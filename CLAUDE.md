# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# First-time setup
cp .env.example .env
# Fill in SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL, DIRECT_URL, JWT_SECRET
# Get connection strings from https://studio.supabase.racoondevs.com

pnpm install          # install all dependencies
pnpm db:generate      # generate Prisma client
pnpm db:migrate       # apply migrations to Supabase PostgreSQL
pnpm db:seed          # seed core modules, permissions, roles

# Start dev servers (API + Vite web preview + worker)
pnpm dev              # recommended for daily dev - web at http://localhost:5173
pnpm dev:tauri        # full native Tauri window (requires Rust toolchain)

# Start individually
pnpm dev:api          # API on port 4010
pnpm dev:frontend     # Vite web preview on port 5173
pnpm dev:worker       # Background worker

# Database
pnpm db:migrate       # run pending migrations
pnpm db:generate      # regenerate Prisma client after schema changes
pnpm db:seed          # seed core modules, permissions, roles
pnpm db:studio        # open Prisma Studio GUI (http://localhost:5555)
pnpm db:fresh         # migrate + generate + seed (non-destructive)
pnpm db:reset         # migrate reset --force + seed (destructive - wipes data)

# Build and lint
pnpm build            # build all packages/apps
pnpm lint             # lint all packages/apps

# Tests (Node.js built-in test runner — no Vitest/Jest)
node --test packages/module-engine/src/__tests__/          # module-engine unit tests
node --test apps/api/src/services/__tests__/               # API service tests
node --test <path/to/file.test.js>                         # single test file
node --check <path/to/file.js>                             # syntax/static check only
```

There is no `pnpm infra:up` or local database stack. All development connects to the self-hosted Supabase instance. Postgres is available directly on port `5433` of the Supabase VPS (port `5432` is the Supavisor pooler — not suitable for Prisma). Your IP must be allowlisted in the Supabase VPS firewall.

### Desktop native build (Windows only)

```bash
cd apps/desktop
pnpm tauri build   # Produces .exe via Rust/Tauri toolchain
pnpm tauri dev     # Native window with hot-reload
```

Tauri requires Rust toolchain + Windows SDK. For development without Tauri, use `pnpm dev:frontend` (Vite web preview only).

## Architecture

### Monorepo structure

```
apps/
  desktop/     React + Vite + Tauri 2 (desktop shell)
  api/         Node.js + Hono (business logic + API)
  worker/      Node.js background job handler (stub)
packages/
  core/           Module registry, event bus, manifest contract
  maps/           Legacy module manifests (being migrated to modules/) — do not extend
  module-engine/  @atlas/module-engine — AME3 primitives: defineAtlasModule, defineModel, defineView, definePage
  ui/             Shared React components (AppShell, Button, AtlasTable, AtlasForm, etc.)
  sdk/            Atlas API client (createAtlasClient factory)
  validators/     Zod schemas shared between API and frontend
modules/
  custom/      Custom AME3 modules (e.g. custom.fleet) — self-contained, no core edits needed
  official/    Future home for migrated official modules (currently empty)
prisma/
  schema.prisma   Single source of truth for Prisma-managed models (core + legacy feature models)
  seed.js         Seeds core modules, blueprints, permissions
```

### Request flow

```
React (apps/desktop)
  -> @atlas/sdk createAtlasClient   (packages/sdk)
  -> Hono API (apps/api/src/index.js)
  -> Zod validation (@atlas/validators)
  -> Prisma -> Supabase PostgreSQL
