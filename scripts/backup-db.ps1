# Database backup script (Windows PowerShell)
# Usage: .\scripts\backup-db.ps1

param(
  [string]$OutputDir = ".\backups"
)

$ErrorActionPreference = "Stop"

if (-not $env:DATABASE_URL) {
  Write-Error "DATABASE_URL environment variable is required"
}

if (-not (Test-Path $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputFile = Join-Path $OutputDir "mrh-academy-$timestamp.sql"

Write-Host "Backing up database to $outputFile ..."

# Requires pg_dump in PATH (PostgreSQL client tools)
pg_dump $env:DATABASE_URL --no-owner --no-acl -f $outputFile

if ($LASTEXITCODE -eq 0) {
  Write-Host "Backup completed: $outputFile"
} else {
  Write-Error "Backup failed with exit code $LASTEXITCODE"
}
