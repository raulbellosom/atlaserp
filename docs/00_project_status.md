# Atlas ERP — Project Status

**Last verified:** 2026-05-02
**Current phase:** Phase 0 complete / Phase 1 in progress

## What exists and works

### API (apps/api)
- Hono server on port 4010
- Routes: GET /health, GET /modules, POST /modules/install, DELETE /modules/:key, GET /blueprints, GET /contacts, POST /contacts
- Direct Prisma calls (no service layer yet — planned for Phase 4+)

### Frontend (apps/desktop)
- React 19 + Vite + Tauri 2, web preview on port 5173
- Single dashboard page (no React Router)
- Hardcoded navigation array
- TanStack Query for server state, glass morphism design

### Packages
- `@atlas/core` — ModuleRegistry, AtlasEventBus, createModuleManifest, MODULE_KINDS, time utilities
- `@atlas/maps` — 4 core module manifests, 2 feature module manifests
- `@atlas/ui` — 28 React components (AppShell, Button, Card, DataTable, Dialog, Form, etc.)
- `@atlas/sdk` — createAtlasClient factory
- `@atlas/validators` — Zod schemas: moduleInstallSchema, contactCreateSchema

### Database (Prisma, 15 models)
AtlasModule, ModuleDependency, Blueprint, InstanceConfig, Company, UserProfile, Membership, Role, Permission, RolePermission, FileAsset, AuditLog, Contact, FinanceAccount, FinanceTransaction

### Seeded data
- 4 core modules: atlas.core, atlas.identity, atlas.files, atlas.branding
- system.admin role with all core permissions
- All module permissions

## What is stubbed or not yet started

| Area | Status | Planned phase |
|---|---|---|
| React Router | Not started | Phase 5 |
| Supabase Auth integration | Not started | Phase 4 |
| Setup wizard / first-run | Not started | Phase 3 |
| GET /instance/status endpoint | Not started | Phase 2 |
| DynamicForm / DynamicTable | Not started | Phase 3 |
| Service layer in API | Not started | Phase 4+ |
| Worker jobs | Stub only | Phase 8+ |
| File upload/download endpoints | Not started | Phase 7 |
| Auth middleware in API | Not started | Phase 4 |
| Contacts CRUD UI | Not started | Phase 6 |
| Finance CRUD | Not started | Phase 8 |

## Supabase infrastructure

| Endpoint | URL |
|---|---|
| API | https://supabase.racoondevs.com |
| Studio | https://studio.supabase.racoondevs.com |

Dedicated to Atlas ERP. All development connects to this instance. No local PostgreSQL/MinIO fallback.

## Key constraints

- JavaScript only — no TypeScript
- No emojis in UI or documentation
- All UI text in Spanish; code and comments in English
- Prisma pinned to ^6 (do not upgrade to v7)
- Direct DB access from frontend is forbidden
- SUPABASE_SERVICE_ROLE_KEY must never reach the frontend bundle
