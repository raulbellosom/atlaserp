#!/bin/sh
set -e
echo "[Runly] Running seed (idempotent)..."
node prisma/seed.js
echo "[Runly] Starting API..."
exec pnpm --filter @runly/api start
