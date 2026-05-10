# AME3 Atlas ORM Execution and Blueprint Renderer — Implementation Plan

Date: 2026-05-10
Spec: docs/superpowers/specs/2026-05-10-ame3-atlas-orm-blueprint-renderer-design.md
Status: Draft

> **For agentic workers:** Declare `Mode: IMPLEMENTATION` before starting. Do not begin coding until the spec is approved and this plan is approved. Use checkbox syntax (`- [ ]`) to track progress. Mark each task completed only after its validation commands pass.

## Goal

Wire all AME3 Phase 2 foundations (module-migration-service, module-metadata-service, discovery service, AtlasModel/AtlasField/AtlasView/ModuleMigration tables) into a functioning end-to-end pipeline: when `custom.fleet` is installed, physical database tables are provisioned automatically; the module's Hono router is auto-mounted by the Route Loader; the `GET /blueprints` API merges AtlasView rows; and the Atlas shell renders blueprint-driven CRUD pages via `AtlasTable`, `AtlasForm`, `AtlasDetail`, and `AtlasCrudView` — without any edit to `prisma/schema.prisma` or any per-module manual wiring.

## Architecture summary

Phase 3 is a wiring layer. All building blocks exist; this plan connects them. The install lifecycle (Task 1) gains a post-transaction ORM hook that reads persisted `AtlasModel.schema` records and calls `applySqlMigration` for each unprovisioned table. The Route Loader (Task 2) is a new service that, at API boot and after each install/uninstall event, dynamically imports module `api/index.js` router factories and delegates matching paths. The fleet API (Task 3) provides the concrete CRUD endpoints that the Route Loader will mount. The Blueprint API (Task 4) is extended to merge `AtlasView` rows alongside legacy `Blueprint` rows. The `@atlas/ui` blueprint renderer (Task 6) provides four generic React components. The shell (Task 7) adds a `BlueprintCrudScreen` fallback in `ModuleOutlet` that activates for any moduleKey not in the core SCREEN_MAP. Tasks 2 and 7 each require a single one-time modification to `apps/api/src/index.js` and `apps/desktop/src/app/ModuleOutlet.jsx` respectively — these are platform additions, not per-module additions; once in place, new AME3 modules require zero changes to those files (satisfying spec AC 13's intent).

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

### Forbidden (must not be touched)

- `prisma/schema.prisma` — no new models; all four metadata models already present
- `prisma/migrations/` — no Prisma migrations; module tables provisioned via Atlas ORM
- `packages/maps/src/feature-modules.js` — custom.fleet is not added here; discovered from `modules/custom/`
- `packages/validators/src/index.js` — fleet validators are module-local, not in the shared package
- `modules/custom/custom.fleet/module.manifest.js` — already correct; not modified
- `modules/custom/custom.fleet/models/vehicle.model.js` — already correct; not modified
- `modules/custom/custom.fleet/models/maintenance.model.js` — already correct; not modified
- `modules/custom/custom.fleet/views/*.js` — already correct; not modified

---

## Task 1 — ORM Execution Hook in Module Install Lifecycle

**Files:**
- Modify: `apps/api/src/services/module-lifecycle-service.js`
- Modify: `apps/api/src/routes/modules.js`

**Changes:**

After `installModule` succeeds in setting `AtlasModule.status = INSTALLED`, it must provision physical tables for all `AtlasModel` records belonging to that module. This uses `module-migration-service`'s `planModelMigrations` + `applySqlMigration`. The model definitions are read from `AtlasModel.schema` (persisted during `POST /modules/sync`). ORM execution runs OUTSIDE the Prisma transaction (physical DDL on PostgreSQL cannot run inside Prisma's advisory-lock transaction). If any migration fails, the module is set to `ERROR` status and an audit log entry is written.

A new endpoint `GET /modules/:key/migrations` returns the ledger of applied migrations for any module.

- [ ] 1.1 At the top of `module-lifecycle-service.js`, import `createModuleMigrationService` from `../services/module-migration-service.js` and instantiate it: `const migrationSvc = createModuleMigrationService({ prisma })`
- [ ] 1.2 Add private async function `applyModuleOrmMigrations({ moduleKey, moduleId, actorId })`:
  - Query `prisma.atlasModel.findMany({ where: { moduleKey, enabled: true } })`
  - If no models found, return early (module has no ORM tables, or sync not yet run)
  - Call `migrationSvc.planModelMigrations({ moduleKey, models: atlasModels.map(m => m.schema) })`
  - For each plan item with `shouldApply: true`, call `migrationSvc.applySqlMigration({ moduleKey, filename, sql })`
  - For each successfully applied migration, write audit log with action `atlas.orm.migrate` and payload `{ moduleKey, filename, tableName: item.tableName, checksum: item.checksum }`
  - On any error, propagate it so `installModule` can catch it
