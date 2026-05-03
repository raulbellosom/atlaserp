# Atlas ERP — Tasks and Roadmap

## Phase 0 — Repository and environment cleanup

- [x] Remove docker-compose.local-lite.yml
- [x] Remove obsolete docs (ARCHITECTURE.md, MODULE_SYSTEM.md, DOCKER.md, SUPABASE_SELF_HOSTED_SCENARIO.md, CODE_STYLE.md)
- [x] Rewrite .env.example for Supabase-first with dotenv substitution pattern
- [x] Create numbered docs suite (docs/00–09)
- [x] Update README.md, CLAUDE.md, codex/00_MASTER_PROMPT.md
- [x] Add atlas.branding manifest to core-modules.js
- [x] Add InstanceConfig model to prisma/schema.prisma
- [x] Update docs/TASKS.md (this file) and docs/BLUEPRINTS.md

Verified: 2026-05-02

## Phase 1 — Supabase + Prisma connection

- [ ] Fill .env with real Supabase credentials (DATABASE_URL, DIRECT_URL, keys)
- [ ] Run pnpm db:generate — Prisma client against Supabase PostgreSQL
- [ ] Run pnpm db:migrate — apply schema including InstanceConfig migration
- [ ] Run pnpm db:seed — 4 core modules, admin role, permissions
- [ ] Verify GET /health returns 200
- [ ] Verify GET /modules returns 4 core modules from live Supabase

## Phase 2 — ERP initialization state

- [ ] Add GET /instance/status endpoint
- [ ] Read InstanceConfig.instance.initialized from DB
- [ ] Add frontend route guard (initialized → /login, not initialized → /setup)
- [ ] Test: fresh instance shows /setup, initialized instance shows /login

## Phase 3 — Onboarding setup wizard

- [ ] Add BrandingConfig Prisma model and migration
- [ ] Build 4-step wizard UI (admin account, company info, branding, review)
- [ ] Build POST /setup/initialize API endpoint
- [ ] Create Supabase Auth user via Admin SDK
- [ ] Create UserProfile, Company, BrandingConfig via Prisma
- [ ] Upload logo to Supabase Storage (atlas-branding bucket)
- [ ] Write InstanceConfig records (initialized, company_id, completed_at)

## Phase 4 — Auth integration

- [ ] Login screen (company-branded, loads logo + colors from API)
- [ ] Supabase Auth signInWithPassword flow
- [ ] Session persistence and logout
- [ ] JWT verification middleware in Atlas API
- [ ] UserProfile + role + permission loading on each authenticated request
- [ ] Password recovery placeholder

## Phase 5 — Atlas shell and module registry UI

- [ ] React Router setup
- [ ] Module launcher (app home screen / module grid)
- [ ] Module-specific layouts and sidebars
- [ ] Module catalog: install, disable, view status
- [ ] Core module protection in UI and API

## Phase 6 — Contacts module

- [ ] Contacts list page with DynamicTable
- [ ] Contact form page/modal with DynamicForm
- [ ] Full CRUD API with service layer
- [ ] Contact picker component exposed to other modules

## Phase 7 — Files module

- [ ] Supabase Storage bucket setup (atlas-branding, atlas-files)
- [ ] Upload endpoint with FileAsset metadata
- [ ] Download/signed URL endpoint
- [ ] FileUploader and FileViewer reusable components

## Phase 8 — Finance module

- [ ] Accounts CRUD
- [ ] Transactions CRUD
- [ ] Balances calculation
- [ ] Dashboard widgets
- [ ] Optional contact relation

## Phase 9 — Future modules

- [ ] Purchases
- [ ] Inventory
- [ ] HR (hr_employees, org chart)
- [ ] Fleet
- [ ] Reports
- [ ] Website builder / CMS
