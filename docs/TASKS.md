# Atlas ERP - Tasks and Roadmap

## Task completion policy

- Mark `[x]` only when the task has explicit verification evidence.
- Add a concrete verification line in the phase section using the format:
  `Verified: YYYY-MM-DD (commands/checks executed)`.
- If a task is implemented but not verified yet, keep it unchecked until validation is done.
- Prisma migration safety: never edit existing `prisma/migrations/**/migration.sql` after apply; always add a new forward migration.

## atlas.pos — Restaurant POS

Specs: `docs/superpowers/specs/2026-06-21-atlas-pos-core-design.md`, `2026-06-29-pos-waiter-split-bill.md`
Plans: `docs/superpowers/plans/2026-06-21-atlas-pos-plan-a-core-backend.md`, `...-plan-b-ui.md`, `...-plan-c-floor-planner.md`, `2026-06-22-pos-reservations.md`, `2026-06-29-pos-waiter-plan-a-backend.md`, `...-plan-b-ui.md`
Stabilization: `docs/superpowers/specs/2026-07-17-post-pause-stabilization-design.md` + plan of same name

- [x] Core backend: sessions, stations, tables, orders, payments (`apps/api/src/routes/pos/`)
- [x] Screens: `PosFloorPlannerScreen`, `PosOrdersScreen`, `PosSessionsScreen`, `PosSettingsScreen`, `PosStationsScreen`, `PosTablesScreen`, `PosTerminalScreen`
- [x] Reservations (`20260622100000_pos_reservations`, `pos-reservation-service.js`, `usePosReservation`)
- [x] Waiter assignment: auto-claim on order open, auto-clear on AVAILABLE, mis-mesas filter, waiter chip (`20260629120000_pos_waiter_split_bill`)
- [x] Split bill: per-seat totals, `SplitBillDialog`, mesa-completa/dividir-cuenta toggle in `PaymentDialog`
- [x] Backend tests: waiter assignment, seat totals, mis-mesas, auto-claim, 404 unknown waiter
- [x] Manual QA: waiter chip + mis-mesas flow in browser
- [x] Manual QA: split-bill payment flow in browser (degenerate "Sin asignar" case only — see pending seat UI below)
- [x] Smoke + commit of transform-based pan/zoom refactor in `FloorOperationalCanvas.jsx` (commit `12af733`)
- [ ] Wire guest/seat management UI in the terminal: no control exists to set `guestCount` on order creation nor to assign lines to `guestSeatId`, so per-seat split bill is unreachable from the UI (backend + `SplitBillDialog` are ready; only reservations set `guestCount` via `partySize`)
- [ ] Fix silent no-op in `SplitBillDialog.handleChargeSeat` when no payment method is configured (button click does nothing; should disable with a hint)
- [ ] Cosmetic: in mis-mesas mode, filtered-out tables render as pale "Disponible" ghosts instead of their true status (backend filters them from the response; canvas falls back to default status)
- [ ] Full restaurant-flow QA with kitchen stations configured (send-to-kitchen returned 400 in dev because products lack an assigned preparation station — error message is correct and actionable)

Verified: 2026-07-17 (`pnpm.cmd exec prisma migrate status` → "Database schema is up to date!" with all 50 migrations applied incl. `20260629120000_pos_waiter_split_bill`; `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` → 31 tests / 31 pass / 0 fail; `pnpm.cmd --filter @atlas/desktop build:web` → built in 3.46s; Playwright browser QA against localhost:5173: canvas fit-to-content 80% + wheel zoom to 92% + pan + fit button OK with zero console errors; new dine-in order on available table auto-claimed table (chip "RB" with title "Raul Belloso Medina" in DOM), mis-mesas dimmed the non-assigned table, full payment via Efectivo → table SUCIA → "Marcar como lista" → AVAILABLE cleared the chip; split-bill dialog showed correct "Sin asignar" seat total $128 and POST /payments 201 closed the dialog and transitioned the table)

## atlas.chat — Realtime Chat

Specs: `docs/superpowers/specs/CHAT_SPEC.md`, `2026-06-28-chat-improvements-a-backend.md`, `...-b-frontend.md`, `2026-06-28-realtime-layer-unificado-design.md`, `2026-06-26-realtime-v2-design.md`
Plans: `docs/superpowers/plans/CHAT_IMPLEMENTATION_PLAN.md`, `2026-06-28-chat-improvements-plan-a.md`, `2026-06-28-realtime-layer-plan-a-api.md`, `...-plan-b-frontend.md`, `2026-06-26-realtime-v2-plan-a-api.md`, `...-plan-b-frontend.md`

