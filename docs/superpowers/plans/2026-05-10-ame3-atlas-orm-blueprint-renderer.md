# AME3 Atlas ORM Execution and Blueprint Renderer — Implementation Plan

Date: 2026-05-10
Spec: docs/superpowers/specs/2026-05-10-ame3-atlas-orm-blueprint-renderer-design.md
Status: Approved

Decision log update (2026-05-11): `docs/superpowers/decisions/2026-05-11-ame3-failed-module-install-recovery.md` documents Task 1 recovery requirements discovered during failed-install validation. Task 2 remains blocked until this remediation is implemented and validated.

Implementation note (2026-05-13): Frontend module component registry now uses generic Vite `import.meta.glob` discovery for `modules/custom/*/components/index.js`. Generic renderer and shell do not import `custom.fleet` directly.

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Wire all AME3 Phase 2 foundations (module-migration-service, module-metadata-service, discovery service, AtlasModel/AtlasField/AtlasView/ModuleMigration tables) into a functioning end-to-end pipeline: when `custom.fleet` is installed, physical database tables are provisioned automatically; the module's Hono router is auto-mounted by the Route Loader; the `GET /blueprints` API merges AtlasView rows; and the Atlas shell renders blueprint-driven CRUD pages via `AtlasTable`, `AtlasForm`, `AtlasDetail`, and `AtlasCrudView` — without any edit to `prisma/schema.prisma` or any per-module manual wiring.

## Architecture summary

Phase 3 is a wiring layer. All building blocks exist; this plan connects them.

The **ORM hook** (Task 1) runs after `installModule` succeeds: it reads persisted `AtlasModel.schema` records and calls `applySqlMigration` for each unprovisioned table. The **Route Loader** (Task 2) initializes synchronously at API boot, queries installed+enabled modules, imports each module's `api/index.js` with fail-soft error handling (per-module import failure does not crash the API), applies `authMiddleware` globally to each sub-router, then delegates matching paths. Each module router factory receives injected dependencies `{ prisma, requirePermission, moduleContext }` — no shared Prisma singletons permitted inside module services. The **fleet API** (Task 3) uses `createFleetService({ prisma })` (pure dependency injection) and explicitly sets `updated_at = now()` in every UPDATE statement (no PostgreSQL triggers in this phase). The **`schema.apiPath`** field is the single source of truth for all blueprint renderers — no path derivation from module key or entity name is allowed. The `custom.fleet` view schemas (Task 3a) must be updated to include `apiPath` before the renderer is built. The **`@atlas/ui` blueprint renderer** (Task 6) reads `schema.apiPath` for all data fetching and form submission. The **ComponentRegistry** is populated at boot from each module's `components/index.js` when present (fail-soft). The **shell** (Task 7) adds a `BlueprintCrudScreen` fallback in `ModuleOutlet` for any moduleKey not in the core SCREEN_MAP. Tasks 2 and 7 each require a single one-time modification to `apps/api/src/index.js` and `apps/desktop/src/app/ModuleOutlet.jsx` — platform additions; once in place, new AME3 modules require zero changes to those files.

---

## File Structure Map

### Create

- `apps/api/src/services/route-loader-service.js`
- `modules/custom/custom.fleet/validators/index.js`
- `modules/custom/custom.fleet/api/fleet-service.js`
- `modules/custom/custom.fleet/api/index.js`
- `packages/ui/src/atlas-renderer/index.js`
- `packages/ui/src/atlas-renderer/AtlasTable.jsx`
- `packages/ui/src/atlas-renderer/AtlasForm.jsx`
- `packages/ui/src/atlas-renderer/AtlasDetail.jsx`
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx`
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx`

### Modify

- `apps/api/src/services/module-lifecycle-service.js` — add ORM execution hook in `installModule`
- `apps/api/src/routes/modules.js` — add `GET /:key/migrations` endpoint
- `apps/api/src/index.js` — one-time: initialize Route Loader at boot; one-time: extend `GET /blueprints` with AtlasView rows
- `packages/sdk/src/index.js` — add `modules.listMigrations`
- `packages/ui/src/index.js` — re-export atlas-renderer components
- `apps/desktop/src/app/ModuleOutlet.jsx` — add BlueprintCrudScreen fallback for AME3 custom modules
- `modules/custom/custom.fleet/views/vehicle.table.js` — add `schema.apiPath`
- `modules/custom/custom.fleet/views/vehicle.form.js` — add `schema.apiPath`; rename `groups` → `sections`
- `modules/custom/custom.fleet/views/vehicle.detail.js` — add `schema.apiPath`

### Forbidden (must not be touched)

- `prisma/schema.prisma` — no new models; all four metadata models already present
- `prisma/migrations/` — no Prisma migrations; module tables provisioned via Atlas ORM
- `packages/maps/src/feature-modules.js` — custom.fleet is not added here; discovered from `modules/custom/`
- `packages/validators/src/index.js` — fleet domain validators are module-local, not in the shared package. Exception: Atlas Core lifecycle request schemas reused by `/modules/:key/*` recovery endpoints are allowed (decision log 2026-05-11).
- `modules/custom/custom.fleet/module.manifest.js` — already correct; not modified
- `modules/custom/custom.fleet/models/vehicle.model.js` — already correct; not modified
- `modules/custom/custom.fleet/models/maintenance.model.js` — already correct; not modified
- `modules/custom/custom.fleet/views/vehicle.page.js` — no changes needed; PAGE views have no apiPath

---

## Task 1 — ORM Execution Hook in Module Install Lifecycle [COMPLETED]

**Files:**
- Modify: `apps/api/src/services/module-lifecycle-service.js`
- Modify: `apps/api/src/routes/modules.js`

**Changes:**

After `installModule` succeeds in setting `AtlasModule.status = INSTALLED`, it must provision physical tables for all `AtlasModel` records belonging to that module. This uses `module-migration-service`'s `planModelMigrations` + `applySqlMigration`. The model definitions are read from `AtlasModel.schema` (persisted during `POST /modules/sync`). ORM execution runs OUTSIDE the Prisma transaction (physical DDL on PostgreSQL cannot run inside Prisma's advisory-lock transaction). If any migration fails, the module is set to `ERROR` status and an audit log entry is written.

A new endpoint `GET /modules/:key/migrations` returns the ledger of applied migrations for any module.

- [x] 1.1 At the top of `module-lifecycle-service.js`, import `createModuleMigrationService` from `'../services/module-migration-service.js'` and instantiate it inside `createModuleLifecycleService`: `const migrationSvc = createModuleMigrationService({ prisma })`
- [x] 1.2 Add private async function `applyModuleOrmMigrations({ moduleKey, actorId })`:
  - Query `prisma.atlasModel.findMany({ where: { moduleKey, enabled: true } })`
  - If no models found, return early — module has no ORM tables or sync has not been run
  - Call `migrationSvc.planModelMigrations({ moduleKey, models: atlasModels.map(m => m.schema) })`
  - For each plan item with `shouldApply: true`, call `migrationSvc.applySqlMigration({ moduleKey, filename: item.filename, sql: item.sql })`
  - For each successfully applied migration, write audit log: `action: 'atlas.orm.migrate'`, payload `{ moduleKey, filename, tableName: item.tableName, checksum: item.checksum }`
  - Propagate any error so `installModule` can catch it
- [x] 1.3 In `installModule`, after `await syncAdminPermissions(prisma)` completes, add a try/catch that calls `await applyModuleOrmMigrations({ moduleKey: manifest.key, actorId })`
- [x] 1.4 In the catch block: call `await prisma.atlasModule.update({ where: { key: manifest.key }, data: { status: 'ERROR' } })`; write audit log with `action: 'core.module.orm.error'` and error message; re-throw so the install route returns 500
- [x] 1.5 In `apps/api/src/routes/modules.js`, import `createModuleMigrationService` at the top
- [x] 1.6 Add `GET /:key/migrations` route after the existing `/:key/lifecycle` route:
  ```js
  app.get('/:key/migrations', authMiddleware, requirePermission('core.modules.read'), async (c) => {
    const key = c.req.param('key')
    const mod = await prisma.atlasModule.findUnique({ where: { key }, select: { id: true } })
    if (!mod) return c.json({ error: 'Modulo no encontrado.' }, 404)
    const migrationSvc = createModuleMigrationService({ prisma })
    const migrations = await migrationSvc.listAppliedMigrations(key)
    return c.json({ data: migrations })
  })
  ```

**Validation:**

```bash
node --check apps/api/src/services/module-lifecycle-service.js
# Expected: exits 0

node --check apps/api/src/services/module-migration-service.js
# Expected: exits 0

node --check apps/api/src/routes/modules.js
# Expected: exits 0

# After API boots and custom.fleet is synced+installed:
TOKEN=<admin_bearer_token>
curl -s http://localhost:4010/modules/custom.fleet/migrations \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: 2
```

**Runtime evidence � 2026-05-11:**

