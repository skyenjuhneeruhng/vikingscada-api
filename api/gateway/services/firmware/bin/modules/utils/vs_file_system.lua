---
-- Module that provide helper functions for working with file system on the target platform
-- @module vs_file_system
--
local os = require("os")

local vs_file_system = {}

--
-- Check if file or path exist in file system.
--
function vs_file_system.exist(path)
    if type(path) ~= "string" then return false end
    return os.rename(path, path) and true or false
end

--
-- Unpack tar.gz archive
--
function vs_file_system.tar_unpack(tar_file_abs_path, target_dir)
	local status = os.execute('tar -xvf' .. tar_file_abs_path..' -C '..target_dir) -- xopf
	if status == 0 then -- no errors
	  return
	else
	  os.execute('tar -xvzf' .. tar_file_abs_path..' -C '..target_dir)
	  print("gzip archive")
	end
	--os.execute('tar -xvf ' .. tar_file_abs_path)
end

--
-- Read content of text file.
--
function vs_file_system.read_all(file_path)
    local f = assert(io.open(file_path, "rb"))
    local content = f:read("*all")
    f:close()
    return content
end

return vs_file_system