#!/usr/bin/env bash
set -euo pipefail

base_url="https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer"
files=(
  docker-compose.yml
  docker-compose.linux.yml
  lib/devkit-installer.mjs
  package.json
  setup-local.mjs
  setup-local.ps1
  setup-local.sh
  stop-local.mjs
  stop-local.ps1
  stop-local.sh
)

echo "[atlas-bootstrap] Descargando instalador local en $(pwd)"

for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  curl -fsSLo "$file" "$base_url/$file"
done

mkdir -p custom-modules

echo "[atlas-bootstrap] Archivos listos."
if [[ "${1:-}" == "--skip-run" ]]; then
  echo "[atlas-bootstrap] Ejecucion omitida. Usa: npm run atlas:local"
  exit 0
fi

echo "[atlas-bootstrap] Iniciando instalacion local..."
exec npm run atlas:local