- [ ] 1.3 In `installModule`, after `await syncAdminPermissions(prisma)` succeeds, add a try/catch block that calls `await applyModuleOrmMigrations({ moduleKey: manifest.key, moduleId: result.id, actorId })`
- [ ] 1.4 In the catch block, set module status to ERROR: `await prisma.atlasModule.update({ where: { key: manifest.key }, data: { status: 'ERROR' } })`; write audit log with action `core.module.orm.error` and the error message; re-throw so the install route returns 500
- [ ] 1.5 In `apps/api/src/routes/modules.js`, add `GET /:key/migrations` route after the existing `/:key/lifecycle` route:
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
- [ ] 1.6 Import `createModuleMigrationService` at the top of `modules.js`

**Validation:**

```bash
node --check apps/api/src/services/module-lifecycle-service.js
# Expected: exits 0

node --check apps/api/src/routes/modules.js
# Expected: exits 0

# After API boots and custom.fleet is synced+installed:
TOKEN=<admin_bearer_token>
curl -s http://localhost:4010/modules/custom.fleet/migrations \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: 2
```

---

## Task 2 — Route Loader Service

**Files:**
- Create: `apps/api/src/services/route-loader-service.js`
- Modify: `apps/api/src/index.js` (one-time platform addition — after this, new AME3 modules never touch this file)

**Changes:**

The Route Loader maintains an in-memory map of `moduleKey → Hono app instance`. At API boot, it queries all `INSTALLED + enabled` modules and attempts to dynamically import each module's `api/index.js`. Each imported file must export a default function `createRouter({ prisma, authMiddleware, requirePermission })` returning a Hono app. The Route Loader mounts a catch-all middleware on the main Hono app that inspects the request path prefix and delegates to the appropriate module router.

Path validation: before importing a module's `api/index.js`, the resolved absolute path must start with the `modules/` directory of the project root. This prevents path traversal.

The Route Loader exposes `reloadModule(moduleKey)` and `unloadModule(moduleKey)` for lifecycle integration. These are called from `installModule` and `disableModule` in the lifecycle service.

`apps/api/src/index.js` receives a minimal addition: import `createRouteLoaderService` and call `await routeLoader.initialize(app)` before any route registrations. This is a one-time 3-line addition.

- [ ] 2.1 Create `apps/api/src/services/route-loader-service.js`:
  - Export `createRouteLoaderService({ prisma })`
  - Private: `routerMap` = `new Map()` (moduleKey → { router, prefix })
  - Private: `getModuleApiPath(manifest)` — resolves the module's `api/index.js` path using `manifest.key` to look up the discovery record's `localPath`; alternatively, derive from known convention `modules/custom/${manifest.key}/api/index.js` and `modules/official/${manifest.key}/api/index.js`
  - Private: `loadRouter(moduleRow)` — dynamic `import(apiPath)`, calls the default export factory with `{ prisma, authMiddleware: null, requirePermission: null }` as stubs (routes bring their own middleware); catches import errors and logs them
  - Public: `initialize(app)` — queries `prisma.atlasModule.findMany({ where: { status: 'INSTALLED', enabled: true } })`, loads each module's router, registers a delegating middleware on `app`
  - Public: `reloadModule(moduleKey)` — unloads if present, loads fresh router for that module
  - Public: `unloadModule(moduleKey)` — removes from `routerMap`
  - Delegating middleware: `app.use('*', async (c, next) => { ... })` — iterates `routerMap`, checks if request path starts with the module's path prefix, delegates if match
- [ ] 2.2 Add path safety: resolve `apiPath` using `path.resolve`; validate it starts with `path.resolve(process.cwd(), 'modules')`; throw if outside allowed root
- [ ] 2.3 Add try/catch in `loadRouter`: on import error, log `[route-loader] Failed to load ${moduleKey}: ${err.message}` and store `null` in `routerMap` to mark as failed (skip delegation)
- [ ] 2.4 In `apps/api/src/index.js` (immediately after the Hono app is created and before route registrations):
  ```js
  import { createRouteLoaderService } from './services/route-loader-service.js'
  const routeLoader = createRouteLoaderService({ prisma })
  await routeLoader.initialize(app)
  ```
