$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$precheck = Join-Path $PSScriptRoot 'precheck.ps1'
$backend = Join-Path $PSScriptRoot 'run-backend.ps1'
$frontend = Join-Path $PSScriptRoot 'run-frontend.ps1'

& $precheck

Start-Process -FilePath powershell -ArgumentList "-NoExit", "-Command", "& '$backend'"
Start-Process -FilePath powershell -ArgumentList "-NoExit", "-Command", "& '$frontend'"

Write-Host 'Started backend and frontend in separate terminals.' -ForegroundColor Green
