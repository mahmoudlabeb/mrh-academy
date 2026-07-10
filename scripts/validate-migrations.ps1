# MRH Academy — Migration validation (PowerShell)
# Drops and recreates the public schema, then runs all TypeORM migrations.
# Requires a local PostgreSQL instance matching apps/api/.env credentials.
#
# Usage:
#   .\scripts\validate-migrations.ps1
#   .\scripts\validate-migrations.ps1 -DatabaseName mrh_academy_migrate_test

param(
  [string]$DatabaseName = "mrh_academy_migrate_test"
)

$ErrorActionPreference = "Stop"
$apiDir = Join-Path $PSScriptRoot ".." "apps" "api"

Write-Host "`n=== MRH Academy Migration Validation ===" -ForegroundColor Cyan
Write-Host "Database: $DatabaseName`n"

Push-Location $apiDir
try {
  $env:CONFIRM_VALIDATE = "yes"
  $env:DATABASE_NAME = $DatabaseName
  $env:DB_SYNCHRONIZE = "false"
  $env:RUN_MIGRATIONS = "false"

  npm run migration:validate
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "`n[PASS] All migrations applied successfully on a fresh schema." -ForegroundColor Green
} finally {
  Pop-Location
}
