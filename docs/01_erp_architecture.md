# Atlas ERP — Architecture

## Overview

Atlas ERP is a desktop-first, full-stack modular ERP. The desktop app is a Tauri + React shell. All business logic lives in a Node.js/Hono API. Data is stored in a dedicated self-hosted Supabase instance.

Atlas ERP is a **module engine that ships ERP modules**. The Atlas Module Engine v3 (AME3) is the primary module architecture. See [docs/architecture/atlas-module-engine-v3.md](architecture/atlas-module-engine-v3.md) for the full specification.

## Stack

| Layer | Technology |
|---|---|
| Desktop | React 19, Vite, Tauri 2, JavaScript, TailwindCSS v4 |
| API | Node.js, Hono, Prisma 6 |
| Worker | Node.js (background jobs) |
| Data platform | Supabase self-hosted (PostgreSQL, Auth, Storage, Realtime) |
| Validation | Zod (shared between API and frontend) |
| State | TanStack Query (server state), Zustand (client UI state) |
| Forms | React Hook Form + Zod |

## Monorepo structure

```
apps/
  desktop/     React + Vite + Tauri 2 (desktop shell)
  api/         Node.js + Hono (business logic + REST API)
  worker/      Background job handler
packages/
  core/        Module registry, event bus, manifest contract, time utilities
  maps/        [DEPRECATED] Legacy module manifests — transitional only
  ui/          Shared React components
  sdk/         Atlas API client (createAtlasClient factory)
  validators/  Zod schemas shared between API and frontend
  module-engine/  @atlas/module-engine — defineAtlasModule, defineModel, defineView, definePage
modules/
  official/    Atlas team modules (migration target for Phase 5)
  custom/      Community and partner modules
prisma/
  schema.prisma   Single source of truth for Atlas Core data models only
  seed.js         Seeds core modules, permissions, roles
```

`packages/maps/` is deprecated. Its contents are the old manifest source for official modules. It remains only while official modules are migrated into `modules/official/`. It will be deleted in Phase 7.

## Layer responsibilities

**apps/desktop** — UI only. No business logic. No direct database access. Reads auth session from Supabase Auth client (anon key only). All ERP data goes through Atlas API via `@atlas/sdk`.

**packages/sdk** — Typed client factory `createAtlasClient({ baseUrl })`. Groups calls by domain. Attaches JWT bearer token from Supabase session to every API request.

**apps/api** — Single authority for all ERP business rules and validation. Verifies JWT via Supabase Auth Admin SDK (service role key — never exposed to frontend). Loads UserProfile + Role + Permissions from Prisma on each authenticated request. Architecture: Routes → Services → Prisma / Atlas ORM.

**apps/worker** — Background jobs: reports, file processing, scheduled tasks. Connects to Prisma directly. No public endpoints.

**modules/official/** — Official Atlas ERP modules (Phase 5 migration target). Each module is a self-contained directory with manifest, models, views, pages, API routes, and optional components.

**modules/custom/** — Community and partner modules. Same structure as official modules. Namespace must be `custom.*` or `community.*`.

**Supabase (external, self-hosted)** — PostgreSQL (Atlas tables via Prisma), Auth (sessions, JWTs, user creation), Storage (physical files), Realtime (future).

## Data flows

### ERP data
```
React → @atlas/sdk (JWT attached) → Atlas API → Service → Prisma / Atlas ORM → Supabase PostgreSQL
```

### Authentication
```
React → Supabase Auth client (anon key) → session JWT
Atlas API ← JWT in Authorization header
Atlas API → verifies via Admin SDK → loads UserProfile + permissions via Prisma
```

### File storage
```
React → Atlas API POST /files/upload (JWT) → API → Supabase Storage (service role)
                                                 → FileAsset metadata via Prisma
```

### First-run
```
React → GET /instance/status → { initialized: false }
      → /setup wizard → Atlas API creates Auth user, Company, UserProfile, BrandingConfig
                       → writes InstanceConfig.initialized = "true"
      → /login
```

## Supabase / Prisma boundary

**Prisma models Atlas Core. Atlas Module Engine models ERP modules.**

| Concern | Owner | Rule |
|---|---|---|
| `auth.users` | Supabase Auth | Never in Prisma migrations |
| `storage.objects` | Supabase Storage | Never in Prisma migrations |
| Atlas Core tables (`AtlasModule`, `Blueprint`, `Permission`, `Role`, `UserProfile`, etc.) | Prisma | Stable — never accessed from frontend |
| Module-owned business tables (Contact, FinanceAccount, HrEmployee, etc.) | Atlas ORM (Phase 3+) | Declared via `defineModel`; transitionally in Prisma during Phase 1–4 |
| Business rules / validation | Atlas API | Never in React components |
| Session tokens | Supabase Auth | Never stored in Atlas tables |
| File bytes | Supabase Storage | Never on local disk in production |
| File metadata (FileAsset) | Prisma | Never duplicated in Supabase Storage metadata |
| `SUPABASE_SERVICE_ROLE_KEY` | API only | Never in any VITE_ alias or frontend bundle |

## Supabase endpoints

| Purpose | URL |
|---|---|
| API | https://supabase.racoondevs.com |
| Studio | https://studio.supabase.racoondevs.com |
