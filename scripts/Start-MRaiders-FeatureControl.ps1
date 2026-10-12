#requires -Version 7
[CmdletBinding()]
param([int]$Port=8765,[switch]$NoBrowser)
$ErrorActionPreference='Stop'
$root=(Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root
if(-not(Get-Command python -ErrorAction SilentlyContinue)){throw 'Python 3.11+ required'}
& gh auth status *> $null
if($LASTEXITCODE -ne 0){throw 'Run gh auth login -h github.com --web -s repo,project,workflow'}
if(-not $NoBrowser){Start-Process "http://127.0.0.1:$Port/"}
python -m tools.feature_control.server --port $Port
