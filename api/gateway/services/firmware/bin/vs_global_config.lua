-- Module that provide global configuration for Viking Scada Rest Client,
-- IoT client etc.
-- 
-- @module global_config
--

local vs_global_config = {}

vs_global_config.VS_SW_VERSION = '0.0.2.8'

--
-- Device unique ID, obtained from viking backend
--
vs_global_config.VS_UUID = "<%= UUID %>"

--
-- Device name
--
vs_global_config.VS_DEVICE_NAME = "<%= DEVICE_NAME %>"

--
-- IoT thing name, this name will use for mqtt broker
--
vs_global_config.VS_THING_NAME = "<%= THING_NAME %>"

--
-- Base Url for Viking Scada backend
--
vs_global_config.VS_BASE_URL = "<%= BASE_URL %>" 

--
-- Authentication URL 
--
vs_global_config.VS_AUTH_URL = "<%= AUTH_URL %>"

--
-- Url for downloading archived certificates and keys for secure connection. 
--
vs_global_config.VS_CERTS_TAR = "<%= IOT_CREDENTIALS %>"

--
-- Url path to Viking Scada Device configuration JSON
--
vs_global_config.VS_DEVICE_CONFIG_URL = "<%= DEVICE_CONFIG_URL %>"

--
-- Geo location url
--
vs_global_config.VS_CURRENT_LOCATOION_URL = "<%= CURRENT_LOCATION_URL %>"

--
-- Url to send information about used traffic
--
vs_global_config.VS_USED_TRAFFIC_URL = "<%= VS_USED_TRAFFIC_URL %>"

--
-- MQTT Credentials 
-- ------------------------
vs_global_config.VS_MQTT_BROKER_URL = "<%= MQTT_BROKER_URL %>"
vs_global_config.VS_MQTT_BASE_TOPIC = "<%= MQTT_BASE_TOPIC %>"


return vs_global_config