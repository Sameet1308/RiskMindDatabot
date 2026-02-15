$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$backend = Join-Path $root 'backend'
$py = Join-Path $backend '.python\python\tools\python.exe'

if (!(Test-Path $py)) { throw "Portable Python not found at $py" }

Set-Location $backend

if (!(Test-Path .\venv)) {
  & $py -m venv venv
  .\venv\Scripts\Activate.ps1
  python -m pip install -r requirements.txt
} else {
  .\venv\Scripts\Activate.ps1
}

python -m uvicorn main:app --reload --port 8000
