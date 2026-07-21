$ErrorActionPreference = 'Stop'

$checks = @()

function Check-Http($name, $url, $expected) {
  try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing -MaximumRedirection 0 -TimeoutSec 5 -ErrorAction SilentlyContinue
    $status = [int]$response.StatusCode
  } catch {
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
    } else {
      $status = 0
    }
  }

  $ok = $expected -contains $status
  $script:checks += [pscustomobject]@{ Name = $name; Status = $status; Result = if ($ok) { 'PASS' } else { 'FAIL' } }
}

Check-Http 'API health' 'http://localhost:4000/api/v1/health' @(200)
Check-Http 'API integration health' 'http://localhost:4000/api/v1/health/integrations' @(200)
Check-Http 'Web login' 'http://localhost:3000/login' @(200)
Check-Http 'Web register' 'http://localhost:3000/register' @(200)
Check-Http 'Web FAQ' 'http://localhost:3000/faq' @(200)
Check-Http 'Web privacy' 'http://localhost:3000/privacy' @(200)
Check-Http 'Web terms' 'http://localhost:3000/terms' @(200)

try {
  $webhook = Invoke-WebRequest -Uri 'http://localhost:4000/api/v1/webhooks/stripe' -Method Post -ContentType 'application/json' -Body '{}' -UseBasicParsing -TimeoutSec 5 -ErrorAction SilentlyContinue
  $webhookStatus = [int]$webhook.StatusCode
} catch {
  $webhookStatus = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 0 }
}
$checks += [pscustomobject]@{ Name = 'Stripe unsigned webhook rejected'; Status = $webhookStatus; Result = if ($webhookStatus -eq 400) { 'PASS' } else { 'FAIL' } }

$checks | Format-Table -AutoSize
$failed = @($checks | Where-Object Result -eq 'FAIL')
if ($failed.Count -gt 0) {
  throw "$($failed.Count) local readiness check(s) failed."
}

Write-Output 'Local readiness checks passed.'
