$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$all = Join-Path $root 'scripts\run-all.ps1'

& $all
