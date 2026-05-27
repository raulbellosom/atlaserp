param(
  [switch]$SkipComposeUp
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "setup-local.mjs"
if (-not (Test-Path $scriptPath)) {
  throw "setup-local.mjs not found at $scriptPath"
}

$nodeArgs = @($scriptPath)
if ($SkipComposeUp) {
  $nodeArgs += "--skip-compose-up"
}

& node $nodeArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
