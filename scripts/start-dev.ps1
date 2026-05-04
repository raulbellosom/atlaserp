$ErrorActionPreference = "Stop"

Write-Host "Starting Atlas ERP dev environment..." -ForegroundColor Cyan

$sshHost      = "root@76.13.114.109"
$remoteDbHost = "172.22.0.3"
$remoteDbPort = "5432"
$localDbPort  = 54322

Write-Host "Checking if local port $localDbPort is already in use..." -ForegroundColor Yellow

$existingConnection = Get-NetTCPConnection -LocalPort $localDbPort -ErrorAction SilentlyContinue

$sshProcess = $null

if ($existingConnection) {
  Write-Host "Port $localDbPort is already in use. Assuming SSH tunnel is already running." -ForegroundColor Yellow
} else {
  Write-Host "Opening SSH tunnel: 127.0.0.1:${localDbPort} -> ${remoteDbHost}:${remoteDbPort}" -ForegroundColor Green

  $sshArgs = @(
    "-N",
    "-o", "ServerAliveInterval=60",
    "-L", "${localDbPort}:${remoteDbHost}:${remoteDbPort}",
    $sshHost
  )

  $sshProcess = Start-Process `
    -FilePath "ssh" `
    -ArgumentList $sshArgs `
    -WindowStyle Hidden `
    -PassThru

  Start-Sleep -Seconds 3

  $connectionReady = Get-NetTCPConnection -LocalPort $localDbPort -ErrorAction SilentlyContinue

  if (-not $connectionReady) {
    throw "SSH tunnel failed to start on local port $localDbPort. Make sure your SSH key is set up for root@76.13.114.109."
  }

  Write-Host "SSH tunnel is ready." -ForegroundColor Green
}

try {
  Write-Host "Starting pnpm dev processes..." -ForegroundColor Cyan
  pnpm dev
}
finally {
  if ($sshProcess -and -not $sshProcess.HasExited) {
    Write-Host "Closing SSH tunnel (pid $($sshProcess.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $sshProcess.Id -Force
  }
  Write-Host "Atlas ERP dev environment stopped." -ForegroundColor Cyan
}
