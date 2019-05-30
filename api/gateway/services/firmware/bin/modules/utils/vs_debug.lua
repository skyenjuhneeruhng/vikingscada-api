---
-- Module Debug provides helper functions for debug reason.
-- The functions in this module should not return any values.
-- 
-- @module vs_debug
--
local vs_debug = {}

function vs_debug.print_table(table) 
    print('--------------------------------------------------------------------')
	print("vs_debug INFO: PRINT TABLE:")
	if table == nil then print('vs_debug WARNING: table is nil') return end
	if not indent then indent = 0 end
	for k, v in pairs(table) do
		local formatting = string.rep("  ", indent) .. k .. ": "
		if type(v) == "table" then
			print(formatting)
			vs_debug.print_table(v, indent+1)
		elseif type(v) == 'boolean' then
			print(formatting .. tostring(v))      
		else
			print(formatting .. v)
		end
	end
	print('--------------------------------------------------------------------')
end

return vs_debug