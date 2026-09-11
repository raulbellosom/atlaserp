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
ssh -L 54322:172.22.0.3:5432 root@76.13.114.109
# This maps localhost:54322 → supabase-db container (172.22.0.3:5432) on the VPS

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
# Opens local port 54322 → supabase-db container (172.22.0.3:5432) on the VPS
ssh -L 54322:172.22.0.3:5432 root@76.13.114.109
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

## Multi-tenant model

Atlas ERP is a true multi-tenant application: one API/database/instance can securely serve multiple companies at once. `Company` is the tenant root and `Membership` is the join to `UserProfile`; the active company for a request is resolved server-side (never trusted from the client) via the `X-Atlas-Company-Id` header, validated against the caller's memberships by `resolveTenantContext` (`apps/api/src/index.js`). Effective permissions are a pure function of `(User, ActiveCompany)` — a user who is admin in one company and a viewer (or non-member) in another never gets admin rights when the other company is active. See `docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md` for the full design and `apps/api/src/__tests__/cross-tenant/` for the opt-in live cross-tenant security suite (`RUN_CROSS_TENANT_TESTS=1`) that verifies this end-to-end.

Two supported deployment shapes, chosen per client, not per code path:
- **Shared instance, multiple companies** — one Atlas ERP deployment (API + worker + desktop) and one Supabase stack serve several companies, isolated at the data layer via `Company`/`Membership` + `resolveTenantContext`. This is the default and requires no extra setup.
- **Dedicated instance per company** — a client who wants full infrastructure isolation (separate VPS, separate Supabase stack, separate `.env`/`DATABASE_URL`) can still get one; the application code is the same either way, this only changes how many `Company` rows exist in that deployment's database (typically one).
