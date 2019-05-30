---
-- Module the provide RV50 system functions
-- @module vs_system
--

local io = require 'io'

local vs_system = {}

--
-- Capture response from sys call an returrn result.
-- command - string, shell command
-- as_raw_data - bool value, if true then return raw data
-- return: string
--
function vs_system.call(command, as_raw_data)
	-- print('- vs_system.call: command -> ' .. command)
	f = assert(io.popen(command, 'r'))
	s = assert(f:read('*a'))
	if s == nill then s = '' end
	f:close()
	if as_raw_data then return s end
	s = string.gsub(s, '^%s+', '')
	s = string.gsub(s, '%s+$', '')
	s = string.gsub(s, '[\n\r]+', ' ')
	return s
end

return vs_system

