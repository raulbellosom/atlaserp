# Atlas ERP — Architecture

## Overview

Atlas ERP is a desktop-first, full-stack modular ERP. The desktop app is a Tauri + React shell. All business logic lives in a Node.js/Hono API. Data is stored in a dedicated self-hosted Supabase instance.

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
  maps/        Module manifests: core-modules.js + feature-modules.js
  ui/          Shared React components
  sdk/         Atlas API client (createAtlasClient factory)
  validators/  Zod schemas shared between API and frontend
prisma/
  schema.prisma   Single source of truth for Atlas data models
  seed.js         Seeds core modules, permissions, roles
```

## Layer responsibilities

**apps/desktop** — UI only. No business logic. No direct database access. Reads auth session from Supabase Auth client (anon key only). All ERP data goes through Atlas API via `@atlas/sdk`.

**packages/sdk** — Typed client factory `createAtlasClient({ baseUrl })`. Groups calls by domain. Attaches JWT bearer token from Supabase session to every API request.

**apps/api** — Single authority for all ERP business rules and validation. Verifies JWT via Supabase Auth Admin SDK (service role key — never exposed to frontend). Loads UserProfile + Role + Permissions from Prisma on each authenticated request. Architecture: Routes → Services → Prisma.

**apps/worker** — Background jobs: reports, file processing, scheduled tasks. Connects to Prisma directly. No public endpoints.

**Supabase (external, self-hosted)** — PostgreSQL (Atlas tables via Prisma), Auth (sessions, JWTs, user creation), Storage (physical files), Realtime (future). Studio at https://studio.supabase.racoondevs.com for admin use only.

## Data flows

### ERP data
```
React → @atlas/sdk (JWT attached) → Atlas API → Service → Prisma → Supabase PostgreSQL
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

| Concern | Owner | Rule |
|---|---|---|
| `auth.users` | Supabase Auth | Never in Prisma migrations |
| `storage.objects` | Supabase Storage | Never in Prisma migrations |
| `public.*` Atlas tables | Prisma | Never accessed directly from frontend |
| Business rules / validation | Atlas API | Never in React components |
| Session tokens | Supabase Auth | Never stored in Atlas tables |
| File bytes | Supabase Storage | Never on local disk in production |
| File metadata (FileAsset) | Prisma | Never duplicated in Supabase Storage metadata |
| SUPABASE_SERVICE_ROLE_KEY | API only | Never in any VITE_ alias or frontend bundle |

## Supabase endpoints

| Purpose | URL |
|---|---|
| API | https://supabase.racoondevs.com |
| Studio | https://studio.supabase.racoondevs.com |
