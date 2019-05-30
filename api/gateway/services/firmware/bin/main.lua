local os = require 'os'
local sched = require 'sched'
local log = require "log"
local io = require 'io'
local devicetree = require 'devicetree'
local timer = require 'timer'
-- Local modules
local vs_rest_client = require 'modules.scada.vs_rest_client'
local vs_global_config = require 'vs_global_config'
local vs_env = require 'vs_env'
local vs_string = require 'modules.utils.vs_string'
local vs_plc_sampler = require 'modules.scada.vs_plc_sampler'
local json = require ("modules.utils.json")
local vs_debug = require 'modules.utils.vs_debug' 
local location = require 'modules.utils.vs_location' 
local vs_file_system = require 'modules.utils.vs_file_system'
local MQTT = require 'modules.mqtt_client.mqtt_library'

-- STATUSES --
--local STATUS_VS_AUTH 	= false
--local STATUS_VS_CONFIG  = false
--local STATUS_MQTT_CONNECTING  = false

local mqtt_client = nil
local mqtt_task = nil

IOT_CONNECTING_LOCK = false
CELLULAR_SATE_REDY = false
IOT_CLIENT_RUN = false

local used_traffic = {
	rcvd_bytes = 0,
	sent_bytes = 0
}

local LOG = 'MAIN'

--
-- Handle disconnection event form MQTT module
--
function mqtt_on_disconenct()
	print('--- Disconnect MQTT client')
	log(LOG, "WARNING", "@@@@@ [iot_client_connect] -> mqtt client disconnected.")
	mqtt_client = nil
	sched.gc() -- ???
	--IOT_CONNECTING_LOCK = false
	if CELLULAR_SATE_REDY then
		timer.once(5, iot_client_connect, nil)
		print(LOG .. " IOT Client reconnect...")
	end
end

--
-- Mqtt message callback handler.
--
function mqtt_msg_callback(topic, message)
	if topic == nil or message == nil then topic = '' end

	if message == 'restart' then	
		print('---------------- restart ----------------')	
		log(LOG, "WARNING", "@@@@@ [mqtt_msg_callback] -> Soft Restart!")
		for k, v in pairs(vs_plc_sampler.sampler_tasks) do
			sched.kill(v)
		end	
		vs_plc_sampler.sampler_tasks = {}
		sched.gc() -- ?

		init_configuration()

		if IOT_CLIENT_RUN == false then
			iot_client_connect()
		end

		initialize_sampling()

		--	print(location.send_my_location(0, 0))
	else 
		print(message)
		local cmd_table = assert(json.decode(message))

		if cmd_table['cmd'] == 'write' then 
			-- Parse JSON object Args:
			--vs_plc_sampler.write_data(cmd_table['device_id'], cmd_table);

			for k, v in pairs(vs_env_config.devices) do
				if v._id == cmd_table['device_id'] then

					sched.run(function() --v, cmd_table
						-- Write to device
						print('CMD[write] sensor id: '..tostring(v._id) ..
						', reg_addr: '..cmd_table['address']..', register_data: '..cmd_table['data'])

						vs_plc_sampler.write_data(v, cmd_table);
					end)
					break
				end
			end
		elseif cmd_table['cmd'] == 'restart' then
		-- 
		end
	end 
end

