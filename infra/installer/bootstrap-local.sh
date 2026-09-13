#!/usr/bin/env bash
set -euo pipefail

base_url="https://raw.githubusercontent.com/raulbellosom/atlaserp/main/infra/installer"
if [[ "${ATLAS_BOOTSTRAP_REFRESHED:-}" != "local" ]]; then
  bootstrap_path="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
  bootstrap_download="$(mktemp "${bootstrap_path}.XXXXXX")"
  trap 'rm -f "$bootstrap_download"' EXIT
  curl -fsSLo "$bootstrap_download" "$base_url/bootstrap-local.sh"
  bash -n "$bootstrap_download"
  if ! cmp -s "$bootstrap_path" "$bootstrap_download"; then
    chmod +x "$bootstrap_download"
    mv -f "$bootstrap_download" "$bootstrap_path"
    trap - EXIT
    echo "[atlas-bootstrap] Bootstrap actualizado; continuando con la lista vigente."
    exec env ATLAS_BOOTSTRAP_REFRESHED=local bash "$bootstrap_path" "$@"
  fi
  rm -f "$bootstrap_download"
  trap - EXIT
fi
files=(
  docker-compose.yml
  docker-compose.linux.yml
  lib/devkit-installer.mjs
  lib/office-config.mjs
  lib/firebase-config.mjs
  lib/livekit-config.mjs
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
mkdir -p -m 700 .secrets/firebase

echo "[atlas-bootstrap] Archivos listos."
if [[ "${1:-}" == "--skip-run" ]]; then
  echo "[atlas-bootstrap] Ejecucion omitida. Usa: npm run atlas:local"
  exit 0
fi

echo "[atlas-bootstrap] Iniciando instalacion local..."
exec npm run atlas:local