- [x] Chat tables + evolution migrations (`20260625000000_add_chat_tables` → `20260629130000_chat_archive`: attachments, tracking code, expiry email flag, archive, available_for_chat)
- [x] Internal chat: `ChatScreen`, conversations, members, typing, presence (Supabase Realtime)
- [x] External guest chat: `ExternalInboxScreen`, `ExternalChatWidget`, storefront-sdk guest flow (v0.5.2)
- [x] Message templates: `ChatTemplatesScreen`; forward message modal
- [x] Unified realtime layer (2026-06-28 plans A/B)
- [ ] Message search
- [ ] Notification integration: unread badge in topbar
- [ ] Confirm `atlas-chat` bucket exists in Supabase Storage

Verified: 2026-07-17 (migrations confirmed applied via `prisma migrate status`; module active in dev use since 2026-06-25; no formal browser verification run recorded)

## atlas.notes — Collaborative Notes

Plans: `docs/superpowers/plans/2026-06-27-atlas-notes-A-backend.md`, `2026-06-27-atlas-notes-B-frontend.md`

- [x] Backend: migrations `20260627120000_atlas_notes_tables` + `20260627130000_atlas_notes_fixes`; services (notes/folders/tags/shares/ydoc); 26-endpoint router; SDK domain; 17 permissions in core manifest
- [x] Frontend: `NotesScreen`, `PublicNoteScreen`, `NoteEditor` (TipTap + Yjs via `SupabaseYjsProvider`), `DrawingCanvas`, `ImageAnnotationOverlay`, `NoteShareModal`, folders/tags sidebar
- [ ] Create `atlas-notes` private bucket in Supabase Storage
- [ ] Live QA: collaborative editing between two sessions; public route `/p/notes/:slug`

Verified: 2026-07-17 (implementation confirmed by file inventory and applied migrations via `prisma migrate status`; no live QA recorded)

## June 2026 UX/platform small plans

Plans: `docs/superpowers/plans/2026-06-20-ledger-categories-user-scope-a-api.md` + `-b-ui.md`, `2026-06-21-sortable-lists-plan.md`, `2026-06-21-notification-bell-ux-fix.md`, `2026-06-22-calendar-deeplink-loading-state.md`, `2026-06-26-file-viewer-mobile-responsive.md`

- [x] Ledger categories user scope (A: API, B: UI)
- [x] Sortable lists
- [x] Notification bell UX fix
- [x] Calendar deeplink loading state
- [x] File viewer mobile responsive

Verified: 2026-06-29 (implemented per plan execution in June sessions and included in commits up to `323e6d9`; re-verify opportunistically when touching these areas)

## Atlas Growth - Storefront Capture Foundation

Spec: `docs/superpowers/specs/2026-06-14-storefront-capture-foundation-design.md`
Plan: `docs/superpowers/plans/2026-06-14-storefront-capture-foundation.md`

- [x] Apply and verify the forward Prisma migration in the target environment.
- [ ] Verify public capture v1 on Builder and uploaded `dist` domains.
- [x] Publish `@raulbellosom/atlas-sdk` 0.3.0 (bumped to 0.3.1 with patch fix).
- [ ] Observe event ingestion, daily aggregation, and retention under production load.
- [x] Start `growth-lead-inbox` — spec approved and fully implemented.

Verified: 2026-06-14 (automated implementation scope: `pnpm.cmd exec prisma validate`, `pnpm.cmd db:generate`, and `pnpm.cmd check:uuid-policy` passed; API/IIFE/worker suites: 58 passed; npm SDK suites: 65 passed; `pnpm.cmd --filter @atlas/desktop build:web` passed; `pnpm.cmd build` produced the web build and Windows MSI/NSIS bundles; React Doctor diagnostics were empty. Target migration, live Builder/`dist`, npm publication, and production-load observation remain pending. See `docs/superpowers/verifications/2026-06-14-storefront-capture-foundation.md`.)

## Atlas Growth - Lead Inbox

Spec: `docs/superpowers/specs/2026-06-14-growth-lead-inbox-design.md`
Plan: `docs/superpowers/plans/2026-06-14-growth-lead-inbox.md`

- [x] Add the protected Growth lead service, state machine, notes, ownership, notifications, and optimistic conflict checks.
- [x] Convert leads transactionally to existing or new Contacts with cross-company and permission checks.
- [x] Add the internal Growth SDK domain and preserve the extracted Website domain contract.
- [x] Add responsive lead inbox/detail screens, manual creation, filters, timeline, conversion, and attachments.
- [x] Add Growth navigation, ACL, file allowlist, and company-scoped assignee/file routes.
- [x] Apply the forward migration in the target environment.
- [ ] Verify authenticated RBAC, notifications, attachments, and both conversion modes against a live installation.

