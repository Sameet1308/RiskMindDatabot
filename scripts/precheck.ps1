$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'
$py = Join-Path $backend '.python\python\tools\python.exe'
$venvPy = Join-Path $backend 'venv\Scripts\python.exe'
$envFile = Join-Path $backend '.env'

Write-Host '== RiskMind Precheck ==' -ForegroundColor Cyan

if (!(Test-Path $backend)) { throw "Backend folder not found: $backend" }
if (!(Test-Path $frontend)) { throw "Frontend folder not found: $frontend" }

if (Test-Path $py) {
  Write-Host "Portable Python: OK ($py)"
} else {
  Write-Host "Portable Python: MISSING ($py)" -ForegroundColor Yellow
}

if (Test-Path $venvPy) {
  Write-Host "Backend venv: OK"
} else {
  Write-Host "Backend venv: MISSING" -ForegroundColor Yellow
}

if (Test-Path $envFile) {
  Write-Host "Backend .env: OK"
} else {
  Write-Host "Backend .env: MISSING" -ForegroundColor Yellow
}

try {
  node --version | Out-Null
  npm --version | Out-Null
  Write-Host "Node/NPM: OK"
} catch {
  Write-Host "Node/NPM: MISSING" -ForegroundColor Yellow
}

Write-Host "Precheck complete." -ForegroundColor Green
