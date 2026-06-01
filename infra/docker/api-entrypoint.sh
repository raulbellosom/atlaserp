#!/bin/sh
set -e
echo "[Atlas] Running seed (idempotent)..."
node prisma/seed.js
echo "[Atlas] Starting API..."
exec pnpm --filter @atlas/api start