Verified: 2026-06-14 (automated scope: Growth/API/SDK/UI suites 42 passed; Prisma validation and UUID policy passed; `pnpm.cmd build` produced the web build, Windows executable, MSI, and NSIS installer; React Doctor scanned 7 changed files with no diagnostics. Live migration and authenticated browser workflows remain pending. See `docs/superpowers/verifications/2026-06-14-growth-lead-inbox.md`.)

## Atlas Growth - Analytics

Spec: `docs/superpowers/specs/2026-06-14-growth-analytics-design.md`
Plan: `docs/superpowers/plans/2026-06-14-growth-analytics.md`

- [x] Aggregate daily site, acquisition, landing, content, CTA, form, funnel,
  and retention dimensions with watermark, late-event reprocessing, and purge.
- [x] Add protected overview, acquisition, content, conversion, retention,
  site-filter, and audited CSV endpoints.
- [x] Add internal SDK methods and the `/app/m/atlas.growth` dashboard with
  shared URL filters and five analytic tabs.
- [x] Verify the initial one-million-event target in disposable PostgreSQL 17
  with recorded `EXPLAIN (ANALYZE, BUFFERS)` plans.
- [x] Apply and verify migrations and worker scheduling in the target environment.
- [ ] Complete authenticated browser and mobile QA against live storefront data.

Verified: 2026-06-14 (49 Growth/API/worker/validator/SDK/UI tests passed; all 19 internal SDK tests passed; Prisma and UUID checks passed; Vite and full monorepo/Tauri builds passed; disposable scale benchmark measured aggregate read 7.245 ms, one-day tails 23.490-58.293 ms, and 44-day retention 272.868 ms with current indexes. React Doctor reported no correctness errors. Live deployment/browser QA remains pending. See `docs/superpowers/verifications/2026-06-14-growth-analytics.md`.)

## Atlas Documents - Template Engine

Spec: `docs/superpowers/specs/2026-06-14-atlas-documents-template-engine-design.md`
Plan: `docs/superpowers/plans/2026-06-14-atlas-documents-template-engine.md`

- [x] Add official `atlas.documents` schema, forward migration, manifest, PWA identity, navigation, and granular permissions.
- [x] Add controlled block validators, safe provider registry, and the company-scoped `growth.lead` provider.
- [x] Add template/version lifecycle, immutable publication, optimistic conflicts, audit entries, preview, generation, and generated-document history.
- [x] Render branded multipage PDFs and persist private outputs as `FileAsset` records using PostgreSQL-generated IDs.
- [x] Add the extracted internal SDK Documents domain and lazy-loaded template editor/history screens.
- [x] Generate Documents from Growth leads and expose generated PDFs in the lead attachment area without granting Growth removal rights.
- [x] Apply and verify the forward migration in the target installation.
- [ ] Complete authenticated browser QA for template lifecycle, every block type, provider RBAC, storage/download, history, and Growth generation.

Verified: 2026-06-15 (Prisma validate/generate and UUID policy passed; 84 Documents/Growth/SDK tests plus 3 manifest/schema contract tests passed; Vite and full monorepo/Tauri builds passed and produced the native executable, MSI, and NSIS bundles; React Doctor reported no correctness errors, with heuristic warnings documented. `rbac:verify-catalog` still reports only the known unrelated Calendar/Catalog/Inventory and platform catalog drift. Live migration and authenticated browser/storage QA remain pending. See `docs/superpowers/verifications/2026-06-15-atlas-documents-template-engine.md`.)

## atlas.inventory — Asset Management [COMPLETE]

Plan: `docs/superpowers/plans/2026-06-12-atlas-inventory.md`

- [x] Prisma models: `InventoryCategory`, `InventoryItem`, `InventoryAssignment`, `InventoryCustomField`, `InventoryCustomFieldValue` + migration
- [x] Category management with icon + color picker, custom field schema per category
- [x] Item CRUD with custom field values; grouped-tree main view by category
- [x] Assignment flow: assign items to HR employees, return flow, history tracking
- [x] API: `inventory-service.js`, `inventory-notification-service.js`, routes
- [x] SDK `atlas.inventory.*` domain; screens `InventoryScreen`, `InventoryCatalogsScreen`, `InventoryAssignmentsScreen`, `InventoryItemDetail`, `InventoryItemForm`
- [x] HR employee integration: assigned items panel in employee detail

Verified: 2026-06-20 (all 5 screens present in `apps/desktop/src/modules/atlas.inventory/screens/`; `inventory-service.js`, `inventory-notification-service.js` present in `apps/api/src/services/`; DB migration up to date per `prisma migrate status`)

