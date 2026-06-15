param(
  [switch]$Reset
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "stop-local.mjs"
if (-not (Test-Path $scriptPath)) {
  throw "stop-local.mjs not found at $scriptPath"
}

$nodeArgs = @($scriptPath)
if ($Reset) {
  $nodeArgs += "--reset"
}

& node $nodeArgs
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}
