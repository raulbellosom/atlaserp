# Atlas ERP - Tasks and Roadmap

## Task completion policy

- Mark `[x]` only when the task has explicit verification evidence.
- Add a concrete verification line in the phase section using the format:
  `Verified: YYYY-MM-DD (commands/checks executed)`.
- If a task is implemented but not verified yet, keep it unchecked until validation is done.
- Prisma migration safety: never edit existing `prisma/migrations/**/migration.sql` after apply; always add a new forward migration.

## UUID v7 Global Cutover (Reset Total)

- [x] Replace Prisma ID defaults from `cuid()` to UUID v7 (`@default(uuid(7)) @db.Uuid`) across domain models.
- [x] Align shared validators and module validators to UUID-based ID contracts.
- [x] Remove `custom.fleet` company hash bridge and require real UUID company scope.
- [x] Normalize AME3 SQL generation and fleet dynamic DDL to UUID v7 defaults (`uuidv7()`).
- [x] Add destructive baseline migration for full reset strategy (`20260524000000_uuid_v7_global_cutover`).
- [x] Add forward fleet migration to normalize legacy text reference columns to UUID (`V009_uuid_reference_columns.sql`).
- [x] Add CI guardrail to block `cuid(` and `.cuid(` reintroduction in source code.
- [x] Document global UUID v7 policy in team-facing architecture and agent docs.

Verified: 2026-05-24 (`pnpm.cmd exec prisma validate`, `pnpm.cmd db:generate`, `pnpm.cmd check:uuid-policy`, `node --test packages/module-engine/src/__tests__/sql-generator.test.js`, `node --test modules/custom/custom.fleet/api/__tests__/fleet-services.test.js modules/custom/custom.fleet/api/__tests__/fleet-routes-auth.test.js`)

## Snake_case Global Rebaseline + Module Lifecycle Hardening

- [x] Add destructive forward migration baseline for full `snake_case` rebuild (`20260525000000_snake_case_global_rebaseline`).
- [x] Harden `public.uuidv7(...)` definition with explicit `SET search_path = public, pg_catalog`.
- [x] Keep Prisma client API readable while mapping SQL objects to `snake_case` via `@@map/@map`.
- [x] Promote `atlas.contacts` and `atlas.hr` to core policy (`core=true`, `uninstallable=false`) and include both in seeded core module list.
- [x] Keep `DELETE /modules/:key` as non-destructive shorthand (`preserve-data`).
- [x] Set explicit uninstall flow default to destructive table purge only for `custom.*` modules (`POST /modules/:key/uninstall` and dry-run).
- [x] Remove `custom.fleet` dependency on `manifest.migrations` SQL chain and switch to declarative model lifecycle defaults.
- [x] Ignore legacy `manifest.migrations` SQL execution for discovered custom modules to avoid checksum drift failures.
- [x] Extend module-engine declarative DDL support with table-level `foreignKeys` and `checks`, including checksum coverage.
- [x] Execute destructive migration and reseed in live environment (`db:reset`, `db:migrate`, `db:seed`).
- [x] Validate Supabase Advisor warnings are fully cleared after reset/reseed.

Verified: 2026-05-25 (`pnpm.cmd prisma validate`, `pnpm.cmd prisma generate`, `node --test packages/module-engine/src/__tests__/define-model.test.js packages/module-engine/src/__tests__/sql-generator.test.js`, `node --test apps/api/src/services/__tests__/module-discovery-service.test.js`, `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`)
Note: destructive reset + reseed executed on live DB (`pnpm.cmd db:reset`, `pnpm.cmd db:migrate`, `pnpm.cmd db:seed`) with resulting baseline migration `20260525193000_core_only_baseline`. In this self-hosted environment the Supabase CLI `db advisors` path fails on direct-port TLS negotiation, so validation is executed with the official Splinter SQL lint set through Prisma (`pnpm.cmd db:advisor-equivalent` -> `SPLINTER_COUNTS { INFO: 33 }`, `SPLINTER_STATUS PASS_NO_WARN_OR_ERROR`).

## Reset 0 + Core-only Baseline + Finance/Ledger Externalization

- [x] Applied destructive reset in active DB (`public` objects dropped, including legacy migration footprint).
- [x] Replaced migration history with a single baseline (`20260525193000_core_only_baseline`).
- [x] Removed finance/ledger models from Prisma baseline schema (no `finance_%`/`ledger_%` at boot).
- [x] Removed finance/ledger from internal feature seed list (`packages/maps` feature bootstrap now excludes them).
- [x] Added placeholder externalized custom manifests `custom.finance` and `custom.ledger` (temporarily non-installable during cutover).
- [x] Confirmed clean bootstrap excludes `fleet_%` tables (fleet stays custom and not auto-installed).

Verified: 2026-05-25 (`pnpm.cmd db:migrate`, `pnpm.cmd db:seed`, DB query on `information_schema.tables` returns no `finance_%`/`ledger_%`/`fleet_%`, `pnpm.cmd prisma validate`, `node --check apps/api/src/index.js`, `pnpm.cmd --filter ./apps/desktop build:web`)

## Documentation Alignment (Module Status Reality Check)

- [x] Align canonical docs with internal core baseline of 6 modules (`atlas.core`, `atlas.identity`, `atlas.files`, `atlas.company`, `atlas.contacts`, `atlas.hr`).
- [x] Remove active-transition wording that still treated `packages/maps` as present.
- [x] Align docs with direct PostgreSQL connectivity on Supabase port `5433` (no SSH tunnel as default path).
- [x] Align docs with Prisma workspace baseline `^7`.
- [x] Add explicit guidance that historical specs/plans may contain obsolete transitional references.

Verified: 2026-05-25 (`rg -n "packages/maps|SSH tunnel|Prisma is pinned to \\`\\^6\\`|Four core modules|4 core modules seeded" AGENTS.md README.md CLAUDE.md docs/00_project_status.md docs/02_module_system.md docs/03_core_modules.md docs/TASKS.md`)

## Phase 0 - Repository and environment cleanup

- [x] Remove docker-compose.local-lite.yml
- [x] Remove obsolete docs (ARCHITECTURE.md, MODULE_SYSTEM.md, DOCKER.md, SUPABASE_SELF_HOSTED_SCENARIO.md, CODE_STYLE.md)
- [x] Rewrite .env.example for Supabase-first with dotenv substitution pattern
- [x] Create numbered docs suite (docs/00-09)
- [x] Update README.md, CLAUDE.md, codex/00_MASTER_PROMPT.md
- [x] Add atlas.company manifest to core-modules.js
- [x] Add InstanceConfig model to prisma/schema.prisma
- [x] Update docs/TASKS.md (this file) and docs/BLUEPRINTS.md

Verified: 2026-05-02

## Phase 1 - Supabase + Prisma connection

- [x] Fill .env: copy keys from VPS /opt/supabase-atlaserp/supabase/docker/.env
- [x] Open SSH tunnel: ssh -L 54322:172.22.0.3:5432 root@76.13.114.109
      Note: PostgreSQL is not on host port 5432 - must tunnel to container IP 172.22.0.3:5432
- [x] Run pnpm db:generate - Prisma client against Supabase PostgreSQL (tunnel required)
- [x] Run pnpm db:migrate - applied initial_migration + add_instance_config (tunnel required)
- [x] Run pnpm db:seed - 4 core modules, admin role, permissions (tunnel required)
- [x] Verify GET /health returns 200
- [x] Verify GET /modules returns 4 core modules from live Supabase

Verified: 2026-05-03

## Phase 2 - ERP initialization state

Plan: `docs/superpowers/plans/2026-05-03-phase2-initialization-state.md`

- [x] Add `GET /instance/status` endpoint - reads `InstanceConfig` key `initialized` from DB
- [x] Add `instance.status()` to SDK
- [x] Install `react-router-dom` in `apps/desktop`
- [x] Add `InitGuard` component - fetches status, redirects to `/setup` or `/login`
- [x] Add `SetupPlaceholder` stub screen at `/setup`
- [x] Add `LoginPlaceholder` stub screen at `/login`
- [x] Move `Dashboard` to `/app` route

Verified: 2026-05-03

## Phase 3 - Onboarding setup wizard

Spec: `docs/superpowers/specs/2026-05-03-phase3-setup-wizard-design.md`
Plan: `docs/superpowers/plans/2026-05-03-phase3-setup-wizard.md`

