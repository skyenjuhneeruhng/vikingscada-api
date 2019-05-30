---
-- Module that provide helper functions for http\s communication.
-- @module http_client
--
--local http = require("socket.http")
local https = require("ssl.https")
local mime = require("mime")
local io = require("io")
local os = require 'os'
local vs_env = require 'vs_env'
local vs_string = require 'modules.utils.vs_string'
local vs_system = require 'modules.utils.vs_system'
local vs_file_system = require 'modules.utils.vs_file_system'
local log = require "log"


local vs_http_client = {}
local LOG = 'vs_http_client'

https.TIMEOUT = 10

--
-- Private: Print HTTP\S header, only for the DEBUG reason.
--
local function print_header(header)
	if header == nil then return end
	print("--------------------------------------------------")
	print("DEBUG INFO: Print response header:")
	for k, v in pairs(header) do
		print(k .. " : " .. v)
	end
	print("--------------------------------------------------")
end

--
-- Make http request.
-- url - url path to resources
-- return: b - response body, if exist, c - status code
--
function vs_http_client.get(url, header)	
	print(LOG .. "INFO get: url -> " .. vs_string.nil_str(url))
	if type(url) ~= "string" then
	    log(LOG, "ERROR", "get: -> Incorrect URL")
		return nil, 404 
	else
		log(LOG, "INFO", "get: -> " .. url)
	end
	
	-- body, code, headers, status = https.request("https://www.site.com.br")
	local b, c, h, s
	if header == nil then
		b, c, h, s = https.request(url);
	else
		b, c, h, s = https.request(url, header)
	end
	--print(b)
	
	if c ~= 200 then
	    print(LOG .. " ERROR response from server " .. vs_string.nil_str(c))  
		return nil, c 
	end
--	print_header(h)
	return b, c
end

--
-- Request a file fron given url and return path to downloaded file.
-- url  - url to downloaded file
-- path - dir path in file system where downloaded file will be stored
-- return: absolute file path to downloaded file
--
function vs_http_client.request_file(url, destination_directory, file_name)
    print(LOG .. " INFO request_file: -> " .. url)
    if type(destination_directory) ~= "string" then destination_directory = vs_env.ROOT_DIR end
    if string.sub(destination_directory, -1) ~= "/" then destination_directory = destination_directory .. "/" end
    
    -- body, code, headers, status = https.request("https://www.site.com")
    local b, c, h, s = https.request(url)  
    -- print_header(h)
  
    -- check response status code.
    if c ~= 200 then return b, c end
    
 	-- local cont_dist = h['content-disposition']
 	-- local file_name = 'device_config.json' --vs_string.split(vs_string.split(cont_dist, ";")[2], "=")[2]
    local abs_file_path = destination_directory .. file_name
    print("http_client.request_file: -> " .. abs_file_path) 

    if vs_file_system.exist(abs_file_path) then
    	os.execute('rm ' .. abs_file_path)
    end
    
    -- Save content to file.
    local file = io.open(abs_file_path, "a")
    file:write(b)
    file:flush()
    file:close()
    
    -- Check if MD5 it exist in response header <Content-MD5>
    local md5 = h['content-md5']
    if type(md5) ~= "string" then 
    	md5 = h['Content-MD5']
    end
   
    -- Compare MD5 if exist, obtain md5 hash sum for file and compare with md5 from response header. 
    -- If MD5 does not exist in the header we do not make any comparation.
    if type(md5) == "string" then
		local cmd = 'md5sum ' .. abs_file_path
    	local fmd5 = vs_string.split(vs_system.call(cmd, false), " ")[1]
    	if fmd5 ~= md5 then
    		return nil, 400
    	end
    end

    return abs_file_path, c
end

return vs_http_client