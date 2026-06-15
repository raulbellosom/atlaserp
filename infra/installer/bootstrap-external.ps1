param(
  [switch]$SkipEnvCopy
)

$ErrorActionPreference = "Stop"

$baseUrl = "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer"
$files = @(
  "docker-compose.yml",
  "lib/devkit-installer.mjs",
  "package.json",
  "setup-external.mjs",
  "setup-external.sh",
  "stop-external.mjs",
  "stop-external.sh",
  ".env.external.example"
)

Write-Host "[atlas-bootstrap] Descargando instalador external en $PWD"

foreach ($file in $files) {
  $outFile = Join-Path $PWD $file
  $outDir = Split-Path -Parent $outFile
  if ($outDir) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }
  Invoke-WebRequest -Uri "$baseUrl/$file" -OutFile $outFile
}

New-Item -ItemType Directory -Force -Path (Join-Path $PWD "custom-modules") | Out-Null

if (-not $SkipEnvCopy -and -not (Test-Path ".\.env.external")) {
  Copy-Item ".\.env.external.example" ".\.env.external"
}

Write-Host "[atlas-bootstrap] Archivos listos."
Write-Host "[atlas-bootstrap] Siguiente paso: edita .env.external y luego ejecuta npm.cmd run atlas:external"
