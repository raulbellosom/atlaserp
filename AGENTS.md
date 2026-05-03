# AGENTS.md

This file guides Codex and other coding agents working in this repository.

## Project Identity

Atlas ERP is a desktop-first, full-stack, modular ERP platform inspired by Odoo, built with:

- React + Vite + Tauri for the desktop shell
- Node.js + Hono for the Atlas API
- Prisma ORM with PostgreSQL
- pnpm workspaces
- TailwindCSS and shared React UI components
- Redis and MinIO in local development

Do not replace this stack unless the user explicitly asks for an architecture migration.

## Architecture Rules

The required request flow is:

```txt
React/Tauri desktop app
  -> @atlas/sdk
  -> Atlas API
  -> services/module backend logic
  -> Prisma
  -> PostgreSQL
```

Frontend code must not access the database directly. Business rules, validation, module lifecycle rules, permissions, and persistence belong in the API layer.

For files:

```txt
React/Tauri
  -> Atlas API
  -> storage provider
  -> MinIO now, Supabase Storage later if requested
```

Supabase self-hosted is a future/advanced deployment scenario. Keep the current development path compatible with standard PostgreSQL, Redis, and MinIO unless the user explicitly asks to move further into Supabase.

## Current Repository Shape

Important folders:

- `apps/desktop` - React + Vite + Tauri desktop shell
- `apps/api` - Hono API
- `apps/worker` - background worker stub
- `packages/core` - module registry, event bus, manifest contract
- `packages/maps` - core and feature module manifests
- `packages/ui` - shared UI components
- `packages/sdk` - Atlas API client
- `packages/validators` - shared Zod schemas
- `prisma` - schema, migrations, seed
- `docs` - architecture and task docs
- `codex` - long-form Codex project prompt

Read `README.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `docs/MODULE_SYSTEM.md`, `docs/BLUEPRINTS.md`, and `docs/TASKS.md` before meaningful feature work.

## Commands

Use `pnpm.cmd` from PowerShell if `pnpm` is blocked by Windows script execution policy.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd infra:up
pnpm.cmd db:generate
pnpm.cmd db:migrate
pnpm.cmd db:seed
pnpm.cmd dev
```

Useful checks:

```powershell
docker compose -f docker-compose.local-lite.yml ps
pnpm.cmd exec prisma migrate status
Invoke-WebRequest -UseBasicParsing http://localhost:4010/health
Invoke-WebRequest -UseBasicParsing http://localhost:5173
```

If `pnpm.cmd db:generate` fails on Windows with `EPERM` while renaming `query_engine-windows.dll.node`, check for running Node/API/dev processes that are holding the Prisma client DLL. Do not kill user processes without clear intent; report the lock and retry after dev servers are stopped.

## Implementation Standards

- Use JavaScript, not TypeScript, unless a specific existing area already uses TypeScript.
- Keep UI text in Spanish. Keep code, docs, and comments in English.
- Use TailwindCSS for styling.
- Keep repeated visual components in `packages/ui` or reusable module-local components.
- Use `@atlas/sdk` for frontend API calls.
- Use Zod schemas from `packages/validators` before writes.
- Keep API route files thin as features grow; move business rules into services.
- Prefer disabling/archiving over destructive delete behavior.
- Core modules must not be uninstallable.
- Update `docs/TASKS.md` when completing meaningful project phases.

## Module System

ERP modules are "maps". Manifests live in `packages/maps`.

Core modules:

- `atlas.core`
- `atlas.identity`
- `atlas.files`

Feature modules currently include:

- `atlas.contacts`
- `atlas.finance`

Each new module should define a manifest with key, name, version, dependencies, navigation, permissions, blueprints, exposed capabilities, and consumed capabilities. Add Prisma models, API routes/services, validators, UI, and docs only as needed for the current phase.

## Current Verified Status

Last checked by Codex on 2026-05-02:

- Dependencies are installed and lockfile is current.
- Local-lite Docker services are running: PostgreSQL, Redis, MinIO.
- PostgreSQL is healthy on `localhost:5432`.
- `pnpm.cmd db:generate` succeeds when no API process is holding the Prisma client DLL.
- Prisma reports one migration and the database schema is up to date.
- `pnpm.cmd db:seed` succeeds and seeds core modules.
- API health endpoint responds at `http://localhost:4010/health` when the API server is started.
- Vite web preview responds at `http://localhost:5173`.
- `pnpm.cmd --filter @atlas/desktop build:web` succeeds.
- The folder is not currently a Git repository.

Known starter gaps:

- Desktop app still needs React Router.
- Navigation is currently hardcoded in `apps/desktop/src/main.jsx`.
- Module detail and install/disable UI are not complete.
- Contacts has API list/create foundations but no full CRUD UI yet.
- DynamicForm and DynamicTable foundations are not implemented yet.
