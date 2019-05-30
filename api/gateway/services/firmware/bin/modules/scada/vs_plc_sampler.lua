
local modbus = require 'modbus'
local sched  = require 'sched'
local socket = require 'socket'
local bit32 =  require 'bit32'
local log = require 'log'

local vs_debug = require 'modules.utils.vs_debug'
local vs_string = require 'modules.utils.vs_string'

local LOG = 'PLC_SAMPLER'

local serial_port_config = {
	baudRate = 9600,
	numDataBits = 8,
	parity = "none",
	numStopBits = 1,
	flowControl = "none",
	timeout = 15	
}

local VSPlcSampler = {}

VSPlcSampler.sampler_tasks = {}

VSPlcSampler.modbusDevice = nil;

VSPlcSampler.callback = nil

-- Private
local function read_holding()
end

local function read_coils()
end

local function read_discrete() 
end

local function read_input()
end

-- Public
function VSPlcSampler.init(callback)
	VSPlcSampler.modbusDevice = modbus.new('/dev/ttyS0',serial_port_config,'RTU')
	VSPlcSampler.callback = callback
end

function VSPlcSampler.add_sensor(sensor, device)
	if sensor['id'] ~= nil then
		print(LOG .. ' Start Sampling Task SENSOR id : ' .. sensor['id'])		
		local task = sched.run(function()

			local data_size = tonumber(sensor['modbus_data_size_bytes'])
			local data_type = string.lower(sensor['modbus_data_type'])
			local addr = sensor['modbus_register_address']
			local multiplier = 1-- sensor['value_multiplier']
			local sampling_interval_s = sensor['sampling_internal_ms'] / 1000
			local register_type = sensor['modbus_register_type']

			local delta = sampling_interval_s

			local modbus_id = 1
			if device ~= nil then modbus_id = tonumber(device['modbus_id']) end

		    print(LOG .. ' Addres: ' .. addr .. ", data size: " .. data_size .. ", multiplier: " .. multiplier)
			while true do
				local start_time = socket.gettime()
				local data = nil
				local number_of_inputs = data_size / 2
				if string.lower(register_type) == 'holding' then
					local addr_inc = 0
					while number_of_inputs > 0 do
						local value = VSPlcSampler.modbusDevice:readHoldingRegisters(modbus_id, addr + addr_inc, 1)
						if data == nil then data = value else data = data .. value end
						number_of_inputs = number_of_inputs - 1
						addr_inc = addr_inc + 1
					end
				elseif string.lower(register_type) == 'coils' then
					local addr_inc = 0
					while number_of_inputs > 0 do
						local value = VSPlcSampler.modbusDevice:readCoils(modbus_id, addr + addr_inc, 1)
						if data == nil then data = value else data = data .. value end
						number_of_inputs = number_of_inputs - 1
						addr_inc = addr_inc + 1
					end
				elseif string.lower(register_type) == 'discrete' then
					local addr_inc = 0
					while number_of_inputs > 0 do
						local value = VSPlcSampler.modbusDevice:readDiscreteInputs(modbus_id, addr + addr_inc, 1)
						if data == nil then data = value else data = data .. value end
						number_of_inputs = number_of_inputs - 1
						addr_inc = addr_inc + 1
					end
				elseif string.lower(register_type) == 'input' then 
					local addr_inc = 0
					while number_of_inputs > 0 do
						local value = VSPlcSampler.modbusDevice:readInputRegisters(modbus_id, addr + addr_inc, 1)
						if data == nil then data = value else data = data .. value end
						number_of_inputs = number_of_inputs - 1
						addr_inc = addr_inc + 1
					end
				end
				
				if data ~= nil then
					if data_type == 'int' then
						local _, v = string.unpack(data,"H")
						if VSPlcSampler.callback ~= nil then
							if v ~= nil then VSPlcSampler.callback(sensor, (v * multiplier)) end
						end
					elseif data_type == 'float' then
						local _, v = string.unpack(data,"f")
						if VSPlcSampler.callback ~= nil then
							if v ~= nil then VSPlcSampler.callback(sensor, (v * multiplier)) end
						end
					elseif data_type == 'double' then
						local _, v = string.unpack(data,"d")
						if VSPlcSampler.callback ~= nil then
							if v ~= nil then VSPlcSampler.callback(sensor, (v * multiplier)) end
						end
					end
				end
				
				delta = socket.gettime() - start_time
				if delta >= sampling_interval_s then
					 wait()
				else
					 wait(sampling_interval_s - delta) 
				end
			end
		end)
		
		VSPlcSampler.sampler_tasks[sensor['id']] = task
	else
		log(LOG, 'WARNING', 'Invalid sensor id')
	end
end

--
--
function VSPlcSampler.write_data(device, cmd_tab)
	local modbus_id = 1
	if device ~= nil then modbus_id = tonumber(device['modbus_id']) end
	
	if cmd_tab ~= nil then
		if cmd_tab['reg_type'] == 'holding' then
			local modbus_reg_addr = cmd_tab['address']
			local modbus_reg_data = cmd_tab['data']
			
			VSPlcSampler.modbusDevice:writeSingleRegister(modbus_id, modbus_reg_addr, modbus_reg_data)
		end
	end
end

--function VSPlcSampler.close()
--	VSPlcSampler.modbusDevice:close();
--end


return VSPlcSampler
