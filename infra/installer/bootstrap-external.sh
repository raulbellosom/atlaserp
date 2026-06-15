#!/usr/bin/env bash
set -euo pipefail

base_url="https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer"
files=(
  docker-compose.yml
  lib/devkit-installer.mjs
  package.json
  setup-external.mjs
  setup-external.sh
  stop-external.mjs
  stop-external.sh
  .env.external.example
)

echo "[atlas-bootstrap] Descargando instalador external en $(pwd)"

for file in "${files[@]}"; do
  mkdir -p "$(dirname "$file")"
  curl -fsSLo "$file" "$base_url/$file"
done

mkdir -p custom-modules

if [[ ! -f .env.external ]]; then
  cp .env.external.example .env.external
fi

echo "[atlas-bootstrap] Archivos listos."
echo "[atlas-bootstrap] Siguiente paso: edita .env.external y luego ejecuta npm run atlas:external"
