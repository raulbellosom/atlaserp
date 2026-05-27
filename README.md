# Atlas ERP

Desktop-first, full-stack modular ERP built with React + Vite + Tauri, a Node/Hono API, Prisma, and a dedicated self-hosted Supabase instance.

## Quick start

## Docker installer (external/local Supabase)

Installer files live in `infra/installer/`.

- `external` profile: Atlas ERP + external Supabase.
- `local` profile: Atlas ERP + local Supabase via `infra/installer/setup-local.ps1` (automated).
- Custom modules mount path: host `infra/installer/custom-modules/` -> container `/app/modules/custom`.

See `infra/installer/README.md` for commands and env setup.

### 1. Fill environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in values from the VPS file:
`/opt/supabase-atlaserp/supabase/docker/.env`

| .env variable                 | Source in VPS .env |
| ----------------------------- | ------------------ |
| `SUPABASE_ANON_KEY`           | `ANON_KEY`         |
| `SUPABASE_SERVICE_ROLE_KEY`   | `SERVICE_ROLE_KEY` |
| `SUPABASE_JWT_SECRET`         | `JWT_SECRET`       |
| `DATABASE_URL` / `DIRECT_URL` | `POSTGRES_PASSWORD` |

Use direct PostgreSQL access on port `5433`:

```bash
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@<SUPABASE_VPS_IP>:5433/postgres
DIRECT_URL=postgresql://postgres:<POSTGRES_PASSWORD>@<SUPABASE_VPS_IP>:5433/postgres
```

### 2. Install dependencies

```bash
pnpm install
```

If PowerShell blocks `pnpm`, use `pnpm.cmd`.

### 3. Validate database connectivity

Before Prisma commands, verify port `5433` is reachable:

```bash
nc -zv <SUPABASE_VPS_IP> 5433
```

No SSH tunnel is required.

### 4. Set up database (first time only)

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

### 5. Start dev servers

```bash
pnpm dev
```

Open `http://localhost:5173` or run `pnpm dev:tauri` for the native window.

## Dev commands

### Servers

| Command             | What it does |
| ------------------- | ------------ |
| `pnpm dev`          | API + Vite web preview + worker |
| `pnpm dev:api`      | API only (port 4010) |
| `pnpm dev:frontend` | Vite only (port 5173) |
| `pnpm dev:worker`   | Worker only |
| `pnpm dev:tauri`    | Native Tauri window + servers |

### Database

| Command            | What it does |
| ------------------ | ------------ |
| `pnpm db:generate` | Regenerate Prisma client |
| `pnpm db:migrate`  | Apply pending migrations |
| `pnpm db:seed`     | Seed module lifecycle metadata, roles, permissions |
| `pnpm db:studio`   | Open Prisma Studio (`http://localhost:5555`) |
| `pnpm db:fresh`    | Migrate + generate + seed (non-destructive) |

### Build

| Command               | What it does |
| --------------------- | ------------ |
| `pnpm build`          | Build all apps and packages |
| `pnpm icons:generate` | Regenerate Tauri app icons |
| `pnpm brand:build`    | Regenerate desktop/web branding assets |

## Ports

| Service         | URL |
| --------------- | --- |
| API             | http://localhost:4010 |
| Frontend (Vite) | http://localhost:5173 |
| Prisma Studio   | http://localhost:5555 |
| Supabase API    | https://supabase.racoondevs.com |
| Supabase Studio | https://studio.supabase.racoondevs.com |

## Architecture

```txt
apps/
  desktop/     React + Vite + Tauri 2 (desktop shell)
  api/         Node.js + Hono (business logic + REST API)
  worker/      Background job handler
packages/
  core/           Module registry, event bus, manifest contract
  module-engine/  @atlas/module-engine (defineAtlasModule, defineModel, defineView, definePage)
  ui/             Shared React components
  sdk/            Atlas API client (createAtlasClient)
  validators/     Zod schemas shared between API and frontend
modules/
  custom/      Community and partner modules
  official/    Optional curated official distributions
prisma/
  schema.prisma   Atlas Core stable models + AME3 metadata tables
  seed.js         Seeds module lifecycle metadata, roles, permissions
```

Request flow:
`React -> @atlas/sdk -> Hono API -> Zod validation -> Prisma / Atlas ORM -> Supabase PostgreSQL`

No direct database access from the frontend.

## Module system

Atlas ERP is a module engine. New AME3 modules live in `modules/custom/` and declare their own models, views, pages, navigation, permissions, and API endpoints.

- Core modules (`core: true`, `uninstallable: false`):
  - `atlas.core`
  - `atlas.identity`
  - `atlas.files`
  - `atlas.company`
  - `atlas.contacts`
  - `atlas.hr`
- Custom modules: `custom.*` or `community.*` in `modules/custom/`
- Official manifest snapshots: `apps/api/src/manifests/official/`

New modules use `defineAtlasModule` from `@atlas/module-engine`.

See:
- `docs/02_module_system.md`
- `docs/03_custom_modules.md`
- `docs/architecture/atlas-module-engine-v3.md`
- `docs/TASKS.md`

## Notes

- UI text in Spanish.
- Code, docs, and comments in English.
- JavaScript only.
- Tailwind for styles.
- Prisma pinned to `^7` via workspace overrides.
- Supabase Studio is admin-only.