```

No direct database access from the frontend. The API is the authority for all business rules, validation, and permissions.

### Supabase infrastructure

All development uses the dedicated self-hosted Supabase instance:

- API: https://supabase.racoondevs.com
- Studio: https://studio.supabase.racoondevs.com (admin use only)

### Module system (packages/core + packages/maps)

Every ERP feature is a **map** (module). Modules are registered via manifests defined in `packages/maps/`.

A manifest defines: `key`, `name`, `version`, `kind`, `core`, `uninstallable`, `dependencies`, `permissions`, `navigation`, `blueprints`, `exposes`, `consumes`.

Two categories:

- **Core modules** (`core-modules.js`): `core: true`, `uninstallable: false` - atlas.core, atlas.identity, atlas.files, atlas.company. Cannot be removed via API.
- **Feature modules** (`feature-modules.js`): installable, versioned, can depend on other modules.

The `ModuleRegistry` class (`packages/core/src/module-registry.js`) handles registration, dependency validation, navigation resolution, and blueprint flattening. The API seeds these into `AtlasModule` rows via `prisma/seed.js`.

### Blueprint system

Blueprints are declarative JSON schemas describing UI and entity metadata. They live in module manifests under `blueprints`, are stored in the `Blueprint` table, and are served via `GET /blueprints`.

Blueprint kinds: `ENTITY`, `FORM`, `TABLE`, `DASHBOARD`, `ACTION`, `RELATION`, `PERMISSION`.

See `docs/08_blueprints.md` for field type reference and rendering rules.

### API structure (apps/api/src/)

```
apps/api/src/
  index.js                  entry point — bootstraps Hono, loads services, registers middleware
  routes/
    modules.js              12-endpoint module lifecycle router (install/enable/disable/uninstall/reset/sync...)
    ledger.js               atlas.ledger routes
  services/
    route-loader-service.js AME3 Route Loader — dynamically mounts api/index.js from modules/custom/* at boot
    module-lifecycle-service.js
    finance-service.js, finance-documents-service.js, finance-posting-service.js, ...
    hr-service.js, contacts-service.js, files-service.js, company-service.js, ledger-service.js, ...
  permission-catalog.js     granular RBAC permission definitions
```

Route Loader behavior: on API boot, `route-loader-service.js` reads all `INSTALLED` + `enabled` modules from DB, looks for `modules/custom/<moduleKey>/api/index.js` (or `modules/official/`), imports it as a Hono router factory, and delegates matching requests at runtime. No `index.js` edits needed when adding a new AME3 module.

Key endpoints:

- `GET /health` - liveness check
- `GET|POST /modules`, `POST /modules/:key/install|disable|enable|uninstall|reset|sync` - module lifecycle
- `GET /blueprints` - all enabled blueprints with module metadata
- `GET|POST|PUT|PATCH /contacts...` - contacts CRUD + picker
- `POST|GET|PATCH /files...` - files upload/list/detail/signed-url/rename/bulk-download/lifecycle
- `GET|POST|PATCH /finance/...` - accounts, entries, documents (AR/AP), applications, tax-rates, FX rates

### Shared validators (packages/validators)

Zod schemas are shared between API and frontend. Add new schemas here when creating new module contracts.

### SDK (packages/sdk)

`createAtlasClient({ baseUrl })` returns a client grouped by domain (`modules`, `blueprints`, `identity`, `contacts`, `files`, etc.). The desktop app instantiates this using `VITE_ATLAS_API_URL`.

### UI components (packages/ui)

`AppShell` is the main layout: fixed sidebar + scrollable main content. Navigation items come from module manifests resolved at runtime. Import from `@atlas/ui`.

Tailwind scans both `src/**` and `../../packages/ui/src/**` (configured in `apps/desktop/tailwind.config.js`).

### Prisma schema highlights

- `AtlasModule` - installed modules (status: INSTALLED/DISABLED/UNINSTALLED/ERROR)
- `Blueprint` - stored blueprint JSON per module
- `InstanceConfig` - key-value store for instance-level state
- `Permission` + `Role` + `RolePermission` - RBAC
- `Company` + `UserProfile` + `Membership` - multi-tenancy foundation
- `AuditLog` - entity-level audit trail
- `FileAsset` - file metadata only (actual files in Supabase Storage)
- `Contact` - contacts entity
- `FinanceAccount` + `FinanceTransaction` - initial finance models (to be evolved in Phase 8)

## Language and conventions

- **JavaScript only** - no TypeScript in this repo yet
- **No emojis** in UI or documentation
- **All UI text in Spanish** - code, docs, and comments in English
- **Tailwind** for all styles - no CSS modules or styled-components
- **React Hook Form + Zod** for forms
- **TanStack Query** for server state; Zustand for client-only UI state when needed
- **Hono** for API routes - keep route files thin, push logic to services
- Business logic stays in `apps/api`, not in React components
- **Atomic file size limit** — No source file may exceed **1000 lines**. Hard ceiling is **1500 lines** (treat as a build-blocking violation). Files approaching 800 lines should be proactively split. Strategies: extract sub-components, split routes by domain, separate sheets/dialogs from list screens, move helpers into `lib/` or `utils/`. Known violators that must be decomposed: `FinanceScreen.jsx` (4462), `apps/api/src/index.js` (3583), `FormFields.jsx` (2153), `HrEmployeeDetail.jsx` (1704), `finance-documents-service.js` (1118), `finance-service.js` (1076), `ModuleCatalog.jsx` (1033).
- Soft-delete pattern: use `enabled: false` instead of hard-deleting records
- Every **new AME3 module** lives in `modules/custom/<moduleKey>/` — requires only `module.manifest.js`, `models/`, `views/`, `api/index.js`, `validators/index.js`. No edits to `prisma/schema.prisma`, `apps/api/src/index.js`, `packages/maps/`, or `packages/validators/`. See `docs/03_custom_modules.md`.
- **Legacy modules** (contacts, files, finance, hr, ledger, identity, company) still live in `packages/maps/` + `apps/api/src/` + `apps/desktop/src/modules/`. They follow the old checklist: manifest in `packages/maps`, Prisma model(s), API routes, service, Zod schema in `packages/validators`. Do not extend this pattern for new modules.
- In docs checklists, mark `[x]` only with explicit verification evidence and `Verified: YYYY-MM-DD (...)`
- Prisma is at `^7` - root `package.json` overrides all workspace packages to `^7.8.0`
- Applied Prisma migrations are immutable: never edit existing `prisma/migrations/**/migration.sql`
- Never "fix" migration history by rewriting old SQL; always create a new forward migration
- AME3 module tables are managed by Atlas ORM (`AtlasModel`/`AtlasField` in Prisma + `defineModel` in module). Do not create Prisma models for AME3 module tables.

## Architecture documentation

Before adding a new feature, read:

- `docs/01_erp_architecture.md` - full system architecture
- `docs/02_module_system.md` - module system (AME3-first)
- `docs/03_core_modules.md` - core module definitions
- `docs/03_custom_modules.md` - how to build an AME3 custom module (13-step workflow)
- `docs/08_blueprints.md` - blueprint field types and rendering rules
- `docs/architecture/atlas-module-engine-v3.md` - AME3 full architecture, roadmap, and required spec sections
- `docs/TASKS.md` - current phase status and roadmap

## Spec-Driven Development

All new features and modules follow the spec -> plan -> implementation -> verification workflow. Implementation must not begin without an approved spec in `docs/superpowers/specs/` and an approved plan in `docs/superpowers/plans/`. See `docs/spec-driven-development.md` for the full methodology, required spec sections, module checklist, and agent mode rules.

## Development phases (current state)

See `docs/TASKS.md` for the full phased roadmap.

- Phase 0–7.1.1: complete (repo setup, auth, shell, contacts, files)
- Phase 8 (Finance): complete — double-entry accounting, AR/AP, FX, taxes, aging, applications, reversal (phases 8.1–8.6)
- Phase 9 (HR): in progress — employee detail redesign
- Phase 9.5 (Module Lifecycle v2): complete — Permission.active, dry-run uninstall/reset, cleanup registry
- AME3 Phase 1 (Module Engine foundation): complete — `packages/module-engine` with `defineAtlasModule`, `defineModel`, `defineView`, `definePage`, SQL generator, checksum
- AME3 Phase 2 (Route Loader + custom module): complete — `route-loader-service.js`, `custom.fleet` module operational
- AME3 Phase 3 (Atlas ORM + Blueprint Renderer): complete — Atlas ORM provisions tables from `defineModel`; blueprint renderer (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) in `@atlas/ui`
- AME3 Phase 4+ (Discovery as primary source, migrate official modules): planned
