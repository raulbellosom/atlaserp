# Atlas ERP

Desktop-first, full-stack ERP built with React + Vite + Tauri, a Node/Hono API, Prisma, and a modular blueprint system inspired by Odoo.

## Quick start

```bash
cp .env.example .env
pnpm setup      # install + start infra + migrate + seed (first time only)
pnpm dev        # start API + frontend
```

Open **http://localhost:5173** in your browser.

## Dev commands

### Start servers

| Command | What it does |
|---|---|
| `pnpm dev` | API + Vite web preview + worker *(recommended for daily dev)* |
| `pnpm dev:api` | API only — port 4010 |
| `pnpm dev:frontend` | Vite web preview only — port 5173 |
| `pnpm dev:worker` | Background worker only |
| `pnpm dev:tauri` | Native Tauri window + API + worker *(requires Rust toolchain)* |

### Infrastructure (Docker)

| Command | What it does |
|---|---|
| `pnpm infra:up` | Start Postgres, Redis, MinIO in the background |
| `pnpm infra:down` | Stop infrastructure containers |
| `pnpm infra:reset` | Destroy all volumes and restart *(wipes all data)* |
| `pnpm infra:logs` | Tail infrastructure logs |
| `pnpm infra:status` | Show container status |

### Database

| Command | What it does |
|---|---|
| `pnpm db:migrate` | Run pending migrations |
| `pnpm db:generate` | Regenerate Prisma client after schema changes |
| `pnpm db:seed` | Seed core modules and permissions |
| `pnpm db:studio` | Open Prisma Studio GUI — http://localhost:5555 |
| `pnpm db:reset` | Drop + re-migrate + seed *(wipes all data)* |
| `pnpm db:fresh` | Apply migrations + generate + seed *(non-destructive)* |

### Other

| Command | What it does |
|---|---|
| `pnpm setup` | Full first-time setup: install + infra + migrate + seed |
| `pnpm icons:generate` | Regenerate Tauri app icons |
| `pnpm build` | Build all packages and apps |

## Ports

| Service | URL |
|---|---|
| API | http://localhost:4010 |
| Frontend (Vite) | http://localhost:5173 |
| Prisma Studio | http://localhost:5555 |
| MinIO Console | http://localhost:9001 |

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

**Request flow:** `React → @atlas/sdk → Hono API → Zod validation → Prisma → PostgreSQL`

No direct database access from the frontend. The API owns all business rules and validation.

## Module system

Every ERP feature is a **module**. Modules register via manifests in `packages/maps/`.

- **Core modules** — `atlas.core`, `atlas.identity`, `atlas.files` — cannot be uninstalled.
- **Feature modules** — installable, versioned, with declared dependencies.

See [docs/MODULE_SYSTEM.md](docs/MODULE_SYSTEM.md) and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Notes

- All UI text must be in **Spanish**. Code, docs, and comments are in **English**.
- JavaScript only — no TypeScript.
- Tailwind for all styles.
- Prisma is pinned to `^6`. Do not upgrade to v7 (breaking API changes in datasource config).
- For Supabase self-hosted, see [infra/supabase/README.md](infra/supabase/README.md).
