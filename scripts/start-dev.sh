#!/bin/bash
# Atlas ERP — local dev startup
# Opens the SSH tunnel to the VPS Postgres container, then starts all dev servers.
# Runs automatically via: pnpm start

SSH_HOST="root@76.13.114.109"
LOCAL_PORT=54322
REMOTE_ADDR="172.22.0.3:5432"
TUNNEL_OWNED=0

check_port() {
  (echo "" > /dev/tcp/127.0.0.1/$LOCAL_PORT) 2>/dev/null
}

if check_port; then
  echo "Port $LOCAL_PORT already bound — tunnel already running, skipping."
else
  echo "Opening SSH tunnel: 127.0.0.1:$LOCAL_PORT -> $REMOTE_ADDR ..."
  ssh -f -N \
    -o ServerAliveInterval=60 \
    -o StrictHostKeyChecking=accept-new \
    -L "${LOCAL_PORT}:${REMOTE_ADDR}" \
    "$SSH_HOST"

  sleep 2

  if ! check_port; then
    echo "ERROR: SSH tunnel did not start. Check SSH access to $SSH_HOST." >&2
    exit 1
  fi

  echo "SSH tunnel ready."
  TUNNEL_OWNED=1
fi

cleanup() {
  if [ $TUNNEL_OWNED -eq 1 ]; then
    echo "Closing SSH tunnel..."
    pkill -f "ssh.*-L.*${LOCAL_PORT}:${REMOTE_ADDR}" 2>/dev/null || true
  fi
  echo "Atlas ERP dev environment stopped."
}
trap cleanup EXIT INT TERM

echo "Starting dev servers (API + web + worker)..."
pnpm dev
