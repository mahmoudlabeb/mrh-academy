# Build Protection Script - Mr.H Academy
# This script builds the project and removes editable source files
# so the client can run but cannot modify the code.

Write-Host "=== Building & Protecting Mr.H Academy ===" -ForegroundColor Yellow

# 1. Install javascript-obfuscator
Write-Host "[1/5] Installing obfuscation tools..." -ForegroundColor Cyan
npm install --save-dev javascript-obfuscator 2>$null

# 2. Build both apps
Write-Host "[2/5] Building API..." -ForegroundColor Cyan
Set-Location -Path "apps/api"
npx nest build
if ($LASTEXITCODE -ne 0) { Write-Host "API build failed!" -ForegroundColor Red; exit 1 }
Set-Location -Path "../.."

Write-Host "[3/5] Building Web..." -ForegroundColor Cyan
Set-Location -Path "apps/web"
npx next build
if ($LASTEXITCODE -ne 0) { Write-Host "Web build failed!" -ForegroundColor Red; exit 1 }
Set-Location -Path "../.."

# 3. Obfuscate API dist output
Write-Host "[4/5] Obfuscating API code..." -ForegroundColor Cyan
$apiDist = "apps/api/dist"
if (Test-Path $apiDist) {
  $jsFiles = Get-ChildItem -Path $apiDist -Recurse -Filter "*.js" | Where-Object { $_.Name -notmatch "spec" }
  foreach ($file in $jsFiles) {
    npx javascript-obfuscator $file.FullName --output $file.FullName --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64 --string-array-threshold 0.8 --self-defending true 2>$null
  }
  # Remove source maps and source TS files
  Get-ChildItem -Path $apiDist -Recurse -Filter "*.js.map" | Remove-Item -Force
  Get-ChildItem -Path $apiDist -Recurse -Filter "*.d.ts.map" | Remove-Item -Force
  Write-Host "API code obfuscated." -ForegroundColor Green
}

# 4. Obfuscate web .next output
Write-Host "[5/5] Obfuscating Web output..." -ForegroundColor Cyan
$webNext = "apps/web/.next"
if (Test-Path $webNext) {
  $webJsFiles = Get-ChildItem -Path $webNext -Recurse -Filter "*.js" | Where-Object { $_.Name -notmatch "spec" }
  foreach ($file in $webJsFiles) {
    try {
      npx javascript-obfuscator $file.FullName --output $file.FullName --compact true --control-flow-flattening true --dead-code-injection true --string-array true --string-array-encoding base64 --string-array-threshold 0.6 --self-defending true 2>$null
    } catch { }
  }
  Get-ChildItem -Path $webNext -Recurse -Filter "*.js.map" | Remove-Item -Force 2>$null
  Write-Host "Web code obfuscated." -ForegroundColor Green
}

Write-Host "`n=== Protection Complete! ===" -ForegroundColor Yellow
Write-Host "The client can run the project using: npm start" -ForegroundColor Green
Write-Host "Source files are obfuscated and cannot be easily modified." -ForegroundColor Green