- [ ] 2.5 Wire `routeLoader.reloadModule` into `installModule` in `module-lifecycle-service.js`: after ORM migrations succeed, call `routeLoader.reloadModule(manifest.key)` if a `routeLoader` instance is available (pass it in as a dependency or use a module-level singleton)
- [ ] 2.6 Wire `routeLoader.unloadModule` into `disableModule` and `uninstallModule` in `module-lifecycle-service.js`

> **Implementation note on route prefix**: The fleet module's router serves routes under `/fleet/*`. The Route Loader must know each module's path prefix. Approach: the `api/index.js` router factory registers its routes with full paths (e.g., `/fleet/vehicles`), and the Route Loader mounts the router on the app root. The Hono sub-router will only handle paths it has registered handlers for; unmatched paths fall through to `next()`.

**Validation:**

```bash
node --check apps/api/src/services/route-loader-service.js
# Expected: exits 0

# Start API and verify no crash:
pnpm dev:api &
sleep 3
curl -f http://localhost:4010/health
# Expected: { "status": "ok" }
```

---

## Task 3 — custom.fleet API (validators, service, router)

**Files:**
- Create: `modules/custom/custom.fleet/validators/index.js`
- Create: `modules/custom/custom.fleet/api/fleet-service.js`
- Create: `modules/custom/custom.fleet/api/index.js`

**Changes:**

Fleet validators use Zod (not imported from `@atlas/validators` — these are module-local). The fleet service uses `prisma.$queryRaw` with tagged template literals for all database operations; never builds SQL strings via concatenation. All queries include `company_id = ${companyId}` and `enabled = true` (where applicable). Audit log writes use `prisma.auditLog.create`. The Hono router factory exports a default function `createFleetRouter({ prisma, authMiddleware, requirePermission })` returning a configured Hono app.

The `api/index.js` must not import from `@atlas/module-engine` or any Atlas platform package that is not available at runtime in the module context. It imports from `../validators/index.js` and from `./fleet-service.js` only.

- [ ] 3.1 Create `modules/custom/custom.fleet/validators/index.js`:
  - `createVehicleSchema`: plate (string, 1–20), brand (string, 1–100), model_name (string, 1–100), year (integer 1900–2100), status (enum active|maintenance|inactive|retired, default 'active'), color (string, optional, hex pattern `^#[0-9a-fA-F]{3,8}$`), driver_id (UUID, optional), notes (string max 5000, optional)
  - `updateVehicleSchema`: all fields optional, same constraints
  - `createMaintenanceSchema`: vehicle_id (UUID), type (enum preventive|corrective|inspection), description (string 1–5000), scheduled_date (ISO date string), completed_date (ISO date string, optional), cost (number >= 0, optional), notes (string, optional)
  - `updateMaintenanceSchema`: all fields optional, same constraints
- [ ] 3.2 Create `modules/custom/custom.fleet/api/fleet-service.js`:
  - Export `createFleetService({ prisma })`
  - `listVehicles({ companyId, page, pageSize, status, search })` — SELECT with pagination, soft-delete filter, company filter
  - `getVehicle({ companyId, id })` — SELECT by id + company_id, throws 404 if not found or wrong company
  - `createVehicle({ companyId, data, actorId })` — INSERT + audit log
  - `updateVehicle({ companyId, id, data, actorId })` — UPDATE + audit log (before/after)
  - `setVehicleEnabled({ companyId, id, enabled, actorId })` — UPDATE enabled + audit log
  - `listMaintenance({ companyId, vehicleId, page, pageSize })` — SELECT with pagination
  - `getMaintenance({ companyId, id })` — SELECT by id + company_id
  - `createMaintenance({ companyId, data, actorId })` — INSERT + audit log
  - `updateMaintenance({ companyId, id, data, actorId })` — UPDATE + audit log
  - `setMaintenanceEnabled({ companyId, id, enabled, actorId })` — UPDATE enabled + audit log
  - All page/pageSize: clamp page to min 1, pageSize to range 1–100
  - Company guard: if `companyId` is null/undefined, throw `FleetServiceError` 400
  - Table-not-exists catch: if `$queryRaw` throws a Postgres error with code `42P01` (undefined_table), throw `FleetServiceError` with message "Las tablas del modulo no estan disponibles aun." and status 503
