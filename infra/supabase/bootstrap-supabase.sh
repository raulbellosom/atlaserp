#!/usr/bin/env bash
set -euo pipefail

mkdir -p runtime
if [ ! -d runtime/.git ]; then
  git clone --depth 1 https://github.com/supabase/supabase.git runtime-src
  rm -rf runtime/*
  cp -R runtime-src/docker/* runtime/
  rm -rf runtime-src
  echo "Supabase docker files copied to infra/supabase/runtime"
else
  echo "runtime already exists"
fi

echo "Next: cd infra/supabase/runtime && cp .env.example .env && docker compose up -d"
