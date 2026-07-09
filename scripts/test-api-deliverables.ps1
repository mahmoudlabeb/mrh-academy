# MRH Academy — API deliverables smoke test (PowerShell)
# Usage:
#   .\scripts\test-api-deliverables.ps1
#   $env:API_URL="https://mrh-academy.onrender.com/api/v1"; .\scripts\test-api-deliverables.ps1

param(
  [string]$ApiUrl = $env:API_URL
)

if (-not $ApiUrl) {
  $ApiUrl = "https://mrh-academy.onrender.com/api/v1"
}

$Password = if ($env:TEST_PASSWORD) { $env:TEST_PASSWORD } else { "123456" }
$Passed = 0
$Failed = 0
$Results = @()

function Write-Result {
  param([string]$Name, [bool]$Ok, [string]$Detail = "")
  if ($Ok) {
    $script:Passed++
    Write-Host "[PASS] $Name" -ForegroundColor Green
  } else {
    $script:Failed++
    Write-Host "[FAIL] $Name - $Detail" -ForegroundColor Red
  }
  $script:Results += [PSCustomObject]@{ Test = $Name; Pass = $Ok; Detail = $Detail }
}

function Invoke-Api {
  param(
    [string]$Method = "GET",
    [string]$Path,
    [hashtable]$Body = $null,
    [string]$Token = $null
  )
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) { $headers["Authorization"] = "Bearer $Token" }
  $uri = "$ApiUrl$Path"
  $params = @{
    Uri = $uri
    Method = $Method
    Headers = $headers
    TimeoutSec = 60
  }
  if ($Body) { $params.Body = ($Body | ConvertTo-Json -Depth 6) }
  try {
    $response = Invoke-WebRequest @params -UseBasicParsing
    return @{ Ok = $true; Status = $response.StatusCode; Data = ($response.Content | ConvertFrom-Json) }
  } catch {
    $status = $null
    $msg = $_.Exception.Message
    if ($_.Exception.Response) {
      $status = [int]$_.Exception.Response.StatusCode
      try {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $msg = $reader.ReadToEnd()
      } catch {}
    }
    return @{ Ok = $false; Status = $status; Error = $msg }
  }
}

Write-Host "`n=== MRH Academy API Deliverables Test ===" -ForegroundColor Cyan
Write-Host "API: $ApiUrl`n"

# 1. Health
$h = Invoke-Api -Path "/health"
Write-Result "GET /health" ($h.Ok -and $h.Status -eq 200) ($h.Error)

# 2. Public tutors
$tutors = Invoke-Api -Path "/tutors"
Write-Result "GET /tutors (public)" ($tutors.Ok) ($tutors.Error)

# 3. Public courses
$courses = Invoke-Api -Path "/courses"
Write-Result "GET /courses (public)" ($courses.Ok) ($courses.Error)

# 4. Vocabulary
$vocab = Invoke-Api -Path "/vocabulary"
Write-Result "GET /vocabulary" ($vocab.Ok) ($vocab.Error)

# 5. Admin login
$adminLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{
  email = "admin@mrhacademy.com"
  password = $Password
}
$adminToken = $null
if ($adminLogin.Ok -and $adminLogin.Data.accessToken) {
  $adminToken = $adminLogin.Data.accessToken
  Write-Result "POST /auth/login (admin)" $true
} else {
  Write-Result "POST /auth/login (admin)" $false ($adminLogin.Error)
}

# 6. Student login
$studentLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{
  email = "student@demo.com"
  password = $Password
}
$studentToken = $null
if ($studentLogin.Ok -and $studentLogin.Data.accessToken) {
  $studentToken = $studentLogin.Data.accessToken
  Write-Result "POST /auth/login (student)" $true
} else {
  Write-Result "POST /auth/login (student)" $false ($studentLogin.Error)
}

# 7. Tutor login
$tutorLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{
  email = "Sarah.alazzeh87@gmail.com"
  password = $Password
}
$tutorToken = $null
if ($tutorLogin.Ok -and $tutorLogin.Data.accessToken) {
  $tutorToken = $tutorLogin.Data.accessToken
  Write-Result "POST /auth/login (tutor)" $true
} else {
  Write-Result "POST /auth/login (tutor)" $false ($tutorLogin.Error)
}

# 8. SubAdmin login
$subLogin = Invoke-Api -Method POST -Path "/auth/login" -Body @{
  email = "subadmin@mrhacademy.com"
  password = $Password
}
Write-Result "POST /auth/login (subadmin)" ($subLogin.Ok) ($subLogin.Error)

# 9. Student balance
if ($studentToken) {
  $bal = Invoke-Api -Path "/students/balance" -Token $studentToken
  Write-Result "GET /students/balance" ($bal.Ok) ($bal.Error)
}

# 10. Student lessons
if ($studentToken) {
  $lessons = Invoke-Api -Path "/lessons" -Token $studentToken
  Write-Result "GET /lessons (student)" ($lessons.Ok) ($lessons.Error)
}

# 11. Messages contacts
if ($studentToken) {
  $contacts = Invoke-Api -Path "/messages/contacts" -Token $studentToken
  Write-Result "GET /messages/contacts" ($contacts.Ok) ($contacts.Error)
}

# 12. My enrollments
if ($studentToken) {
  $enroll = Invoke-Api -Path "/courses/my/enrollments" -Token $studentToken
  Write-Result "GET /courses/my/enrollments" ($enroll.Ok) ($enroll.Error)
}

# 13. Tutor stats
if ($tutorToken) {
  $stats = Invoke-Api -Path "/tutors/me/stats" -Token $tutorToken
  Write-Result "GET /tutors/me/stats" ($stats.Ok) ($stats.Error)
}

# 14. Tutor profile
if ($tutorToken) {
  $profile = Invoke-Api -Path "/tutors/me/profile" -Token $tutorToken
  Write-Result "GET /tutors/me/profile" ($profile.Ok) ($profile.Error)
}

# 15. Admin stats
if ($adminToken) {
  $aStats = Invoke-Api -Path "/admin/stats" -Token $adminToken
  Write-Result "GET /admin/stats" ($aStats.Ok) ($aStats.Error)
}

# 16. Admin pending tutors
if ($adminToken) {
  $pending = Invoke-Api -Path "/tutors/pending" -Token $adminToken
  Write-Result "GET /tutors/pending" ($pending.Ok) ($pending.Error)
}

# 17. Admin employees
if ($adminToken) {
  $emps = Invoke-Api -Path "/admin/employees" -Token $adminToken
  Write-Result "GET /admin/employees" ($emps.Ok) ($emps.Error)
}

# 18. Admin payments
if ($adminToken) {
  $pay = Invoke-Api -Path "/admin/payments" -Token $adminToken
  Write-Result "GET /admin/payments" ($pay.Ok) ($pay.Error)
}

# 19. Register new student (unique email)
$ts = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$reg = Invoke-Api -Method POST -Path "/auth/register" -Body @{
  firstName = "QA"
  lastName = "Test"
  email = "qa-$ts@test.mrh"
  password = "Test1234!"
  role = "student"
}
Write-Result "POST /auth/register (student)" ($reg.Ok) ($reg.Error)

Write-Host "`n=== Summary ===" -ForegroundColor Cyan
Write-Host "Passed: $Passed" -ForegroundColor Green
Write-Host "Failed: $Failed" -ForegroundColor $(if ($Failed -gt 0) { "Red" } else { "Green" })

if ($Failed -gt 0) { exit 1 }
exit 0