--
-- Mqtt client connect.
--
function iot_client_connect()

	if IOT_CONNECTING_LOCK then	
		log(LOG, "WARNING", "@@@@@ [iot_client_connect] -> connect collision.")
		return
	end

	IOT_CONNECTING_LOCK = true
	--MQTT.Utility.set_debug(true)
	local command_topic = vs_global_config.VS_MQTT_BASE_TOPIC..'/'..vs_env_config.gateway_config.global_id .. '/command'

	if mqtt_client ~= nil then
		mqtt_client:destroy()
		mqtt_client = nil
	end 

	if mqtt_task ~= nil then
		sched.kill(mqtt_task)
		print(LOG .. '- IOT_CLIENT_CONNECT: KILL mqtt_task!' )
	end

	-- -->
	local conn_in_progress = false 
	while conn_in_progress == false do

		print(LOG .. " IOT Client connect...")
		mqtt_client = MQTT.client.create(vs_global_config.VS_MQTT_BROKER_URL, 8883, mqtt_msg_callback, mqtt_on_disconenct)
		mqtt_client:tls_set(vs_env.get_root_ca_file_path(), vs_env.get_cert_file_path(), vs_env.get_private_key_file_path()) 

		local res = mqtt_client:connect(vs_env_config.gateway_config.global_id)
		if res ~= nil then
			log(LOG, "WARNING", "@@@@@ [mqtt_client:connect] Error= "..tostring(res))
		end

		--print('- Client ID: ' .. vs_env_config.gateway_config.global_id)

		if mqtt_client ~= nil then 
			conn_in_progress = mqtt_client.connected
			--IOT_CONNECTING_LOCK = not mqtt_client.connected

			print('- IOT_CLIENT_CONNECT: mqtt_client.connected= '..tostring(mqtt_client.connected)..
			', IOT_CONNECTING_LOCK= '..tostring(IOT_CONNECTING_LOCK))

			if mqtt_client.connected then
				mqtt_client:subscribe({command_topic})
				print(LOG .. '- Subscribe : ' .. command_topic)
				break
			end
		end
		wait(5) --sched.wait(5)	
	end

	--mqtt_client:publish(command_topic, 'Viking_Scada_RV50: CONNECTED!')
	-- <--
	mqtt_task = sched.run(function()
		-- ----- ?
		log(LOG, "WARNING", "@@@@@ [iot_client_connect] -> Connected to mqtt broker.")
		IOT_CLIENT_RUN = true
		-- Process messages -------
		local error_message = nil
		while (error_message == nil) do 
			if mqtt_client ~= nil then 
				if mqtt_client.connected == true then 
					error_message = mqtt_client:handler()
				end 
			else break end
			wait(1) 
		end

		IOT_CLIENT_RUN = false

		if (error_message == nil) then
			if mqtt_client ~= nil then	
				mqtt_client:unsubscribe({command_topic})
				mqtt_client:destroy()
			end
			if CELLULAR_SATE_REDY then
				--print(LOG .. " IOT Client reconnect... (in sched)")
				timer.once(5, iot_client_connect, nil)
			end
		else
			print(LOG .. ' ' .. error_message)
		end

		IOT_CONNECTING_LOCK = false
		print(LOG .. '---- Live: iot_client_connect')
		log(LOG, "WARNING", "@@@@@ [iot_client_connect] -> exit of mqtt thread!")
		sched.killSelf()
		sched.gc() -- ???
	end)
end

--
-- Initialize gateway configuration
-- Download configuration for gateway from viking backend
--
function init_configuration() 
	local c, b = nil
	local d = false

	while d ~= true do
		log(LOG, "WARNING", "@@@@@ [init_configuration] -> Download configuration JSON.")
		STATUS_VS_CONFIG, b, c = vs_rest_client.get_config()
		while STATUS_VS_CONFIG == false do
			log(LOG, "ERROR", "failed when download configuration JSON, error code: " .. vs_string.nil_str(c) .. ", msg: " .. vs_string.nil_str(b) .. ", restart in 5 seconds ...")
			print(LOG .. " ERROR failed when download configuration JSON, error code: " .. vs_string.nil_str(c) .. ", msg: " .. vs_string.nil_str(b) .. ", restart in 5 seconds ...")
			STATUS_VS_CONFIG, b, c = vs_rest_client.get_config()
			wait(5)
			-- sched.wait(5)
		end

		if vs_env.init_env_from_json(b) then
			log(LOG, "WARNING", "@@@@@ [init_configuration] -> Download SSL certs.")
			d = vs_rest_client.download_certs()
		else
			wait(8)
		end
	end	

	print(LOG .. " INFO Download certifiates success!")	

--		print(vs_env.ROOT_DIR)
--		print(os.execute('ls -l '.. vs_env.ROOT_DIR))
--		print(vs_env.ROOT_DIR..'/certs')
--		print(os.execute('ls -l '.. vs_env.ROOT_DIR..'/certs'))

	print(location.send_my_location(0, 0))
	location.set_fix()
end

--
-- Initialise Sensors:
--
function initialize_sampling() 
	print(LOG .. ' ---- Initialize sampling...')
	vs_plc_sampler.init(function(sensor, value)
		-- print('Sampling callback: ' .. value)
		if mqtt_client ~= nil then
			if mqtt_client.connected == true then
				local topic = vs_global_config.VS_MQTT_BASE_TOPIC..'/'..sensor['id']..'/sensor/data'
				print(LOG .. ' TOPIC:' .. topic .. " " .. value)

				if mqtt_client:publish(topic, value) ~= true then
				-- 	print('---------------  err reconnect MQTT client')
				--log(LOG, "WARNING", "MQTT Publish error: (reconect to broker!)")
				--mqtt_client:destroy()
				--mqtt_client = nil
				--sched.gc()
				--IOT_CONNECTING_LOCK = false
				--iot_client_connect()
				end
			end
		end
	end)
	-- Initialise sensors from configurration json
	for k, v in pairs(vs_env_config.devices) do
		print(k ..' - Init Device: ' .. v['id'])
		if v['sensors'] ~= nil then
			for sk, sv in pairs(v['sensors']) do
				vs_plc_sampler.add_sensor(sv, v)
			end
		end
	end
