#!/usr/bin/env bash
# stop-local.sh — stop/reset Atlas local stack (Linux / macOS / Git Bash)
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/stop-local.mjs" "$@"