| Check | Result |
|---|---|
| `node --check module-lifecycle-service.js` | PASS |
| `node --check module-migration-service.js` | PASS |
| `node --check modules.js` | PASS |
| AtlasModel rows for custom.fleet | 2 rows: `fleet.vehicle`, `fleet.maintenance` |
| SQL generation (`generateCreateTableSql`) | PASS for both models |
| `assertSafeMigrationSql` | PASS for both models |
| DDL-in-transaction (`$executeRawUnsafe`) | PASS |
| `applySqlMigration` fleet_maintenance | applied=true, migrationId recorded |
| `applySqlMigration` fleet_vehicle | applied=true, migrationId recorded |
| ModuleMigration rows for custom.fleet | 2 rows (`fleet_maintenance__36d3cc40b4a5.sql`, `fleet_vehicle__02ac7853c0d6.sql`) |
| `fleet_vehicle` table in PostgreSQL | EXISTS |
| `fleet_maintenance` table in PostgreSQL | EXISTS |
| `POST /modules/:key/clear-error` (`mode: preserve-data`) | PASS � `custom.fleet` moved `ERROR -> UNINSTALLED`, `enabled=false`, tables/migrations preserved |
| `POST /modules/install` failure path | PASS � induced dependency failure stored `lifecycleConfig.lastError` and forced `status=ERROR`, `enabled=false` |
| `POST /modules/:key/retry-install` | PASS � recovered `custom.fleet` to `INSTALLED`, `enabled=true` |
| `GET /modules/custom.fleet/migrations` | PASS � returned 2 rows |
| Module Catalog actions for `ERROR` | PASS � shows `Ver error`, `Reintentar instalaci�n`, `Restaurar a sin instalar`, `Limpiar intento fallido` |
| Guard: no module in `ERROR` with `enabled=true` after failure | PASS � validated on induced failure (`ERROR`, `enabled=false`) |

**Bug found and fixed during runtime validation:**

`module-migration-service.js` called `createChecksum(sql)` in two places, passing the generated SQL string to a function that expects a model object (`typeof sql !== 'object'` → throws `AME_INVALID_MODEL`). Fixed:
- `planModelMigrations`: `createChecksum(sql)` → `createChecksum(safeModel)`
- `applySqlMigration`: `createChecksum(sql)` → `createHash('sha256').update(sql).digest('hex')` (added `node:crypto` import)

**Note:** Task 1 recovery gap is closed and verified; Task 2 remains intentionally not started in this session.

---

## Task 2 — Route Loader Service

**Files:**
- Create: `apps/api/src/services/route-loader-service.js`
- Modify: `apps/api/src/index.js` (one-time platform addition — after this, new AME3 modules never touch this file)

**Changes:**

The Route Loader maintains an in-memory map of `moduleKey → Hono sub-router`. It initializes synchronously at API boot (awaited before `serve()` is called), queries all `INSTALLED + enabled` modules, and imports each module's `api/index.js` factory with fail-soft error handling: if any module's import fails, that failure is logged, `lifecycleConfig.routeLoader.status = 'ERROR'` is persisted to the `AtlasModule` record in the database, and boot continues. A failed module never prevents Atlas Core from becoming healthy.

Module router factories receive injected dependencies: `{ prisma, requirePermission, moduleContext }`. There is no `authMiddleware` parameter — the Route Loader applies `authMiddleware` globally to each module's sub-router before mounting it, so individual route handlers within module code only call `requirePermission`.

At boot, the Route Loader also scans each installed module's directory for `components/index.js`. If present, it imports the file and calls its `register(ComponentRegistry)` export to populate the ComponentRegistry for that module. A missing or failed `components/index.js` is silently skipped (fail-soft).

Path safety: before importing any module file, the resolved absolute path must start with `path.resolve(process.cwd(), 'modules')`. Any path outside this root is rejected.

`apps/api/src/index.js` receives a one-time addition: after the Hono app is created but before any route registrations, import and initialize the Route Loader (3–5 lines total). After this, no further changes to `index.js` are needed for any new AME3 module.

- [x] 2.1 Create `apps/api/src/services/route-loader-service.js`:
  - Export `createRouteLoaderService({ prisma, authMiddleware, requirePermission })`
  - Private: `routerMap = new Map()` (moduleKey → Hono sub-router)
  - Private: `resolveModuleApiPath(moduleRow)` — derives the expected `api/index.js` path from the module's `lifecycleConfig.discovery.localPath` field; falls back to convention `modules/custom/${moduleRow.key}/api/index.js` or `modules/official/${moduleRow.key}/api/index.js`; validates path is under `modules/` root via `path.resolve`
  - Private: `resolveModuleComponentsPath(moduleRow)` — same derivation for `components/index.js`
  - Private: async `loadModuleRouter(moduleRow)` — resolves path, validates it, dynamic `import(apiPath)`, calls the default export factory with `{ prisma, requirePermission, moduleContext: { moduleKey: moduleRow.key, manifest: moduleRow.manifest } }`, wraps the returned Hono app with `authMiddleware` applied globally, stores in `routerMap`
  - Private: async `loadModuleComponents(moduleRow)` — resolves `components/index.js` path; if file exists, imports it and calls `module.register(ComponentRegistry)`; if file missing or import fails, logs and continues
  - Private: async `markModuleRouteError(moduleKey, errorMessage)` — `prisma.atlasModule.update` to merge `lifecycleConfig.routeLoader = { status: 'ERROR', error: errorMessage, updatedAt: new Date().toISOString() }`
  - Public: async `initialize(app)` — queries `prisma.atlasModule.findMany({ where: { status: 'INSTALLED', enabled: true }, include: { ... } })`; for each module, calls `loadModuleRouter` inside try/catch (on error: log + `markModuleRouteError`); then calls `loadModuleComponents` inside its own try/catch; after all modules loaded, registers a delegating middleware on `app`
  - Public: async `reloadModule(moduleKey)` — removes from `routerMap`, re-runs `loadModuleRouter` for that module
  - Public: `unloadModule(moduleKey)` — removes from `routerMap`
  - Delegating middleware: `app.use('*', async (c, next) => { ... })` — iterates all Hono sub-routers in `routerMap` in insertion order; for each, calls `await subRouter.fetch(c.req.raw, { ...env })` or dispatches the request through the sub-router; the first sub-router that has a matching registered route (e.g. `GET /fleet/vehicles`, `POST /fleet/maintenance`) handles the request and the middleware returns without calling `next()`; if no loaded module router matches the path, calls `next()` to pass control to core Atlas routes. Module routers own their own concrete route paths (such as `/fleet/vehicles` and `/fleet/maintenance`) — there is no shared prefix scheme in this phase.
- [x] 2.2 Add path safety in `resolveModuleApiPath` and `resolveModuleComponentsPath`: call `path.resolve` on derived path; check `resolvedPath.startsWith(path.resolve(process.cwd(), 'modules'))`; throw if outside allowed root
- [x] 2.3 In `loadModuleRouter` catch block: log `[route-loader] ${moduleKey}: ${err.message}`; call `await markModuleRouteError(moduleKey, err.message)`; do NOT throw (continue boot)
- [x] 2.4 In `apps/api/src/index.js`, after Hono app creation and before any `app.use` / `app.get` / `app.post` calls:
  ```js
  import { createRouteLoaderService } from './services/route-loader-service.js'
  const routeLoader = createRouteLoaderService({ prisma, authMiddleware, requirePermission })
  await routeLoader.initialize(app)
  ```
- [ ] 2.5 Pass `routeLoader` into `createModuleLifecycleService` or make it accessible so `installModule` can call `routeLoader.reloadModule(manifest.key)` after ORM migrations succeed
- [ ] 2.6 Wire `routeLoader.unloadModule(key)` into `disableModule` and `uninstallModule` in `module-lifecycle-service.js`
  - Deferred in this Task 2 commit to avoid expanding scope into `apps/api/src/routes/modules.js`; boot-time route loading and fail-soft behavior are fully verified.

**Validation:**

```bash
node --check apps/api/src/services/route-loader-service.js
# Expected: exits 0

# Start API and verify no crash (even if no custom modules are installed):
pnpm dev:api &
sleep 3
curl -f http://localhost:4010/health
# Expected: { "status": "ok" }

# Verify boot does not crash when a module's api/index.js is intentionally broken:
# (introduce a temporary import error, restart, check health)
# Expected: { "status": "ok" } — broken module marked ERROR, API healthy
```

**Runtime evidence — 2026-05-11:**

| Check | Result |
|---|---|
| `node --check apps/api/src/services/route-loader-service.js` | PASS |
| `node --check apps/api/src/index.js` | PASS |
| `node --check apps/api/src/services/module-lifecycle-service.js` | PASS |
| `pnpm dev:api` boot | PASS — API started (`Atlas API running on http://localhost:4010`) |
| `curl -f http://localhost:4010/health` | PASS — `{"ok":true,...}` |
| Missing `custom.fleet/api/index.js` handling | PASS — module skipped safely; API stayed healthy |
| `custom.fleet` state after boot | PASS — `status=INSTALLED`, `enabled=true`, `lifecycleConfig.routeLoader=null` |
| Broken-router fail-soft test (temporary `custom.route-loader-test`) | PASS — import failure persisted `lifecycleConfig.routeLoader.status='ERROR'`; `/health` remained OK |
| Temporary fail-soft test cleanup | PASS — temporary module files removed; temporary AtlasModule row removed |