- [x] Add BrandingConfig Prisma model and migration
- [x] Add setupInitializeSchema to @atlas/validators
- [x] Add FormData support + setup.initialize() to @atlas/sdk
- [x] Install @supabase/supabase-js in API
- [x] Build POST /setup/initialize endpoint (transaction-safe, logo upload, adminRole guard)
- [x] Build 4-step wizard UI - SetupWizard shell with motion/react slide transitions
- [x] Step 1: Admin account (TextField + PasswordField with strength meter)
- [x] Step 2: Company info (name + slug preview)
- [x] Step 3: Branding (drag-drop logo, dominant color extraction, color swatches)
- [x] Step 4: Review + submit
- [x] Create Supabase Auth user via Admin SDK
- [x] Create UserProfile, Company, BrandingConfig via Prisma transaction
- [x] Upload logo to Supabase Storage (atlas-files canonical bucket)
- [x] Write InstanceConfig records (initialized, company_id, completed_at)
- [x] Add FormFields component library to @atlas/ui
- [x] Split admin name -> firstName + lastName
- [x] Expand Company model - legalName, RFC, companyType, companyTypeName, companySize, full address (country/state/city/street/extNumber/intNumber/postalCode)
- [x] Add optional company industry (giro) with suggested catalog + custom entry
- [x] Add ComboboxField to @atlas/ui with cascading country -> state -> city (country-state-city library)
- [x] Update setupInitializeSchema and API handler for all new fields
- [x] Apply primaryColor as global brand accents (buttons, links, active nav, ring)
- [x] Migration applied for Company + UserProfile + industry fields

Verified: 2026-05-03 (complete)

## Phase 4 - Auth integration

- [x] Login screen (company-branded, loads logo + colors from API)
- [x] Supabase Auth signInWithPassword flow
- [x] Session persistence and logout
- [x] JWT verification middleware in Atlas API
- [x] UserProfile + role + permission loading on each authenticated request
- [x] Password recovery placeholder

## Phase 5 - Atlas shell and module registry UI

- [x] Module launcher (app home screen / module grid)
- [x] Module-specific layouts and sidebars
- [x] Module catalog: install, disable, view status
- [x] Core module protection in UI and API
- [x] Phase 5.2 (partial): Identity UX refresh (Users/Roles), skeletons, atomic form controls, and permission catalog in Spanish grouped by module
- [x] Phase 5.5 stabilization: lifecycle authorization/guards validated and unavailable-module redirect to catalog

## Phase 6 - Contacts module

- [x] Contacts list page with DynamicTable
- [x] Contact form page/modal with DynamicForm
- [x] Full CRUD API with service layer
- [x] Contact picker component exposed to other modules

## Phase 7 - Files module

- [x] Supabase Storage pipeline aligned for files flows (`atlas-files`) and branding integration path
- [x] Files API service layer (`upload`, `list`, `getById`, `getSignedUrl`, `setEnabled`)
- [x] Authenticated files endpoints (`POST /files/upload`, `GET /files`, `GET /files/:id`, `GET /files/:id/signed-url`, `PATCH /files/:id/enabled`)
- [x] Company-scoped metadata policy on `FileAsset` (`moduleKey`, `entityType`, `entityId`, `metadata.companyId`)
- [x] SDK files domain (`atlas.files.upload/list/get/getSignedUrl/setEnabled`)
- [x] Reusable `FileUploader` and `FileViewer` exports in `@atlas/ui`
- [x] Full Atlas Files module screen (upload, list/search/filter, preview, download, copy-link, enable/disable)
- [x] Module routing integration for `atlas.files` in `ModuleOutlet` and manifest navigation
- [x] Branding logo workflow migrated to shared files APIs/components with `logoFileId`
- [x] Signed URL delivery used for preview/download in Files and Branding flows

Verified: 2026-05-04 (build + runtime compile checks)

## Phase 7.1 - Files module advanced UX

- [x] Multi-view explorer (`Tabla`, `Cards`, `Cuadricula`)
- [x] Thumbnail/image previews + file-type visual icons
- [x] Advanced viewer modal (image rotate/invert/reset visual-only, PDF preview, prev/next)
- [x] File detail panel with origin metadata and `Ir al origen` when route exists
- [x] Rename endpoint + UI flow
- [x] Multi-select and bulk download (`direct` signed URLs and `zip`)
- [x] Module route support for file detail path (`/app/m/atlas.files/files/:id`)

Verified: 2026-05-04 (API syntax checks + desktop production build)

## Phase 7.1.1 - Files storage unification

- [x] Single canonical storage bucket policy: `atlas-files`
- [x] Setup logo upload aligned to `atlas-files` with `company/branding/<companyId>/...` object keys
- [x] New `FileAsset` rows forced to `bucket=atlas-files` in setup/files/avatar flows
- [x] Standardized object keys for module uploads (`modules/<moduleKey>/<entityType>/<entityId>/...`)
- [x] Standardized object keys for bulk ZIP artifacts (`system/bulk-downloads/<companyId>/...`)
- [x] Runtime cleanup: removed active API references to `atlas-company` and `atlas-branding`
- [x] Documentation baseline reconciled for canonical bucket policy
- [x] Legacy bucket removal policy documented as manual infra action (no destructive auto-delete in API)

Verified: 2026-05-04 (API runtime search + compile checks)

## Phase 8 - Finance module

Spec: `docs/superpowers/specs/2026-05-04-phase8-finance-design.md`  
Plan: `docs/superpowers/plans/2026-05-04-phase8-finance.md`

- [x] Phase 8.1 - Accounting core (double-entry)
- [x] Company-scoped chart of accounts CRUD
- [x] Journal entry CRUD with balanced debit/credit lines
- [x] Base balance calculation per account and consolidated totals
- [x] Guided capture flow (income/expense/transfer) plus advanced entry editor
- [x] Phase 8.2 - Full multi-currency
- [x] Manual historical FX table by date/currency pair
- [x] Transaction conversion using historical rate traceability
- [x] Ledger and balance views with original and converted amounts
- [x] Phase 8.3 - Analytics and dashboard
- [x] Financial widgets (operational + analytical) over active company data
- [x] Period trend and variance cards
- [x] Optional contact relation in transactions (only when contacts module is available)

Verified: 2026-05-25 (`node --check apps/api/src/services/finance-service.js`; `pnpm.cmd --filter @atlas/desktop build:web`; finance entry UI now supports optional per-line contact selection in `EntrySheet`; backend validates contact ownership only when `atlas.contacts` is enabled+installed)

### Phase 8.4-A - AR/AP Core Expansion

Spec: `docs/superpowers/specs/2026-05-04-phase8-4-finance-expansion-design.md`  
Plan: `docs/superpowers/plans/2026-05-04-phase8-4-finance-expansion.md`

- [x] Unified finance document subledger (AR/AP)
- [x] FIFO allocation engine with validation tests
- [x] Document application flows (`preview` and `apply`) in API
- [x] Automatic accounting traceability links per document event
- [x] Aging service (`0-30`, `31-60`, `61-90`, `90+`)
- [x] SDK contracts for documents, applications, aging, and journal links
- [x] Finance sidebar routes for `CxC`, `CxP`, `Aging`, and `Aplicaciones`
- [x] Desktop AR/AP screens with document creation and lifecycle actions
- [x] Desktop application workflows (FIFO automatic + manual editable allocation)
- [x] Desktop journal-links panel for accounting traceability

Verified: 2026-05-05 (`node --test apps/api/src/services/__tests__/finance-application-engine.test.js`, `node --check apps/api/src/services/finance-documents-service.js`, `node --check apps/api/src/services/finance-posting-service.js`, `node --check apps/api/src/services/finance-aging-service.js`, `node --check apps/api/src/index.js`, `node --check packages/sdk/src/index.js`, `pnpm.cmd --filter ./apps/desktop build:web`)

### Phase 8.4-B - Application reversal + cross-currency traceability

Spec: `docs/superpowers/specs/2026-05-05-phase8-4-b-finance-application-reversal-design.md`  
Plan: `docs/superpowers/plans/2026-05-05-phase8-4-b-finance-application-reversal.md`

- [x] `FinanceDocumentApplication` extended with status + reversal metadata + FX fields
- [x] `REVERSE` event support in finance document accounting links
- [x] Cross-currency application resolution using historical FX rates (direct or inverse)
- [x] Cross-currency preview/apply API responses include source/target amount trace
- [x] Reversal endpoint `POST /finance/applications/:id/reverse` with transactional restoration and idempotency guard
- [x] Validators + SDK contracts updated (`status` filter + reverse mutation)
- [x] Applications desktop view updated with status filter, status badges, FX columns, and reverse action
- [x] Applications CSV export expanded with status/FX/reversal metadata

Verified: 2026-05-05 (`pnpm.cmd prisma migrate dev`, `pnpm.cmd db:generate`, `node --check apps/api/src/services/finance-documents-service.js`, `node --check apps/api/src/services/finance-posting-service.js`, `node --check apps/api/src/index.js`, `node --check packages/validators/src/index.js`, `node --check packages/sdk/src/index.js`, `pnpm.cmd --filter ./apps/desktop build:web`)

### Phase 8.5 - Taxes and withholdings

Spec: `docs/superpowers/specs/2026-05-05-phase8-5-finance-taxes-withholdings-design.md`  
Plan: `docs/superpowers/plans/2026-05-05-phase8-5-finance-taxes-withholdings.md`

