# Run this once to publish divulga-top to GitHub
# Usage: right-click -> Run with PowerShell

$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "`n=== Divulga Top -> GitHub ===" -ForegroundColor Cyan

# 1. Login (opens browser — takes 30 seconds)
Write-Host "`nStep 1: GitHub login..." -ForegroundColor Yellow
& "C:\Program Files\GitHub CLI\gh.exe" auth login --hostname github.com --git-protocol https --web

# 2. Create repo + push
Write-Host "`nStep 2: Creating repo and pushing..." -ForegroundColor Yellow
& "C:\Program Files\GitHub CLI\gh.exe" repo create divulga-top --public --source=. --remote=origin --push --description "Divulga Top - affiliate offer aggregator (Next.js)"

Write-Host "`nDone! Clone from:" -ForegroundColor Green
Write-Host "https://github.com/JacobTurner0321/divulga-top`n" -ForegroundColor White