**Task 2 notes (delegation limitation):**
- Runtime route reload/unload wiring from lifecycle actions (`2.5` / `2.6`) is intentionally deferred in this commit to avoid expanding scope into `apps/api/src/routes/modules.js`.
- Boot-time dynamic route loading, safe skip of missing `api/index.js`, and fail-soft error persistence are fully implemented and validated.

---

## Task 3a — Fleet View Schema Updates (apiPath + sections rename)

**Files:**
- Modify: `modules/custom/custom.fleet/views/vehicle.table.js`
- Modify: `modules/custom/custom.fleet/views/vehicle.form.js`
- Modify: `modules/custom/custom.fleet/views/vehicle.detail.js`

**Changes:**

All three data-fetching view schemas must include `apiPath: '/fleet/vehicles'`. The renderer uses this field exclusively; no path derivation is allowed. Additionally, `vehicle.form.js` currently uses the key `groups` for field groupings; rename it to `sections` to match the spec's AtlasForm schema contract (`schema.sections`).

- [x] 3a.1 In `vehicle.table.js`: add `apiPath: '/fleet/vehicles'` to the `schema` object (top-level field alongside `entity`, `component`, `columns`, etc.)
- [x] 3a.2 In `vehicle.form.js`: add `apiPath: '/fleet/vehicles'` to the `schema` object; rename the `groups` key to `sections`
- [x] 3a.3 In `vehicle.detail.js`: add `apiPath: '/fleet/vehicles'` to the `schema` object

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
# Expected: all exit 0

# After sync, verify apiPath is persisted to AtlasView:
curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.source=="atlas-view" and .moduleKey=="custom.fleet") | .schema.apiPath] | unique'
# Expected: ["/fleet/vehicles"]
```

**Runtime evidence — 2026-05-11:**

| Check | Result |
|---|---|
| `node --check modules/custom/custom.fleet/views/vehicle.table.js` | PASS |
| `node --check modules/custom/custom.fleet/views/vehicle.form.js` | PASS |
| `node --check modules/custom/custom.fleet/views/vehicle.detail.js` | PASS |
| Sync tooling execution (`discoverModules` + `syncModules` + `syncModuleMetadata`) | PASS — `discovered=1`, `valid=1`, `metadataSynced=1` |
| AtlasView `fleet.vehicle.table` `schema.apiPath` | PASS — `/fleet/vehicles` |
| AtlasView `fleet.vehicle.form` `schema.apiPath` | PASS — `/fleet/vehicles` |
| AtlasView `fleet.vehicle.detail` `schema.apiPath` | PASS — `/fleet/vehicles` |

---

## Task 3b — custom.fleet API (validators, service, router)

**Files:**
- Create: `modules/custom/custom.fleet/validators/index.js`
- Create: `modules/custom/custom.fleet/api/fleet-service.js`
- Create: `modules/custom/custom.fleet/api/index.js`

**Changes:**

Fleet validators use Zod (module-local, not from `@atlas/validators`). The fleet service receives `prisma` via injection (`createFleetService({ prisma })`) — no module-level Prisma singleton. All database operations use `prisma.$queryRaw` with tagged template literals; SQL string concatenation is prohibited. All UPDATE statements must explicitly include `updated_at = now()` — no triggers are generated in this phase. All queries include `company_id = ${companyId}` (company-scoped guard); all vehicle list queries include `enabled = true` (soft-delete filter). Audit log writes use `prisma.auditLog.create`. The Hono router factory signature matches the Route Loader contract: `export default function createFleetRouter({ prisma, requirePermission, moduleContext })`.

The `api/index.js` must not import from `@atlas/module-engine` or any Atlas platform package unavailable in the module runtime context. It imports from `../validators/index.js` and `./fleet-service.js` only.

- [x] 3b.1 Create `modules/custom/custom.fleet/validators/index.js`:
  - `createVehicleSchema`: plate (string 1–20), brand (string 1–100), model_name (string 1–100), year (integer 1900–2100), status (enum active|maintenance|inactive|retired, default `'active'`), color (string optional, hex pattern `^#[0-9a-fA-F]{3,8}$`), driver_id (UUID string optional), notes (string max 5000 optional)
  - `updateVehicleSchema`: all fields optional, same constraints
  - `createMaintenanceSchema`: vehicle_id (UUID required), type (enum preventive|corrective|inspection), description (string 1–5000), scheduled_date (ISO date string), completed_date (ISO date string optional), cost (number >= 0 optional), notes (string optional)
  - `updateMaintenanceSchema`: all fields optional, same constraints
- [x] 3b.2 Create `modules/custom/custom.fleet/api/fleet-service.js`:
  - Export `createFleetService({ prisma })` — prisma is injected, never imported as a singleton
  - `listVehicles({ companyId, page, pageSize, status, search })` — SELECT with pagination, `WHERE enabled = true AND company_id = $1`, optional status and ILIKE search on plate/brand/model_name
  - `getVehicle({ companyId, id })` — SELECT by id and company_id; throw `FleetServiceError` 404 if not found
  - `createVehicle({ companyId, data, actorId })` — INSERT; write `AuditLog` with action `fleet.vehicle.create`
  - `updateVehicle({ companyId, id, data, actorId })` — UPDATE; SQL must include `updated_at = now()`; write `AuditLog` action `fleet.vehicle.update` with before/after
  - `setVehicleEnabled({ companyId, id, enabled, actorId })` — UPDATE `enabled` and `updated_at = now()`; write `AuditLog` action `fleet.vehicle.disable` (when enabled=false)
  - `listMaintenance({ companyId, vehicleId, page, pageSize })` — SELECT with pagination and company_id filter
  - `getMaintenance({ companyId, id })` — SELECT by id and company_id
  - `createMaintenance({ companyId, data, actorId })` — INSERT; write `AuditLog` action `fleet.maintenance.create`
  - `updateMaintenance({ companyId, id, data, actorId })` — UPDATE with `updated_at = now()`; write `AuditLog` action `fleet.maintenance.update`
  - `setMaintenanceEnabled({ companyId, id, enabled, actorId })` — UPDATE `enabled` and `updated_at = now()`
  - All page/pageSize: clamp page to min 1, pageSize to range 1–100
  - Company guard: if `companyId` is null/undefined, throw `FleetServiceError` 400 "companyId es requerido."
  - Table-not-exists catch: if `$queryRaw` throws a Postgres error code `42P01`, throw `FleetServiceError` 503 "Las tablas del modulo no estan disponibles aun."
- [x] 3b.3 Create `modules/custom/custom.fleet/api/index.js`:
  - `export default function createFleetRouter({ prisma, requirePermission, moduleContext })` — factory receives injected prisma; creates `createFleetService({ prisma })`; creates a Hono app; mounts all vehicle and maintenance endpoints
  - Each route: extracts `companyId` from `c.get('userContext')?.memberships?.[0]?.companyId`, `actorId` from `c.get('userContext')?.profile?.id`
  - Validates request body with Zod; returns 400 on failure
  - Catches `FleetServiceError` and returns its status code + error message
  - Routes: `GET /fleet/vehicles`, `POST /fleet/vehicles`, `GET /fleet/vehicles/:id`, `PATCH /fleet/vehicles/:id`, `PATCH /fleet/vehicles/:id/enabled`, `GET /fleet/maintenance`, `POST /fleet/maintenance`, `GET /fleet/maintenance/:id`, `PATCH /fleet/maintenance/:id`, `PATCH /fleet/maintenance/:id/enabled`

**Validation:**

```bash
node --check modules/custom/custom.fleet/validators/index.js
# Expected: exits 0

node --check modules/custom/custom.fleet/api/fleet-service.js
# Expected: exits 0

node --check modules/custom/custom.fleet/api/index.js
# Expected: exits 0

# After sync+install, with admin token having fleet permissions:
curl -s http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" | jq '.pagination'
# Expected: { "page": 1, "pageSize": 20, "total": 0 }

curl -s -X POST http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC-123","brand":"Toyota","model_name":"Hilux","year":2023,"status":"active"}' \
  | jq '.data.plate'
# Expected: "ABC-123"

# Verify updated_at is set correctly on update:
curl -s -X PATCH http://localhost:4010/fleet/vehicles/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brand":"Mitsubishi"}' | jq '.data.updated_at'
# Expected: recent ISO datetime (not the original created_at value)
```

**Runtime evidence — 2026-05-11:**

