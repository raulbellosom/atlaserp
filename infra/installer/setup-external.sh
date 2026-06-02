#!/usr/bin/env bash
# setup-external.sh — Atlas ERP external/production installer (Linux / macOS / Git Bash)
# Delegates to setup-external.mjs (Node.js 20+ required).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/setup-external.mjs" "$@"