- [x] Added tax domain models in Prisma schema (`FinanceTaxRate`, `FinanceDocumentTaxLine`, `FinanceTaxKind`)
- [x] Added forward migration folder `20260505073000_phase8_5_finance_taxes_withholdings`
- [x] Added validators and SDK contracts for finance tax catalog
- [x] Added API tax catalog endpoints (`GET/POST/PATCH /finance/tax-rates`)
- [x] Extended finance document creation to persist tax trace lines and summary metadata
- [x] Added finance sidebar route and screen section for `Impuestos`
- [x] Added document modal tax selection with subtotal and suggested total preview
- [x] Apply migration in live dev DB and run DB-backed smoke for tax persistence

Verified: 2026-05-05 (`pnpm.cmd db:migrate`, `pnpm.cmd db:generate`, `pnpm.cmd --filter ./apps/desktop build:web`, manual smoke for `/finance/tax-rates` and document tax flow)

### Phase 8.6 - Finance operations UX (AR/AP)

Spec: `docs/superpowers/specs/2026-05-05-phase8-6-finance-operations-ux-design.md`  
Plan: `docs/superpowers/plans/2026-05-05-phase8-6-finance-operations-ux.md`

- [x] Operational status layer in UI with overdue detection (`OVERDUE`)
- [x] Spanish status labels for AR/AP daily operations
- [x] Status filter in CxC and CxP tables (`Todos`, `Vencidos`, `Abiertos`, `Parciales`, `Pagados`, `Anulados`)
- [x] Overdue badge style (`destructive`) for faster visual triage
- [x] Quick reminder action in AR/AP row action menu for open balances
- [x] Persist reminder actions as notification records (API-backed)
- [x] Due-date filters (`Vence hoy`, `Esta semana`) in CxC and CxP
- [x] Bulk reminder action for visible rows with open balances

Verified: 2026-05-05 (`node --check apps/api/src/services/finance-documents-service.js`, `node --check apps/api/src/index.js`, `node --check packages/validators/src/index.js`, `node --check packages/sdk/src/index.js`, `pnpm.cmd --filter ./apps/desktop build:web`, `FINANCE_FINAL_SMOKE_OK` scripted run covering taxes, reminders, cross-currency apply, and reversal)

## Phase 9 - HR module

Spec: `docs/superpowers/specs/2026-05-05-phase9-hr-design.md`  
Plan: `docs/superpowers/plans/2026-05-05-phase9-hr.md`

- [x] Dedicated routes for HR list and employee detail (`/hr/employees`, `/hr/employees/:id`)
- [x] Single long-form employee view with all core sections visible (not modal-first)
- [x] View/Edit toggle with stable layout and async loading safeguards
- [x] Full HR v1 employee model fields persisted via API/SDK/Prisma
- [x] Rich markdown notes editor + rendered read mode
- [x] Employee dossier attachments via canonical files pipeline (`atlas-files`)
- [x] Embedded employee audit timeline (`actor/action/timestamp`)
- [x] Permission and auth contracts for `hr.employee|department|job_title|org_chart.*`

Verified: 2026-05-25 (`node --check apps/api/src/services/hr-service.js`; `node --check apps/api/src/index.js`; `node --check packages/sdk/src/index.js`; `node --check packages/validators/src/index.js`; `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`; `rg -n "atlas.hr:/hr/employees|atlas.hr:/hr/employees/:id" apps/desktop/src/app/ModuleOutlet.jsx`; `rg -n "queryKey: \\[\\\"hr-employee-audit\\\"|FilesPanel|MarkdownField|isEditing" apps/desktop/src/modules/atlas.hr/screens/HrEmployeeDetail.jsx`)

## Phase 9.5 - Module Lifecycle v2

Spec: `docs/superpowers/specs/2026-05-09-module-lifecycle-v2-and-custom-modules-design.md`
Plan: `docs/superpowers/plans/2026-05-09-module-lifecycle-v2-and-custom-modules.md`

- [x] `Permission.active`, `Permission.moduleKey`, `AtlasModule.lifecycleConfig` — migration `20260509100000_module_lifecycle_v2`
- [x] Seed backfill: `active=false` for all permissions belonging to uninstalled/disabled modules
- [x] `module-cleanup-registry.js` — Map of per-module `{ count, purge }` handlers; atlas.ledger handler registered
- [x] `module-lifecycle-service.js` — `install`, `disable`, `enable`, `uninstall`, `reset`, `dryRunUninstall`, `dryRunReset`, `syncModules`
- [x] `getUserContextByAuthId` — `WHERE active = true` filter in both membership and admin permission loads (fail-closed)
- [x] `routes/modules.js` — 12-endpoint router extracted from `index.js` + new lifecycle endpoints
- [x] `GET /identity/permissions` — defaults to `active: true` filter; `?includeInactive=true` override available
- [x] `PATCH /identity/roles/:id/permissions` — only assigns active permissions to roles
- [x] Manifest v2 lifecycle blocks on all 4 feature manifests (contacts, finance, hr, ledger)
- [x] SDK `modules` domain expanded: `getAvailable`, `sync`, `getLifecycle`, `uninstallDryRun`, `uninstallExplicit`, `resetDryRun`, `reset`