- [ ] 3.3 Create `modules/custom/custom.fleet/api/index.js`:
  - Default export: `export default function createFleetRouter({ prisma, authMiddleware, requirePermission })`
  - Creates a Hono app; mounts all vehicle and maintenance endpoints
  - Uses `authMiddleware` and `requirePermission` from the factory params (passed by Route Loader)
  - Routes: `GET /fleet/vehicles`, `POST /fleet/vehicles`, `GET /fleet/vehicles/:id`, `PATCH /fleet/vehicles/:id`, `PATCH /fleet/vehicles/:id/enabled`, `GET /fleet/maintenance`, `POST /fleet/maintenance`, `GET /fleet/maintenance/:id`, `PATCH /fleet/maintenance/:id`, `PATCH /fleet/maintenance/:id/enabled`
  - Each route extracts `companyId` from `c.get('userContext')?.memberships?.[0]?.companyId`
  - Each route extracts `actorId` from `c.get('userContext')?.profile?.id`
  - Validates request body against the appropriate Zod schema; returns 400 on failure
  - Returns `FleetServiceError` responses with the service's status code

**Validation:**

```bash
node --check modules/custom/custom.fleet/validators/index.js
# Expected: exits 0

node --check modules/custom/custom.fleet/api/fleet-service.js
# Expected: exits 0

node --check modules/custom/custom.fleet/api/index.js
# Expected: exits 0

# After sync+install, with admin token having fleet permissions:
curl -s -X GET http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" | jq '.pagination'
# Expected: { page: 1, pageSize: 20, total: 0 }

curl -s -X POST http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC-123","brand":"Toyota","model_name":"Hilux","year":2023,"status":"active"}' \
  | jq '.data.plate'
# Expected: "ABC-123"
```

---

## Task 4 — Blueprint API Extension

**Files:**
- Modify: `apps/api/src/index.js` — extend `GET /blueprints` handler (lines ~1903–1919)

**Changes:**

The existing `GET /blueprints` handler queries only the `Blueprint` table. It must be extended to also query `AtlasView` for installed+enabled modules. Both result sets are normalized to the same response shape. A `source` discriminator field is added: `"blueprint"` for legacy rows, `"atlas-view"` for AME3 rows. On key collision, the `AtlasView` row wins. Both sets are filtered by `userCanAccessModule`.

- [ ] 4.1 In the `GET /blueprints` handler, after fetching `blueprints`, add a second query:
  ```js
  const installedModuleKeys = new Set(
    (await prisma.atlasModule.findMany({
      where: { status: 'INSTALLED', enabled: true },
      select: { key: true },
    })).map(m => m.key)
  )
  const atlasViews = await prisma.atlasView.findMany({
    where: { enabled: true, moduleKey: { in: [...installedModuleKeys] } },
    include: { model: true },
  })
  ```
- [ ] 4.2 Fetch module rows for AtlasView normalization: build a moduleKey→moduleRow map from the existing `blueprints` include (module is already included) plus any additional modules referenced by AtlasView but not in Blueprint results
- [ ] 4.3 Normalize each Blueprint row: add `source: "blueprint"` field
- [ ] 4.4 Normalize each AtlasView row to Blueprint-compatible shape:
  ```js
  {
    id: view.id,
    key: view.key,
    moduleKey: view.moduleKey,
    kind: view.type,
    version: moduleRow?.version ?? '0.1.0',
    schema: view.schema,
    enabled: view.enabled,
    source: 'atlas-view',
    module: {
      key: moduleRow?.key,
      name: moduleRow?.name,
      status: moduleRow?.status,
      enabled: moduleRow?.enabled,
    },
  }
  ```
- [ ] 4.5 Merge: start with a `Map` keyed by `key`. Add all Blueprint rows first, then add all AtlasView rows (overwriting on key collision). Apply `userCanAccessModule` filter to the merged array.
- [ ] 4.6 Return `c.json({ data: [...mergedMap.values()] })`

**Validation:**

```bash
# With custom.fleet installed and fleet.access permission:
curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.moduleKey=="custom.fleet")] | length'
# Expected: >= 3

curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.source=="atlas-view")] | map(.key)'
# Expected: includes "fleet.vehicle.table", "fleet.vehicle.form", "fleet.vehicle.detail"
```

---