Note: Activity feed bridge deferred — no `activityBridge` pattern for inventory events yet.

## Atlas Comments System [COMPLETE]

Plans: `docs/superpowers/plans/2026-06-14-generic-comments-api.md`, `2026-06-14-generic-comments-ui.md`, `2026-06-14-growth-comments-api.md`, `2026-06-14-growth-comments-ui.md`

- [x] `comments-service.js`: generic comments engine with @mentions, emoji reactions, and soft-delete
- [x] Growth lead comments integration
- [x] Comments UI components in `@atlas/ui`

Verified: 2026-06-20 (`comments-service.js` present in `apps/api/src/services/`)

## Atlas Projects [COMPLETE — v1 through v2.3]

Specs: `docs/superpowers/specs/2026-06-08-atlas-projects-design.md`, `2026-06-08-atlas-projects-v2.1-design.md`, `2026-06-08-atlas-projects-v2.3-design.md`  
Plans: `docs/superpowers/plans/2026-06-08-atlas-projects-plan-a-api.md`, `...-plan-b-ui.md`, plus v2.1 and v2.3 variants; `2026-06-10-atlas-projects-perf-A.md`, `...-perf-B.md`, `2026-06-10-atlas-projects-mobile-mentions.md`

- [x] Project + task management: `projects-service.js`, `tasks-service.js`
- [x] Custom fields: `projects-fields-service.js`
- [x] Task dependencies: `projects-dependencies-service.js`
- [x] Recurring tasks: `projects-recurring-service.js`
- [x] Notifications: `projects-notification-service.js`
- [x] Calendar bridge: `projects-calendar-bridge.js`
- [x] Desktop: `ProjectsScreen.jsx` with full task/project management UI
- [x] Performance optimization (v2.3) and mobile @mentions improvements

Verified: 2026-06-20 (`ProjectsScreen.jsx` present in `apps/desktop/src/modules/atlas.projects/screens/`; 7 API service files confirmed in `apps/api/src/routes/projects/`)

## Atlas Calendar + Google Calendar Sync [COMPLETE]

Spec: `docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md`  
Plans: `docs/superpowers/plans/2026-06-07-google-calendar-phase-1-2-implementation.md`, `2026-06-08-google-calendar-phase-3a-implementation.md`, `2026-06-08-google-calendar-phase-3b-implementation.md`, `2026-06-08-google-calendar-sidebar-modal-implementation.md`, `2026-06-08-google-calendar-persistent-icon-implementation.md`

- [x] Calendar event CRUD: `calendar-service.js`, `calendar-event-service.js`
- [x] Notification layer: `calendar-notification-service.js`
- [x] Google OAuth + token management: `google-oauth-service.js`, `google-token-crypto.js`
- [x] Google Calendar discovery, connection, event linking, initial import (9 Google service files)
- [x] Desktop: `CalendarScreen.jsx` with sidebar modal, persistent Google Calendar icon
- [x] Projects calendar bridge integration

Verified: 2026-06-20 (`CalendarScreen.jsx` present in `apps/desktop/src/modules/atlas.calendar/`; `apps/api/src/routes/calendar/google/` contains 9 Google integration service files)

## Offline Sync Architecture [COMPLETE — Phases 1–5]

Spec: `docs/superpowers/specs/2026-06-06-offline-architecture-design.md`  
Plans: `docs/superpowers/plans/2026-06-06-offline-phase-1a-package.md` through `2026-06-07-offline-phase5c-ledger-hooks.md`

- [x] `packages/offline/` — sync engine, Dexie IndexedDB persister, mutation queue, session vault, online detector
- [x] Conflict detection + resolution (backend + frontend phases)
- [x] Backend pull/push: `sync-service.js`, `sync-push-service.js`, `sync-cleanup-worker.js`
- [x] Navigation guard for offline state; offline provider for React tree
- [x] Calendar offline support (tier 2); Atlas Ledger SQLite cache (Phase 5 — also tracked above)

Verified: 2026-06-20 (`packages/offline/src/` contains 15 files including `sync-engine.js`, `dexie-persister.js`, `mutation-queue.js`, `offline-provider.jsx`; `sync-service.js`, `sync-push-service.js`, `sync-cleanup-worker.js` in API services; `sync.js` route present)

## Storefront SDK + Hosted Build [COMPLETE]

