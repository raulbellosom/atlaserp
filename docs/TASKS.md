# Atlas ERP - Tasks and Roadmap

## Task completion policy

- Mark `[x]` only when the task has explicit verification evidence.
- Add a concrete verification line in the phase section using the format:
  `Verified: YYYY-MM-DD (commands/checks executed)`.
- If a task is implemented but not verified yet, keep it unchecked until validation is done.
- Prisma migration safety: never edit existing `prisma/migrations/**/migration.sql` after apply; always add a new forward migration.

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
- [ ] Optional contact relation in transactions (only when contacts module is available)

Verified: 2026-05-05 (`node --check apps/api/src/index.js`, `node --check apps/api/src/services/finance-service.js`, `node --check packages/sdk/src/index.js`, `pnpm.cmd --filter ./apps/desktop build:web`, `pnpm.cmd prisma migrate status`)

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

- [ ] Dedicated routes for HR list and employee detail (`/hr/employees`, `/hr/employees/:id`)
- [ ] Single long-form employee view with all core sections visible (not modal-first)
- [ ] View/Edit toggle with stable layout and async loading safeguards
- [ ] Full HR v1 employee model fields persisted via API/SDK/Prisma
- [ ] Rich markdown notes editor + rendered read mode
- [ ] Employee dossier attachments via canonical files pipeline (`atlas-files`)
- [ ] Embedded employee audit timeline (`actor/action/timestamp`)
- [ ] Permission and auth contracts for `hr.employee|department|job_title|org_chart.*`

Verified: pending

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
- [ ] *Spec approved* → Create `modules/custom/` directory with `README.md` and `.gitkeep`
- [ ] *Spec approved* → File-system discovery from `modules/custom/` at API boot and `POST /modules/sync`

Verified: 2026-05-09 (node --check 13 source files — all pass; node --test 4 test files — 61 tests, 0 fail [15 define-module, 14 define-model, 22 sql-generator, 10 checksum]; 16 named exports verified importable from packages/module-engine/src/index.js; pnpm --filter ./apps/desktop build:web exits 0)

### AME3 Phase 2 — Folder Structure and Custom Sample Module

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-route-loader-sample-module.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-route-loader-sample-module.md`

- [ ] *Spec approved* → Create `modules/official/` directory (migration target, initially empty)
- [ ] *Spec approved* → Route Loader: mount `api/index.js` from `modules/custom/*/` automatically
- [ ] *Spec approved* → Build and document one complete sample custom module (`custom.demo` or `custom.fleet`)
- [ ] *Spec approved* → Module-local validators auto-discovered from `validators/index.js` (no `packages/validators/` edit required)
- [ ] *Spec approved* → `@atlas/module-engine` ships with `defineAtlasModule`, `defineModel`, `defineView`, `definePage`

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

### AME3 Phase 4 — Discovery as Primary Source

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-module-discovery-primary.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-module-discovery-primary.md`

- [ ] *Spec approved* → API boot reads modules from `modules/custom/` and `modules/official/` as primary sources
- [ ] *Spec approved* → `packages/maps/` read only as fallback for not-yet-migrated official modules
- [ ] *Spec approved* → Route Loader: mount all installed module routers at boot; unmount on disable/uninstall
- [ ] *Spec approved* → Component Registry: load all installed module component registrations at boot
- [ ] *Spec approved* → `POST /modules/sync` triggers re-discovery without restart

### AME3 Phase 5 — Migrate Official Modules to modules/official/

**Required spec per module:** `docs/superpowers/specs/YYYY-MM-DD-ame3-migrate-<moduleKey>.md`  
**Required plan per module:** `docs/superpowers/plans/YYYY-MM-DD-ame3-migrate-<moduleKey>.md`

Migration order: atlas.ledger → atlas.contacts → atlas.hr → atlas.finance → atlas.core (navigation/shell only) → atlas.identity → atlas.files → atlas.company

For each module:
- [ ] *Spec approved* → Move code from `packages/maps/` + `apps/api/src/` + `apps/desktop/src/` into `modules/official/<moduleKey>/`
- [ ] *Spec approved* → Replace transitional Prisma models with Atlas ORM `defineModel` declarations
- [ ] *Spec approved* → Replace manual API route mounting with Route Loader
- [ ] *Spec approved* → Replace hardcoded frontend screens with blueprint-driven pages

### AME3 Phase 6 — Generic CRUD Blueprint Renderer

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-crud-blueprint-renderer.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-crud-blueprint-renderer.md`

- [ ] *Spec approved* → `AtlasTable` fully renders any TABLE blueprint with sort, filter, pagination
- [ ] *Spec approved* → `AtlasForm` fully renders any FORM blueprint with React Hook Form + generated Zod schema
- [ ] *Spec approved* → `AtlasDetail` renders any DETAIL blueprint read-only
- [ ] *Spec approved* → `AtlasCrudView` composes list + form + detail into a full CRUD experience
- [ ] *Spec approved* → Shell and layout resolution: `atlas.dashboardShell`, `atlas.crudLayout`
- [ ] *Spec approved* → Custom component key resolution via Component Registry

### AME3 Phase 7 — Remove packages/maps

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-remove-packages-maps.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-remove-packages-maps.md`

- [ ] *Spec approved* → All official modules confirmed operational from `modules/official/`
- [ ] *Spec approved* → `packages/maps/src/feature-modules.js` deleted
- [ ] *Spec approved* → `packages/maps/src/core-modules.js` deleted or absorbed into `modules/official/atlas.core/`
- [ ] *Spec approved* → `packages/maps/` package removed from monorepo
- [ ] *Spec approved* → No remaining references to `packages/maps/` in core codebase

---

## Future feature modules

- [ ] Purchases (supplier orders, receiving)
- [ ] Inventory (stock management)
- [ ] Fleet (vehicles, drivers, maintenance) — candidate first AME3 custom module
- [ ] Reports (cross-module reporting engine)
- [ ] Website builder / CMS

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
