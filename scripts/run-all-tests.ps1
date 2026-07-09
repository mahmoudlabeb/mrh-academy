# Run all MRH Academy deliverable tests
# Usage:
#   .\scripts\run-all-tests.ps1
#   $env:BASE_URL="https://mrh-academy-1.vercel.app"; .\scripts\run-all-tests.ps1

param(
  [string]$ApiUrl = $env:API_URL,
  [string]$BaseUrl = $env:BASE_URL
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot

if (-not $ApiUrl) { $ApiUrl = "https://mrh-academy.onrender.com/api/v1" }
if (-not $BaseUrl) { $BaseUrl = "https://mrh-academy-1.vercel.app" }

Write-Host "`n=== Step 1: API smoke tests ===" -ForegroundColor Cyan
& "$Root\scripts\test-api-deliverables.ps1" -ApiUrl $ApiUrl
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "`n=== Step 2: Playwright E2E ===" -ForegroundColor Cyan
Push-Location "$Root\apps\web"
$env:BASE_URL = $BaseUrl
npx playwright test
$playwrightExit = $LASTEXITCODE
Pop-Location
if ($playwrightExit -ne 0) { exit $playwrightExit }

Write-Host "`nAll tests completed successfully!" -ForegroundColor Green
