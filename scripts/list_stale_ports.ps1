$ErrorActionPreference = "SilentlyContinue"
$ports = Get-NetTCPConnection -State Listen | Where-Object { $_.LocalAddress -eq "127.0.0.1" -or $_.LocalAddress -eq "0.0.0.0" }
$stale_processes = @()

foreach ($port in $ports) {
    try {
        $proc = Get-Process -Id $port.OwningProcess
        if ($proc) {
            $is_dev = ($proc.ProcessName -match "node|python|java|uvicorn|flask|django|react|next|http-server") -or ($port.LocalPort -gt 1024)
            if ($is_dev) {
                $stale_processes += [PSCustomObject]@{
                    Port = $port.LocalPort
                    PID = $port.OwningProcess
                    Name = $proc.ProcessName
                    Path = $proc.Path
                }
            }
        }
    } catch {}
}

$stale_processes | Sort-Object Port | Format-Table -AutoSize
