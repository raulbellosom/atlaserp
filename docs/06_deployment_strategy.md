# Atlas ERP — Deployment Strategy

## Two independent stacks

**Supabase stack** (already deployed externally):
- https://supabase.racoondevs.com — PostgreSQL, Auth, Storage, Realtime, Studio
- Not managed by Atlas ERP's docker-compose
- Credentials in `.env`, never in version control

**Atlas ERP stack** (managed here):
- `apps/api` — Hono REST API
- `apps/worker` — background job processor
- `apps/desktop` — Tauri desktop application
- Connects to Supabase via environment variables

## No local database

There is no local PostgreSQL, Redis, or MinIO in the Atlas ERP dev setup. All development connects to https://supabase.racoondevs.com.

## Development setup (local, without Docker)

```bash
# 1. Copy and fill env
cp .env.example .env
# Fill: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL, JWT_SECRET

# 2. Install dependencies
pnpm install

# 3. First-time database setup
pnpm db:generate
pnpm db:migrate
pnpm db:seed

# 4. Start dev servers
pnpm dev           # API + Vite web preview + worker
pnpm dev:tauri     # Native Tauri window + all servers (requires Rust)
```

## Ports (development)

| Service | URL |
|---|---|
| API | http://localhost:4010 |
| Frontend (Vite) | http://localhost:5173 |
| Prisma Studio | http://localhost:5555 |

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
