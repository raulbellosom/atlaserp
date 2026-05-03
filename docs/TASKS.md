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

- [x] Fill .env: copy keys from VPS /opt/supabase-atlaserp/supabase/docker/.env
- [x] Open SSH tunnel: ssh -L 54322:172.22.0.3:5432 root@76.13.114.109
      Note: PostgreSQL is not on host port 5432 — must tunnel to container IP 172.22.0.3:5432
- [x] Run pnpm db:generate — Prisma client against Supabase PostgreSQL (tunnel required)
- [x] Run pnpm db:migrate — applied initial_migration + add_instance_config (tunnel required)
- [x] Run pnpm db:seed — 4 core modules, admin role, permissions (tunnel required)
- [x] Verify GET /health returns 200
- [x] Verify GET /modules returns 4 core modules from live Supabase

Verified: 2026-05-03

## Phase 2 — ERP initialization state

Plan: `docs/superpowers/plans/2026-05-03-phase2-initialization-state.md`

- [x] Add `GET /instance/status` endpoint — reads `InstanceConfig` key `initialized` from DB
- [x] Add `instance.status()` to SDK
- [x] Install `react-router-dom` in `apps/desktop`
- [x] Add `InitGuard` component — fetches status, redirects to `/setup` or `/login`
- [x] Add `SetupPlaceholder` stub screen at `/setup`
- [x] Add `LoginPlaceholder` stub screen at `/login`
- [x] Move `Dashboard` to `/app` route

Verified: 2026-05-03

## Phase 3 — Onboarding setup wizard

Spec: `docs/superpowers/specs/2026-05-03-phase3-setup-wizard-design.md`
Plan: `docs/superpowers/plans/2026-05-03-phase3-setup-wizard.md`

- [x] Add BrandingConfig Prisma model and migration
- [x] Add setupInitializeSchema to @atlas/validators
- [x] Add FormData support + setup.initialize() to @atlas/sdk
- [x] Install @supabase/supabase-js in API
- [x] Build POST /setup/initialize endpoint (transaction-safe, logo upload, adminRole guard)
- [x] Build 4-step wizard UI — SetupWizard shell with motion/react slide transitions
- [x] Step 1: Admin account (TextField + PasswordField with strength meter)
- [x] Step 2: Company info (name + slug preview)
- [x] Step 3: Branding (drag-drop logo, dominant color extraction, color swatches)
- [x] Step 4: Review + submit
- [x] Create Supabase Auth user via Admin SDK
- [x] Create UserProfile, Company, BrandingConfig via Prisma transaction
- [x] Upload logo to Supabase Storage (atlas-branding bucket)
- [x] Write InstanceConfig records (initialized, company_id, completed_at)
- [x] Add FormFields component library to @atlas/ui
- [ ] **PENDING**: Split admin name → firstName + lastName (currently single displayName field)
- [ ] **PENDING**: Expand Company step — legalName, RFC, companyType, companySize, address fields
- [ ] **PENDING**: Update Prisma Company + UserProfile models for new fields
- [ ] **PENDING**: Update setupInitializeSchema and API handler for new fields

Verified: 2026-05-03 (core flow complete; expansions pending)

## Phase 4 — Auth integration

- [ ] Login screen (company-branded, loads logo + colors from API)
- [ ] Supabase Auth signInWithPassword flow
- [ ] Session persistence and logout
- [ ] JWT verification middleware in Atlas API
- [ ] UserProfile + role + permission loading on each authenticated request
- [ ] Password recovery placeholder

## Phase 5 — Atlas shell and module registry UI

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