| Check | Result |
|---|---|
| `node --check modules/custom/custom.fleet/validators/index.js` | PASS |
| `node --check modules/custom/custom.fleet/api/fleet-service.js` | PASS |
| `node --check modules/custom/custom.fleet/api/index.js` | PASS |
| `node --check apps/api/src/services/route-loader-service.js` | PASS |
| API boot (`pnpm dev:api`) | PASS — API started on `http://localhost:4010` |
| `curl -f http://localhost:4010/health` | PASS — `{"ok":true,...}` |
| `GET /fleet/vehicles` | PASS — `200` with `{ data: [], pagination: { page: 1, pageSize: 20, total: 0 } }` |
| `POST /fleet/vehicles` | PASS — `201` with created record (`plate: "ABC-123"`) |
| `PATCH /fleet/vehicles/:id` | PASS — `200`, brand updated to `"Mitsubishi"` |
| `updated_at` on vehicle update | PASS — changed from create timestamp |
| `PATCH /fleet/vehicles/:id/enabled` | PASS — `200`, `enabled: false` |
| Soft-disable list behavior | PASS — disabled vehicle no longer returned by `GET /fleet/vehicles` |
| Validation failure (`POST /fleet/vehicles` missing required fields) | PASS — `400` with Spanish validation message |
| Permission failure (limited token) | PASS — `403` (`fleet.vehicles.read`) |
| Route Loader state for `custom.fleet` | PASS — module router serves fleet routes and `lifecycleConfig.routeLoader = null` after sync refresh |

Task 3b required a minimal Route Loader Node compatibility patch because `c.executionCtx` is not available in the Node runtime.

---

## Task 4 — Blueprint API Extension

**Files:**
- Modify: `apps/api/src/index.js` — extend `GET /blueprints` handler

**Changes:**

The existing `GET /blueprints` handler queries only the `Blueprint` table. It must be extended to also query `AtlasView` for installed+enabled modules. Both result sets are normalized to the same response shape. A `source` discriminator field is added: `"blueprint"` for legacy rows, `"atlas-view"` for AME3 rows. On key collision, the `AtlasView` row wins. Both sets are filtered by `userCanAccessModule`.

- [x] 4.1 In the `GET /blueprints` handler, after fetching `blueprints`, query installed modules:
  ```js
  const installedModuleKeys = new Set(
    (await prisma.atlasModule.findMany({
      where: { status: 'INSTALLED', enabled: true },
      select: { key: true, version: true, name: true },
    })).map(m => m.key)
  )
  const installedModuleRows = await prisma.atlasModule.findMany({
    where: { status: 'INSTALLED', enabled: true },
    select: { key: true, name: true, version: true, status: true, enabled: true },
  })
  const moduleRowsByKey = new Map(installedModuleRows.map(m => [m.key, m]))
  const atlasViews = await prisma.atlasView.findMany({
    where: { enabled: true, moduleKey: { in: [...installedModuleKeys] } },
  })
  ```
- [x] 4.2 Normalize each existing Blueprint row: add `source: "blueprint"` field (the existing rows already have `module` attached via `include`)
- [x] 4.3 Normalize each AtlasView row to the response shape:
  ```js
  const moduleRow = moduleRowsByKey.get(view.moduleKey)
  return {
    id: view.id,
    key: view.key,
    moduleKey: view.moduleKey,
    kind: view.type,
    version: moduleRow?.version ?? '0.1.0',
    schema: view.schema,
    enabled: view.enabled,
    source: 'atlas-view',
    module: {
      key: moduleRow?.key ?? view.moduleKey,
      name: moduleRow?.name ?? view.moduleKey,
      status: moduleRow?.status ?? 'INSTALLED',
      enabled: moduleRow?.enabled ?? true,
    },
  }
  ```
- [x] 4.4 Merge: start with a `Map` keyed by blueprint `key`. Insert all Blueprint-normalized rows first, then insert all AtlasView-normalized rows (overwriting on key collision — AtlasView wins). Apply `userCanAccessModule` filter to the merged array values.
- [x] 4.5 Return `c.json({ data: [...mergedMap.values()] })`

**Validation:**

```bash
# With custom.fleet installed and user has fleet.access:
curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.moduleKey=="custom.fleet")] | length'
# Expected: >= 3

curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.source=="atlas-view" and .moduleKey=="custom.fleet") | .schema.apiPath] | unique'
# Expected: ["/fleet/vehicles"]

# apiPath presence check across all atlas-view blueprints:
curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.source=="atlas-view") | .schema.apiPath] | all(. != null and . != "")'
# Expected: true
```

**Runtime evidence — 2026-05-12:**

| Check | Result |
|---|---|
| `node --check apps/api/src/index.js` | PASS |
| `pnpm dev:api` boot | PASS — API running on `http://localhost:4010` |
| `curl -f http://localhost:4010/health` | PASS — `{"ok":true,...}` |
| `/blueprints` merged payload | PASS — response contains both `source="blueprint"` and `source="atlas-view"` rows |
| `custom.fleet` rows in `/blueprints` | PASS — 4 rows: `fleet.vehicle.table`, `fleet.vehicle.form`, `fleet.vehicle.detail`, `fleet.vehicle.page` |
| `custom.fleet` TABLE/FORM/DETAIL `schema.apiPath` | PASS — all are `"/fleet/vehicles"` |
| atlas-view TABLE/FORM/DETAIL `schema.apiPath` presence check | PASS — `true` |
| Forbidden file scope | PASS — only `apps/api/src/index.js` modified for implementation (plan file updated for evidence) |

---

## Task 5 — SDK Extension

**Files:**
- Modify: `packages/sdk/src/index.js`

**Changes:**

Add `listMigrations(moduleKey, token)` to the `modules` domain in `createAtlasClient`.

- [x] 5.1 In the `modules` domain object in `createAtlasClient`, add:
  ```js
  listMigrations: (moduleKey, token) =>
    request(`/modules/${encodeURIComponent(moduleKey)}/migrations`, {
      headers: withAuthHeaders(token),
    }),
  ```

**Validation:**

```bash
node --check packages/sdk/src/index.js
# Expected: exits 0
```

**Runtime evidence — 2026-05-12:**

| Check | Result |
|---|---|
| `node --check packages/sdk/src/index.js` | PASS |
| `atlas.modules.listMigrations("custom.fleet", token)` | PASS — response `data` contains 2 migration rows |
| Migration filenames | `fleet_maintenance__36d3cc40b4a5.sql`, `fleet_vehicle__02ac7853c0d6.sql` |

---

## Task 6 — Blueprint Renderer Components

**Files:**
- Create: `packages/ui/src/atlas-renderer/index.js`
- Create: `packages/ui/src/atlas-renderer/AtlasTable.jsx`
- Create: `packages/ui/src/atlas-renderer/AtlasForm.jsx`
- Create: `packages/ui/src/atlas-renderer/AtlasDetail.jsx`
- Create: `packages/ui/src/atlas-renderer/AtlasCrudView.jsx`
- Modify: `packages/ui/src/index.js`

**Changes:**

Four React components that consume blueprint schemas and render working UIs. All user-facing text in Spanish. No TypeScript. The renderer uses native `fetch` and lightweight internal validation in this phase. All data operations use `blueprint.schema.apiPath` and never derive API paths from module key or entity name.

- [x] 6.1 Create `packages/ui/src/atlas-renderer/index.js` barrel
- [x] 6.2 Create `AtlasTable.jsx` - use `blueprint.schema.apiPath` for fetch URL
- [x] 6.3 Create `AtlasForm.jsx` - use `blueprint.schema.apiPath` for POST/PATCH and `schema.sections` for layout
- [x] 6.4 Create `AtlasDetail.jsx` - use `schema.sections` for layout
- [x] 6.5 Create `AtlasCrudView.jsx` - compose table/form/detail using blueprint-driven routes
- [x] 6.6 Re-export from `packages/ui/src/index.js`:
  ```js
  export { AtlasTable, AtlasForm, AtlasDetail, AtlasCrudView } from './atlas-renderer/index.js'
  ```

**Validation rule (corrected for this runtime):**

- `node --check` is valid only for plain `.js` files.
- `.jsx` renderer components are validated through desktop build:
  `pnpm --filter @atlas/desktop build:web`

**Validation commands used:**

```bash
node --check packages/ui/src/atlas-renderer/index.js
node --check packages/ui/src/index.js
pnpm --filter @atlas/desktop build:web
```

**Runtime evidence - 2026-05-12:**

| Check | Result |
|---|---|
| `node --check packages/ui/src/atlas-renderer/index.js` | PASS |
| `node --check packages/ui/src/index.js` | PASS |
| `pnpm.cmd --filter @atlas/desktop build:web` | PASS |
| `@atlas/ui` renderer exports | PASS - `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView` re-exported from `packages/ui/src/index.js` |
| Undeclared imports | PASS - no undeclared imports were added in `@atlas/ui` |
| Dependency note | `@tanstack/react-query` and `zod` were not added to `@atlas/ui` because the renderer uses native `fetch` and lightweight internal validation in this phase |
| Forbidden file scope | PASS - no changes in ModuleOutlet, API routes, custom.fleet files, Prisma schema/migrations, maps, or validators |

