# Atlas ERP — Deployment Strategy

## Two independent stacks

**Supabase stack** (self-hosted on VPS, already deployed):
- https://supabase.racoondevs.com — PostgreSQL, Auth, Storage, Realtime
- https://studio.supabase.racoondevs.com — Studio (admin use only)
- Not managed by Atlas ERP's docker-compose
- Credentials in `.env`, never in version control
- Config source of truth: `/opt/supabase-atlaserp/supabase/docker/.env` on the VPS

**Atlas ERP stack** (managed here):
- `apps/api` — Hono REST API
- `apps/worker` — background job processor
- `apps/desktop` — Tauri desktop application
- Connects to Supabase via environment variables

## No local database

There is no local PostgreSQL, Redis, or MinIO. All development connects to the self-hosted Supabase at https://supabase.racoondevs.com via an SSH tunnel.

## Development setup (local)

### Prerequisites

- Node.js 22, pnpm 9
- SSH access to the VPS (`root@76.13.114.109`)
- Credentials from `/opt/supabase-atlaserp/supabase/docker/.env`

### Steps

```bash
# 1. Copy and fill env
cp .env.example .env
# Fill in all values — see .env.example header for instructions

# 2. Install dependencies
pnpm install

# 3. Open SSH tunnel (keep this terminal open)
ssh -L 54322:127.0.0.1:5432 root@76.13.114.109
# This maps localhost:54322 → PostgreSQL on the VPS

# 4. First-time database setup (in a new terminal, tunnel must be open)
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 5. Start dev servers (tunnel not required at runtime — only for DB commands)
pnpm dev           # API + Vite web preview + worker
pnpm dev:tauri     # Native Tauri window + all servers (requires Rust)
```

## Ports (development)

| Service | URL |
|---|---|
| API | http://localhost:4010 |
| Frontend (Vite) | http://localhost:5173 |
| Prisma Studio | http://localhost:5555 (requires SSH tunnel) |
| Supabase API | https://supabase.racoondevs.com |
| Supabase Studio | https://studio.supabase.racoondevs.com |

## SSH tunnel reference

```bash
# Opens local port 54322 → PostgreSQL port 5432 on the VPS
ssh -L 54322:127.0.0.1:5432 root@76.13.114.109
```

Required before: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm db:studio`, `pnpm db:fresh`.

**Not required** for `pnpm dev` — the API connects to Supabase Auth/Storage via HTTPS, not direct PostgreSQL. However, Prisma queries from the API also need the tunnel during development unless the VPS exposes PostgreSQL on a public port (currently it does not).

## docker-compose.yml

Runs Atlas ERP application services only. Does not start any database — all services connect to Supabase via env vars.

```bash
docker compose up    # start api + worker + web-preview
docker compose down
```

## Tauri desktop build (Windows only)

```bash
cd apps/desktop
pnpm tauri build   # produces .exe installer
pnpm tauri dev     # native window with hot-reload
```

Requires Rust toolchain + Windows SDK. Not available inside Docker containers.

## Per-company deployment model

Each company deployment:
- Own Atlas ERP instance (API + worker + desktop)
- Own `.env` with company-specific DATABASE_URL and credentials
- Own Supabase stack (strong isolation) OR shared Supabase with company-scoped data (future multi-company mode using existing Company/Membership schema)

Current priority: single-company per deployment.
