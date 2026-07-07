# Deploy divulga-top to Vercel production
# First time: browser opens for login. Or set $env:VERCEL_TOKEN from https://vercel.com/account/tokens

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$nodeDir = Join-Path $PSScriptRoot ".tools\node-v20.19.0-win-x64"
if (Test-Path $nodeDir) {
  $env:PATH = "$nodeDir;$env:PATH"
}

Write-Host "`n=== Deploy divulga-top to Vercel ===" -ForegroundColor Cyan
npx vercel deploy --prod --yes
Write-Host "`nDone. Check: https://divulga-top.vercel.app/api/health" -ForegroundColor Green