## Task 5 — SDK Extension

**Files:**
- Modify: `packages/sdk/src/index.js`

**Changes:**

Add `listMigrations(moduleKey, token)` to the `modules` domain in `createAtlasClient`. This calls `GET /modules/:key/migrations`.

- [ ] 5.1 In the `modules` domain object in `createAtlasClient`, add:
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

Four React components that consume blueprint schemas and render working UIs. All text in Spanish. No TypeScript. All imports from React, `@tanstack/react-query`, `react-hook-form`, `zod`, and existing `@atlas/ui` primitives (Button, Input, Skeleton, etc.).

**AtlasTable** accepts `{ blueprint, token, apiBaseUrl }`:
- Fetches `GET {apiBaseUrl}{blueprint.schema.entityPath}` with TanStack Query
- Renders a `<table>` with columns from `blueprint.schema.columns`; column headers use `label` from the blueprint column definition
- Pagination: `page` and `pageSize` state; uses `blueprint.schema.pagination.defaultPageSize` (default 20)
- Search: renders a text input if `blueprint.schema.searchable: true`; appends `?search=` query param
- Filters: renders per `blueprint.schema.filters`; select filter → `<select>`, text filter → text input
- Loading: skeleton rows matching column count; Error: "No se pudo cargar la informacion." with retry; Empty: `blueprint.schema.emptyState?.message ?? "No hay registros."`
- Toolbar: action buttons from `blueprint.schema.actions` (e.g., "Agregar" → `schema.actions[0]`)
- Row actions: `...` dropdown per row from `blueprint.schema.rowActions`

