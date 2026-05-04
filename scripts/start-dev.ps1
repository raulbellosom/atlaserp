# Atlas ERP — Local dev startup
# Starts API + Web + Worker. No SSH tunnel needed — PostgreSQL is exposed on the VPS.
# Run with: pnpm start

Write-Host "Starting Atlas ERP dev servers (API + Web + Worker)..." -ForegroundColor Green
pnpm dev
