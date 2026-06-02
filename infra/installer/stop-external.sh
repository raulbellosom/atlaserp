#!/usr/bin/env bash
# stop-external.sh — stop/reset Atlas external stack (Linux / macOS / Git Bash)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/stop-external.mjs" "$@"
