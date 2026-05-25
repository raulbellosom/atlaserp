# AGENTS.md

This file guides Codex and other coding agents working in this repository.

## Project Identity

**Atlas ERP Meridian Edition** - a desktop-first, full-stack, modular ERP platform inspired by Odoo, built with:

- React + Vite + Tauri for the desktop shell
- Node.js + Hono for the Atlas API
- Prisma ORM (workspace baseline `^7`) with PostgreSQL via self-hosted Supabase
- pnpm workspaces
- TailwindCSS and shared React UI components
- **Supabase** for Auth, Storage, and PostgreSQL (self-hosted at https://supabase.racoondevs.com)

There is no local Docker stack (no Redis, no MinIO). All persistence goes through Supabase.

## Infrastructure

- **Supabase API**: https://supabase.racoondevs.com - self-hosted instance, NOT Supabase Cloud
- **Supabase Studio**: https://studio.supabase.racoondevs.com (admin use only)
- **PostgreSQL** is exposed on port `5433` of the Supabase VPS (direct Postgres, not the pooler on `5432`). No SSH tunnel required. Your machine's IP must be allowlisted in the Supabase VPS firewall. `DATABASE_URL` and `DIRECT_URL` connect directly via `<SUPABASE_VPS_IP>:5433`.
- **Supabase Storage**: used for file assets. Canonical bucket: `atlas-files` (all modules, including branding/logo, organized by objectKey folders + FileAsset metadata).
- **Supabase Auth**: used for user account creation and authentication.

## MCP Server

The Supabase MCP server is configured and available for database inspection, docs, and debugging:

- **`.vscode/mcp.json`** (VS Code): `https://supabase.racoondevs.com/mcp?features=docs%2Cdatabase%2Cdebugging%2Cdevelopment`
- **`.mcp.json`** (root, for Claude/other agents): `https://supabase.racoondevs.com/mcp`

Use MCP tools when querying or inspecting live database state, schema, or Supabase docs.

## Architecture Rules

Required request flow:

```txt
React/Tauri desktop app
  -> @atlas/sdk  (packages/sdk)
  -> Atlas API   (apps/api - Hono)
  -> Zod validation (@atlas/validators)
  -> Prisma
  -> Supabase PostgreSQL
```

For file uploads:

```txt
React/Tauri -> Atlas API -> Supabase Storage (supabaseAdmin client)
```

Frontend code must not access the database or Supabase directly. The API owns all business rules, validation, and auth-admin operations (uses `SUPABASE_SERVICE_ROLE_KEY`). The frontend only holds `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

## Repository Shape

| Folder                | Purpose                                                     |
| --------------------- | ----------------------------------------------------------- |
| `apps/desktop`        | React + Vite + Tauri desktop shell                          |
| `apps/api`            | Hono API - routes, Prisma, Supabase Admin client            |
| `apps/worker`         | Background worker stub                                      |
| `packages/core`       | Module registry, event bus, manifest contract               |
| `packages/ui`         | Shared React components (`AppShell`, `Button`, `Card`, ...) |
| `packages/sdk`        | `createAtlasClient` factory - all frontend API calls        |
| `packages/validators` | Zod schemas shared between API and frontend                 |
| `prisma`              | `schema.prisma`, migrations, `seed.js`                      |
| `docs`                | Architecture and task docs                                  |

Before meaningful feature work, read: [CLAUDE.md](CLAUDE.md), [docs/TASKS.md](docs/TASKS.md), [docs/08_blueprints.md](docs/08_blueprints.md).

## Commands

> **Port 5433 must be reachable** (`nc -zv <SUPABASE_VPS_IP> 5433`) before any `db:*` command.

Use `pnpm.cmd` from PowerShell if `pnpm` is blocked by Windows execution policy.

```powershell
# First time
pnpm.cmd install --frozen-lockfile

# Database
pnpm.cmd db:generate   # regenerate Prisma client after schema changes
pnpm.cmd db:migrate    # apply pending migrations
pnpm.cmd db:seed       # seed core modules, roles, permissions
pnpm.cmd db:fresh      # migrate + generate + seed (non-destructive)
pnpm.cmd db:studio     # Prisma Studio at http://localhost:5555

# Dev servers
pnpm.cmd dev           # API (4010) + Vite (5173) + worker
pnpm.cmd dev:api
pnpm.cmd dev:frontend
```

Useful checks:

```powershell
Invoke-WebRequest -UseBasicParsing http://localhost:4010/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173
```

**Windows gotcha**: If `db:generate` fails with `EPERM` renaming `query_engine-windows.dll.node`, a running Node/API process is holding the Prisma DLL. Stop dev servers first, then retry.

## Implementation Standards

- **JavaScript only** - no TypeScript unless an existing area already uses it.
- UI text in **Spanish**. Code, docs, and comments in **English**.
- **TailwindCSS** for all styles - no CSS modules or styled-components.
- Use `@atlas/sdk` for all frontend API calls - never `fetch` directly.
- Use Zod schemas from `@atlas/validators` before any write.
- Prefer `enabled: false` (soft-disable) over hard deletes.
- Core modules must not be uninstallable.
- Keep API route handlers thin; push business logic into service functions.
- **Global ID policy (hard rule)**: use **UUID v7 only** for all entity identifiers (Prisma IDs, relation IDs, validator ID contracts, module IDs). Do not introduce `cuid` in new or modified code. `z.string().uuid()` is the validator baseline for ID inputs.
- **Atomic file size limit** — No source file may exceed **1000 lines**. Hard ceiling is **1500 lines** (treat as a build-blocking violation). Files approaching 800 lines should be proactively split. Strategies: extract sub-components into their own files, split route files by domain, separate form sheets from list screens, move helpers into `lib/` or `utils/` files. Current known violators that must be decomposed: `FinanceScreen.jsx` (4462), `apps/api/src/index.js` (3583), `FormFields.jsx` (2153), `HrEmployeeDetail.jsx` (1704), `finance-documents-service.js` (1118), `finance-service.js` (1076), `ModuleCatalog.jsx` (1033).
- **Never use native browser dialogs** (`window.confirm`, `window.alert`, `window.prompt`, `prompt`). Always use the shared `<ConfirmDialog>` component from `@atlas/ui` for confirmations.
- Update [docs/TASKS.md](docs/TASKS.md) when completing meaningful project phases.
- In docs checklists, mark `[x]` only with explicit verification evidence and a concrete `Verified: YYYY-MM-DD (...)` note.
- Prisma baseline is `^7` in root workspace overrides. Keep Prisma versions aligned across workspace packages.
- Never expose `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `JWT_SECRET`, or `DATABASE_URL` to the frontend via `VITE_` prefixes.

## Prisma Migration Safety (Hard Rule)

- Applied migrations are immutable.
- Never edit an existing file under `prisma/migrations/**/migration.sql` after it was applied in any environment.
- Never rewrite migration SQL manually to "fix" history. Create a new forward migration instead.
- If history drift is detected, reconcile `_prisma_migrations` metadata only after verifying data safety; do not reset by default.

## Module System

AME3 modules are filesystem modules. New module work lives in `modules/custom/` or `modules/official/`.
Official module manifest snapshots are maintained in `apps/api/src/manifests/official/`.

**Core modules** (`core: true`, `uninstallable: false`):

- `atlas.core`
- `atlas.identity`
- `atlas.files`
- `atlas.company`

**Feature modules** (installable, versioned):

- `atlas.contacts`
- `atlas.finance`

Each new module needs: `module.manifest.js`, `models/`, `views/`, optional `api/` + `components/`, lifecycle sync, and `docs/TASKS.md` evidence updates. Prefer Atlas ORM (`defineModel`) over new Prisma feature tables. See [docs/02_module_system.md](docs/02_module_system.md).

## Current Phase Status (2026-05-20)

| Phase                             | Status      | Notes                                             |
| --------------------------------- | ----------- | ------------------------------------------------- |
| 0 - Repo cleanup + env alignment  | Complete    | Supabase-first env, numbered docs suite           |
| 1 - Supabase + Prisma connection  | Complete    | 3 migrations applied, 4 core modules seeded       |
| 2 - ERP initialization state      | Complete    | InitGuard + instance status routing complete      |
| 3 - Onboarding setup wizard       | Complete    | Transactional setup + branding flow complete      |
| 4 - Auth integration              | Complete    | Login, session persistence, protected API context |
| 5 - Shell and module lifecycle UI | Complete    | Runtime registry + catalog + lifecycle guards     |
| 6 - Contacts module               | Complete    | Full CRUD UI/API + contact picker                 |
| 7 - Files module                  | Complete    | Files v1 + v1.1 UX + storage unification          |
| 8 - Finance module                | Complete    | Implemented and verified                          |
| AME3 Phase 1                      | Complete    | `@atlas/module-engine` foundation                 |
| AME3 Phase 2                      | Complete    | Route loader + `custom.fleet` sample module       |
| AME3 Phase 3                      | Complete    | Atlas ORM + Blueprint renderer                    |
| AME3 Phase 4                      | Complete    | Discovery+sync primary, route/component lifecycle |
| AME3 Phase 5                      | Retired     | Official module relocation no longer required     |

See [docs/TASKS.md](docs/TASKS.md) for the full task checklist.

## Known Gaps

- Automated contract/regression coverage is still limited for module lifecycle, contacts, and files.
- Legacy planning docs may include historical unchecked task markers; use `docs/TASKS.md` as status source of truth.
