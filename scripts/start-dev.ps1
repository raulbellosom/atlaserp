# Atlas ERP — Local dev startup
# Opens the SSH tunnel to the VPS in a separate window, then starts all dev servers.
# Run with: pnpm start (or powershell -File scripts/start-dev.ps1)

$tunnelCmd = "ssh -o ServerAliveInterval=60 -L 54322:172.22.0.3:5432 root@76.13.114.109"

Write-Host "Opening SSH tunnel to VPS database..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", $tunnelCmd

Write-Host "Waiting for tunnel to establish..." -ForegroundColor Yellow
Start-Sleep -Seconds 3

Write-Host "Starting Atlas ERP dev servers (API + Web + Worker)..." -ForegroundColor Green
pnpm dev
