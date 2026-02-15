$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$frontend = Join-Path $root 'frontend'

Set-Location $frontend

if (!(Test-Path .\node_modules)) {
  npm install
}

npm run dev