Task 6 is **complete** under the corrected validation gate.

> **Design-system alignment follow-up (2026-05-13):** Task 6 delivered a functional MVP renderer. Visual production-readiness requires a follow-up phase to replace basic HTML primitives with existing `@atlas/ui` components (`DynamicTable`, `DynamicForm`, `ListLayout`, `FormFields`, `ViewModeSwitch`, `EmptyState`, `ErrorState`, `ActionMenu`, `PageHeader`, `ConfirmDialog`). See the full audit and phased roadmap: `docs/superpowers/decisions/2026-05-13-ame3-renderer-ui-reuse-and-glassic-design.md`

---

## Task 6 Follow-up — Renderer Glassic UI Reuse Phase A [COMPLETED]

**Date:** 2026-05-13
**Decision:** `docs/superpowers/decisions/2026-05-13-ame3-renderer-ui-reuse-and-glassic-design.md`

**Files created:**
- `packages/ui/src/atlas-renderer/renderer-adapters.js` — utility functions (`shouldUsePageMode`, `normalizeToFilterBarFilters`)
- `packages/ui/src/atlas-renderer/AtlasCardView.jsx` — glassic card grid view for AtlasTable

**Files modified:**
- `packages/ui/src/atlas-renderer/AtlasTable.jsx` — wrapped in `ListLayout`; uses `FilterBar` + `MobileFiltersSheet` for filters; `ActionMenu` for row actions; `EmptyState` / `ErrorState` for data states; cards view via `AtlasCardView`; view mode switcher (table/cards) via `ListLayout`
- `packages/ui/src/atlas-renderer/AtlasForm.jsx` — replaced all bare HTML inputs with `TextField`, `TextareaField`, `MarkdownField`, `SelectField`, `PhoneField`, `SwitchField` from `FormFields`; sections use glassic `rounded-2xl border bg-[hsl(var(--card))] p-5` cards with uppercase eyebrow titles
- `packages/ui/src/atlas-renderer/AtlasDetail.jsx` — sections use same glassic card pattern as AtlasForm; cleaner field label/value layout
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` — added `shouldUsePageMode` heuristic (>6 fields or >2 sections → page mode instead of Sheet); added `ConfirmDialog` for delete with `DELETE` fetch; added `onCreateSuccess`, `onEditSuccess`, `onDeleteSuccess` callbacks; added `resolveRowLabel` for readable confirm dialog detail
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx` — added `PageHeader` with module eyebrow + blueprint title; replaced bare `Card` loading/error states with `Skeleton` placeholder layout, `ErrorState` with retry, `EmptyState` with `Package` icon; added `toast.success()` for create/edit/delete via `sonner`
- `packages/ui/src/atlas-renderer/index.js` — added `AtlasCardView` export
- `packages/ui/src/index.js` — added `AtlasCardView` to named re-exports

**Form presentation heuristic:**
- `shouldUsePageMode(schema, fields)`: returns `true` if `sections.length > 2` OR visible fields `> 6`
- Page mode: create/edit renders as a full-page panel (no Sheet overlay), with "Volver al listado" back button
- Sheet mode: create/edit/detail render in right-side Sheet (existing behavior for small forms)

**Toast deferred note:** `toast.success()` is wired in `BlueprintCrudScreen` (desktop, uses `sonner`). The `@atlas/ui` renderer components themselves do not import `sonner` — they call `onCreateSuccess` / `onEditSuccess` / `onDeleteSuccess` props instead.

**Validation results:**

| Check | Result |
|---|---|
| `node --check packages/ui/src/atlas-renderer/renderer-adapters.js` | PASS |
| `node --check packages/ui/src/atlas-renderer/index.js` | PASS |
| `pnpm --filter @atlas/desktop build:web` | PASS |
| Forbidden file scope | PASS — no Prisma, API routes, custom.fleet, packages/maps, packages/validators modified |
| New dependencies | PASS — none added; sonner was already in desktop |

**Acceptance criteria met:**
- [x] AtlasTable uses glassic `rounded-2xl border overflow-hidden` container with `bg-[hsl(var(--muted))]/40` table header
- [x] AtlasTable has ViewModeSwitch (table + cards) with localStorage persistence via `ListLayout`
- [x] AtlasTable has `SearchInput` (via `ListLayout`) and `FilterBar` (desktop) + `MobileFiltersSheet` (mobile, via `ListLayout`)
- [x] AtlasTable uses `EmptyState` and `ErrorState` components
- [x] AtlasTable uses `ActionMenu` for row actions (Ver / Editar / Eliminar)
- [x] AtlasForm uses `TextField`, `TextareaField`, `MarkdownField`, `SelectField`, `PhoneField`, `SwitchField` from `FormFields`
- [x] AtlasForm sections use glassic `rounded-2xl border bg-card p-5` cards with uppercase eyebrow
- [x] AtlasDetail sections use same glassic section card pattern
- [x] `BlueprintCrudScreen` renders `PageHeader` with module eyebrow, blueprint title, and description
- [x] `AtlasCrudView` includes `ConfirmDialog` for delete
- [x] CRUD operations propagate `onCreateSuccess` / `onEditSuccess` / `onDeleteSuccess` → `toast.success()` in `BlueprintCrudScreen`
- [x] All user-facing text in Spanish
- [x] Desktop build passes

---
## Task 6 Follow-up — Renderer UI Refinement Pass (Implementation Refinement) [COMPLETED]

**Date:** 2026-05-13
**Trigger:** Manual browser validation after Phase A revealed visual gaps versus Files/HR modules.

**Issues addressed:**
1. Page title showed English entity key ("Vehicles") — resolved via nav item label lookup
2. Loading skeleton did not match actual page layout — replaced with 3-part skeleton (PageHeader + toolbar + table)
3. Missing-view EmptyState used raw entity key — now uses nav item label ("Mantenimiento")
4. View modes: only table+cards existed — added three modes (table / list / cards/grid) mapping to ListLayout's table/cards/grid slots with correct ViewModeSwitch icons
5. Stacked list view added: initials circle + primary text + subtitle text + badge column + hover + ActionMenu
6. Sort controls added: select for sortable columns + toggle direction button (ArrowUp/ArrowDown), wired to `?sortBy=&sortDir=` API params
7. Toolbar polish: icon-only RefreshCw reload button, Plus icon on Agregar, count as small muted text
8. AtlasCardView enhanced: initials circle, hover effect + transition, primary text as subtitle, up to 4 secondary columns

**Files modified:**
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
  - Added `resolveNavItem(module, routePath, entitySegment)` — matches module navigation array by exact path then entity segment; returns nav item with label/icon
  - Added `resolveEmptyLabel(entitySegment, navItem)` — uses nav label before raw entity key
  - Updated `resolvePageTitle` — blueprint title → nav item label → "Registros"
  - Removed unused `CardContent` import
  - Loading skeleton: 3-part (PageHeader skeleton + toolbar skeleton + table skeleton with header row + 8 body rows)
  - Missing-view EmptyState: description uses resolved nav label ("Mantenimiento" instead of "maintenance")
- `packages/ui/src/atlas-renderer/AtlasTable.jsx`
  - `normalizeColumns` preserves `sortable` boolean from schema column definitions
  - Added `sortBy` / `sortDir` state; included in fetch `useEffect` deps; appended to API `URLSearchParams`
  - `renderListView` (slot: `renderCards`, icon: LayoutList) — stacked horizontal rows inside `rounded-2xl border overflow-hidden` container; initials circle; primary + subtitle + badge col; hover transition; loading skeleton; EmptyState; ErrorState
  - `renderCardGridView` (slot: `renderGrid`, icon: Grid3X3) — moved from former `renderCardsView`; renders `AtlasCardView`
  - `enabledViews` changed from `["table","cards"]` to `["table","cards","grid"]`
  - Added `sortExtras` JSX (styled native select + ArrowUp/ArrowDown toggle) passed as `toolbarExtras`
  - Toolbar actions: `RefreshCw` icon-only button (h-9 w-9 p-0), `Plus` icon + text on Agregar, count as `text-xs` muted span
- `packages/ui/src/atlas-renderer/AtlasCardView.jsx`
  - Initials circle (h-10 w-10 rounded-xl) with first char of primary column value
  - Secondary columns: first shown as subtitle inside header; remaining (up to 3) in detail section below divider
  - Hover: `transition-all duration-150 hover:border-[hsl(var(--border))]/60 hover:bg-[hsl(var(--muted))]/20`
  - `secondaryColumns = columns.slice(1, 5)` — up to 4 secondary columns

**Validation results:**

| Check | Result |
|---|---|
| `node --check packages/ui/src/atlas-renderer/renderer-adapters.js` | PASS |
| `node --check packages/ui/src/atlas-renderer/index.js` | PASS |
| `node --check packages/ui/src/index.js` | PASS |
| `pnpm --filter @atlas/desktop build:web` | PASS (`✓ built in 1.56s`) |
| Forbidden file scope | PASS — no Prisma, API routes, custom.fleet backend, packages/maps, packages/validators modified |