**AtlasForm** accepts `{ blueprint, fields, initialData, onSuccess, onCancel, token, apiBaseUrl }`:
- `fields` is the array of `AtlasField`-shaped objects (from the model's field definitions in the blueprint schema)
- Uses `react-hook-form` with a Zod schema derived from field `required`, `type`, and `validation` constraints
- Sections from `blueprint.schema.sections`; each section has `title` and `fields` array (field names)
- Each field name is looked up in `fields` to get label/type/required/options
- Field type → component mapping: text/email/phone → Input; number/decimal → number Input; textarea → Textarea; select → Select (from existing `@atlas/ui` SelectField); boolean → checkbox; date/datetime → Input type=date/datetime-local; color → Input type=color; relation → plain text input for now (full relation picker is Phase 6)
- Required fields: red asterisk via CSS class on label
- Read-only fields: render as `<span>` not input
- Submit button: `blueprint.schema.submitLabel ?? "Guardar"`; Cancel: `blueprint.schema.cancelLabel ?? "Cancelar"`
- On submit: POST or PATCH to `{apiBaseUrl}{blueprint.schema.entityPath}`; success → call `onSuccess(result)`; error → show inline error toast

**AtlasDetail** accepts `{ blueprint, fields, data }`:
- Sections same structure as AtlasForm
- Each field renders as a `<dt>` label + `<dd>` value pair
- Color type: renders a small color swatch
- Select type: renders the raw value (enum display mapping is Phase 6)

**AtlasCrudView** accepts `{ tableBlueprint, formBlueprint, detailBlueprint, fields, token, apiBaseUrl }`:
- Manages view state: `list | create | detail | edit` (derived from URL sub-path via `useParams`)
- `list` → renders `AtlasTable` + floating "Agregar" button if create action is present
- `create` → renders `AtlasForm` in a Sheet (using `@atlas/ui` Sheet primitives if available, else inline)
- `detail` → renders `AtlasDetail` + Edit button
- `edit` → renders `AtlasForm` pre-filled with the record's data
- On successful create/edit: invalidates the TanStack Query cache for the entity list; returns to list view
- Handles navigation via `useNavigate` from react-router-dom

- [ ] 6.1 Create `packages/ui/src/atlas-renderer/index.js` barrel:
  ```js
  export { AtlasTable } from './AtlasTable.jsx'
  export { AtlasForm } from './AtlasForm.jsx'
  export { AtlasDetail } from './AtlasDetail.jsx'
  export { AtlasCrudView } from './AtlasCrudView.jsx'
  ```
- [ ] 6.2 Create `AtlasTable.jsx` per the description above; use TanStack Query `useQuery` with `queryKey: ['atlas-entity', blueprint.key, page, pageSize, search, filters]`
- [ ] 6.3 Create `AtlasForm.jsx` per the description above; derive Zod schema from fields array at render time
- [ ] 6.4 Create `AtlasDetail.jsx` per the description above
- [ ] 6.5 Create `AtlasCrudView.jsx` per the description above; compose the three components
- [ ] 6.6 Add to `packages/ui/src/index.js`:
  ```js
  export { AtlasTable, AtlasForm, AtlasDetail, AtlasCrudView } from './atlas-renderer/index.js'
  ```

**Validation:**

```bash
node --check packages/ui/src/atlas-renderer/AtlasTable.jsx
node --check packages/ui/src/atlas-renderer/AtlasForm.jsx
node --check packages/ui/src/atlas-renderer/AtlasDetail.jsx
node --check packages/ui/src/atlas-renderer/AtlasCrudView.jsx
# Expected: all exit 0

pnpm --filter ./apps/desktop build:web 2>&1 | tail -5
# Expected: exits 0 with no errors
```

---

## Task 7 — Shell Routing for AME3 Custom Modules

**Files:**
- Create: `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (one-time platform addition — after this, new AME3 modules never touch this file)

**Changes:**

`BlueprintCrudScreen` is a generic shell screen that resolves blueprints from `GET /blueprints` and renders `AtlasCrudView`. It reads `moduleKey` and the sub-path from the URL, finds the matching `AtlasView`-sourced blueprints for the entity, and passes them to `AtlasCrudView`.

`ModuleOutlet.jsx` currently uses a hardcoded `SCREEN_MAP`. The fallback must be added in `resolveScreen()`: if no match is found in `SCREEN_MAP` AND the moduleKey is NOT a known core module key (atlas.core, atlas.identity, atlas.files, atlas.company, atlas.contacts, atlas.finance, atlas.hr, atlas.ledger, atlas.ledger), return the `BlueprintCrudScreen` component.

This means custom modules like `custom.fleet` will naturally fall through to `BlueprintCrudScreen` without any SCREEN_MAP entry needed.

- [ ] 7.1 Create `apps/desktop/src/shell/BlueprintCrudScreen.jsx`:
  - Imports: `useParams`, `useNavigate` from react-router-dom; `useQuery` from @tanstack/react-query; `AtlasCrudView` from `@atlas/ui`; `useAuth` from `../auth/AuthProvider`; `atlas` from `../lib/atlas`
  - Reads `moduleKey` and `*` (wildcard sub-path) from `useParams`
  - Fetches blueprints: `useQuery({ queryKey: ['blueprints'], queryFn: () => atlas.blueprints.list(token) })`
  - Derives `entityPath`: the first segment of the sub-path (e.g., `vehicles` from `/vehicles` or `/vehicles/new`)
  - Finds blueprints for this module+entity: filters by `moduleKey` and `key` containing `entityPath`
  - Finds `tableBlueprint`, `formBlueprint`, `detailBlueprint` by `kind === 'TABLE'|'FORM'|'DETAIL'`
  - Also finds `fields` from `tableBlueprint.schema.fields` or `formBlueprint.schema.fields`
  - If `tableBlueprint` not found: renders "Vista no disponible para este modulo."
  - If module not installed: redirects to `/app/m/atlas.core/modules`
  - Renders `<AtlasCrudView tableBlueprint={...} formBlueprint={...} detailBlueprint={...} fields={...} token={token} apiBaseUrl={apiBaseUrl} />`
- [ ] 7.2 Add `atlas.blueprints.list` method to `packages/sdk/src/index.js` if not already present (check: it may exist under a different name)
- [ ] 7.3 Modify `apps/desktop/src/app/ModuleOutlet.jsx`:
  - Add at the top: `import { BlueprintCrudScreen } from '../shell/BlueprintCrudScreen.jsx'`
  - Define `CORE_MODULE_KEYS = new Set(['atlas.core', 'atlas.identity', 'atlas.files', 'atlas.company', 'atlas.contacts', 'atlas.finance', 'atlas.hr', 'atlas.ledger'])`
  - In `resolveScreen(moduleKey, subPath)`, after all existing checks and the final `return null`:
    ```js
    if (!CORE_MODULE_KEYS.has(moduleKey)) return BlueprintCrudScreen
    return null
    ```
- [ ] 7.4 Ensure `BlueprintCrudScreen` receives the module as a prop or derives it from `useRuntimeModules` to display module name in the page title

**Validation:**

```bash
pnpm --filter ./apps/desktop build:web
# Expected: exits 0

# Browser test (requires dev server running):
# Navigate to http://localhost:5173/app/m/custom.fleet/vehicles
# Expected: AtlasCrudView renders AtlasTable with "Vehiculos" heading
# Expected: columns match field labels from vehicle.model.js (Matricula, Marca, Modelo, Anio, Estado)
```

---

## Task 8 — End-to-End Verification

Run all 13 verification commands from spec section 26 in sequence. Mark this task complete only when all commands produce the expected output.

- [ ] 8.1 Syntax check all new files:
  ```bash
  node --check modules/custom/custom.fleet/api/index.js
  node --check modules/custom/custom.fleet/api/fleet-service.js
  node --check modules/custom/custom.fleet/validators/index.js
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
- [ ] 8.4 Sync custom.fleet:
  ```bash
  curl -s -X POST http://localhost:4010/modules/sync \
    -H "Authorization: Bearer $TOKEN" | jq '.data.valid'
  # Expected: >= 1
  ```
- [ ] 8.5 Install custom.fleet and verify INSTALLED status
- [ ] 8.6 Verify ORM provisioned tables via Prisma db execute
- [ ] 8.7 Verify ModuleMigration rows (2 rows for custom.fleet)
- [ ] 8.8 Fleet CRUD smoke: GET returns empty list; POST creates vehicle; GET list returns 1
- [ ] 8.9 Blueprint API returns >= 3 items for custom.fleet with `source: "atlas-view"`
- [ ] 8.10 Migration listing returns 2 records for custom.fleet
- [ ] 8.11 Permission fail-closed: request without fleet permissions returns 403
- [ ] 8.12 Desktop build exits 0
- [ ] 8.13 Forbidden file check:
  ```bash
  git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/|packages/maps/src/|packages/validators/src/|modules/custom/custom\.fleet/module\.manifest\.js|modules/custom/custom\.fleet/models/|modules/custom/custom\.fleet/views/)"
  # Expected: empty output
  ```
  > Note: `apps/api/src/index.js` and `apps/desktop/src/app/ModuleOutlet.jsx` ARE modified in this plan as one-time platform additions (Tasks 2 and 7). The verification confirms that fleet-specific and schema files are untouched.

---

## Commit Checkpoints

Commit after each task passes its validation. Suggested message format:

```
feat(ame3): wire ORM execution hook into module install lifecycle

feat(ame3): add route-loader-service for dynamic module API mounting

feat(ame3): add custom.fleet CRUD API (fleet-service + validators + router)

feat(ame3): extend GET /blueprints to include AtlasView rows

feat(ame3): add modules.listMigrations to Atlas SDK

feat(ame3): add AtlasTable/AtlasForm/AtlasDetail/AtlasCrudView blueprint renderer

feat(ame3): add BlueprintCrudScreen shell fallback for AME3 custom modules

feat(ame3): end-to-end verification of custom.fleet via blueprint renderer
```

---

## Rollback Notes

- **Before Task 1**: Revert `module-lifecycle-service.js` and `modules.js` changes. No data affected (ORM not called yet).
- **After Task 1 (ORM ran)**: Module tables (`fleet_vehicle`, `fleet_maintenance`) were created with `CREATE TABLE IF NOT EXISTS`. Tables persist — this is intentional (preserve-data). To drop: DBA must execute `DROP TABLE fleet_vehicle; DROP TABLE fleet_maintenance;` manually. To reset ledger: `DELETE FROM "ModuleMigration" WHERE "moduleKey" = 'custom.fleet';`. The module can then be reinstalled cleanly.
- **Tasks 2–7**: All changes are additive files plus small modifications to `index.js` and `ModuleOutlet.jsx`. Reverting: `git revert` the relevant commits or `git checkout` individual files. No database schema changes are involved.
- **No Prisma migrations in this plan**: There is nothing to roll back in `prisma/migrations/`.

---

## Verification Gate

Before marking Phase 3 tasks complete in `docs/TASKS.md`:

- [ ] All task validation commands have been run and produced the expected output.
- [ ] All commands exited without errors.
- [ ] `pnpm exec prisma validate` exits 0 (schema unchanged).
- [ ] `pnpm --filter ./apps/desktop build:web` exits 0.
- [ ] `git diff HEAD` shows no uncommitted changes.
- [ ] `docs/TASKS.md` updated with `Verified: 2026-05-10 (all 13 verification commands executed)`.