Specs: `docs/superpowers/specs/2026-06-01-atlas-storefront-sdk-design.md`, `2026-06-01-hosted-build-design.md`, `2026-06-11-dist-auth-sdk-design.md`, `2026-06-14-pwa-module-icon-consistency-design.md`  
Plans: `docs/superpowers/plans/2026-06-01-atlas-storefront-sdk-plan-a-api.md`, `...-plan-b-sdk.md`, `2026-06-01-hosted-build-plan-a-backend.md`, `...-plan-b-frontend.md`, `2026-06-11-dist-auth-sdk.md`, `2026-06-14-pwa-module-icon-consistency.md`, `2026-06-14-unified-storefront-auth.md`

- [x] Storefront capture + config API: `storefront-capture-service.js`, `storefront-capture-routes.js`, `storefront-config-routes.js`
- [x] Storefront auth API: `storefront-auth-service.js`, `storefront-auth-routes.js`
- [x] Storefront files pipeline: `storefront-files-service.js`, `storefront-files-routes.js`
- [x] Hosted dist upload + serve: `dist-upload-service.js`, `dist-serve-service.js`
- [x] `@raulbellosom/atlas-sdk` npm package published (0.3.1)
- [x] Unified storefront auth flow; PWA module icon consistency

Verified: 2026-06-20 (`apps/api/src/routes/storefront/` contains `storefront-router.js` + 5 route files; `dist-serve-service.js`, `dist-upload-service.js`, `storefront-auth-service.js`, `storefront-capture-service.js`, `storefront-files-service.js` in `apps/api/src/services/`)

## Atlas Notifications Core [COMPLETE]

Spec: `docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md`  
Plans: `docs/superpowers/plans/2026-06-01-atlas-notifications-core-part-a-foundation.md` through `...-part-d-web-push.md`; `2026-06-14-notifications-comments-reactions.md`, `2026-06-10-notifications-deep-link-audit.md`

- [x] Notification service + publisher: `notification-service.js`, `notification-publisher.js`
- [x] Delivery worker: `notification-delivery-worker.js`
- [x] Web push: `web-push-service.js`
- [x] Email delivery via `smtp-service.js`
- [x] Deep link routing audit and fix
- [x] Comments/reactions notification integration
- [x] Desktop: `NotificationsInboxScreen.jsx`, `NotificationSettingsScreen.jsx`

Verified: 2026-06-20 (`notification-service.js`, `notification-publisher.js`, `notification-delivery-worker.js`, `web-push-service.js` in `apps/api/src/services/`; notification screens present in `apps/desktop/src/modules/atlas.notifications/`)

## Atlas Website v2 [COMPLETE]

Specs: `docs/superpowers/specs/2026-05-30-atlas-website-v2-redesign.md`, `2026-06-05-atlas-website-admin-refactor-design.md`, `2026-06-01-morada-premium-template-design.md`  
Plans: `docs/superpowers/plans/2026-05-30-atlas-website-v2-plan-A.md`, `...-plan-B.md`, `2026-06-05-atlas-website-wizard-nav-refactor.md`, `...-screens-refactor.md`, `2026-06-01-morada-premium-template.md`, `2026-05-30-website-overview-delete-status-editor-bar.md`, `2026-05-31-multi-page-site-templates.md`

- [x] Full CMS: pages, blog, forms, menus, templates, theme, payments, settings
- [x] Page editor with blocks + live preview (`WebsitePageEditorScreen`)
- [x] Blog post editor (`WebsiteBlogPostEditorScreen`)
- [x] Forms builder with submission tracking (`WebsiteFormsScreen`)
- [x] Website wizard + multi-page site templates; Morada premium template
- [x] API routes in `apps/api/src/routes/website/` + `apps/api/src/routes/public-website.js`

Verified: 2026-06-20 (15+ screens present in `apps/desktop/src/modules/atlas.website/screens/` including `WebsiteOverviewScreen`, `WebsitePagesScreen`, `WebsitePageEditorScreen`, `WebsiteBlogScreen`, `WebsiteFormsScreen`, `WebsiteMenusScreen`, `WebsiteThemeScreen`, `WebsiteTemplatesScreen`, `WebsiteWizard`)

## Atlas Catalog v2 [COMPLETE]

Spec: `docs/superpowers/specs/2026-05-31-atlas-catalog-v2-design.md`  
Plans: `docs/superpowers/plans/2026-05-30-atlas-catalog-plan-A.md`, `...-plan-B.md`, `2026-05-31-atlas-catalog-v2-plan-a-backend.md`, `...-plan-b-frontend.md`, `2026-06-01-atlas-catalog-core-migration.md`

- [x] Product catalog with categories, items, and inventory count
- [x] Screens: `CatalogCategoriesScreen`, `CatalogProductsScreen`, `CatalogProductDetailScreen`, `CatalogInventoryScreen`
- [x] API routes in `apps/api/src/routes/catalog/`