---
## Task 6 Follow-up — Renderer UI Refinement Pass 2 (Second Visual Polish) [COMPLETED]

**Date:** 2026-05-12
**Trigger:** Second manual review showed lingering visual gaps: missing Spanish accents in labels ("Vehiculos" → "Vehículos"), hardcoded row action labels ignoring `schema.rowActions`, no status badge in list/card views, and no module description in PageHeader.

**Issues addressed:**
1. **Accent normalization** — Added `normalizeSpanishLabel(text)` in `renderer-adapters.js`. Generic word-by-word lookup over a curated ERP accent map (vehiculo→vehículo, matricula→matrícula, anio→año, gestion→gestión, etc.). Case-preserving: "Vehiculos"→"Vehículos", "VEHICULOS"→"VEHÍCULOS".
2. **Row action labels from blueprint** — `rowMenuItems` now reads `schema.rowActions[0].label` (view), `schema.rowActions[1].label` (edit), `schema.rowActions[last].label` (delete/disable) instead of hardcoded "Ver / Editar / Eliminar". Falls back to hardcoded defaults if `schema.rowActions` is absent.
3. **Column and filter label normalization** — `normalizeColumns` and `normalizeFilters` apply `normalizeSpanishLabel` to all labels at parse time (e.g., "Matricula"→"Matrícula", "Anio"→"Año").
4. **Status badge in list view** — `renderListView` detects a column with `field` matching `/^(status|estado)$/i`, shows its value as a muted rounded-full pill on the right side of list rows.
5. **Status badge in card grid** — `AtlasCardView` detects the same status column pattern, renders a small muted chip below the card title. Status column is excluded from the secondary columns detail section.
6. **Module description in PageHeader** — `BlueprintCrudScreen` adds `resolvePageDescription(tableBlueprint, module)` → blueprint `schema.description` → `module.description` → `null`. Passed to `PageHeader description` prop. `normalizeSpanishLabel` applied to both title and description.
7. **Empty label normalization** — `normalizeSpanishLabel` applied to the resolved nav label in the missing-view EmptyState description.

**Files modified:**
- `packages/ui/src/atlas-renderer/renderer-adapters.js` — added `ACCENT_MAP` + `normalizeSpanishLabel`
- `packages/ui/src/atlas-renderer/index.js` — added `normalizeSpanishLabel` to exports
- `packages/ui/src/index.js` — added `normalizeSpanishLabel` to atlas-renderer re-exports
- `packages/ui/src/atlas-renderer/AtlasTable.jsx` — import `normalizeSpanishLabel`; apply in `normalizeColumns` and `normalizeFilters`; parse `schema.rowActions` for action labels; detect status column in `renderListView` for chip display
- `packages/ui/src/atlas-renderer/AtlasCardView.jsx` — detect status column; render muted chip below card title; exclude status from secondary columns
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx` — import `normalizeSpanishLabel`; add `resolvePageDescription`; apply normalization to page title, description, and empty label

**Validation results:**

| Check | Result |
|---|---|
| `node --check packages/ui/src/atlas-renderer/renderer-adapters.js` | PASS |
| `node --check packages/ui/src/atlas-renderer/index.js` | PASS |
| `node --check packages/ui/src/index.js` | PASS |
| `pnpm --filter @atlas/desktop build:web` | PASS (`✓ built in 1.47s`) |
| Forbidden file scope | PASS — no Prisma, API routes, custom.fleet backend, packages/maps, packages/validators modified |

---
## Task 6 Follow-up — Renderer UI Refinement Pass 3 (Toolbar, Selection, Form PageHeader) [COMPLETED]

**Date:** 2026-05-13
**Trigger:** Third visual review identified: native `<select>` for sort, missing row selection foundation, and bare h3/back-button in page mode forms instead of PageHeader.

**Issues addressed:**
1. **Native select removal** — Extracted `AtlasSortMenu.jsx` (DropdownMenu-based column picker + direction toggle button with ArrowUp/ArrowDown). Extracted `AtlasTableToolbar.jsx` (2-row toolbar: Row 1 = SearchInput + FilterBar(desktop) + MobileFiltersSheet(mobile) + AtlasSortMenu + ViewModeSwitch; Row 2 = selection count left, Reload + Agregar right). `ListLayout` removed as the table container; replaced with a plain flex-col wrapper wiring `AtlasTableToolbar` + view content + pagination.
2. **Row selection foundation** — `selectedIds: Set<string>` state in `AtlasTable`. `getRowId(row, index)` helper. Header checkbox (all/indeterminate/none) in table mode. Per-row checkbox in table view and list (stacked) view. Per-card checkbox with indigo border highlight in card grid view. `selectedIds` cleared automatically when `rows` change. Toolbar Row 2 shows "N seleccionados" + "Limpiar selección" button when any rows are selected. No destructive bulk API calls — UI-only foundation.
3. **Form page mode PageHeader** — `AtlasCrudView` page mode create/edit now uses `PageHeader` with `eyebrow` ("Nuevo registro" / "Editar registro" / "Detalle"), `title` from `blueprint.schema.title`, and `actions` containing a Volver `<Button variant="outline">` with ArrowLeft icon. Bare `<h3>` + "Volver al listado" ghost button removed.
4. **AtlasCardView action labels** — Accepts `viewActionLabel`, `editActionLabel`, `deleteActionLabel` props passed from `AtlasTable`; falls back to "Ver / Editar / Eliminar".
5. **ViewModeSwitch persistence** — `AtlasTableToolbar` forwards `storageKey` to `ViewModeSwitch`; `AtlasTable` initializes `view` state via `getStoredViewMode(storageKey, "table")`.

**Files created:**
- `packages/ui/src/atlas-renderer/AtlasSortMenu.jsx` — DropdownMenu column picker with active indigo styling + direction toggle button
- `packages/ui/src/atlas-renderer/AtlasTableToolbar.jsx` — 2-row toolbar (controls row + actions row)

**Files modified:**
- `packages/ui/src/atlas-renderer/AtlasTable.jsx` — removed `ListLayout` + `FilterBar` + native sort controls; added `Checkbox`, `getStoredViewMode`, `AtlasTableToolbar`, `ChevronLeft/Right`; added `getRowId`, `view`, `selectedIds` state; added `handleSortChange`, `handleToggleRow`, `handleToggleAll`; checkboxes in table header + rows + list rows; selection props passed to `AtlasCardView`; inline pagination replacing `ListLayout` pagination
- `packages/ui/src/atlas-renderer/AtlasCardView.jsx` — added `Checkbox` import; accepts `selectedIds`, `onToggleSelect`, `getRowId`, action label props; checkbox before initials; selected card gets `border-indigo-500/60 bg-indigo-500/5`
- `packages/ui/src/atlas-renderer/AtlasCrudView.jsx` — added `PageHeader` import; page mode create/edit/detail use `PageHeader` with eyebrow + title + Volver button as actions; bare `<h3>` + ghost back-button div removed
- `packages/ui/src/atlas-renderer/AtlasTableToolbar.jsx` — added `storageKey` prop forwarded to `ViewModeSwitch`

**Validation results:**

| Check | Result |
|---|---|
| `node --check packages/ui/src/atlas-renderer/renderer-adapters.js` | PASS |
| `node --check packages/ui/src/atlas-renderer/index.js` | PASS |
| `node --check packages/ui/src/index.js` | PASS |
| `pnpm --filter @atlas/desktop build:web` | PASS (`✓ built in 1.61s`) |
| Forbidden file scope | PASS — no Prisma, API routes, custom.fleet backend, packages/maps, packages/validators modified |

---
## Task 7 — Shell Routing for AME3 Custom Modules

**Files:**
- Create: `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (one-time platform addition — after this, new AME3 modules never touch this file)

**Changes:**

`BlueprintCrudScreen` is a generic shell screen. It reads `moduleKey` and the sub-path from the URL, fetches blueprints from `GET /blueprints`, finds the matching blueprints for this module and entity (by matching against `schema.apiPath`), and renders `AtlasCrudView`. It never derives API paths itself — it reads `schema.apiPath` from the blueprint.

`ModuleOutlet.jsx`'s `resolveScreen()` function adds a fallback: if no match is found in `SCREEN_MAP` AND the `moduleKey` is not a known core module key, return `BlueprintCrudScreen`. Custom modules like `custom.fleet` fall through to this fallback without any `SCREEN_MAP` entry.

