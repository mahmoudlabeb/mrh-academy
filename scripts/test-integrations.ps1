# MRH Academy — Integration status test (PowerShell)
# Verifies third-party services are configured and reachable.
# Usage:
#   .\scripts\test-integrations.ps1
#   $env:API_URL="https://mrh-academy.onrender.com/api/v1"; .\scripts\test-integrations.ps1

param(
  [string]$ApiUrl = $env:API_URL
)

if (-not $ApiUrl) {
  $ApiUrl = "https://mrh-academy.onrender.com/api/v1"
}

Write-Host "`n=== MRH Academy Integration Test ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl`n"

$passed = 0
$failed = 0

function Test-Endpoint {
  param([string]$Name, [string]$Path, [int[]]$OkStatus = @(200))
  try {
    $res = Invoke-WebRequest -Uri "$ApiUrl$Path" -UseBasicParsing -TimeoutSec 60
    if ($OkStatus -contains $res.StatusCode) {
      Write-Host "[PASS] $Name" -ForegroundColor Green
      $script:passed++
      return ($res.Content | ConvertFrom-Json)
    }
    Write-Host "[FAIL] $Name - HTTP $($res.StatusCode)" -ForegroundColor Red
    $script:failed++
  } catch {
    Write-Host "[FAIL] $Name - $($_.Exception.Message)" -ForegroundColor Red
    $script:failed++
  }
  return $null
}

$health = Test-Endpoint "GET /health" "/health"
if (-not $health) { exit 1 }

$integrations = Test-Endpoint "GET /health/integrations" "/health/integrations"
if ($integrations) {
  $items = $integrations.integrations
  foreach ($key in @('redis','stripe','bunny','gemini','googleOAuth','cloudinary')) {
    $status = $items.$key
    $color = if ($status -match 'ok|configured') { 'Green' } elseif ($status -eq 'degraded') { 'Yellow' } else { 'DarkYellow' }
    Write-Host "  $key : $status" -ForegroundColor $color
  }
}

# Auth smoke (optional credentials)
if ($env:TEST_PASSWORD) {
  $body = @{ email = 'admin@mrhacademy.com'; password = $env:TEST_PASSWORD } | ConvertTo-Json
  try {
    $login = Invoke-WebRequest -Uri "$ApiUrl/auth/login" -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing
    if ($login.StatusCode -eq 200 -or $login.StatusCode -eq 201) {
      Write-Host "[PASS] POST /auth/login (admin)" -ForegroundColor Green
      $passed++
      $token = ($login.Content | ConvertFrom-Json).accessToken
      if ($token) {
        $headers = @{ Authorization = "Bearer $token"; 'X-MRH-Client' = 'mrh-web' }
        $bunnyCheck = Invoke-WebRequest -Uri "$ApiUrl/courses" -Headers $headers -UseBasicParsing -ErrorAction SilentlyContinue
        if ($bunnyCheck.StatusCode -eq 200) {
          Write-Host "[PASS] Authenticated /courses" -ForegroundColor Green
          $passed++
        }
      }
    }
  } catch {
    Write-Host "[WARN] Login test skipped or failed" -ForegroundColor Yellow
  }
} else {
  Write-Host "[INFO] Set TEST_PASSWORD=123456 to run authenticated integration checks" -ForegroundColor DarkGray
}

Write-Host "`nManual checks (require browser + credentials):" -ForegroundColor Cyan
Write-Host "  - WebRTC classroom: join /classroom/{roomId} with tutor + student in two browsers"
Write-Host "  - Bunny video: enroll in course, click Watch Course Video (needs BUNNY_* env on API)"
Write-Host "  - Stripe Connect: tutor dashboard Connect button (needs STRIPE_SECRET_KEY)"
Write-Host "  - Stripe Checkout: student Subscribe with card (needs Stripe test keys + webhook)"

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $passed" -ForegroundColor Green
Write-Host "Failed: $failed" -ForegroundColor $(if ($failed -gt 0) { 'Red' } else { 'Green' })
if ($failed -gt 0) { exit 1 }