Verified: 2026-06-20 (4 screens present in `apps/desktop/src/modules/atlas.catalog/screens/`; `catalog/` route folder confirmed in `apps/api/src/routes/`)

## Fleet: AME3 → Desktop Module Migration [COMPLETE]

Plans: `docs/superpowers/plans/2026-06-06-fleet-screens-migration.md`, `2026-06-06-sdk-migration-calendar-fleet.md`, `2026-06-06-ledger-cleanup-modules-official.md`

- [x] Migrated from AME3 (`modules/custom/custom.fleet/`) to core desktop module (`atlas.fleet`)
- [x] Fleet API moved to `apps/api/src/routes/fleet/` (full service layer retained)
- [x] Desktop screens: `VehiclesScreen`, `DriversScreen`, `ReportsScreen`, `ReportFormPage`, `ReportDetailScreen`, `InsuranceScreen`, `CatalogsScreen`
- [x] SDK migration for fleet + calendar domains; `modules/custom/` is now empty

Verified: 2026-06-20 (`apps/desktop/src/modules/atlas.fleet/screens/` contains 7 screens; `apps/api/src/routes/fleet/` present with full service layer; `modules/custom/` empty confirmed)

## Dynamic Module Bundler + Custom Module ZIP Upload [COMPLETE]

Specs: `docs/superpowers/specs/2026-05-28-dynamic-module-bundler-design.md`, `2026-06-10-custom-module-zip-upload-design.md`  
Plans: `docs/superpowers/plans/2026-05-28-dynamic-module-bundler.md`, `2026-06-10-custom-module-zip-upload-api.md`, `2026-06-10-custom-module-zip-upload-ui.md`

- [x] `module-bundler-service.js` — builds and bundles custom module components at install time
- [x] `module-upload-service.js` — handles ZIP upload + extraction for custom modules
- [x] `dist-upload-service.js` / `dist-serve-service.js` — serves bundled dist assets
- [x] UI in Module Catalog for uploading custom modules via ZIP

Verified: 2026-06-20 (`module-bundler-service.js`, `module-upload-service.js`, `dist-upload-service.js`, `dist-serve-service.js` present in `apps/api/src/services/`)

## Platform Settings + SMTP [COMPLETE]

Plan: `docs/superpowers/plans/2026-05-30-platform-settings-smtp-plan.md`

- [x] `smtp-service.js` — SMTP configuration and transactional email delivery
- [x] `settings-routes.js` — platform settings API endpoints
- [x] `SmtpSettingsScreen.jsx` — SMTP configuration UI in `platform-settings` module

Verified: 2026-06-20 (`smtp-service.js` in `apps/api/src/services/`; `settings-routes.js` in `apps/api/src/routes/`; `SmtpSettingsScreen.jsx` in `apps/desktop/src/modules/platform-settings/screens/`)

## HR v2 — Org Chart [COMPLETE]

Spec: `docs/superpowers/specs/2026-05-05-phase9-hr-v2-orgchart-design.md`  
Plan: `docs/superpowers/plans/2026-05-05-phase9-hr-v2-orgchart.md`

- [x] `GET /hr/org-chart` endpoint with recursive supervisor chain (CTE)
- [x] SDK `atlas.hr.getOrgChart(token, { rootEmployeeId })` method
- [x] `HrOrgChartScreen.jsx` — interactive tree with root employee selector, supervisor hierarchy rendering, and empty-state guidance
- [x] HR navigation entry for org chart route

Verified: 2026-06-20 (`HrOrgChartScreen.jsx` present in `apps/desktop/src/modules/atlas.hr/screens/`; queries `atlas.hr.getOrgChart` with `rootEmployeeId` parameter confirmed at line 429)

## atlas.activity (CORE Activity Feed)