- [x] 7.1 Create `apps/desktop/src/shell/BlueprintCrudScreen.jsx`:
  - Reads `moduleKey` and wildcard route from `useParams`.
  - Loads blueprints with `useQuery({ queryKey: ['blueprints', moduleKey, token], queryFn: () => atlas.blueprints.list(token) })`.
  - Selects TABLE/FORM/DETAIL using `source = "atlas-view"` + `moduleKey`, preferring PAGE `schema.path` match and falling back to `schema.apiPath` + `schema.entity`.
  - Renders Spanish loading/error/empty states and uses `"No se encontró una vista para este módulo."` when no TABLE blueprint exists.
  - Passes `tableBlueprint`, `formBlueprint`, `detailBlueprint`, `token`, and `apiBaseUrl` into `AtlasCrudView`.
- [x] 7.2 Verify `atlas.blueprints.list` exists in `packages/sdk/src/index.js` (already existed; no SDK changes needed)
- [x] 7.3 Modify `apps/desktop/src/app/ModuleOutlet.jsx`:
  - Added `BlueprintCrudScreen` import.
  - Added `SCREEN_MODULE_KEYS` derived from `SCREEN_MAP`.
  - `resolveScreen()` now falls back to `BlueprintCrudScreen` only when module key is not represented in `SCREEN_MAP`.
- [x] 7.4 `BlueprintCrudScreen` uses `useRuntimeModules` and `isModuleAvailable` for module availability context

**Validation:**

```bash
node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx
node --check apps/desktop/src/app/ModuleOutlet.jsx
# Expected in this runtime: both fail with ERR_UNKNOWN_FILE_EXTENSION (.jsx)

pnpm --filter @atlas/desktop build:web
# Expected: exits 0

# Browser test (requires dev server + custom.fleet installed):
# Navigate to http://localhost:5173/app/m/custom.fleet/vehicles
# Expected: AtlasCrudView renders AtlasTable with "Vehiculos" column headers
# Expected: table fetches from /fleet/vehicles (schema.apiPath)
# Expected: no hardcoded fleet paths in BlueprintCrudScreen or AtlasCrudView
```

**Runtime evidence â€” 2026-05-12:**

| Check | Result |
|---|---|
| `node --check apps/desktop/src/shell/BlueprintCrudScreen.jsx` | FAIL â€” Node runtime rejects `.jsx` (`ERR_UNKNOWN_FILE_EXTENSION`) |
| `node --check apps/desktop/src/app/ModuleOutlet.jsx` | FAIL â€” same `.jsx` limitation |
| `pnpm.cmd --filter @atlas/desktop build:web` | PASS |
| `http://localhost:4010/health` | PASS (`200`) |
| `http://localhost:5173/app/m/custom.fleet/vehicles` | PASS (`200`, no frontend 404) |
| `GET /blueprints` (`moduleKey=custom.fleet`, `source=atlas-view`) | PASS â€” returned `fleet.vehicle.table`, `fleet.vehicle.form`, `fleet.vehicle.detail`, `fleet.vehicle.page`; TABLE/FORM/DETAIL include `schema.apiPath = "/fleet/vehicles"` |
| `GET /fleet/vehicles?page=1&pageSize=20` | PASS â€” returned empty list with pagination `{ page: 1, pageSize: 20, total: 0 }` |
| `POST /fleet/vehicles` (runtime audit token) | FAIL â€” returned `500` (`"No se pudo crear el vehiculo de custom.fleet."`) |
| Forbidden file scope | PASS â€” only Task 7 files + plan updated |

Task 7 is **not marked complete yet** because runtime create-flow validation did not pass in this run (`POST /fleet/vehicles` returned `500` with the current runtime audit token).

**Debug follow-up evidence â€” 2026-05-12 (Task 7 create-flow):**

| Check | Result |
|---|---|
| `node --check modules/custom/custom.fleet/api/fleet-service.js` | PASS |
| `node --check modules/custom/custom.fleet/api/index.js` | PASS |
| `pnpm.cmd --filter @atlas/desktop build:web` | PASS |
| `curl -f http://localhost:4010/health` | PASS (`200`) |
| `GET /blueprints` (`custom.fleet`, `atlas-view`) | PASS |
| `GET /fleet/vehicles` | PASS (`200`) |
| `POST /fleet/vehicles` duplicate plate | PASS â€” now returns `409` with `{"error":"Ya existe un vehiculo con esa matricula."}` |
| `POST /fleet/vehicles` unique plate | PASS â€” now returns `201` with created row |
| `PATCH /fleet/vehicles/:id` | PASS (`200`) |
| `PATCH /fleet/vehicles/:id/enabled` | PASS (`200`) |
| List after soft-disable | PASS â€” created vehicle no longer appears in enabled list |
| Dev error observability (`custom.fleet` route) | PASS â€” development log now includes `route`, `moduleKey`, `operation`, `error.name`, `error.message`, `error.code`, `error.meta`, and `error.stack` without exposing stack traces to API clients |

Task 7 remains **not marked complete** in this evidence update because full interactive browser create from `/app/m/custom.fleet/vehicles` was not executed in this terminal-only verification run.

**Debug follow-up evidence â€” 2026-05-12 (Task 7 route parsing):**

| Check | Result |
|---|---|
| Root cause hypothesis | CONFIRMED â€” custom module navigation path was absolute (`/app/m/custom.fleet/vehicles`) while shell launch/sidebar logic also prepended `/app/m/${moduleKey}`, producing duplicated routes (`/app/m/custom.fleet/app/m/custom.fleet/vehicles`) |
| Duplicated wildcard parsing impact | CONFIRMED â€” wildcard `app/m/custom.fleet/vehicles` yielded segment index `1 = "m"` in route-mode parsing, incorrectly inferring detail mode with `recordId = "m"` |
| Fix scope | `apps/desktop/src/lib/runtimeModules.js`, `apps/desktop/src/shell/BlueprintCrudScreen.jsx` |
| Navigation normalization | PASS â€” absolute module navigation paths are normalized to module-relative (`/vehicles`, `/`) before use by launchers/sidebar/palette |
| Route parser hardening | PASS â€” parser now collapses duplicated `app/m/${moduleKey}/` prefix in wildcard before deriving mode/recordId |
| Scripted route checks | PASS â€” `/vehicles` => `list`, `/vehicles/new` => `create`, `/vehicles/:id` => `detail`, `/vehicles/:id/edit` => `edit`, duplicated wildcard => `list` with `recordId = null` |
| `node --check apps/desktop/src/lib/runtimeModules.js` | PASS |
| `pnpm.cmd --filter @atlas/desktop build:web` | PASS |
| Regression check (backend) | PASS â€” `POST /fleet/vehicles` still returns `201` for unique plate after frontend route fix |
| SCREEN_MAP hardcoding | PASS â€” no `custom.fleet` entry added |

Task 7 remains **not marked complete** in this update until interactive browser verification confirms:
1) `/app/m/custom.fleet/vehicles` loads list mode,
2) no `GET /fleet/vehicles/m` request occurs,
3) UI create flow succeeds end-to-end.

**Debug follow-up evidence â€” 2026-05-12 (Task 7 CORS on dynamic routes):**

| Check | Result |
|---|---|
| Root cause hypothesis | CONFIRMED â€” `routeLoader.initialize(app)` registered delegation middleware before global `cors()` middleware, so delegated module responses could return before CORS headers were applied |
| Fix scope | `apps/api/src/index.js` |
| Exact fix | Moved global `app.use('*', cors(...))` registration before `await routeLoader.initialize(app)` so CORS runs first for all routes, including delegated module routes and OPTIONS preflight |
| `node --check apps/api/src/index.js` | PASS |
| `node --check apps/api/src/services/route-loader-service.js` | PASS |
| `curl -i -X OPTIONS /fleet/vehicles` with Origin and ACRM headers | PASS â€” `204` with `access-control-allow-origin`, `access-control-allow-methods`, `access-control-allow-headers` |
| `curl -i GET /fleet/vehicles?page=1&pageSize=20` with Origin + Authorization | PASS â€” `200` and `access-control-allow-origin` present |
| `curl -i GET /blueprints` with Origin + Authorization | PASS â€” `200` and `access-control-allow-origin` present |
| `curl -i /health` | PASS â€” `200` and CORS header present |
| `POST /fleet/vehicles` unique with Origin | PASS â€” `201` with CORS header |
| `POST /fleet/vehicles` duplicate with Origin | PASS â€” `409` with Spanish conflict message and CORS header |
| API log scan for `22P02` / `/fleet/vehicles/m` during this verification run | PASS â€” no matches in current run logs |

Task 7 remains **not marked complete** in this evidence update because interactive browser/runtime verification of:
- `/app/m/custom.fleet/vehicles` list-mode rendering,
- absence of `GET /fleet/vehicles/m` in browser-driven navigation,
- and UI create/edit/disable clicks
was not executed in this terminal-only run.

**Debug follow-up evidence - 2026-05-13 (Task 7 runtime UX/parsing hardening):**

