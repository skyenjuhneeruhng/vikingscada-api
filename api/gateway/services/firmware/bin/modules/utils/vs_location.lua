---
-- Module Module provides location (GPS)
-- @module vs_location
--

local math = require 'math'
local devicetree = require 'devicetree'
local https = require 'ssl.https'
local ltn12 = require "ltn12"
local vs_global_config = require 'vs_global_config'
local sched  = require 'sched'
local vs_debug = require 'modules.utils.vs_debug' 

local vs_location = {}

local GPS_VARS = {
    'system.gps.latitude',
    'system.gps.longitude',
    'system.gps.fix'
}

local GPS_PASSIVE_VARS = {}

local lstate = {
    gps_fix  = 0;
    
    lat  = 0;
    long = 0;
    
    last_lat  = 0;
    last_long = 0;
    
    control_delta = 10; -- Minimum distance to be a change in position: 100 meters.
    
    need_send_data = 0;
}


local pi_360              = math.pi/360
local pi_180_earth_radius = math.pi/180 * 6.371e6

function vs_location.send_my_location(lat, lng)
	checks('number', 'number')

	-- for json format
	--local reqbody = '{"lat":'..tostring(lat)..', "long":'..tostring(lng)
	--reqbody = reqbody .. '"version": '.. vs_global_config.VS_SW_VERSION..'}'
	
	local reqbody = 'lat='..tostring(lat)..'&long='..tostring(lng)
	reqbody = reqbody ..'&version='.. vs_global_config.VS_SW_VERSION
		
	--local respbody = {} 
	local rb, code, headers, status = https.request {
        method = "PUT",
        url = vs_global_config.VS_CURRENT_LOCATOION_URL,
        source = ltn12.source.string(reqbody),
        headers = { 
                    ["Accept-Language"] = "en-us",
                  	--["Content-Type"] = 'application/json',
                  	["Content-Type"] = 'application/x-www-form-urlencoded',
  					["connection"] = "close",
	                ["content-length"] = string.len(reqbody)
    	 },
     --sink = ltn12.sink.table(respbody)
    }
	print('location send status: ' .. tostring(status))
	--vs_debug.print_table(headers)
	--print_table(respbody)
  return (code == 200)	
end

function vs_location.set_fix()
   lstate.need_send_data = 1
end

local function distance(x1,y1, x2,y2)
    checks('number', 'number', 'number', 'number')
   
   --local x1, x2 = p1.longitude, p2.longitude
   --local y1, y2 = p1.latitude,  p2.latitude
   --local z1, z2 = p1.altitude,  p2.altitude 
    local dx  = (x2-x1) * pi_180_earth_radius * math.cos((y2+y1)*pi_360)
    local dy  = (y2-y1) * pi_180_earth_radius
   -- local dz = z1 and z2 and z2-z1 or 0
   -- assert (dx*dx+dy*dy+dz*dz >= 0)
   
    assert (dx*dx+dy*dy >= 0)
    assert ((dx*dx+dy*dy)^0.5 >= 0)

  return (dx*dx+dy*dy)^0.5
end

local function gps_callback(gpsvalues)
  	local fix = gpsvalues['system.gps.fix'] or lstate.gps_fix
  	lstate.gps_fix = fix
   --  if fix == 1 then 
		-- Get the new GPS position
    	local lat  = gpsvalues['system.gps.latitude']  or lstate.lat
    	local long = gpsvalues['system.gps.longitude'] or lstate.long
    	lstate.lat  = lat
    	lstate.long = long
    	
	-- print('system.gps.fix: '..fix..' state.need_send_data: '..lstate.need_send_data)
	  -- print('lat: '..lat..',  long: '..long)
		
	   --(point1 - point2)
		if distance(lstate.last_long, lstate.last_lat, lstate.long, lstate.lat) > lstate.control_delta or
				(lstate.need_send_data ~= 0)  then
					   	 	
	   	 	lstate.last_long = lstate.long
           	lstate.last_lat = lstate.lat
           	
			if (long~=0) and (lat~=0) then
			   	print('lat: '..lat..',  long: '..long)
             
              --sched.run(function()
                 if vs_location.send_my_location(lstate.lat, lstate.long) then
                 	 lstate.need_send_data = 0
                 end
               --end)
             end  
		end
	--end
end

function vs_location.set_distance_delta(d)
	lstate.control_delta = d
end

function vs_location.init_gps()
	-- Register the callback for fix, latitude and longitute values change.
    -- The date of the fix, the sattelite count are set as passive variables
    -- because we need to display theses values, but not to be notified of their changes.
    -- In our case, it's very useful to avoid to be notified each second by the variable 'system.gps.seconds'
    -- The tracking variables are also set as passive variable, our callback need all theses values.
    -- If we don't add tracking variable to the passive vars, only the var that change will be pass to the callback
    print("init gps")
    assert(devicetree.register(GPS_VARS, gps_callback, GPS_PASSIVE_VARS))
end

function vs_location.get_sw_version()
  local swv_info = devicetree.get("system.sw_info.fw_ver")
	if swv_info ~= nil then return swv_info else return "nil" end
end


return vs_location