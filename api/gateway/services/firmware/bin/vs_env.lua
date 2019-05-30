---
-- Module that provide common environment configuration, variables and methods for Viking Scada application
-- @module vs_env
--

local os    = require("os")
local lfs   = require("lfs")
local vs_fs = require("modules.utils.vs_file_system")
local vs_system = require("modules.utils.vs_system")
local vs_string = require("modules.utils.vs_string")
local json = require("modules.utils.json")

local vs_debug = require("modules.utils.vs_debug")
local string = require("string")

local vs_env = {}

vs_env_config = {}

local certs_dir_name   = "certs"
local config_dir_name = "config"

--
-- Current working directory
--
vs_env.ROOT_DIR = os.getenv("PWD")

--
-- Path to certificate\key files
--
vs_env.CERTS_DIR = vs_env.ROOT_DIR .. "/" .. certs_dir_name

--
-- Path to environment configuration files
--
vs_env.CONFIG_DIR = vs_env.ROOT_DIR .. "/" .. config_dir_name

--
-- Table which holds coinfiguration for Gateway.
--
vs_env_config.gateway_config = {
	name = nil,          -- String: Viking Scada Gateway global name.
	global_id = nil,     -- String: holds the global id for this particular Viking Scada Gateway
	site_id = nil        -- String: which represents an unique ID for Site
}

--
-- Table: holds credentials for secure connection to IoT server, certificates files and keys.
--
vs_env_config.conn_credential = {
	certs_url = nil,
	ca_file = nil,
	cert_file = nil,
	key_file = nil
}

--
-- Table which contain coonfiguration for IoT client.
--
vs_env_config.mqtt = {
	host = "127.0.0.1",
	port = 1883,
	secure = false
}

-- Table holds configuration for each connected PLS which is connected  to this gateway (RV50).
-- Each device(PLC) holds registers mapping, each register(address) represent a sensor.  
vs_env_config.devices = {}

--
-- Create an environment if not exist.
--
local function make_environment()
	if vs_fs.exist(vs_env.CERT_DIR) == false then lfs.mkdir(vs_env.CERTS_DIR) end
	if vs_fs.exist(vs_env.CERT_DIR) == false then lfs.mkdir(vs_env.CONFIG_DIR) end
end

-- 
-- Get root certificate absolute file path.
-- This method must return path to rootCA file, without know real name, which is obtained from Viking Backend.
-- return: absolute path to root certificate file, or nil if not exist.
--
function vs_env.get_root_ca_file_path()
	local cafn = vs_env.CERTS_DIR .. '/' .. vs_env_config.conn_credential.ca_file
	local file_name = vs_system.call('ls ' .. cafn, false)
	if file_name ~= nil then
		--if vs_fs.exist(file_name) == true then 
		return file_name --end
	end
	return nil
end

--
-- Get absolute certificate file path, an extension of file must be *.pem.crt
-- return: absolute file path if exist otherwise nil 
--
function vs_env.get_cert_file_path()
	local cfn = vs_env.CERTS_DIR .. '/' .. vs_env_config.conn_credential.cert_file
	local file_name = vs_system.call('ls ' .. cfn , false)
	if file_name ~= nil then
		--if vs_fs.exist(file_name) == true then 
		return file_name --end
	end
	return nil
end

--
-- Get absolute file path to private key, an extension of file must be *.pem.key
-- return: absolute file path if exist otherwise nil 
--
function vs_env.get_private_key_file_path()
	--	local file_name = vs_system.call('ls ' .. vs_env.CERTS_DIR .. '/*.pem.key', false)
	local kfn = vs_env.CERTS_DIR .. '/' .. vs_env_config.conn_credential.key_file
	local file_name = vs_system.call('ls ' .. kfn, false)
	if file_name ~= nil then
		--if vs_fs.exist(file_name) == true then 
		return file_name --end
	end
	return nil
end

--
--
--
function check_json(jstr)
	local str= string.match(jstr, "^()%s*$") and "" or string.match(jstr, "^%s*(.*%S)")
	if string.sub(str, 1, 1) == "{" and string.sub(str, #str, #str) == "}" then
		return true
	end
	return false
end
--
--
--
function vs_env.init_env_from_json(config_json_file_path)
	local json_str = vs_fs.read_all(config_json_file_path)

	if json_str == nil then return false end
	if not check_json(json_str) then
		log("VS_ENV", "WARNING", "@@@@@ [vs_env.init_env_from_json] -> Invalid json.")
		print("Invalid json.")
		return false
	end

	--print(json_str)

	local conf_table = assert(json.decode(json_str))

	-- Initialize common gateway configuration variables
	vs_env_config.gateway_config.name = conf_table['name']
	vs_env_config.gateway_config.global_id = conf_table['global_id']
	vs_env_config.gateway_config.site_id = conf_table['site_id']

	-- Initialize credentials object
	vs_env_config.conn_credential.certs_url = conf_table['credentials']['certs_url']

	vs_env_config.conn_credential.ca_file =   'rootCA.pem' 			--conf_table['credentials']['ca_file']
	vs_env_config.conn_credential.cert_file = 'certificate.pem.crt' --conf_table['credentials']['cert_file']
	vs_env_config.conn_credential.key_file =  'private.pem.key' 	--conf_table['credentials']['key_file']

	-- Initialise MQTT configuration object
	--vs_env_config.mqtt = conf_table['mqtt']['credentials']

	-- Initialise table of devices (PLC)
	vs_env_config.devices = conf_table['devices']


	--	print(' - Print table: vs_env_config.gateway_config')
	--	vs_debug.print_table(vs_env_config.gateway_config)
	--	print(' - Print table: vs_env_config.conn_credential')
	--	vs_debug.print_table(vs_env_config.conn_credential)
	--	print(' - Print table: vs_env_config.mqtt')
	--	vs_debug.print_table(vs_env_config.mqtt)
	--	vs_debug.print_table(vs_env_config.devices)

	return true
end
--
-- Prepare environment.
--
make_environment()

return vs_env