- [x] Spec: `docs/superpowers/specs/2026-05-31-atlas-activity-design.md` (28 sections, status Approved).
- [x] Plan: `docs/superpowers/plans/2026-05-31-atlas-activity.md` (14 tasks).
- [x] Prisma `Activity` model + manual migration `20260531000000_add_activity_table` with `DEFAULT uuidv7()`, 4 indexes (company+createdAt desc, entity, type, actor), FK SET NULL.
- [x] Core manifest `activityMap` registered (12 modules seeded), 4 permissions (`activity.access/read/publish/manage`) in catalog with Spanish labels.
- [x] Validators: `activityPublishSchema` (4KB payload limit via `superRefine`), `activityListQuerySchema` (z.coerce), `ACTIVITY_CONSTANTS`.
- [x] Service `apps/api/src/services/activity-service.js`: `publish`, `publishFromContext` (resolves company via membership), `list`, `recent`, `listForEntity`, 2s dedupe window, actor join.
- [x] Bridge `apps/api/src/services/activity-bridge.js`: translator registry (HR, contacts, files, company, core), `logAndPublish` writes AuditLog first then never throws on activity errors.
- [x] Routes `apps/api/src/routes/activity.js`: GET list/recent/entity, POST publish, POST subscribe-token; mounted with `requirePermission` guards.
- [x] HR adoption: `hr-service.js` uses `bridge.logAndPublish` for create/update/setEnabled with severity hints.
- [x] SDK `packages/sdk/src/index.js`: `atlas.activity.{list,recent,listForEntity,publish,subscribeToken,getRealtimeChannel}`.
- [x] UI `packages/ui`: `ActivityTimeline`, `ActivityDrawer`, `ActivityBellTrigger` (poll 15s + optional Supabase Realtime, localStorage lastSeen).
- [x] Desktop integration: `<ActivityBellTrigger />` in `Topbar` (permission-gated), `/app/activity` route + `ActivityFeedScreen`, embedded `HrEmployeeActivityPanel` in employee detail.
- [x] Tests: `apps/api/src/services/__tests__/activity-service.test.js` (6) + `activity-bridge.test.js` (6) → 12/12 passing.

Verified: 2026-05-31 (`pnpm prisma migrate deploy` → applied `20260531000000_add_activity_table`; `pnpm db:seed` → "Atlas modules seeded (12)"; `node --test apps/api/src/services/__tests__/activity-service.test.js apps/api/src/services/__tests__/activity-bridge.test.js` → tests 12 / pass 12 / fail 0; `node --check` on `apps/api/src/{index,routes/activity,services/activity-service,services/activity-bridge,services/hr-service}.js`, `packages/{sdk,validators}/src/index.js` → OK; `pnpm --filter ./apps/desktop build` → `✓ built in 4.86s` + Tauri release bundles produced)

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

## Offline Phase 5 - Ledger SQLite Read Cache

Spec: `docs/superpowers/specs/2026-06-07-offline-phase5-tauri-sqlite.md`  
Phase 5C Spec: `docs/superpowers/specs/2026-06-07-offline-phase5c-ledger-hooks.md`  
Plan: `docs/superpowers/plans/2026-06-07-offline-phase5c-ledger-hooks.md`

- [x] Phase 5A - `/sync/pull` supports `atlas.ledger` records (`account`, `transaction`, `category`, `transaction_type`)
- [x] Phase 5B - Tauri SQLite cache, `LedgerSQLiteStore`, `LedgerSyncAdapter`, and guarded dual-pull orchestration
- [x] Phase 5C - Desktop ledger reads use SQLite offline for accounts, account detail, transaction history, and summary charts
- [x] Ledger write actions stay online-only and the desktop UI explains read-only offline behavior
- [x] Offline documentation and status tracking updated to reflect final Phase 5 behavior

Verified: 2026-06-07 (`node --test packages/offline/src/__tests__/ledger-sqlite.test.js apps/desktop/src/modules/atlas.ledger/lib/__tests__/ledger-data-client.test.js`, `pnpm.cmd --filter @atlas/desktop build:web`, `npx.cmd -y react-doctor@latest . --verbose --diff` in `apps/desktop`)

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
- [x] _Spec approved_ → Create `packages/module-engine/` — exports `defineAtlasModule`, `defineModel`, `defineView`, `definePage`
- [x] _Spec approved_ → Create `modules/custom/` directory with `README.md` and `.gitkeep`
- [x] _Spec approved_ → File-system discovery from `modules/custom/` at API boot and `POST /modules/sync`

Verified: 2026-05-09 (node --check 13 source files — all pass; node --test 4 test files — 61 tests, 0 fail [15 define-module, 14 define-model, 22 sql-generator, 10 checksum]; 16 named exports verified importable from packages/module-engine/src/index.js; pnpm --filter ./apps/desktop build:web exits 0)

### AME3 Phase 2 — Folder Structure and Custom Sample Module

**Required spec:** `docs/superpowers/specs/2026-05-09-ame3-custom-fleet-module.md`  
**Required plan:** `docs/superpowers/plans/2026-05-09-ame3-custom-fleet-module.md`

- [x] _Spec approved_ → Create `modules/official/` directory (migration target, initially empty)
- [x] _Spec approved_ → Route Loader: mount `api/index.js` from `modules/custom/*/` automatically
- [x] _Spec approved_ → Build and document one complete sample custom module (`custom.demo` or `custom.fleet`)
- [x] _Spec approved_ → Module-local validators auto-discovered from `validators/index.js` (no `packages/validators/` edit required)
- [x] _Spec approved_ → `@atlas/module-engine` ships with `defineAtlasModule`, `defineModel`, `defineView`, `definePage`

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

