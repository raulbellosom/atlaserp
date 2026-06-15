param(
  [switch]$SkipRun
)

$ErrorActionPreference = "Stop"

$baseUrl = "https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer"
$files = @(
  "docker-compose.yml",
  "docker-compose.linux.yml",
  "lib/devkit-installer.mjs",
  "package.json",
  "setup-local.mjs",
  "setup-local.ps1",
  "setup-local.sh",
  "stop-local.mjs",
  "stop-local.ps1",
  "stop-local.sh"
)

Write-Host "[atlas-bootstrap] Descargando instalador local en $PWD"

foreach ($file in $files) {
  $outFile = Join-Path $PWD $file
  $outDir = Split-Path -Parent $outFile
  if ($outDir) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  }
  Invoke-WebRequest -Uri "$baseUrl/$file" -OutFile $outFile
}

New-Item -ItemType Directory -Force -Path (Join-Path $PWD "custom-modules") | Out-Null

Write-Host "[atlas-bootstrap] Archivos listos."
if ($SkipRun) {
  Write-Host "[atlas-bootstrap] Ejecucion omitida. Usa: npm.cmd run atlas:local"
  exit 0
}

Write-Host "[atlas-bootstrap] Iniciando instalacion local..."
& npm.cmd run atlas:local
exit $LASTEXITCODE
