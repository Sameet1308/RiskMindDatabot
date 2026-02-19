Get-CimInstance Win32_Process | Where-Object { $_.Name -match "python|node" } | Select-Object ProcessId, CommandLine | Format-Table -AutoSize