Verified: 2026-05-09 (`node --check` all 7 modified/created service and route files; `pnpm exec prisma validate` — schema valid; `pnpm build` — full monorepo including Tauri native bundle passes; manual DB steps pending: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`, and curl smoke tests against running API require stopping dev server for db:generate on Windows)

---

## AME3 — Atlas Module Engine v3

> Atlas ERP is no longer an ERP with modules. Atlas ERP is a module engine that ships ERP modules.

Architecture: `docs/architecture/atlas-module-engine-v3.md`  
Custom modules guide: `docs/03_custom_modules.md`  
Module system: `docs/02_module_system.md`

**No new module work should extend the old system.** Old code (`packages/maps/`, transitional Prisma models, manual route mounting) may remain temporarily only to keep the app running during migration. Any new feature waits for the relevant AME3 layer or builds it first.

### AME3 Phase 1 — Package Foundation and Lifecycle v2

**Required spec:** `docs/superpowers/specs/2026-05-09-ame3-module-engine-foundation.md`  
**Required plan:** `docs/superpowers/plans/2026-05-09-ame3-module-engine-foundation.md`

- [x] `docs/architecture/atlas-module-engine-v3.md` — master AME3 architecture document
- [x] `docs/03_custom_modules.md` — custom module developer guide
- [x] `docs/02_module_system.md` — module system rewrite (AME3-first)
- [x] `docs/01_erp_architecture.md` — updated architecture reference
- [x] `README.md` — updated module system and architecture sections
- [x] `docs/00_project_status.md` — AME3 direction and roadmap added
- [x] Module Lifecycle v2 (Phase 9.5): `Permission.active`, dry-run, reset, purge-data, cleanup registry
- [x] *Spec approved* → Create `packages/module-engine/` — exports `defineAtlasModule`, `defineModel`, `defineView`, `definePage`
- [x] *Spec approved* → Create `modules/custom/` directory with `README.md` and `.gitkeep`
- [x] *Spec approved* → File-system discovery from `modules/custom/` at API boot and `POST /modules/sync`

Verified: 2026-05-09 (node --check 13 source files — all pass; node --test 4 test files — 61 tests, 0 fail [15 define-module, 14 define-model, 22 sql-generator, 10 checksum]; 16 named exports verified importable from packages/module-engine/src/index.js; pnpm --filter ./apps/desktop build:web exits 0)

### AME3 Phase 2 — Folder Structure and Custom Sample Module

**Required spec:** `docs/superpowers/specs/2026-05-09-ame3-custom-fleet-module.md`  
**Required plan:** `docs/superpowers/plans/2026-05-09-ame3-custom-fleet-module.md`

- [x] *Spec approved* → Create `modules/official/` directory (migration target, initially empty)
- [x] *Spec approved* → Route Loader: mount `api/index.js` from `modules/custom/*/` automatically
- [x] *Spec approved* → Build and document one complete sample custom module (`custom.demo` or `custom.fleet`)
- [x] *Spec approved* → Module-local validators auto-discovered from `validators/index.js` (no `packages/validators/` edit required)
- [x] *Spec approved* → `@atlas/module-engine` ships with `defineAtlasModule`, `defineModel`, `defineView`, `definePage`

Verified: 2026-05-20 (`node --check apps/api/src/services/route-loader-service.js`; `node --check apps/api/src/services/module-discovery-service.js`; `node --check modules/custom/custom.fleet/module.manifest.js`; `node --test packages/module-engine/src/__tests__/define-module.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`)

### AME3 Phase 3 — Atlas ORM and Blueprint Renderer [COMPLETE]

**Spec:** `docs/superpowers/specs/2026-05-10-ame3-atlas-orm-blueprint-renderer-design.md`  
**Plan:** `docs/superpowers/plans/2026-05-10-ame3-atlas-orm-blueprint-renderer.md`

- [x] Add `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` to `prisma/schema.prisma` — Verified: 2026-05-13 (migration applied, tables confirmed)
- [x] Atlas ORM: provisions `atlas_*` tables from `defineModel` declarations, forward-only — Verified: 2026-05-13 (`fleet_vehicle`, `fleet_maintenance` provisioned by ORM hook)
- [x] Blueprint renderer: `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`, `AtlasCardView`, `AtlasTableToolbar`, `AtlasSortMenu` — Verified: 2026-05-13 (build passes, browser renders list/detail/form)
- [x] Component Registry: `registry.register(key, component)` from module `components/index.js` — Verified: 2026-05-13 (route-loader-service loads components on boot)
- [x] First full AME3 module end-to-end: zero Prisma edits, zero manual route mounting, zero manual screen registration — Verified: 2026-05-13 (`custom.fleet` installs, provisions tables, mounts routes, and renders via `BlueprintCrudScreen` fallback with no hardcoded SCREEN_MAP entry)
- [x] Route Loader lifecycle wiring: install/retry-install/enable reload routes; disable/uninstall/clear-error/cleanup unload routes — in-memory state matches DB without API restart — Verified: 2026-05-14 (static checks + build pass; runtime validation pending API restart)

### custom.fleet Operational Expansion [COMPLETE]

**Spec:** `docs/superpowers/specs/2026-05-14-custom-fleet-operational-expansion-design.md`
**Plan:** `docs/superpowers/plans/2026-05-14-custom-fleet-operational-expansion.md`

- [x] Additive migrations: `fleet_vehicle` expansion columns (`vehicle_type_id`, `vehicle_brand_id`, `economic_group_number`, `economic_individual_number`, `photo_asset_id`) and `fleet_maintenance` expansion columns (`maintenance_type_id`, `title`, `status`, `driver_id`, `started_at`, `odometer_km`, `provider`, `currency`) — Verified: 2026-05-16 (all columns present in DB)
- [x] Seven new fleet tables provisioned via Atlas ORM: `fleet_driver`, `fleet_vehicle_type`, `fleet_vehicle_brand`, `fleet_maintenance_type`, `fleet_vehicle_document`, `fleet_driver_document`, `fleet_maintenance_document` — Verified: 2026-05-16 (all 9 fleet tables present in DB)
- [x] Fleet service layer split: `fleet-service.js` → domain files (`driver-service.js`, `maintenance-service.js`, `catalog-service.js`) + `service-helpers.js` shared utilities — Verified: 2026-05-16 (34/34 node --check pass)
- [x] Driver CRUD API: full lifecycle with license fields, document associations, file resolution — Verified: 2026-05-16 (POST 201, GET 200, PATCH 200, PATCH/enabled 200)
- [x] Maintenance CRUD API: expanded schema with `type` enum, status lifecycle, odometer, cost, provider — Verified: 2026-05-16 (POST 201 `type:preventive`, GET 200, PATCH 200, PATCH/enabled 200)
- [x] Catalog APIs: vehicle types, vehicle brands, maintenance types with seed endpoint — Verified: 2026-05-16 (all 3 catalogs return 200 list, 201 create, 200 PATCH/enabled)
- [x] Document attachment endpoints for vehicles, drivers, and maintenance — Verified: 2026-05-16 (`GET /fleet/vehicles/:id/documents` → 200 with `data` array)
- [x] `ALLOWED_FILE_ENTITY_TYPES` updated: `FleetVehicle`, `FleetDriver`, `FleetMaintenance` — Verified: 2026-05-16 (code review of `files-service.js`; GET /files with fleet entity types returns 200)
- [x] Module manifest v0.2.0: 9 models, 21 views, 4 navigation items, 17 permissions — Verified: 2026-05-16 (AtlasModel: 9 rows, AtlasView: 21 rows, all enabled)
- [x] `syncModuleMetadata` transaction timeout fixed to 30s — Verified: 2026-05-16 (`module-metadata-service.js` line 284 `{ timeout: 30000 }`)
- [x] Desktop build passes — Verified: 2026-05-16 (`pnpm --filter @atlas/desktop build:web` → 1.42s, exit 0)
- [x] Smoke test: 46/46 E2E checks pass — Verified: 2026-05-16 (SMOKE_PASS: module sync, 6 list endpoints, catalog CRUD, driver CRUD, vehicle CRUD, maintenance CRUD, files integration)

Known follow-ups: relation field picker UX, DocumentsPanel UI component, fleet dashboards, maintenance type unique name DB constraint.

### custom.fleet + Blueprint Renderer Stabilization [COMPLETE]

**Spec:** `docs/superpowers/specs/2026-05-16-custom-fleet-blueprint-stabilization-design.md`  
**Plan:** `docs/superpowers/plans/2026-05-16-custom-fleet-blueprint-stabilization.md`

- [x] Multi-segment route parsing for blueprint CRUD routes (`catalogs/vehicle-types`, `catalogs/vehicle-brands`, `catalogs/maintenance-types`) in `BlueprintCrudScreen` — Verified: 2026-05-16 (runtime route harness `RUNTIME_ROUTE_VALIDATION_OK` across 20 route cases)
- [x] Longest PAGE path matching before entity fallback — Verified: 2026-05-16 (runtime route harness confirms `/app/m/custom.fleet/catalogs/*` uses full PAGE base path for list/create/detail/edit)
- [x] Canonical `schema.apiPath` usage (no fake appended IDs from route subsegments) — Verified: 2026-05-16 (runtime route harness confirms no generated requests for `/fleet/catalogs/vehicle-types/vehicle-types`, `/fleet/vehicles/m`, `/fleet/vehicles/new` as record id)
- [x] Explicit `schema.formMode` support (`page`/`sheet`/`auto`) in renderer adapters + CRUD view — Verified: 2026-05-16 (static diff + build pass)
- [x] Maintenance page-mode is metadata-driven (`schema.formMode = 'page'` in `maintenance.form.js`) — Verified: 2026-05-16 (blueprint metadata change only; no module hardcode in renderer)
- [x] Runtime availability checks for requested UI routes — Verified: 2026-05-16 (`Invoke-WebRequest` returns HTTP 200 for all maintenance/catalog/regression frontend routes)
- [x] No new CORS regressions — Verified: 2026-05-16 (`OPTIONS` preflight on `/fleet/maintenance`, `/fleet/catalogs/vehicle-types`, `/fleet/catalogs/vehicle-brands`, `/fleet/catalogs/maintenance-types`, `/fleet/vehicles`, `/fleet/drivers` → HTTP 204 with `access-control-allow-origin=http://localhost:5173`)
- [x] Desktop build passes — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web` → built in 1.66s, exit 0)

Verified: 2026-05-16 (`node --check packages/ui/src/atlas-renderer/renderer-adapters.js`; `node --check modules/custom/custom.fleet/views/maintenance.form.js`; `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` and `node --check packages/ui/src/atlas-renderer/AtlasCrudView.jsx` executed but this Node runtime reports `ERR_UNKNOWN_FILE_EXTENSION` for `.jsx`; `pnpm.cmd --filter @atlas/desktop build:web`; frontend route HTTP checks; API CORS preflight checks; runtime route harness output `RUNTIME_ROUTE_VALIDATION_OK`)

### Blueprint Schema Expansion — Relation Fields [COMPLETE]

**Spec:** `docs/superpowers/specs/2026-05-16-blueprint-schema-relation-fields-design.md`  
**Plan:** `docs/superpowers/plans/2026-05-16-blueprint-schema-relation-fields.md`

- [x] `normalizeRelationDescriptor(fieldLike)` added to `packages/ui/src/atlas-renderer/renderer-adapters.js` — normalizes `source`, `apiPath`, `valueField`, `labelField` (string or array), `labelSeparator`, search/page params, `pageSize`, `preload`, `clearable`, `disabledField` with safe defaults; returns `null` for invalid config — Verified: 2026-05-16 (`node --check packages/ui/src/atlas-renderer/renderer-adapters.js` → OK)
- [x] `RelationSelectField` component added to `packages/ui/src/components/FormFields.jsx` — combobox control with Spanish loading/error/empty/search/clear states and `onSearchChange` callback — Verified: 2026-05-16 (included in build; `ERR_UNKNOWN_FILE_EXTENSION` from `node --check` on `.jsx` is expected)
- [x] `AtlasForm` updated: imports, `normalizeField`/`normalizeSections` preserve `relation` metadata; `loadRelationOptions` async loader (preload + debounced remote search); `resolveRelationLabel` for string and array `labelField`; `case "relation"` renders `RelationSelectField` with per-field relation state; invalid config degrades to labeled placeholder — Verified: 2026-05-16 (build pass)
- [x] `vehicle.form.js`: `vehicle_type_id` → relation `/fleet/catalogs/vehicle-types`; `vehicle_brand_id` → relation `/fleet/catalogs/vehicle-brands`; `driver_id` → relation `/fleet/drivers` (composed `first_name last_name`) — Verified: 2026-05-16 (`node --check` → OK)
- [x] `maintenance.form.js`: `maintenance_type_id` → relation `/fleet/catalogs/maintenance-types`; `vehicle_id` → required relation `/fleet/vehicles` (composed `plate · model_name`); `driver_id` → relation `/fleet/drivers` (composed `first_name last_name`) — Verified: 2026-05-16 (`node --check` → OK)
- [x] Desktop build passes — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web` → ✓ built in 2.78s, 0 errors, 4404 modules transformed)

Runtime checks: Not verified in this session (no browser access). Required manual follow-up:
- Vehicle form relation selectors (vehicle_type_id, vehicle_brand_id, driver_id) load options from API
- Maintenance form relation selectors load options (maintenance_type_id, vehicle_id, driver_id)
- Search triggers debounced re-fetch from remote endpoints
- Required relation fields block submit when empty
- Optional relation fields clear to null and submit null
- Edit mode shows readable labels for persisted IDs
- Payload inspection confirms only scalar IDs submitted (no label text)
- Existing text/select/date/number/boolean fields unaffected
- No custom.fleet hardcoding in core renderer files

### custom.fleet Vehicle Catalog Relational Redesign [COMPLETE]

**Spec:** `docs/superpowers/specs/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign-design.md`
**Plan:** `docs/superpowers/plans/2026-05-16-custom-fleet-vehicle-catalog-relational-redesign.md`

- [x] `fleet_vehicle_model` table created (V004): brand_id FK, type_id FK, name, year, company-scoped, soft-delete, 4 indexes including unique (company, brand, type, name, year) — Verified: 2026-05-16 (DB column check + direct INSERT via smoke test HTTP 201)
- [x] `vehicle_model_id` FK column added to `fleet_vehicle` (V004 ALTER TABLE) — Verified: 2026-05-16 (information_schema column check: nullable=YES)
- [x] `economic_group_number` column added to `fleet_vehicle_type` (V005 ALTER TABLE) — Verified: 2026-05-16 (PATCH /fleet/catalogs/vehicle-types/:id returns updated field)
- [x] `brand`, `model_name`, `year` columns made nullable in `fleet_vehicle` (V004b) — Verified: 2026-05-16 (information_schema column check: nullable=YES; vehicle INSERT with only vehicle_model_id returns HTTP 201)
- [x] `vehicle-model.model.js` added to module manifest and AtlasModel table — Verified: 2026-05-16 (AtlasModel query: `fleet.vehicle_model -> fleet_vehicle_model`, modelsCount=10 in sync response)
- [x] Catalog service updated: vehicle type supports `economic_group_number` on create/update; full vehicle model CRUD (`listVehicleModels`, `createVehicleModel`, `updateVehicleModel`, `setVehicleModelEnabled`) with brand_name/type_name enrichment — Verified: 2026-05-16 (GET /fleet/catalogs/vehicle-models returns `brand_name: Kenworth`, `type_name: Camion`)
- [x] Catalogs routes: 4 new `/fleet/catalogs/vehicle-models` endpoints (GET, POST, PATCH /:id, PATCH /:id/enabled) — Verified: 2026-05-16 (smoke tests HTTP 200/201/409 as expected)
- [x] Fleet service updated: `listVehicles`/`getVehicle` JOIN `fleet_vehicle_model` + COALESCE fallback for `vehicle_brand_name`, `vehicle_type_name`, `economic_group_number_resolved`; `createVehicle`/`updateVehicle` accept `vehicle_model_id` — Verified: 2026-05-16 (GET /fleet/vehicles/:id returns `vehicle_model_name: T680`, `vehicle_brand_name: Kenworth`, `economic_number: 0002-0042`)
- [x] Blueprint views: `catalog.vehicle-models.table.js`, `.form.js` (brand_id + type_id relation fields), `.page.js` created — Verified: 2026-05-16 (AtlasView query: 3 new views present, type=TABLE/FORM/PAGE; `node --check` all pass)
- [x] `vehicle.form.js` updated: removed legacy brand/model_name/year/vehicle_type_id/vehicle_brand_id/economic_group_number fields; added `vehicle_model_id` relation selector — Verified: 2026-05-16 (`node --check` → OK; build pass)
- [x] `vehicle.table.js` updated: removed brand/model_name/year columns; added vehicle_model_name, vehicle_brand_name, vehicle_type_name — Verified: 2026-05-16 (`node --check` → OK)
- [x] `vehicle.detail.js` updated: shows vehicle_model_name, vehicle_model_year, vehicle_brand_name, vehicle_type_name, economic_number — Verified: 2026-05-16 (`node --check` → OK)
- [x] `catalog.vehicle-types.form.js` updated: added `economic_group_number` field — Verified: 2026-05-16 (`node --check` → OK)
- [x] Module manifest updated to v0.3.0: 10 models, 24 views, VehicleModel ACL, new navigation entry — Verified: 2026-05-16 (POST /modules/sync → modelsCount=10, viewsCount=24)
- [x] Desktop build passes — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web` → ✓ built in 2.61s, 0 errors)
- [x] API smoke tests: vehicle type with economic_group_number (201), vehicle brand (201), vehicle model (201), duplicate model (409), vehicle with vehicle_model_id (201), enriched GET/list with correct economic_number (0002-0042) — Verified: 2026-05-16

Verified: 2026-05-16 (full stack: DB migrations applied, module synced, all smoke tests pass)
Note: 2026-05-16 manual authenticated regression helper added at `scripts/smoke-fleet-relational.mjs` (requires `ATLAS_TOKEN`; runtime endpoint verification remains manual, not browser-automated).

### custom.fleet Catalog Hub Tabs [VERIFIED]

Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-catalog-hub-tabs-design.md`  
Plan: `docs/superpowers/plans/2026-05-16-custom-fleet-catalog-hub-tabs.md`

- [x] Fleet sidebar catalog navigation simplified to one `Catálogos` entry pointing to `/app/m/custom.fleet/catalogs` and redundant `Modelos de vehículo` entry removed — Verified: 2026-05-16 (`node --check modules/custom/custom.fleet/module.manifest.js`)
- [x] Blueprint shell route-group catalog tabs added for grouped PAGE routes (including base-route redirect from `/catalogs` to default tab route) without duplicating CRUD rendering — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web`)
- [x] Runtime metadata sync and browser UX verification completed — Verified: 2026-05-16 (authenticated `POST /modules/sync` 200; sidebar shows one `Catálogos` entry; separate `Modelos de vehículo` removed; tabs visible for Tipos/Marcas/Modelos/Mantenimiento; each tab navigates to its route and renders existing CRUD table; direct catalog routes work; `Número económico de grupo` remains visible in vehicle type form; relation inline-create metadata remains present).

### custom.fleet Detail UX & Relationship Cards [VERIFIED]

Spec: `docs/superpowers/specs/2026-05-16-custom-fleet-detail-ux-relationship-cards-design.md`  
Plan: `docs/superpowers/plans/2026-05-16-custom-fleet-detail-ux-relationship-cards.md`

- [x] Fleet API enrichment for detail UX: vehicle detail now includes `driver_name`, `driver_phone`, `driver_license_number`; maintenance detail/list now include readable relation fields including `maintenance_type_name` and vehicle context — Verified: 2026-05-16 (`node --check modules/custom/custom.fleet/api/fleet-service.js`, `node --check modules/custom/custom.fleet/api/maintenance-service.js`)
- [x] New company-scoped endpoint `GET /fleet/drivers/:id/vehicles` added for relation-list cards in driver detail — Verified: 2026-05-16 (`node --check modules/custom/custom.fleet/api/driver-service.js`, `node --check modules/custom/custom.fleet/api/drivers-routes.js`)
- [x] Generic `AtlasDetail` renderer support added for `relation-card` and `relation-list` section types plus metadata-driven field icons (no custom.fleet hardcoding) — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web`; `node --check` for `.jsx` not available in this Node runtime due `ERR_UNKNOWN_FILE_EXTENSION`)
- [x] Sidebar icon resolver updated to correctly map Fleet icon names (`Truck`, `Wrench`, `ClipboardList`, `UserCheck`, `BookOpen`, `Library`, `Layers`) with safe fallback — Verified: 2026-05-16 (`pnpm.cmd --filter @atlas/desktop build:web`)
- [x] Fleet detail blueprints updated: vehicle driver relation card, driver assigned-vehicles relation list, maintenance vehicle/driver relation cards, and Spanish icon metadata while keeping DocumentsPanel sections — Verified: 2026-05-16 (`node --check modules/custom/custom.fleet/views/vehicle.detail.js`, `node --check modules/custom/custom.fleet/views/driver.detail.js`, `node --check modules/custom/custom.fleet/views/maintenance.detail.js`)
- [x] Runtime metadata synced via safe local tokenless metadata service script (no manual token flow) and AtlasView detail schemas updated — Verified: 2026-05-16 (sync result: `moduleKey=custom.fleet`, `syncedModels=10`, `syncedViews=24`; detail schemas include `relation-card`/`relation-list` + `documents` sections)
- [x] Authenticated contract verification for permissions and fail-closed company scope added in automated route tests (`fleet-routes-auth.test.js`) and service regression suite extended for scoped UUID behavior — Verified: 2026-05-20 (`node --test modules/custom/custom.fleet/api/__tests__/fleet-routes-auth.test.js`; `node --test modules/custom/custom.fleet/api/__tests__/fleet-services.test.js`)

Verified: 2026-05-20 (`node --test modules/custom/custom.fleet/api/__tests__/fleet-routes-auth.test.js`; `node --test modules/custom/custom.fleet/api/__tests__/fleet-services.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`)

### Blueprint Attachments UI System + Fleet Form Opt-in [VERIFIED]

Spec: `docs/superpowers/specs/2026-05-16-blueprint-attachments-ui-system-design.md`  
Plan: `docs/superpowers/plans/2026-05-16-blueprint-attachments-ui-system.md`

- [x] Reusable attachments system implemented in `packages/ui` with shared controller/component flow (`useAttachmentsController`, `AttachmentsPanel`) and metadata-driven renderer integration — Verified: 2026-05-17 (static review + build pass)
- [x] `AtlasForm` supports attachments sections with create/edit lifecycle handling while remaining module-agnostic — Verified: 2026-05-17 (`pnpm.cmd --filter @atlas/desktop build:web`)
- [x] Fleet forms opt in via blueprint metadata only (`vehicle.form`, `driver.form`, `maintenance.form`) with no renderer hardcoding for `custom.fleet` — Verified: 2026-05-17 (runtime AtlasView schema check after safe local tokenless sync)
- [x] Create mode supports staged files before parent record exists and flushes upload/association after successful record creation — Verified: 2026-05-17 (implementation evidence in shared controller + form submit flow)
- [x] Edit mode supports existing attachment loading and immediate upload behavior — Verified: 2026-05-17 (implementation evidence + build pass)
- [x] `DocumentsPanel` remains compatible as wrapper over shared attachments logic for detail screens — Verified: 2026-05-17 (code review + build pass)
- [x] Attachments aside UX polished: no visible free-text document type input by default, no visible label input by default, inferred `document_type` from MIME/extension, filename as default label, and clear `Archivos pendientes`/`Archivos asociados` sections — Verified: 2026-05-17 (`node --check packages/ui/src/hooks/useAttachmentsController.js`; `pnpm.cmd --filter @atlas/desktop build:web`)
- [x] Browser/manual verification completed on Fleet vehicle create/detail flow: right-side `Documentos` aside visible, multi-file pending selection before save, differentiated file type visuals (including PDF icon/color), image thumbnail preview, cards with filename/type-extension/size/status, no visible `Tipo de documento` or `Etiqueta` inputs by default, save uploads/associates pending files, detail shows associated docs, and preview/open/download/remove actions available — Verified: 2026-05-20 (manual browser QA after latest attachments polish)

Verified: 2026-05-20 (`pnpm.cmd --filter @atlas/desktop build:web`; runtime service-level tokenless E2E previously passed for create/upload/associate/list/remove cleanup across Fleet vehicle/driver/maintenance + manual browser verification completed for vehicle attachments UX)

### custom.fleet Reportes V2 Rework [VERIFIED]

Plan: Fleet reportes V2 (maintenance/service/repair/other, strict typed flows)

- [x] New report domain models added and synced in manifest: `fleet.report`, `fleet.report_part`, `fleet.report_document` with company-scoped folio strategy by type (`MNT|SRV|REP|OTR`) and report status (`draft|finalized`) support.
- [x] New API router/service for reportes v2 with typed endpoints (`/fleet/reports/maintenance|service|repair|other`), common lifecycle endpoints (`/:id`, `/:id/enabled`, `/:id/finalize`, `/:id/reopen`), documents endpoints, parts list endpoint, and PDF generation endpoint (`GET /fleet/reports/:id/pdf`).
- [x] Strict business validation matrix enforced for report types (maintenance reminder requirement, service subtype + invoice/ticket, repair priority/damage/start-date/date coherence, other custom category).
- [x] Legacy maintenance flow removed from primary routing (`createMaintenanceRouter` no longer mounted in fleet router) and replaced by reports-first navigation/blueprints under `/app/m/custom.fleet/reports/*` with grouped tabs.
- [x] Reportes UI blueprints completed for 4 flows (`maintenance`, `service`, `repair`, `other`) including table/form/detail/page, status badge usage, attachments with `entityType: FleetReport`, relation-card vehicle context, parts relation-list in detail, and metadata-driven detail header actions (`Descargar PDF`, `Regenerar PDF`, `Finalizar`, `Reabrir`).
- [x] Files whitelist updated to allow report uploads (`FleetReport`) and report permissions aligned to `fleet.reports.read|create|update|delete` in module manifest ACL/navigation.

Verified: 2026-05-22 (`node --check modules/custom/custom.fleet/api/reports-service.js`; `node --check modules/custom/custom.fleet/api/reports-routes.js`; `node --check modules/custom/custom.fleet/api/vehicles-routes.js`; `node --check modules/custom/custom.fleet/validators/index.js`; `node --check modules/custom/custom.fleet/module.manifest.js`; `Get-ChildItem modules/custom/custom.fleet/views/reports*.js | ForEach-Object { node --check $_.FullName }`; `pnpm.cmd --filter @atlas/desktop build:web`)

### AME3 Phase 4 — Discovery as Primary Source

**Required spec:** `docs/superpowers/specs/2026-05-09-ame3-module-discovery-sync.md`  
**Required plan:** `docs/superpowers/plans/2026-05-09-ame3-module-discovery-sync.md`

- [x] *Spec approved* → API boot reads modules from `modules/custom/` and `modules/official/` as primary sources
- [x] *Spec approved* → `packages/maps/` read only as fallback for legacy official modules during decommission track
- [x] *Spec approved* → Route Loader: mount all installed module routers at boot; unmount on disable/uninstall
- [x] *Spec approved* → Component Registry: load all installed module component registrations at boot
- [x] *Spec approved* → `POST /modules/sync` triggers re-discovery without restart

Verified: 2026-05-20 (`node --check apps/api/src/routes/modules.js`; `node --check apps/api/src/services/module-discovery-service.js`; `node --check apps/api/src/services/route-loader-service.js`; `node --check apps/api/src/services/module-lifecycle-service.js`; `node --check apps/api/src/services/module-metadata-service.js`; `node --check apps/api/src/services/module-migration-service.js`; `node --test packages/module-engine/src/__tests__/define-module.test.js`; `node --test packages/module-engine/src/__tests__/sql-generator.test.js`)

### AME3 Hardening — Discovery/Lifecycle/Route Loader

- [x] G1 package import hardening: API AME3 services now resolve `@atlas/module-engine` through workspace dependency (`@atlas/api` direct dependency added)
- [x] G2 discovery checksum enforcement: manifest migration checksums are validated during discovery (`MANIFEST_MIGRATION_CHECKSUM_MISMATCH` fail-fast)
- [x] G3 dependency cycle guard: required dependency cycle detection added for lifecycle install/sync and `/modules/sync` dependency reconciliation (`DEPENDENCY_CYCLE_DETECTED`)
- [x] G4 route collision visibility: route loader now detects `METHOD + PATH` collisions, keeps first owner, and marks conflicting module route loader state as `ERROR` with collision metadata
- [x] G5 `validateView` structural contracts: minimum schema validation added for TABLE/FORM/DETAIL kinds
- [x] G7 safe runtime signaling: desktop blueprint screen warns when namespaced component keys are missing from active runtime bundle and indicates rebuild requirement
- [x] G8 destructive uninstall mode: `purge-owned-tables` flow added with dry-run summary, `ACEPTO` confirmation, transactional table drop, migration ledger cleanup, and audit details
- [x] Regression/unit coverage added for new hardening behavior (`define-view`, dependency graph cycle detection, discovery checksum mismatch, route collision handling, lifecycle schema modes)

Verified: 2026-05-20 (`node --check apps/api/src/services/module-dependency-utils.js`; `node --check apps/api/src/services/module-discovery-service.js`; `node --check apps/api/src/services/module-migration-service.js`; `node --check apps/api/src/services/module-lifecycle-service.js`; `node --check apps/api/src/services/route-loader-service.js`; `node --check apps/api/src/routes/modules.js`; `node --check packages/module-engine/src/define-view.js`; `node --check packages/validators/src/index.js`; `node --test packages/module-engine/src/__tests__/define-view.test.js packages/validators/src/__tests__/module-lifecycle-schemas.test.js apps/api/src/services/__tests__/module-dependency-utils.test.js apps/api/src/services/__tests__/module-discovery-service.test.js apps/api/src/services/__tests__/route-loader-service.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`)

### AME3 Phase 5 — Official Module Relocation to modules/official/ [RETIRED]

Architecture decision: as of 2026-05-25, relocating the six official base modules to `modules/official/` is no longer required.
Official modules remain in their current workspace locations, and AME3 continues through renderer completion and `packages/maps` decommission.

- [x] Decision recorded: remove official-module relocation as a required AME3 gate.
- [x] Roadmap realigned: subsequent AME3 phases no longer depend on module folder relocation.

Verified: 2026-05-25 (architecture decision documented in `docs/TASKS.md` and `AGENTS.md`)

### AME3 Phase 6 — Generic CRUD Blueprint Renderer

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-crud-blueprint-renderer.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-crud-blueprint-renderer.md`

- [x] Kickoff audit complete: renderer primitives (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) and runtime registry wiring are present and actively used by `custom.fleet` routes.
- [x] *Spec approved* → `AtlasTable` fully renders TABLE blueprints with sort, filter, and pagination controls.
- [x] *Spec approved* → `AtlasForm` fully renders FORM blueprints using schema-driven sections, relation loaders, inline create, and submit validations.
- [x] *Spec approved* → `AtlasDetail` renders DETAIL blueprints in read-only mode, including relation labels and attachments context.
- [x] *Spec approved* → `AtlasCrudView` composes list + form + detail into a complete CRUD flow with create/view/edit transitions.
- [x] *Spec approved* → Shell and layout resolution: `atlas.dashboardShell`, `atlas.crudLayout`
- [x] *Spec approved* → Custom component key resolution via Component Registry

Verified: 2026-05-25 (`rg -n "filterValues|sortBy|sortDir|pagination|TablePaginationFooter" packages/ui/src/atlas-renderer/AtlasTable.jsx packages/ui/src/atlas-renderer/AtlasTableToolbar.jsx packages/ui/src/atlas-renderer/TablePaginationFooter.jsx`; `rg -n "normalizeSections|handleSubmit|relation|inlineCreate|AttachmentsPanel" packages/ui/src/atlas-renderer/AtlasForm.jsx packages/ui/src/atlas-renderer/atlas-form-schema.js`; `rg -n "readOnly|AttachmentsPanel" packages/ui/src/atlas-renderer/AtlasDetail.jsx`; `rg -n "AtlasTable|AtlasForm|AtlasDetail|mode=\"create\"|mode=\"edit\"" packages/ui/src/atlas-renderer/AtlasCrudView.jsx`; `node --test packages/ui/src/atlas-renderer/__tests__/renderer-adapters.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`)

### AME3 Phase 7 — Remove packages/maps

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-remove-packages-maps.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-remove-packages-maps.md`

- [x] Kickoff inventory completed for `packages/maps` decommission: direct runtime/seed/test import points identified in API, desktop, and Prisma seed flows.
- [x] Desktop decommission cut #1 complete: removed `@atlas/maps` dependency/alias/import usage from runtime merge and module catalog install flow.
- [x] API decommission cut #1 complete: centralized official manifest access behind `module-manifests-service` and removed direct maps imports from module routes and RBAC contract tests.
- [x] Seed decommission cut #1 complete: `prisma/seed.js` now consumes `listOfficialModuleManifests()` and no longer imports map files directly.
- [x] *Spec approved* → All official modules confirmed operational from current production locations (no `modules/official/` relocation required)
- [x] *Spec approved* → `packages/maps/src/feature-modules.js` deleted
- [x] *Spec approved* → `packages/maps/src/core-modules.js` deleted or absorbed into core runtime sources
- [x] *Spec approved* → `packages/maps/` package removed from monorepo
- [x] *Spec approved* → No remaining references to `packages/maps/` in core codebase

Verified: 2026-05-25 (`pnpm.cmd install --lockfile-only`; `node --check apps/api/src/index.js`; `node --check apps/api/src/routes/modules.js`; `node --check apps/api/src/services/module-manifests-service.js`; `node --check prisma/seed.js`; `node --check scripts/verify-permission-catalog.mjs`; `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`; `node --test apps/api/src/services/__tests__/module-discovery-service.test.js apps/api/src/services/__tests__/route-loader-service.test.js apps/api/src/services/__tests__/module-dependency-utils.test.js`; `node --test packages/module-engine/src/__tests__/define-view.test.js packages/module-engine/src/__tests__/sql-generator.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`; `rg -n "@atlas/maps|packages/maps" apps packages prisma scripts --glob "!**/dist/**"` -> `NO_MATCHES`)

---

## Future feature modules

- [ ] Purchases (supplier orders, receiving)
- [ ] Inventory (stock management)
- [ ] Fleet (vehicles, drivers, maintenance) — active next focus (2026-05-25)
- [ ] Reports (cross-module reporting engine)
- [ ] Website builder / CMS

## Next agreed focus (2026-05-25)

- [ ] Fleet expansion execution (functional + UX + API hardening as next delivery block)
- [ ] Module Scaffolder / Module Creator for future modules after Fleet expansion completion

## Phase 10 - Responsive foundation, toolbar migrations, and Finance decomposition

### Phase 10.1 - Responsive / mobile foundation

- [x] Replaced `vh` with `dvh` in AppShell and all layout wrappers
- [x] Added `safe-area-inset` padding (`pb-[env(safe-area-inset-bottom)]`, `pt-safe`) across shell components
- [x] Added `min-w-0` to flex/grid children in AtlasApp shell to prevent overflow
- [x] Fixed `overflow-hidden` on body / `#root` to `overflow-auto` so content scrolls correctly
- [x] Responsive table column widths: `w-40 min-w-[10rem]` etc., no fixed `w-px` on data columns
- [x] Files and Contacts toolbars migrated to responsive grid; added `ViewModeSwitch`, `MobileFiltersSheet`, and `ListLayout` shared components to `@atlas/ui`
- [x] Button, Card, Pagination, PageHeader, Input components updated with responsive token sizes

Verified: 2026-05-06 (manual audit of AppShell, AtlasApp, Files, Contacts, and HR toolbars; all layout wrappers confirmed dvh + safe-area)

### Phase 10.2 - Finance module decomposition

- [x] Extracted all constants and utility functions from `FinanceScreen.jsx` into `lib/finance-utils.js` (~302 lines)
- [x] Created 8 self-contained Sheet components: `AccountSheet`, `DocumentSheet`, `EntrySheet`, `GuidedEntrySheet`, `ApplySheet`, `JournalLinksSheet`, `ReverseApplicationSheet`, `ReminderSheet`
- [x] Replaced all `window.prompt` violations with `ReverseApplicationSheet` (reversal reason textarea) and `ReminderSheet` (single + bulk reminder message)
- [x] Created 9 fully self-contained sub-screens: `FinanceSummary`, `FinanceAr`, `FinanceAp`, `FinanceAging`, `FinanceApplications`, `FinanceAccounts`, `FinanceEntries`, `FinanceTaxes`, `FinanceFxRates`
- [x] Replaced original 4462-line `FinanceScreen.jsx` monolith with 30-line orchestrator that routes to each sub-screen via `resolveFinanceSection`
- [x] All Finance files are under 1000 lines (largest: `FinanceApplications.jsx` at ~503 lines)
- [x] No `window.prompt`, `window.confirm`, or `window.alert` remain in the finance module

Verified: 2026-05-06 (`wc -l apps/desktop/src/modules/atlas.finance/screens/*.jsx apps/desktop/src/modules/atlas.finance/components/*.jsx apps/desktop/src/modules/atlas.finance/lib/finance-utils.js` — all under 1000 lines; `grep -r "window.prompt\|window.confirm\|window.alert" apps/desktop/src/modules/atlas.finance/` returns no results)

## Phase 11 - RBAC granular por feature (v2)

Spec: `docs/superpowers/specs/2026-05-08-rbac-granular-phase2-design.md`  
Plan: `docs/superpowers/plans/2026-05-08-rbac-granular-phase2.md`

- [x] Granular contract helpers (`module.access` + `module.feature.action`) and uniqueness checks
- [x] Oleada A manifests (`core`, `identity`, `company`) with ACL granular
- [x] Oleada B/C manifests (`files`, `contacts`, `finance`, `hr`) with ACL granular
- [x] API guards en modo granular-only (sin fallback legacy)
- [x] Runtime module and navigation checks con verificacion directa granular
- [x] Catalogo de permisos explicito en espanol para todas las llaves declaradas en manifiestos
- [x] Limpieza de permisos legacy en seed (Permission + RolePermission obsoletos)
- [x] Script operativo `rbac:verify-catalog` para validar `missing_in_catalog=0`
- [x] Roles/Permissions UI redesigned as module > feature > action tree with bulk toggles
- [x] Documentation rules for future modules (granular convention + authorization checklist)
- [x] Mandatory checklist for new modules:
  - [x] Declare granular permissions in manifest
  - [x] Map navigation `permissionKey` by route
  - [x] Protect API endpoints with granular guards
  - [x] Add role x endpoint authorization tests

Verified: 2026-05-08 (`node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`, `node --check apps/api/src/index.js`, `node --check packages/maps/src/core-modules.js`, `node --check packages/maps/src/feature-modules.js`, `node --check apps/api/src/permission-catalog.js`, `pnpm.cmd --filter ./apps/desktop build:web`)

## SDD Methodology adoption

Spec: `docs/superpowers/specs/2026-05-08-spec-driven-development-design.md`
Plan: `docs/superpowers/plans/2026-05-08-spec-driven-development.md`

- [x] Create `docs/spec-driven-development.md` (full methodology, 9 sections)
- [x] Create `docs/superpowers/README.md` (folder index, quick-start, existing spec/plan table)
- [x] Create `docs/superpowers/templates/feature-spec-template.md` (annotated 28-section skeleton)
- [x] Create `docs/superpowers/templates/implementation-plan-template.md` (task/checkbox plan skeleton)
- [x] Create `docs/superpowers/templates/verification-checklist-template.md` (grouped verification checklist)
- [x] Create `docs/superpowers/templates/decision-log-template.md` (5-field deviation log)
- [x] Add `## Spec-Driven Development` section to `CLAUDE.md`
- [x] Add principle #12 to `codex/00_MASTER_PROMPT.md`

Verified: 2026-05-08 (git commit 8249aac — 9 files changed, 1125 insertions; `grep "Spec-Driven" CLAUDE.md` returns section; `grep "spec aprobado" codex/00_MASTER_PROMPT.md` returns principle #12; all 4 template files present in `docs/superpowers/templates/`)

## custom.fleet Reportes V2 UX Rework

- [x] AtlasForm upgraded for report flows: collapsible sections + dedicated `parts-editor` section type with automatic `parts_cost` and `total_cost` recalculation.
- [x] New renderer helpers extracted to keep `AtlasForm.jsx` under project file-size limit (`<=1000` lines).
- [x] Report forms reworked for `maintenance`, `service`, `repair`, `other` with structured sections (vehiculo, datos, taller, refacciones, costos, observaciones, adjuntos) and labels in Spanish.
- [x] Removed unresolved custom badge dependencies in fleet table blueprints that caused “componentes no disponibles (requiere rebuild)” failures.

Verified: 2026-05-21 (`pnpm.cmd --filter @atlas/desktop build:web`; line-count check for `packages/ui/src/atlas-renderer/AtlasForm.jsx` = 978)

## custom.fleet Expansion — Fleet Operativo de Producción

Spec: `docs/superpowers/specs/2026-05-25-fleet-expansion-design.md`
Plan: `docs/superpowers/plans/ya-estamos-por-adaptive-backus.md`

### Área 1: Legacy Cleanup

- [x] Eliminated `fleet.maintenance`, `fleet.maintenance_document`, `fleet.maintenance_type` models from manifest
- [x] Deleted all legacy maintenance views: `maintenance.table.js`, `maintenance.form.js`, `maintenance.detail.js`, `catalog.maintenance-types.table.js`, `catalog.maintenance-types.form.js`, `catalog.maintenance-types.page.js`
- [x] Deleted legacy API files: `maintenance-routes.js`, `maintenance-service.js`
- [x] Removed maintenance navigation entries and ACL entries from `module.manifest.js`
- [x] Removed `createMaintenanceSchema`, `updateMaintenanceSchema` from `validators/index.js`
- [x] Unmounted maintenance router from `api/index.js`

### Área 2: Insurance Policy Entity

- [x] Created `fleet.insurance_policy` model (vehicle relation, insurer_name, policy_number, coverage_type, start/expiry dates, premium, currency, notes, document_asset_id; companyScoped + softDelete)
- [x] Added unique index on `(company_id, policy_number)` and expiry index for active-policy queries
- [x] `insurance-service.js`: `listPolicies`, `createPolicy` (uniqueness check), `getPolicy`, `updatePolicy`, `disablePolicy`, `listVehiclePolicies`, `getActivePolicyForVehicle`
- [x] `insurance-routes.js`: GET/POST /fleet/insurance, GET/PATCH/PATCH+enabled /:id, GET /fleet/vehicles/:vehicleId/insurance
- [x] `createInsurancePolicySchema` + `updateInsurancePolicySchema` with cross-field refinement (`expiry_date >= start_date`)
- [x] Manifest: 4 granular permissions (`fleet.insurance.read/create/update/delete`), Seguros navigation item with ShieldCheck icon
- [x] Insurance views: `insurance-policy.table.js`, `insurance-policy.form.js`, `insurance-policy.detail.js`, `insurance-policy.page.js`
- [x] Auth contract tests for all insurance routes

### Área 3: Vehicle Integration

- [x] `InsuranceBadgeCell.jsx` component (activa/vencida/sin póliza badges) registered in `components/index.js`
- [x] `fleet-service.js`: `listVehicles` enriched with `insurance_status` lateral query; `getVehicle` enriched with `active_insurance_policy`
- [x] `vehicle.table.js`: new `insurance_status` column using `custom.fleet:InsuranceBadgeCell`; `full_economic_number` computed column (`{group}-{individual}`)
- [x] `vehicle.detail.js`: `relation-card` "Póliza activa" (with empty-state CTA) + `relation-list` "Historial de pólizas"
- [x] `vehicles-routes.js`: `GET /fleet/vehicles/:vehicleId/insurance` delegating to insurance service

### Área 4: UX Polish + Validaciones

- [x] Cascading vehicle model picker: `catalogs-routes.js` accepts `?brand_id=&type_id=` filters; `vehicle.form.js` declares `dependsOn: ['vehicle_brand_id', 'vehicle_type_id']`
- [x] Financing validation fix: `updateVehicleSchema` correctly requires `financing_start_date` when `is_financed: true` and validates `financing_end_date >= financing_start_date`
- [x] Catalog filter: `GET /fleet/catalogs/vehicle-models?brand_id=&type_id=` scoped and paginated

Verified: 2026-05-26 (commits `d6e52cf`–`1be2e6a`; `node --check` on all modified files; `POST /modules/sync` rediscovery confirmed; insurance routes return 200 with empty list; vehicle list/detail include `insurance_status` and `active_insurance_policy`; browser QA: badge column visible, cascading picker filters correctly)

## Custom View Components — kind: CUSTOM + ImmersiveShell + Public Routes

Spec: `docs/superpowers/specs/2026-05-25-custom-view-components-design.md` (implied by plan)
Plan: `docs/superpowers/plans/` (inline subagent-driven-development session)

- [x] **CUSTOM validation in `define-view.js`**: validates `schema.component` (namespaced key `namespace:ComponentName`), `schema.path` (starts with `/`), `schema.public` (boolean true when declared), rejects `/p/` paths without `schema.public: true`
- [x] **16 passing tests** in `packages/module-engine/src/__tests__/define-view.test.js` covering all CUSTOM validation rules
- [x] **ImmersiveShell**: full-viewport hover-overlay nav wrapper (`apps/desktop/src/shell/ImmersiveShell.jsx`); mouse trigger ≤80px from top-left; 400ms hide delay; mobile hamburger at bottom-left; uses `h-full` (inside AtlasApp content area below topbar); no duplicate Topbar
- [x] **BlueprintCrudScreen CUSTOM branch**: `customBlueprint` useMemo + `isCustomView` flag; performance guards skip expensive memos on CUSTOM routes; renders `<ImmersiveShell>` wrapping the registered custom component; amber warning card if component not in registry
- [x] **GET /public/blueprints** unauthenticated endpoint: Prisma JSON path filter (`schema.public === true`), cacheGet/cacheSet with `TTL.BLUEPRINTS`, schema projection allowlist (`component`, `path`, `title`, `public`) — no auth data leakage
- [x] **PublicShell + PublicModuleOutlet**: bare outlet wrapper, matches pathname via `normalizePath`, resolves component from `componentRegistry`; NO `setActiveModules` call (would destructively overwrite authenticated registry)
- [x] **`/p/*` router group**: outside `AppAccessGuard`, before catch-all, with `PublicShell` layout and `PublicModuleOutlet` as wildcard child
- [x] **`pathUtils.js`** shared utility: `normalizePath` extracted from both `BlueprintCrudScreen` and `PublicModuleOutlet` to eliminate duplication
- [x] Browser QA: `GET /p/test` (no session) → "Vista pública no encontrada" (confirmed via screenshot 2026-05-26)
- [x] Build verified: `pnpm build` + Tauri native bundle — no errors

Verified: 2026-05-26 (commits `c84dabc`–`aba2ad8`; `node --test packages/module-engine/src/__tests__/define-view.test.js` → 16 passing; browser screenshot confirms `/p/test` shows empty state without session; `pnpm build` clean)

## Next: Module Scaffolder / Creator

Fleet expansion is complete and validated. Custom view components (kind: CUSTOM, ImmersiveShell, public routes) are implemented and build-verified. The agreed next focus is the **Module Scaffolder / Creator** — a tool that generates the scaffold for a new AME3 custom module from a description, producing the complete file structure (`module.manifest.js`, `models/`, `views/`, `api/`, `validators/`) ready for development. Fleet serves as the reference implementation and pattern.
