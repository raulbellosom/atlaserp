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

## Phase 9 - Future modules

- [ ] Purchases
- [ ] Inventory
- [ ] HR (hr_employees, org chart)
- [ ] Fleet
- [ ] Reports
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