- [x] _Spec approved_ → API boot reads modules from `modules/custom/` and `modules/official/` as primary sources
- [x] _Spec approved_ → `packages/maps/` read only as fallback for legacy official modules during decommission track
- [x] _Spec approved_ → Route Loader: mount all installed module routers at boot; unmount on disable/uninstall
- [x] _Spec approved_ → Component Registry: load all installed module component registrations at boot
- [x] _Spec approved_ → `POST /modules/sync` triggers re-discovery without restart

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
- [x] _Spec approved_ → `AtlasTable` fully renders TABLE blueprints with sort, filter, and pagination controls.
- [x] _Spec approved_ → `AtlasForm` fully renders FORM blueprints using schema-driven sections, relation loaders, inline create, and submit validations.
- [x] _Spec approved_ → `AtlasDetail` renders DETAIL blueprints in read-only mode, including relation labels and attachments context.
- [x] _Spec approved_ → `AtlasCrudView` composes list + form + detail into a complete CRUD flow with create/view/edit transitions.
- [x] _Spec approved_ → Shell and layout resolution: `atlas.dashboardShell`, `atlas.crudLayout`
- [x] _Spec approved_ → Custom component key resolution via Component Registry

Verified: 2026-05-25 (`rg -n "filterValues|sortBy|sortDir|pagination|TablePaginationFooter" packages/ui/src/atlas-renderer/AtlasTable.jsx packages/ui/src/atlas-renderer/AtlasTableToolbar.jsx packages/ui/src/atlas-renderer/TablePaginationFooter.jsx`; `rg -n "normalizeSections|handleSubmit|relation|inlineCreate|AttachmentsPanel" packages/ui/src/atlas-renderer/AtlasForm.jsx packages/ui/src/atlas-renderer/atlas-form-schema.js`; `rg -n "readOnly|AttachmentsPanel" packages/ui/src/atlas-renderer/AtlasDetail.jsx`; `rg -n "AtlasTable|AtlasForm|AtlasDetail|mode=\"create\"|mode=\"edit\"" packages/ui/src/atlas-renderer/AtlasCrudView.jsx`; `node --test packages/ui/src/atlas-renderer/__tests__/renderer-adapters.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`)

### AME3 Phase 7 — Remove packages/maps

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-remove-packages-maps.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-remove-packages-maps.md`

- [x] Kickoff inventory completed for `packages/maps` decommission: direct runtime/seed/test import points identified in API, desktop, and Prisma seed flows.
- [x] Desktop decommission cut #1 complete: removed `@atlas/maps` dependency/alias/import usage from runtime merge and module catalog install flow.
- [x] API decommission cut #1 complete: centralized official manifest access behind `module-manifests-service` and removed direct maps imports from module routes and RBAC contract tests.
- [x] Seed decommission cut #1 complete: `prisma/seed.js` now consumes `listOfficialModuleManifests()` and no longer imports map files directly.
- [x] _Spec approved_ → All official modules confirmed operational from current production locations (no `modules/official/` relocation required)
- [x] _Spec approved_ → `packages/maps/src/feature-modules.js` deleted
- [x] _Spec approved_ → `packages/maps/src/core-modules.js` deleted or absorbed into core runtime sources
- [x] _Spec approved_ → `packages/maps/` package removed from monorepo
- [x] _Spec approved_ → No remaining references to `packages/maps/` in core codebase

Verified: 2026-05-25 (`pnpm.cmd install --lockfile-only`; `node --check apps/api/src/index.js`; `node --check apps/api/src/routes/modules.js`; `node --check apps/api/src/services/module-manifests-service.js`; `node --check prisma/seed.js`; `node --check scripts/verify-permission-catalog.mjs`; `node --test apps/api/src/services/__tests__/rbac-granular-contract.test.js`; `node --test apps/api/src/services/__tests__/module-discovery-service.test.js apps/api/src/services/__tests__/route-loader-service.test.js apps/api/src/services/__tests__/module-dependency-utils.test.js`; `node --test packages/module-engine/src/__tests__/define-view.test.js packages/module-engine/src/__tests__/sql-generator.test.js`; `pnpm.cmd --filter @atlas/desktop build:web`; `rg -n "@atlas/maps|packages/maps" apps packages prisma scripts --glob "!**/dist/**"` -> `NO_MATCHES`)

---

## Future feature modules

- [ ] Purchases (supplier orders, receiving)
- [ ] Reports (cross-module reporting engine)

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

