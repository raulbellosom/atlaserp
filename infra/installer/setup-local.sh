#!/usr/bin/env bash
# setup-local.sh — Atlas ERP local installer (Linux / macOS / Git Bash)
# Delegates to setup-local.mjs (Node.js 20+ required).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$DIR/setup-local.mjs" "$@"