end

--
-- Cellular net status callback
--
local function net_state_callback(values)

	log(LOG, "WARNING","@@@@@@@@ -- system.aleos.cellular.state: %s",
		values['system.aleos.cellular.state'])
	--log(LOG, "WARNING","@@@@@@@@ -- system.cellular.link.state: %s", 
	--	devicetree.get('system.cellular.link.state'))	

	if values['system.aleos.cellular.state'] ~= nil and 
	   values['system.aleos.cellular.state'] == 'Network Link Down' then

		print('---- info---- mobile network is down (')
		CELLULAR_SATE_REDY = false
		if mqtt_client ~= nil then
			mqtt_client:destroy()
		end 
	elseif values['system.aleos.cellular.state'] ~= nil and 
		   values['system.aleos.cellular.state'] == 'Network Ready' then
		--init_configuration() ----???
		print('---- info ----  Network Ready :)')
		CELLULAR_SATE_REDY = true
		--IOT_CONNECTING_LOCK = IOT_CLIENT_RUN
		iot_client_connect()
	end
end

--
-- Send current used traffic
--
local function check_timer_callback()
--[[	local rcvd_bytes = devicetree.get('system.cellular.link.bytes_rcvd') or 0 
	local sent_bytes = devicetree.get('system.cellular.link.bytes_sent') or 0

	local curren_traffic = 'sent='..tostring(sent_bytes - used_traffic.sent_bytes)..
						   '&rcvd='..tostring(rcvd_bytes - used_traffic.rcvd_bytes)
	print(curren_traffic)	
	print(tostring(vs_rest_client.put(vs_global_config.VS_USED_TRAFFIC_URL, curren_traffic))) ]]
	
end

--
-- Main function: Application flow after start RV50
-- 1. Auth device with UUID on Viking backend
-- 2. Request device configuration from Viking backend
-- 3. Request device certificates and keys for secure connection.
-- 4. Initialize MQTT client. 
-- 5. Init sensors and start sampling process.
-- 6. Strart sampling process
--

local function main ()
	log.setlevel('WARNING')
	-- 1541610566 -- 11/7/2018, 7:09:26 PM

	local utime = tonumber(os.time())
	local uttry = 40

	while utime < 1541610566 and uttry > 0 do 
		print(utime)
		utime = tonumber(os.time())
		uttry = uttry - 1
		sched.wait(5)
	end

	assert(devicetree.init())

	sched.wait(5)

	--used_traffic.sent_bytes=devicetree.get('system.cellular.link.bytes_rcvd') or 0 
	--used_traffic.rcvd_bytes=devicetree.get('system.cellular.link.bytes_sent') or 0
	
	--
	-- 1. Client Auth. Authentication on Viking Scada backend using UUID of the client (RV50)
	-- 
	local c, b = nil
	STATUS_VS_AUTH, c, b = vs_rest_client.auth(vs_global_config.VS_UUID)
	while STATUS_VS_AUTH == false do
		log(LOG, "ERROR", "Authentication failed, error: " .. vs_string.nil_str(c) ..  ", restart in 60 seconds ...")
		print(LOG .. ": ERROR Authentication failed, error: " .. vs_string.nil_str(c) ..  ", restart in 60 seconds ...")
		STATUS_VS_AUTH, b, c = vs_rest_client.auth(vs_global_config.VS_UUID)
		wait(60)
		-- sched.wait(5)
	end
	--log(LOG, "WARNING", "Successfully authenticate on Viking Backend: code -> %s", c)
	--print(LOG .. ': INFO Successfully authenticate on Viking Backend: code -> ' .. c .. ', auth status ->', STATUS_VS_AUTH)
	CELLULAR_SATE_REDY = true
	--	
	-- 2. Download Gateway configuration JSON file from Viking Backend
	--
	init_configuration()

	-- 3. Dowbnload necessary files (resources) for client.
	--    Download certificates archive from backend	 
	--	vs_rest_client.download_certs()
	-- 4. Initialise IoT(MQTT) client

	iot_client_connect()

	while mqtt_client.connected == false do 
		wait(2)
		print("mqtt try connect")
	end

	-- 5 Init sensors and start sampling process
	initialize_sampling() 

	-- 6 
	print("-- INFO --".."Start listening Cellular Service variables")
	local cellularvariables = { 'system.aleos.cellular.state' }
	--local cellular_state =
	assert (devicetree.register(cellularvariables, net_state_callback))
	log(LOG, "WARNING", "@@@@@ Successfully authenticate on Viking Backend. Start sensor pooling ...")
	--devicetree.unregister (cellular_state)

	--timer.periodic(60 * 30, check_timer_callback)
	
	location.init_gps()
end

sched.run(main)
sched.loop()

