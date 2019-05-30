---
-- Module the provide functionality for communication with Viking Scada backend server.
-- @module vs_rest_client
--

local vs_env = require 'vs_env'
local vs_global_config = require 'vs_global_config'
local vs_http_client = require 'modules.network.vs_http_client'
local vs_file_system = require 'modules.utils.vs_file_system'
local ltn12 = require "ltn12"
local https = require 'ssl.https'
local io = require 'io'

local log = require 'log'
local LOG = 'VS_REST_CLIENT'

local VSRestClient = {}
VSRestClient.auth_callback = nil

--
-- Request Device authentication on Viking Scada Backend
--
function VSRestClient.auth(device_uuid, callback)
	print(LOG .. ' INFO auth: dev_uuid -> ' .. device_uuid)
	if type(device_uuid) ~= "string" then 
		return false, nil, nil
	end
	
	-- Make Http request for client authentication
	local body, status_code = vs_http_client.get(vs_global_config.VS_AUTH_URL, nil)
	if body == nil then 
		return false, nil, status_code
	end
	return true, body, status_code
end

--
-- Request gateway configuration JSON file, and place it to appropriate directory.
-- A configuration json holds all configs for gateway(RV50) and for connected devices (PLC)
--
function VSRestClient.get_config()
	print(LOG .. ' INFO get_config: url -> ' .. vs_global_config.VS_DEVICE_CONFIG_URL)
	log(LOG, "WARNING", "@@@@@ [get_config json url] -> "..vs_global_config.VS_DEVICE_CONFIG_URL)  --?
	local body, status_code = vs_http_client.request_file(vs_global_config.VS_DEVICE_CONFIG_URL, vs_env.CONFIG_DIR, 'device_config.json')
	if status_code ~= 200 then 
		return false, nil, status_code
	end
	return true, body, status_code
end

--
-- Request download root CA file from Viking Scada Backend
--
--[[
function VSRestClient.download_root_ca()
	print('- VSRestClient.download_root_ca: path -> ' .. vs_env.CERTS_DIR)
	-- Request rootCA file from Viking Scada Backend
	path, status_code = vs_http_client.request_file(vs_global_config.VS_ROOT_CA_URL, vs_env.CERTS_DIR)
	if status_code ~= 200 then return false end
	return true
end
--
-- Request download certificate file from Viking Scada Backend
--
function VSRestClient.download_cert()
	print(' - VSRestClient.download_cert()')
	local path, status_code = vs_http_client.request_file(vs_global_config.VS_CERT_URL, vs_env.CERTS_DIR)
	if status_code ~= 200 then return false end
	print(' 	- path: ' .. path)
	return true
end
--
-- Request to download private key from Viking Scada Backend
--
function VSRestClient.download_private_key()
	print(' - VSRestClient.download_private_key()')
	path, status_code = vs_http_client.request_file(vs_global_config.VS_PRIVATE_KEY_URL, vs_env.CERTS_DIR)
	if status_code ~= 200 then return false end
	print(' 	- path: ' .. path)
	return true
end
]]
-- -----------------------------------------------------------
--[[local function chaeck_enter_symbol(str)
	local c
	local i = 1
	while i <= #str do
		c = string.byte (str, i)
		if c == 92 then
			i = i + 1
			c = string.byte (str, i)
			if c == 110 then
				return true
			end
		end
		i = i + 1
	end
  return false
end]]

--------------------------------------------------------------
local function replace_symbols_and_rewrite_file(fn)
	local s = vs_file_system.read_all(fn)

	local pos = string.find(s, "\\n")
	if pos == nil then
		return
	end
	local str = s:gsub("\\n", "\n")
 --[[ 
 	local str, c = '', ''
	local i = 1
 	if not chaeck_enter_symbol(s) then
    	return
    end
   	while i <= #s do
		c = string.byte (s, i)
		if c == 92 then
			p = c
			i = i + 1
			c = string.byte (s, i)
			if c == 110 then
				str = str..string.char(10)
			else
				str = str..string.char(p)..string.char(c)
			end
		else
			str = str..string.char(c) 
		end
		i = i + 1
	end]]
	-- if vs_file_system.exist(fn) then
	-- 	 os.execute('rm ' .. fn)
	-- end
	
	print(' Modify: '..fn)
	local cert_file = io.open(fn, "w+")
    cert_file:write(str)
    cert_file:flush()
    cert_file:close()
end

--
-- Request to download certificates/keys as archive (tar.gz) from Viking Scada Backend
--
function VSRestClient.download_certs()
--	local path, status_code = vs_http_client.request_file(vs_global_config.VS_CERTS_TAR, vs_env.ROOT_DIR) remove in next commit...
	local path, status_code = vs_http_client.request_file(vs_global_config.VS_CERTS_TAR, vs_env.CERTS_DIR, 'certs.tar')
	
	if status_code ~= 200 then return false end
	print('-- path: ' .. path)
	
	if vs_file_system.exist(path) then
		vs_file_system.tar_unpack(path, vs_env.CERTS_DIR)  --os.getenv("PWD")..'/certs'
		--log(LOG, "INFO", "- VSRestClient.download_certs: path = %s", path)
		
	  -- check and modify certificates
	  replace_symbols_and_rewrite_file(vs_env.get_private_key_file_path())
      replace_symbols_and_rewrite_file(vs_env.get_cert_file_path())
      replace_symbols_and_rewrite_file(vs_env.get_root_ca_file_path())
	
	  return true
	end
  return false
end

function VSRestClient.put(_url, reqbody)
	-- for (application/json)
	--local reqbody = '{"lat":'..tostring(lat)..', "long":'..tostring(lng)
	--reqbody = reqbody .. '"version": '.. vs_global_config.VS_SW_VERSION..'}'
	-- for (application/x-www-form-urlencoded)
	--local reqbody = 'lat='..tostring(lat)..'&long='..tostring(lng)
	--reqbody = reqbody ..'&version='.. vs_global_config.VS_SW_VERSION	
	--local respbody = {} 
	
	local rb, code, headers, status = https.request {
        method = "PUT",
        url = _url,
        source = ltn12.source.string(reqbody),
        headers = { 
			["Accept-Language"] = "en-us",
			--["Content-Type"] = 'application/json',
			["Content-Type"] = 'application/x-www-form-urlencoded',
			["connection"] = "close",
			["content-length"] = string.len(reqbody)
    	 }
     --,sink = ltn12.sink.table(respbody)
    }
    
	--print('location send status: ' .. tostring(status))
	--vs_debug.print_table(headers)
	--print_table(respbody)
  return (code == 200)	
end

return VSRestClient