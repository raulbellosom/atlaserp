# Atlas ERP

Desktop-first, full-stack modular ERP built with React + Vite + Tauri, a Node/Hono API, Prisma, and a dedicated self-hosted Supabase instance.

## Quick start

### 1. Fill environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in the values. All keys come from the VPS file at:
`/opt/supabase-atlaserp/supabase/docker/.env`

| .env variable | Source in VPS .env |
|---|---|
| `SUPABASE_ANON_KEY` | `ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` |
| `SUPABASE_JWT_SECRET` | `JWT_SECRET` |
| `DATABASE_URL` / `DIRECT_URL` | Use `POSTGRES_PASSWORD` — see below |

`DATABASE_URL` uses the SSH tunnel address:
```
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:54322/postgres
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Open SSH tunnel (required for all Prisma commands)

PostgreSQL is not exposed publicly. Open this tunnel in a separate terminal before running any `db:*` command:

```bash
ssh -L 54322:127.0.0.1:5432 root@76.13.114.109
```

Keep it open for the duration of your database work.

### 4. Set up database (first time only)

```bash
pnpm db:generate    # generate Prisma client
pnpm db:migrate     # apply migrations to Supabase PostgreSQL
pnpm db:seed        # seed core modules, roles, permissions
```

### 5. Start dev servers

```bash
pnpm dev            # API + Vite web preview + worker
```

Open **http://localhost:5173** in your browser or run `pnpm dev:tauri` for the native window.

## Dev commands

### Servers

| Command | What it does |
|---|---|
| `pnpm dev` | API + Vite web preview + worker (recommended) |
| `pnpm dev:api` | API only — port 4010 |
| `pnpm dev:frontend` | Vite web preview only — port 5173 |
| `pnpm dev:worker` | Background worker only |
| `pnpm dev:tauri` | Native Tauri window + all servers (requires Rust toolchain) |

### Database (SSH tunnel required for all)

| Command | What it does |
|---|---|
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:migrate` | Run pending migrations against Supabase PostgreSQL |
| `pnpm db:seed` | Seed core modules, permissions, roles |
| `pnpm db:studio` | Open Prisma Studio GUI — http://localhost:5555 |
| `pnpm db:fresh` | migrate + generate + seed (non-destructive) |

### Build

| Command | What it does |
|---|---|
| `pnpm build` | Build all packages and apps |
| `pnpm icons:generate` | Regenerate Tauri app icons |

## Ports

| Service | URL |
|---|---|
| API | http://localhost:4010 |
| Frontend (Vite) | http://localhost:5173 |
| Prisma Studio | http://localhost:5555 |
| Supabase API | https://supabase.racoondevs.com |
| Supabase Studio | https://studio.supabase.racoondevs.com |

## Architecture

```
apps/
  desktop/     React + Vite + Tauri 2 (desktop shell)
  api/         Node.js + Hono (business logic + REST API)
  worker/      Background job handler
packages/
  core/        Module registry, event bus, manifest contract
  maps/        Module manifests: core-modules.js + feature-modules.js
  ui/          Shared React components
  sdk/         Atlas API client (createAtlasClient)
  validators/  Zod schemas shared between API and frontend
prisma/
  schema.prisma   Database models
  seed.js         Seeds core modules, roles, permissions
```

**Request flow:** `React → @atlas/sdk → Hono API → Zod validation → Prisma → Supabase PostgreSQL`

No direct database access from the frontend. The API owns all business rules and validation.

## Module system

Every ERP feature is a **module**. Modules register via manifests in `packages/maps/`.

- **Core modules** — `atlas.core`, `atlas.identity`, `atlas.files`, `atlas.branding` — cannot be uninstalled.
- **Feature modules** — installable, versioned, with declared dependencies.

See [docs/02_module_system.md](docs/02_module_system.md) and [docs/01_erp_architecture.md](docs/01_erp_architecture.md).

## Notes

- All UI text must be in **Spanish**. Code, docs, and comments are in **English**.
- JavaScript only — no TypeScript.
- Tailwind for all styles.
- Prisma is pinned to `^6`. Do not upgrade to v7 (breaking API changes).
- Supabase Studio: https://studio.supabase.racoondevs.com (admin use only).