| Check | Result |
|---|---|
| `/maintenance` showing vehicle table root cause | CONFIRMED - generic selector previously fell back to first TABLE/FORM/DETAIL when no PAGE/entity match, so unrelated routes could render vehicle blueprints |
| `/maintenance` behavior fix | PASS - removed first-item TABLE/FORM/DETAIL fallback; when no matching PAGE/entity exists, selection resolves to null and screen shows `"No se encontró una vista para este módulo."` |
| Route parser hardening (`GET /fleet/vehicles/m` class bug) | PASS - wildcard prefix collapse now handles `app/m/<moduleKey>/`, `m/<moduleKey>/`, and `<moduleKey>/` before mode/id inference |
| PAGE path compatibility | PASS - selector now matches `PAGE` by `schema.path` or `schema.page.path`, and resolves table key from `schema.view|schema.page.view` / `schema.table|schema.page.table` |
| Scripted route validation | PASS - `vehicles` => list/table, `vehicles/new` => create, `vehicles/:id/edit` => edit, `maintenance` => no table, `m/custom.fleet/vehicles` => list with `recordId=null` |
| Form label root cause | CONFIRMED - section field objects (`{ field, label, type }`) were not fully normalized into field metadata when `fields` list was sparse, so key names leaked as labels |
| Form/detail label fix | PASS - `AtlasForm` and `AtlasDetail` now normalize section field objects using `field` as name and `label` as label |
| Create payload type root cause | CONFIRMED - numeric inputs were submitted as strings when field type metadata was not propagated from sections |
| Create payload type fix | PASS - normalized field type now preserved; submit casts `type='number'` to number; empty select values are omitted (prevents `status: null`) |
| Save button visibility | PASS - `AtlasForm` footer is sticky and `AtlasCrudView` sheet bodies are scrollable with max height |
| Build gate | PASS - `pnpm.cmd --filter @atlas/desktop build:web` |
| CORS preflight for dynamic module route | PASS - `OPTIONS /fleet/vehicles` includes `access-control-allow-origin`, `allow-methods`, `allow-headers` |

**Browser validation evidence - 2026-05-13 (manual):**

| Check | Result |
|---|---|
| `/app/m/custom.fleet/vehicles` list rendering | PASS - renders list mode with real records |
| Browser CORS errors | PASS - no CORS error observed |
| `GET /fleet/vehicles/m` regression | PASS - request did not occur |
| `GET /blueprints` | PASS |
| `GET /fleet/vehicles?page=1&pageSize=20` | PASS |
| Form labels | PASS - Spanish labels rendered (`Matricula`, `Marca`, `Modelo`, `Anio`, etc.) |
| Save button visibility | PASS - submit action is visible and reachable |
| UI create flow | PASS - unique plate create succeeded |
| Create response | PASS - `POST /fleet/vehicles` returned `201` |
| `year` submit type | PASS - submitted as number (not string) |
| `color` submit format | PASS - submitted as valid hex color |
| `status` submit behavior | PASS - submitted correctly as `active` |
| List refresh after create | PASS - created vehicle appears in list |
| View/Edit actions | PASS - both actions work from UI |
| Soft-disable from UI | Not validated in this pass - current renderer exposes `Ver` and `Editar`; soft-disable remains covered by Task 3b API validation |
| `/app/m/custom.fleet/maintenance` behavior | PASS - does not render vehicle views; shows missing-view state `"No se encontró una vista para este módulo."` |

Task 7 is now **marked complete** based on this browser validation run on **May 13, 2026**.

**Follow-up notes:**
1. Maintenance navigation exists, but maintenance `TABLE`/`FORM`/`DETAIL`/`PAGE` atlas views are not implemented yet.
2. As renderer UX follow-up, large CRUD forms should support page-based create/edit routes (not only modal/sheet flows).

---

## Task 8 — End-to-End Verification

Run all 15 verification commands from spec section 26. Mark this task complete only when all commands produce the expected output.

- [ ] 8.1 Syntax check all new/modified source files:
  ```bash
  node --check modules/custom/custom.fleet/api/index.js
  node --check modules/custom/custom.fleet/api/fleet-service.js
  node --check modules/custom/custom.fleet/validators/index.js
  node --check modules/custom/custom.fleet/views/vehicle.table.js
  node --check modules/custom/custom.fleet/views/vehicle.form.js
  node --check modules/custom/custom.fleet/views/vehicle.detail.js
  node --check apps/api/src/services/route-loader-service.js
  # Expected: all exit 0
  ```
- [ ] 8.2 Prisma validation (schema unchanged):
  ```bash
  pnpm exec prisma validate
  pnpm exec prisma migrate status
  # Expected: schema valid, no pending migrations
  ```
- [ ] 8.3 API health:
  ```bash
  curl -f http://localhost:4010/health
  # Expected: { "status": "ok" }
  ```
- [ ] 8.4 Sync custom.fleet (verifies apiPath is persisted to AtlasView):
  ```bash
  curl -s -X POST http://localhost:4010/modules/sync \
    -H "Authorization: Bearer $TOKEN" | jq '.data.valid'
  # Expected: >= 1
  ```
- [ ] 8.5 Install custom.fleet and verify INSTALLED status
- [ ] 8.6 Verify ORM provisioned both tables via `information_schema.tables` query
- [ ] 8.7 Verify ModuleMigration rows (2 rows for custom.fleet)
- [ ] 8.8 Fleet CRUD smoke: GET empty list → POST vehicle → GET list returns 1 → PATCH → verify updated_at changed
- [ ] 8.9 Blueprint API: fleet blueprints include `source: "atlas-view"` and non-null `schema.apiPath`:
  ```bash
  curl -s http://localhost:4010/blueprints \
    -H "Authorization: Bearer $TOKEN" \
    | jq '[.data[] | select(.source=="atlas-view" and .moduleKey=="custom.fleet") | .schema.apiPath] | all(. != null and . != "")'
  # Expected: true
  ```
- [ ] 8.10 Migration listing returns 2 records
- [ ] 8.11 Permission fail-closed: request without fleet permissions returns 403
- [ ] 8.12 Desktop build exits 0
- [ ] 8.13 Forbidden file check:
  ```bash
  git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/|packages/maps/src/|packages/validators/src/|modules/custom/custom\.fleet/module\.manifest\.js|modules/custom/custom\.fleet/models/|modules/custom/custom\.fleet/views/vehicle\.page\.js)"
  # Expected: empty output
  ```
- [ ] 8.14 apiPath presence across all atlas-view blueprints:
  ```bash
  curl -s http://localhost:4010/blueprints \
    -H "Authorization: Bearer $TOKEN" \
    | jq '[.data[] | select(.source=="atlas-view") | .schema.apiPath] | all(. != null and . != "")'
  # Expected: true
  ```
- [ ] 8.15 Broken-module fail-soft: introduce a deliberate import error in a test module's `api/index.js`, restart API, verify `GET /health` returns 200; verify module record has `lifecycleConfig.routeLoader.status = 'ERROR'` in DB; restore file

---

## Commit Checkpoints

Commit after each task passes its validation. Suggested message format:

```
feat(ame3): wire ORM execution hook into module install lifecycle

feat(ame3): add route-loader-service with synchronous boot and fail-soft per module

feat(ame3): add schema.apiPath to fleet view schemas; rename groups to sections

feat(ame3): add custom.fleet CRUD API with injected prisma and manual updated_at

feat(ame3): extend GET /blueprints to include AtlasView rows with source discriminator

feat(ame3): add modules.listMigrations to Atlas SDK

feat(ame3): add AtlasTable/AtlasForm/AtlasDetail/AtlasCrudView blueprint renderer

feat(ame3): add BlueprintCrudScreen shell fallback for AME3 custom modules

feat(ame3): end-to-end verification of custom.fleet via blueprint renderer
```

---

## Rollback Notes

- **Before Task 1**: Revert `module-lifecycle-service.js` and `modules.js`. No data affected.
- **After Task 1 (ORM ran)**: `fleet_vehicle` and `fleet_maintenance` tables were created. Tables persist by default. Use module lifecycle recovery/cleanup endpoints (`clear-error`, `cleanup-dry-run`, `cleanup`) for controlled rollback; do not require manual SQL patches.
- **Task 3a (view schema changes)**: `git checkout modules/custom/custom.fleet/views/` to restore. Re-run sync to push prior schema to AtlasView.
- **Tasks 2, 3b, 4, 5, 6, 7**: All additive files plus small edits to `index.js` and `ModuleOutlet.jsx`. Reverting: `git revert` the relevant commits or `git checkout` individual files. No database schema changes involved.
- **No Prisma migrations**: Nothing to roll back in `prisma/migrations/`.

---

## Verification Gate

Before marking Phase 3 tasks complete in `docs/TASKS.md`:

- [ ] All 15 task validation commands have been run and produced the expected output.
- [ ] All commands exited without errors.
- [ ] `pnpm exec prisma validate` exits 0 (schema unchanged).
- [ ] `pnpm --filter ./apps/desktop build:web` exits 0.
- [ ] `git diff HEAD` shows no uncommitted changes.
- [ ] `docs/TASKS.md` updated with `Verified: 2026-05-10 (all 15 verification commands executed)`.
