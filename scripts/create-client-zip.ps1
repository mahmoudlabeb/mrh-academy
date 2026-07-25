param(
  [string]$OutputPath = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$DeliveryDirectory = Join-Path $ProjectRoot "delivery"
if (-not $OutputPath) {
  $OutputPath = Join-Path $DeliveryDirectory "MRH-Academy-client-ready.zip"
}
$OutputPath = [System.IO.Path]::GetFullPath($OutputPath)

if (-not $OutputPath.EndsWith(".zip", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "OutputPath must be a .zip file."
}

New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($OutputPath)) | Out-Null
node (Join-Path $ProjectRoot "scripts/secret-scan.js") --quiet
if ($LASTEXITCODE -ne 0) {
  throw "Secret scan failed. The client ZIP was not created."
}

$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("mrh-client-package-" + [System.Guid]::NewGuid().ToString("N"))
$TempProject = Join-Path $TempRoot "MRH-Academy"
New-Item -ItemType Directory -Force -Path $TempProject | Out-Null

try {
  $FileList = git -C $ProjectRoot ls-files --cached --others --exclude-standard
  if ($LASTEXITCODE -ne 0) {
    throw "Unable to build the repository file list."
  }

  $ExcludedPrefixes = @(
    ".agents/",
    ".codex/",
    ".codex-runtime/",
    ".local/",
    ".runlogs/",
    "backups/",
    "delivery/",
    "dogfood-output/",
    "node_modules/"
  )
  $ExcludedFiles = @(
    "AGENTS.md",
    "REFACTOR_PLAN.md",
    "docs/REFACTOR_PLAN.md"
  )

  foreach ($RelativePath in $FileList) {
    $Normalized = $RelativePath.Replace("\", "/")
    if ($ExcludedFiles -contains $Normalized) { continue }
    if ($ExcludedPrefixes | Where-Object { $Normalized.StartsWith($_) }) { continue }
    if ($Normalized -match '(^|/)\.env($|\.)' -and -not $Normalized.EndsWith(".env.example")) { continue }
    if ($Normalized -match '(^|/)(dist|\.next|coverage|test-results|playwright-report)/') { continue }

    $Source = Join-Path $ProjectRoot $RelativePath
    if (-not (Test-Path -LiteralPath $Source -PathType Leaf)) { continue }
    $Destination = Join-Path $TempProject $RelativePath
    New-Item -ItemType Directory -Force -Path ([System.IO.Path]::GetDirectoryName($Destination)) | Out-Null
    Copy-Item -LiteralPath $Source -Destination $Destination
  }

  if (Test-Path -LiteralPath $OutputPath) {
    Remove-Item -LiteralPath $OutputPath -Force
  }
  Compress-Archive -Path $TempProject -DestinationPath $OutputPath -CompressionLevel Optimal
  $Hash = (Get-FileHash -Algorithm SHA256 -LiteralPath $OutputPath).Hash
  Write-Host "Client package created: $OutputPath"
  Write-Host "SHA256: $Hash"
}
finally {
  $ResolvedTemp = [System.IO.Path]::GetFullPath($TempRoot)
  $SystemTemp = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
  if ($ResolvedTemp.StartsWith($SystemTemp) -and (Test-Path -LiteralPath $ResolvedTemp)) {
    Remove-Item -LiteralPath $ResolvedTemp -Recurse -Force
  }
}
