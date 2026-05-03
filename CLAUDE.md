# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env
pnpm setup            # install + start infra + migrate + seed

# Start dev servers (API + Vite web preview + worker)
pnpm dev              # recommended for daily dev — web at http://localhost:5173
pnpm dev:tauri        # full native Tauri window (requires Rust toolchain)

# Start individually
pnpm dev:api          # API on port 4010
pnpm dev:frontend     # Vite web preview on port 5173
pnpm dev:worker       # Background worker

# Infrastructure (Docker — Postgres, Redis, MinIO)
pnpm infra:up         # start
pnpm infra:down       # stop
pnpm infra:reset      # wipe volumes and restart
pnpm infra:status     # show container status

# Database
pnpm db:migrate       # run pending migrations
pnpm db:generate      # regenerate Prisma client after schema changes
pnpm db:seed          # seed core modules, permissions, roles
pnpm db:studio        # open Prisma Studio GUI
pnpm db:reset         # drop + re-migrate + seed (wipes all data)
pnpm db:fresh         # migrate + generate + seed (non-destructive)

# Build
pnpm build            # build all packages/apps
```

Copy `.env.example` → `.env` before first run. The API reads `DATABASE_URL` and `ATLAS_API_PORT`.

### Desktop native build (Windows only, outside Docker)

```bash
cd apps/desktop
pnpm tauri build   # Produces .exe via Rust/Tauri toolchain
pnpm tauri dev     # Native window with hot-reload
```

Tauri requires Rust toolchain + Windows SDK. For development without Tauri, use `pnpm dev:desktop` (Vite web preview only).

## Architecture

### Monorepo structure

```
apps/
  desktop/     React + Vite + Tauri 2 (desktop shell)
  api/         Node.js + Hono (business logic + API)
  worker/      Node.js background job handler (stub)
packages/
  core/        Module registry, event bus, manifest contract
  maps/        Module manifests: core-modules.js + feature-modules.js
  ui/          Shared React components (AppShell, Button, Card, etc.)
  sdk/         Atlas API client (createAtlasClient factory)
  validators/  Zod schemas shared between API and frontend
prisma/
  schema.prisma   Single source of truth for data models
  seed.js         Seeds core modules, blueprints, permissions
```

### Request flow

```
React (apps/desktop)
  → @atlas/sdk createAtlasClient   (packages/sdk)
  → Hono API (apps/api/src/index.js)
  → Zod validation (@atlas/validators)
  → Prisma → PostgreSQL
```

No direct database access from the frontend. The API is the authority for all business rules, validation, and permissions.

### Module system (packages/core + packages/maps)

Every ERP feature is a **map** (module). Modules are registered via manifests defined in `packages/maps/`.

A manifest defines: `key`, `name`, `version`, `kind`, `core`, `uninstallable`, `dependencies`, `permissions`, `navigation`, `blueprints`, `exposes`, `consumes`.

Two categories:
- **Core modules** (`core-modules.js`): `core: true`, `uninstallable: false` — atlas.core, atlas.identity, atlas.files. Cannot be removed via API.
- **Feature modules** (`feature-modules.js`): installable, versioned, can depend on other modules — e.g. atlas.contacts, atlas.finance.

The `ModuleRegistry` class (`packages/core/src/module-registry.js`) handles registration, dependency validation, navigation resolution, and blueprint flattening. The API seeds these into `AtlasModule` rows in PostgreSQL via `prisma/seed.js`.

### Blueprint system

Blueprints are declarative JSON schemas that describe UI and entity metadata. They live in module manifests under the `blueprints` array, are stored in the `Blueprint` table, and are served via `GET /blueprints`.

Blueprint kinds: `ENTITY`, `FORM`, `TABLE`, `DASHBOARD`, `ACTION`, `RELATION`, `PERMISSION`.

Blueprints drive `DynamicForm` and `DynamicTable` UI components — they are not a substitute for Prisma models or backend validation. Prisma schema + API services remain the source of truth.

See `docs/BLUEPRINTS.md` for field type reference and rendering rules.

### API structure (apps/api/src/index.js)

Current pattern: routes → direct Prisma calls. As features grow, introduce a service layer:

```
routes (Hono handlers)
  → services (business logic)
  → Prisma (database)
```

Key endpoints:
- `GET /health` — liveness check
- `GET /modules` / `POST /modules/install` / `DELETE /modules/:key` — module lifecycle
- `GET /blueprints` — all enabled blueprints with module metadata
- `GET /contacts` / `POST /contacts` — first real CRUD module

The `DELETE /modules/:key` endpoint checks `module.core` and `module.uninstallable` before allowing removal.

### Shared validators (packages/validators)

`moduleInstallSchema` and `contactCreateSchema` are Zod schemas imported by both the API (for request validation) and potentially the frontend (for form validation). Add new schemas here when creating new modules.

### SDK (packages/sdk)

`createAtlasClient({ baseUrl })` returns a typed client object grouped by domain (`modules`, `blueprints`, `contacts`). The desktop app instantiates this once using `VITE_ATLAS_API_URL` and passes it down via props or context.

### UI components (packages/ui)

`AppShell` is the main layout: fixed sidebar (w-72) + scrollable main content. Navigation items come from the module manifests resolved at runtime via the API. Import components from `@atlas/ui`.

Tailwind is configured in `apps/desktop/tailwind.config.js` to scan both `src/**` and `../../packages/ui/src/**`.

### Prisma schema highlights

Key models relevant to the module system:
- `AtlasModule` — installed modules (status: INSTALLED/DISABLED/UNINSTALLED/ERROR)
- `Blueprint` — stored blueprint JSON per module
- `Permission` + `Role` + `RolePermission` — RBAC
- `Company` + `UserProfile` + `Membership` — multi-tenancy foundation
- `AuditLog` — entity-level audit trail
- `FileAsset` — file metadata only (actual files in MinIO or Supabase Storage)
- `Contact` — first real business entity

The schema is multi-tenancy-ready but the MVP runs with one company.

## Language and conventions

- **JavaScript only** — no TypeScript in this repo yet
- **No emojis** in UI or documentation
- **Tailwind** for all styles — no CSS modules or styled-components
- **React Hook Form + Zod** for forms
- **TanStack Query** for server state; Zustand for client-only UI state when needed
- **Hono** for API routes — keep route files thin, push logic to services
- Business logic stays in `apps/api`, not in React components
- Soft-delete pattern: disable/archive instead of hard-deleting records
- Every new module needs: manifest in `packages/maps`, Prisma model(s), API routes, service, Zod schema in `packages/validators`, and documentation update in `docs/TASKS.md`

## Development phases (current state)

See `docs/TASKS.md` for the full phased roadmap. The project is a working starter bundle:

- Phase 0 (infrastructure) — partially done; Docker stack defined, Prisma schema complete, seed script exists
- Phase 1 (ERP shell navigation) — partially done; AppShell exists but navigation is hardcoded in `apps/desktop/src/main.jsx`; needs React Router + dynamic nav from API
- Phase 2+ (Auth, DynamicForm/Table, Contacts CRUD, Finance) — not yet started

Before adding a new feature, read `docs/ARCHITECTURE.md`, `docs/MODULE_SYSTEM.md`, and `docs/BLUEPRINTS.md` to understand constraints.
