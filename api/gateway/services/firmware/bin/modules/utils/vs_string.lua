---
-- Module Module provides helper functions for work with strings in lua
-- @module vs_string
--

local vs_string = {}

--
-- Split the string separated by pattern into appropriate table where key will be 1..n
-- return table
--
function vs_string.split(pString, pPattern)
   local Table = {}  -- NOTE: use {n = 0} in Lua-5.0
   local fpat = "(.-)" .. pPattern
   local last_end = 1
   local s, e, cap = pString:find(fpat, 1)
   while s do
      if s ~= 1 or cap ~= "" then
     table.insert(Table,cap)
      end
      last_end = e+1
      s, e, cap = pString:find(fpat, last_end)
   end
   if last_end <= #pString then
      cap = pString:sub(last_end)
      table.insert(Table, cap)
   end
   return Table
end

--
-- Remove extension from file path if exist
--
function vs_file_remove_extension(file_path)
end

--
--
--
function vs_string.nil_str(value)
	if value ~= nil then return value else return "nil" end
end

return vs_string
