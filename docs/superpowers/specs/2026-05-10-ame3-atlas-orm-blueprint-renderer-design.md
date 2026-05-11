# AME3 Atlas ORM Execution and Blueprint Renderer

Date: 2026-05-10
Status: Approved
Author: Claude Code (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-10-ame3-atlas-orm-blueprint-renderer-design.md
Plan file: docs/superpowers/plans/2026-05-10-ame3-atlas-orm-blueprint-renderer.md (created after spec approval)

---

## 1. Feature title

AME3 Phase 3 — Atlas ORM Execution and Blueprint Renderer: End-to-End Custom Module Support

---

## 2. Status

Approved

Implementation note (2026-05-11): recovery behavior for failed module installs is extended by decision log `docs/superpowers/decisions/2026-05-11-ame3-failed-module-install-recovery.md` and must be completed before Task 2 execution.

---

## 3. Context

AME3 Phase 1 delivered the `@atlas/module-engine` package with `defineAtlasModule`, `defineModel`, `defineView`, `definePage`, SQL generation utilities, and checksums. AME3 Phase 2 delivered the `custom.fleet` module declaration files, the module discovery service, and the metadata persistence layer (`module-metadata-service`, `module-migration-service`, `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` Prisma tables).

After Phase 2, the following assets exist and are operational:
- `packages/module-engine/src/` — all declaration and SQL generation utilities
- `modules/custom/custom.fleet/` — module manifest, two models, three views, one page declaration
- `apps/api/src/services/module-metadata-service.js` — upserts model/view metadata to `AtlasModel`/`AtlasField`/`AtlasView`
- `apps/api/src/services/module-migration-service.js` — `generateSqlForModel`, `planModelMigrations`, `applySqlMigration`, `listAppliedMigrations`
- `apps/api/src/services/module-discovery-service.js` — scans `modules/custom/` and `modules/official/`
- `POST /modules/sync` — discovers, validates, persists metadata for custom.fleet
- `GET /blueprints` — serves Blueprint table rows for installed modules (not yet AtlasView rows)
- `prisma/schema.prisma` — `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` models present

Despite this foundation, custom.fleet cannot operate end-to-end because:
1. Installing custom.fleet does **not** provision physical tables (`fleet_vehicle`, `fleet_maintenance`) — `applySqlMigration` is not called from the install lifecycle.
2. Installing custom.fleet does **not** mount any API routes — there is no `api/index.js` in custom.fleet and no Route Loader connects it.
3. The frontend has no mechanism to render a blueprint-driven page — `AtlasTable`, `AtlasForm`, `AtlasDetail`, and `AtlasCrudView` do not exist.
4. The module shell cannot resolve `/app/m/custom.fleet/vehicles` to a blueprint-driven page.

This spec defines Phase 3: the layer that connects all existing foundations into a functioning end-to-end pipeline for custom modules.

---

## 4. Problem

A custom module developer who correctly authors `module.manifest.js`, `models/*.model.js`, and `views/*.js` using AME3 APIs currently still must:
1. Manually add Prisma models to `prisma/schema.prisma` and run `pnpm db:migrate` to create physical tables.
2. Manually import and mount the module's Hono router in `apps/api/src/index.js`.
3. Manually add React screen files to `apps/desktop/src/` and register routes there.

These three manual steps are the exact constraints AME3 was designed to eliminate. Phase 3 eliminates all three for any module that conforms to the AME3 declaration API.

Additionally, the existing `GET /blueprints` endpoint only serves legacy `Blueprint` table rows. View declarations persisted in `AtlasView` through the metadata service are not exposed to the frontend renderer. The frontend has no generic renderer capable of turning a TABLE, FORM, or DETAIL blueprint into a working UI.

---

## 5. Goals

1. When a custom module is installed, the Atlas ORM automatically provisions all physical tables declared via `defineModel` using the existing `module-migration-service.applySqlMigration` — zero Prisma edits required from the module author.
2. When a custom module is installed, its `api/index.js` Hono router factory is automatically loaded and mounted by the Route Loader. The Route Loader initializes synchronously during API boot — after core services are ready and before the server starts listening. A module whose `api/index.js` fails to import must not crash Atlas Core: the Route Loader logs the error, marks `lifecycleConfig.routeLoader.status = 'ERROR'` on the module record, and continues booting (fail-soft per module). Zero manual route mounting in `apps/api/src/index.js`.
3. The `GET /blueprints` API returns both legacy `Blueprint` rows and `AtlasView` rows, filtered to installed and enabled modules, with module metadata attached.
4. A new `GET /modules/:key/migrations` endpoint returns the list of applied migrations from `ModuleMigration` for a given module.
5. The `custom.fleet` module ships `api/index.js` and `fleet-service.js` so that CRUD endpoints for vehicles and maintenance records exist and respond correctly once the module is installed.
6. `AtlasTable`, `AtlasForm`, `AtlasDetail`, and `AtlasCrudView` React components exist in `@atlas/ui` and can render a blueprint-driven CRUD experience for any TABLE, FORM, and DETAIL blueprint.
7. The Atlas shell resolves `/app/m/:moduleKey/*` paths by looking up page blueprints from `AtlasView` and rendering the appropriate `AtlasCrudView` or component.
8. `custom.fleet` works end-to-end: discover → sync → install → physical tables provisioned → routes mounted → shell sidebar links active → vehicle list renders via `AtlasTable` → create/edit form renders via `AtlasForm` — without any edit to `prisma/schema.prisma`, `apps/api/src/index.js`, or any hardcoded screen file.

9. At API boot, the Route Loader scans each installed and enabled module's `components/index.js` (when present) and calls its `register(ComponentRegistry)` export to populate the ComponentRegistry for that module. A module with no `components/index.js` is silently skipped. A module whose `components/index.js` fails to load is handled fail-soft (logged, not fatal). This enables custom column components declared in `AtlasTable` blueprints and custom field components in `AtlasForm` blueprints to be resolved at runtime for modules that provide them.

---

## 6. Non-goals

1. Official module migration (atlas.contacts, atlas.finance, atlas.hr, atlas.ledger) from `packages/maps/` to `modules/official/` — Phase 5.
2. `packages/maps/` removal — Phase 7.
3. Automatic DROP or TRUNCATE of physical tables on module uninstall — explicitly prohibited; tables are preserved on uninstall (preserve-data default).
4. Full generic blueprint rendering for all possible blueprint field types, complex conditional logic, or nested relation traversal — Phase 6.
5. `AtlasPage` composition (page blueprints composed of sub-blueprints) — Phase 6.
6. Per-company module enablement (enable module for company A but not company B) — a future feature; this phase is instance-wide only.
7. Runtime hot-reload without API restart — route changes take effect after API restart.
8. Module-to-module event bus communication — future.
9. Blueprint versioning conflict resolution beyond "latest wins" — future.
10. Module ZIP upload or registry — explicitly non-goal for the entire AME3 design.
11. TypeScript types or `.d.ts` files for new components.
12. Advanced `AtlasTable` features (complex nested filters, server-side group-by, virtual scrolling) — Phase 6.
13. `AtlasForm` dynamic field conditions (show field B only when field A equals X) — Phase 6.

---

## 7. User stories

- As a module author, I want to declare `defineModel` in my module's `models/` folder so that physical database tables are created automatically when my module is installed, without editing `prisma/schema.prisma`.
- As a module author, I want to place `api/index.js` in my module's `api/` folder so that my HTTP routes are available automatically when my module is installed, without editing `apps/api/src/index.js`.
- As a module author, I want to declare `defineView` and `definePage` in my module's `views/` folder so that my module's screens are available in the Atlas shell automatically, without editing any screen registration file.
- As an ERP administrator, I want to install a custom module from the Module Catalog so that its tables, routes, and navigation items become active immediately.
- As an ERP user with the correct permissions, I want to see the fleet module's vehicle list and create a new vehicle using a form that matches the module's declared fields, without any developer having written custom React screens.
- As an Atlas platform developer, I want `GET /blueprints` to include blueprint metadata from `AtlasView` (not only legacy `Blueprint` rows) so that the frontend renderer has a unified blueprint source.

---

## 8. UX requirements

All user-facing text, labels, placeholders, and messages must be in Spanish. Code identifiers, API paths, file names, and comments remain in English.

### AtlasTable
- Renders a responsive data table driven by the TABLE blueprint schema.
- Data is fetched from the endpoint declared at `schema.apiPath` (e.g., `/fleet/vehicles`). The renderer must use `schema.apiPath` as the source of truth; no API path derivation from module key or entity name is allowed.
- Columns are defined by `schema.columns` — each column entry maps to a field name from the model. Column header is the field's `label` from AtlasField.
- Supports pagination (page size: 20 default, configurable via blueprint).
- Supports a single text search bar if `schema.searchable: true` in blueprint.
- Filter pills rendered for each filter declared in `schema.filters`. Filter UI: `select` filter type renders a dropdown; `text` filter renders a text input.
- Loading state: skeleton rows matching column count.
- Empty state: displays `schema.emptyState.message` or default "No hay registros." in Spanish.
- Error state: displays "No se pudo cargar la informacion." with a retry button.
- Toolbar: renders action buttons from `schema.actions` filtered by the authenticated user's permissions.
- Row actions: rendered as a dropdown menu (`...`) per row, listing row-level actions from `schema.rowActions` filtered by permissions.
- Custom column renderers: if a column declares `component: 'moduleKey:ComponentName'`, the ComponentRegistry resolves and renders the custom component in that cell. The ComponentRegistry is populated at boot time from each module's `components/index.js` (see Goal 9).

### AtlasForm
- Renders a create/edit form driven by the FORM blueprint schema.
- Sections come from `schema.sections`, each with a `title` and a `columns` grid (1 or 2 columns).
- Each field in a section renders a matching form control based on its type from AtlasField:
  - `text` → `<input type="text">`
  - `number` → `<input type="number">`
  - `decimal` → `<input type="number" step="0.0001">`
  - `select` → dropdown (single)
  - `textarea` → `<textarea>`
  - `date` → date picker
  - `datetime` → datetime picker
  - `boolean` → checkbox or toggle
  - `email` → `<input type="email">`
  - `phone` → `<input type="tel">`
  - `color` → color picker
  - `relation` → entity picker (search-as-you-type, loads from related entity's list endpoint)
  - `file` → file upload via `atlas.files` SDK
  - `markdown` → markdown textarea with preview toggle
- Required fields show a red asterisk.
- Read-only fields render as text, not input.
- Submit button: `schema.submitLabel` (Spanish). Cancel button: `schema.cancelLabel` (Spanish).
- Validation errors: shown inline under each field.
- Form submission: POST (create) or PATCH (edit) to the endpoint declared at `schema.apiPath`. The renderer must use `schema.apiPath` as the source of truth; no API path derivation is allowed. Success → navigate to detail view. Error → show error toast.

### AtlasDetail
- Renders a read-only detail view driven by the DETAIL blueprint schema.
- Sections from `schema.sections`, same layout as AtlasForm.
- Fields rendered as labeled key-value pairs.
- Custom field renderers resolved via ComponentRegistry.
- Edit button links to the form view for the same record.

### AtlasCrudView
- Composes `AtlasTable` (list), `AtlasForm` (create/edit sheet or modal), and `AtlasDetail` (detail sheet) for a full CRUD flow.
- The route `/app/m/:moduleKey/resource` renders the list view.
- The route `/app/m/:moduleKey/resource/new` opens the form sheet.
- The route `/app/m/:moduleKey/resource/:id` renders the detail view.
- The route `/app/m/:moduleKey/resource/:id/edit` opens the form sheet pre-populated.
- Shell layout key `atlas.dashboardShell` wraps the module content in the standard Atlas shell (sidebar + header).
- Layout key `atlas.crudLayout` places a page header with title + toolbar above the table/form/detail.

### Module shell routing
- When a user navigates to a path under `/app/m/:moduleKey/`, the shell looks up the matching `AtlasView` record with `type = 'page'` and `schema.path = pathname`.
- If found and the module is installed+enabled and the user has the required permission, the blueprint-driven view is rendered.
- If the module is not installed, redirect to module catalog.
- If the user lacks permission, render a 403 "Acceso denegado" message.

---

## 9. Routes/screens

New frontend routes introduced by this spec:

| Route | Screen | Module | Description |
|---|---|---|---|
| `/app/m/:moduleKey/:entityPath` | `BlueprintCrudScreen` | resolved at runtime from AtlasView | Generic blueprint-driven list screen |
| `/app/m/:moduleKey/:entityPath/new` | `BlueprintCrudScreen` | resolved at runtime | Generic create form sheet |
| `/app/m/:moduleKey/:entityPath/:id` | `BlueprintCrudScreen` | resolved at runtime | Generic detail view |
| `/app/m/:moduleKey/:entityPath/:id/edit` | `BlueprintCrudScreen` | resolved at runtime | Generic edit form sheet |

The `BlueprintCrudScreen` is not a per-module file. It is a single generic screen in `apps/desktop/src/shell/` that resolves the blueprint from the URL and renders the appropriate component (`AtlasCrudView`, `AtlasTable`, `AtlasForm`, or `AtlasDetail`).

For `custom.fleet` specifically (resolved dynamically, no hardcoded screen):
- `/app/m/custom.fleet/vehicles` → TABLE blueprint `fleet.vehicle.table` → `AtlasCrudView` list
- `/app/m/custom.fleet/vehicles/new` → FORM blueprint `fleet.vehicle.form` → `AtlasCrudView` create
- `/app/m/custom.fleet/vehicles/:id` → DETAIL blueprint `fleet.vehicle.detail` → `AtlasCrudView` detail
- `/app/m/custom.fleet/vehicles/:id/edit` → FORM blueprint `fleet.vehicle.form` → `AtlasCrudView` edit

---

## 10. Data model

### Already-existing metadata models (confirmed in prisma/schema.prisma as of Phase 2)

#### AtlasModel
Stores the persisted copy of each `defineModel` declaration. Fields include:
- `id`, `moduleKey`, `name` (unique namespaced identifier, e.g. `fleet.vehicle`), `tableName` (unique physical table name), `label`, `pluralLabel`, `companyScoped`, `schema` (full JSON snapshot), `enabled`, `createdAt`, `updatedAt`.
- Relations: `fields AtlasField[]`, `views AtlasView[]`.
- Index: `moduleKey`.

#### AtlasField
Stores individual field definitions per model. Fields include:
- `id`, `modelId` (FK → AtlasModel), `name`, `label`, `type`, `required`, `readonly`, `defaultValue`, `options`, `relation`, `validation`, `order`.
- Unique: `(modelId, name)`.

#### AtlasView
Stores view/page blueprint declarations from `defineView` and `definePage`. Fields include:
- `id`, `moduleKey`, `key` (unique), `modelName` (nullable FK → AtlasModel.name), `type` (e.g. `TABLE`, `FORM`, `DETAIL`, `PAGE`), `title`, `schema` (full JSON snapshot), `enabled`, `createdAt`, `updatedAt`.
- Indexes: `moduleKey`, `modelName`.

**Required `schema` fields for TABLE, FORM, and DETAIL view types:**
- `apiPath` (string, required): the API endpoint path for CRUD operations, e.g. `/fleet/vehicles`. The blueprint renderer uses `schema.apiPath` as the source of truth. No API path derivation from module key or entity name is performed by the renderer. View declarations that omit `apiPath` will produce a non-functional blueprint; validation should warn at sync time.
- Other schema fields vary by type: `columns` for TABLE; `sections` for FORM and DETAIL.

#### ModuleMigration
Ledger of applied module SQL migrations. Fields include:
- `id`, `moduleKey`, `filename` (e.g. `fleet_vehicle__abc123def456.sql`), `checksum` (SHA-256 of the SQL text), `appliedAt`.
- Unique: `(moduleKey, filename)`.

### New models in this spec

None. All four metadata models are already present in `prisma/schema.prisma`. This spec adds no new Prisma models.

### Physical tables (created by Atlas ORM, not in Prisma schema)

For `custom.fleet` as the reference implementation:

**Physical table `updated_at` behavior**: The Atlas ORM generates `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` for INSERT operations but does not generate PostgreSQL triggers in this phase. The service layer (e.g., `fleet-service.js`) must explicitly include `updated_at = now()` in every UPDATE SQL statement. PostgreSQL trigger generation is a future enhancement (see Section 28).

**`fleet_vehicle`** (created by Atlas ORM on module install)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL` (companyScoped: true)
- `plate VARCHAR(20) NOT NULL`
- `brand VARCHAR(100) NOT NULL`
- `model_name VARCHAR(100) NOT NULL`
- `year INTEGER NOT NULL`
- `color VARCHAR(32)`
- `status VARCHAR(64) NOT NULL DEFAULT 'active'`
- `driver_id UUID`
- `notes TEXT`
- `enabled BOOLEAN NOT NULL DEFAULT true` (softDelete: true)
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Indexes: `(company_id, plate) UNIQUE`, `(company_id, status)`

**`fleet_maintenance`** (created by Atlas ORM on module install)
- `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `company_id UUID NOT NULL` (companyScoped: true)
- `vehicle_id UUID NOT NULL`
- `type VARCHAR(64) NOT NULL`
- `description TEXT NOT NULL`
- `scheduled_date DATE NOT NULL`
- `completed_date DATE`
- `cost NUMERIC(18,4)`
- `notes TEXT`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Indexes: `(company_id, vehicle_id)`, `(company_id, scheduled_date)`

---

## 11. Prisma impact

New Prisma models: **none** — all four metadata models (`AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`) already exist in `prisma/schema.prisma` as of Phase 2.

Modified Prisma models: **none**.

New Prisma migration required: **No**. The physical tables for custom modules (`fleet_vehicle`, `fleet_maintenance`) are provisioned by the Atlas ORM via raw SQL (`$executeRawUnsafe` inside `module-migration-service.applySqlMigration`), not via Prisma migrations. Prisma never knows about module-owned tables.

Migration safety notes: The existing `prisma/migrations/` history is immutable and unchanged. All module table provisioning is tracked in `ModuleMigration`, not in `prisma/migrations/`.

---

## 12. API contract

### Module API router factory contract

Each AME3 module's `api/index.js` must export a default factory function with this exact signature:

```js
export default function createModuleRouter({ prisma, requirePermission, moduleContext })
```

Where:
- `prisma`: the platform Prisma client instance injected by the Route Loader. Module services must receive this instance via their own factory (`createFleetService({ prisma })`). A shared Prisma singleton imported at module level is not permitted.
- `requirePermission`: the platform permission guard middleware factory, identical to the one used in core API routes.
- `moduleContext`: `{ moduleKey: string, manifest: object }` — module-specific metadata provided by the Route Loader at mount time.

The Route Loader applies `authMiddleware` globally to the module sub-router before mounting it, so individual route handlers within the module do not specify `authMiddleware` but must use `requirePermission` for permission-based access control.

### Existing endpoints (behavior extended)

#### GET /blueprints

Auth: required
Permission: none (authenticated user required; existing behavior retained)
Current behavior: returns only `Blueprint` table rows where `enabled: true`, filtered by module access.
Extended behavior: also returns `AtlasView` rows for installed and enabled modules, normalized to the same shape as `Blueprint` rows. Module metadata attached to each item.

Response shape (each item):
```json
{
  "id": "...",
  "key": "fleet.vehicle.table",
  "moduleKey": "custom.fleet",
  "kind": "TABLE",
  "version": "0.1.0",
  "schema": { ... },
  "enabled": true,
  "source": "atlas-view",
  "module": {
    "key": "custom.fleet",
    "name": "Flota",
    "status": "INSTALLED",
    "enabled": true
  }
}
```

`source` field: `"blueprint"` for rows from the `Blueprint` table, `"atlas-view"` for rows from `AtlasView`.

Error: `{ "error": "..." }` 401 if not authenticated.

### New endpoints

#### GET /modules/:key/migrations

Auth: required
Permission: `core.modules.read`
Returns all applied migrations from `ModuleMigration` for the given module key.
Response: `{ data: [{ id, moduleKey, filename, checksum, appliedAt }] }`
Error: 404 if module not found. 403 if permission missing.

#### GET /fleet/vehicles (custom.fleet module)

Auth: required
Permission: `fleet.vehicles.read`
Query params: `page` (integer, default 1), `pageSize` (integer, default 20), `status` (select filter), `search` (text filter on plate, brand, model_name)
Returns all vehicles for the authenticated user's company.
Response: `{ data: Vehicle[], pagination: { page, pageSize, total } }`

Where `Vehicle` shape:
```json
{
  "id": "uuid",
  "company_id": "uuid",
  "plate": "string",
  "brand": "string",
  "model_name": "string",
  "year": 2020,
  "color": "#hex",
  "status": "active",
  "driver_id": "uuid or null",
  "notes": "string or null",
  "enabled": true,
  "created_at": "ISO datetime",
  "updated_at": "ISO datetime"
}
```

Error: 403 if permission missing.

#### POST /fleet/vehicles

Auth: required
Permission: `fleet.vehicles.create`
Body: `{ plate, brand, model_name, year, color?, status?, driver_id?, notes? }`
Creates a vehicle record in `fleet_vehicle` for the authenticated company.
Response: `{ data: Vehicle }` 201
Errors: 400 if validation fails. 403 if permission missing.

#### GET /fleet/vehicles/:id

Auth: required
Permission: `fleet.vehicles.read`
Returns a single vehicle by ID, scoped to the authenticated company.
Response: `{ data: Vehicle }`
Errors: 404 if not found or belongs to another company. 403 if permission missing.

#### PATCH /fleet/vehicles/:id

Auth: required
Permission: `fleet.vehicles.update`
Body: `{ plate?, brand?, model_name?, year?, color?, status?, driver_id?, notes? }` (all optional)
Updates a vehicle. Only provided fields are updated.
Response: `{ data: Vehicle }`
Errors: 404 if not found. 403 if permission missing.

#### PATCH /fleet/vehicles/:id/enabled

Auth: required
Permission: `fleet.vehicles.delete`
Body: `{ enabled: boolean }`
Soft-enables or disables a vehicle (soft delete when `enabled: false`).
Response: `{ data: Vehicle }`
Errors: 404 if not found. 403 if permission missing.

#### GET /fleet/maintenance

Auth: required
Permission: `fleet.maintenance.read`
Query params: `vehicleId` (filter), `page`, `pageSize`
Returns maintenance records for the authenticated company.
Response: `{ data: MaintenanceRecord[], pagination: { page, pageSize, total } }`

#### POST /fleet/maintenance

Auth: required
Permission: `fleet.maintenance.create`
Body: `{ vehicle_id, type, description, scheduled_date, completed_date?, cost?, notes? }`
Response: `{ data: MaintenanceRecord }` 201

#### PATCH /fleet/maintenance/:id

Auth: required
Permission: `fleet.maintenance.update`
Body: partial maintenance fields
Response: `{ data: MaintenanceRecord }`

#### PATCH /fleet/maintenance/:id/enabled

Auth: required
Permission: `fleet.maintenance.delete`
Body: `{ enabled: boolean }`
Response: `{ data: MaintenanceRecord }`

---

## 13. SDK contract

Domain: `atlas.modules` (extended)

- `listMigrations(moduleKey, token)` — calls `GET /modules/:key/migrations`; returns `{ data: ModuleMigration[] }`

Domain: `atlas.fleet` (new, custom.fleet module SDK — optional, modules may add SDK methods via convention)

N/A — custom module SDK methods are declared by the module author in a module-local file. The `@atlas/sdk` package is extended only for platform-level APIs. Fleet CRUD is called directly from `AtlasCrudView` using `schema.apiPath` declared in each blueprint.

**Blueprint renderer API path rule**: The blueprint renderer uses `schema.apiPath` as the single source of truth for all API calls (data fetching, form submission, record retrieval). It must not derive API paths from module keys, entity names, pluralization, or any naming convention. SDK domain methods are not required for generic CRUD: the renderer calls the explicit `schema.apiPath` value declared by each blueprint, making any conforming AME3 module work with the generic renderer without SDK additions.

---

## 14. Validator contract

Module-local validators (not in `@atlas/validators`):

New file: `modules/custom/custom.fleet/validators/index.js`

- `createVehicleSchema` — validates: `plate` (string, 1–20 chars), `brand` (string, 1–100 chars), `model_name` (string, 1–100 chars), `year` (integer, 1900–2100), `status` (enum: active|maintenance|inactive|retired, default: active), `color` (string, optional, hex pattern), `driver_id` (UUID string, optional), `notes` (string, max 5000, optional)
- `updateVehicleSchema` — same as `createVehicleSchema` but all fields optional
- `createMaintenanceSchema` — validates: `vehicle_id` (UUID, required), `type` (enum: preventive|corrective|inspection), `description` (string, 1–5000), `scheduled_date` (date string ISO), `completed_date` (date string ISO, optional), `cost` (number, non-negative, optional), `notes` (string, optional)
- `updateMaintenanceSchema` — same as `createMaintenanceSchema` but all fields optional

These validators live in the module. They are not added to `packages/validators/src/index.js`.

---

## 15. Module manifest impact

The `custom.fleet` manifest at `modules/custom/custom.fleet/module.manifest.js` requires no changes. It already declares all permissions, navigation, lifecycle, and model/view paths correctly.

The `packages/maps/src/feature-modules.js` must **not** be modified. custom.fleet is not added there. It is discovered exclusively from `modules/custom/` via the discovery service.

---

## 16. Navigation impact

No new navigation items are introduced by this spec at the platform level. The `custom.fleet` module's navigation items (`Vehiculos` and `Mantenimiento`) are already declared in its manifest. They become visible in the Atlas shell sidebar after the module is installed, when the shell resolves navigation from the installed module's manifest.

The Atlas shell must be extended to include navigation items from AME3 modules discovered via `GET /modules`. This is the same source that today populates navigation for `packages/maps` modules.

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Vehiculos | `/app/m/custom.fleet/vehicles` | Truck | main | `fleet.vehicles.read` |
| Mantenimiento | `/app/m/custom.fleet/maintenance` | Wrench | main | `fleet.maintenance.read` |

---

## 17. Blueprint impact

Blueprint-related changes in this spec:

1. `GET /blueprints` is extended to include `AtlasView` rows in its response. This is a behavioral change on an existing endpoint, not a new blueprint kind.

2. New blueprint kinds introduced by `custom.fleet` views (already declared in `AtlasView` after sync):
   - `fleet.vehicle.table` — kind: `TABLE`, `schema.apiPath: '/fleet/vehicles'`
   - `fleet.vehicle.form` — kind: `FORM`, `schema.apiPath: '/fleet/vehicles'`
   - `fleet.vehicle.detail` — kind: `DETAIL`, `schema.apiPath: '/fleet/vehicles'`
   - `fleet.vehicle.page` — type: `PAGE` (no `apiPath` required; pages are not data-fetching views)

   The `apiPath` field must be added to the existing `vehicle.table.js`, `vehicle.form.js`, and `vehicle.detail.js` view source files as part of Phase 3. The `vehicle.page.js` file requires no changes.

3. The blueprint renderer components (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) are introduced in `@atlas/ui`. They consume the blueprint schema from `GET /blueprints` and render the appropriate UI.

4. Blueprint filtering rule: a blueprint is served only when its owning module has `status: INSTALLED` and `enabled: true`. Blueprints for `UNINSTALLED`, `DISABLED`, or `ERROR` modules are excluded from `GET /blueprints` responses.

---

## 18. RBAC/permissions

### Atlas ORM execution (integrated into module install)

The ORM execution is triggered internally by the module install lifecycle. The install endpoint `POST /modules/install` is guarded by `core.modules.create`. No new permission is needed for ORM execution.

### Route Loader

Route Loader runs at API boot and on install/uninstall lifecycle events. It is an internal platform service with no user-facing permission. Module routes are only mounted when the module is `INSTALLED` and `enabled: true`; their own `requirePermission` guards remain in effect.

### Fleet module permissions

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| `fleet.access` | Module access gate (requirePermission check) | No |
| `fleet.vehicles.read` | `GET /fleet/vehicles`, `GET /fleet/vehicles/:id` | Yes — Vehiculos |
| `fleet.vehicles.create` | `POST /fleet/vehicles` | No |
| `fleet.vehicles.update` | `PATCH /fleet/vehicles/:id` | No |
| `fleet.vehicles.delete` | `PATCH /fleet/vehicles/:id/enabled` | No |
| `fleet.maintenance.read` | `GET /fleet/maintenance`, detail | Yes — Mantenimiento |
| `fleet.maintenance.create` | `POST /fleet/maintenance` | No |
| `fleet.maintenance.update` | `PATCH /fleet/maintenance/:id` | No |
| `fleet.maintenance.delete` | `PATCH /fleet/maintenance/:id/enabled` | No |

### Blueprint API

`GET /blueprints` requires authentication but no specific permission (existing behavior). Only blueprints for modules accessible to the authenticated user are returned (filtered by installed + enabled + user has `module.access` permission for that module).

### Migration listing

`GET /modules/:key/migrations` requires `core.modules.read`.

---

## 19. Multi-company behavior

All module-owned physical tables that are `companyScoped: true` (both `fleet_vehicle` and `fleet_maintenance`) include a `company_id UUID NOT NULL` column generated by the Atlas ORM.

The `fleet-service.js` must filter all queries by the authenticated user's `companyId` from the user context. Cross-company access is structurally prevented by including `AND company_id = $1` in every SQL query.

The company ID is extracted from `c.get('userContext')?.memberships?.[0]?.companyId` — the same pattern used in all existing Atlas service code.

`companyScoped: false` models (none in custom.fleet) would have no `company_id` column and would be instance-wide. Instance-wide data must still be read-only for non-admin users unless the module explicitly manages permissions for it.

`softDelete: true` models (`fleet_vehicle`) have `enabled BOOLEAN NOT NULL DEFAULT true`. Soft-deleted rows have `enabled = false`. List queries filter `WHERE enabled = true` by default unless the caller explicitly requests all records.

`softDelete: false` models (`fleet_maintenance`) have no `enabled` column; records are hard-deleted if the purge operation is confirmed.

---

## 20. Files/storage impact

N/A — this spec introduces no file upload or Supabase Storage operations. Custom fleet routes do not handle file attachments in Phase 3. Vehicle profile images (driver photos) are a future enhancement.

---

## 21. Export/import requirements

N/A — no CSV, PDF, or Excel exports are in scope for this spec. Fleet list CSV export is a future enhancement listed in the future enhancements section.

---

## 22. Audit log requirements

The fleet service must write `AuditLog` entries for the following actions:

| Action key | Trigger | Payload |
|---|---|---|
| `fleet.vehicle.create` | `POST /fleet/vehicles` — success | `after: { id, plate, brand, model_name, year, status, companyId }` |
| `fleet.vehicle.update` | `PATCH /fleet/vehicles/:id` — success | `before: { plate, status, ... }, after: { plate, status, ... }` |
| `fleet.vehicle.disable` | `PATCH /fleet/vehicles/:id/enabled` with `enabled: false` | `after: { id, enabled: false }` |
| `fleet.maintenance.create` | `POST /fleet/maintenance` — success | `after: { id, vehicle_id, type, scheduled_date }` |
| `fleet.maintenance.update` | `PATCH /fleet/maintenance/:id` — success | `before: {...}, after: {...}` |

AuditLog writes use the existing `prisma.auditLog.create` pattern. The `actorId` comes from `c.get('userContext')?.profile?.id`. The `moduleKey` is `custom.fleet`. The `entityType` is `vehicle` or `maintenance`. The `entityId` is the record `id`.

Additionally, the Atlas ORM execution during module install writes an AuditLog entry:
- Action key: `atlas.orm.migrate`
- Trigger: module install, ORM migration applied
- Payload: `{ moduleKey, filename, tableName, checksum }`

---

## 23. Edge cases

1. **Module installed but ORM migration fails**: If `applySqlMigration` throws (e.g., syntax error in generated SQL that passed `assertSafeMigrationSql`), the install operation must catch the error, set the module status to `ERROR`, write an AuditLog entry, and return an error response. The module must not be left in `INSTALLED` state with no tables.

2. **Module re-installed after ORM migration already applied**: `planModelMigrations` checks `ModuleMigration` for existing `(moduleKey, filename)` rows. If the migration is already applied, it is skipped (`alreadyApplied: true`). Re-install is idempotent.

3. **Model field added in a new version**: Adding a field to `defineModel` changes the model's SQL. `createChecksum` produces a new value. `planModelMigrations` generates a new filename and adds a new migration plan item. The new migration provisions the additional column using `CREATE TABLE IF NOT EXISTS` (idempotent) — the new table DDL includes all current fields. If the physical table already exists, PostgreSQL's `CREATE TABLE IF NOT EXISTS` is a no-op, but the new column is NOT added automatically. This is a known limitation: additive column changes require a manual migration SQL file in `migrations/`. The spec records this limitation explicitly and defers additive column migration to a future phase.

4. **Route Loader at API boot with module in ERROR state**: Routes for `ERROR` status modules must not be mounted. The Route Loader filters to `status: INSTALLED AND enabled: true` before loading `api/index.js`.

5. **`api/index.js` import fails**: If a module's `api/index.js` cannot be imported (syntax error, missing dependency), the Route Loader must log the error, persist `lifecycleConfig.routeLoader.status = 'ERROR'` on the module's `AtlasModule` record in the database, and continue booting. Other modules are unaffected. The Route Loader initialization is synchronous — it runs at boot and awaits all module load attempts (including failed ones) before the HTTP server starts listening. A broken module never prevents Atlas Core from becoming healthy.

6. **Blueprint key collision between `Blueprint` table and `AtlasView`**: If the same `key` exists in both tables, the `AtlasView` record takes precedence (AME3 source wins over legacy). A warning is logged.

7. **User navigates to `/app/m/custom.fleet/vehicles` before module is installed**: The shell detects the module is not `INSTALLED` and redirects to the Module Catalog with a notice: "El modulo Flota no esta instalado."

8. **User lacks `fleet.vehicles.read` permission**: The shell detects the permission is missing and renders a 403 page: "No tienes acceso a esta seccion."

9. **Fleet vehicle list requested with invalid `page` or `pageSize` param**: Service clamps `page` to minimum 1, `pageSize` to range 1–100. Invalid non-numeric values are treated as default.

10. **`fleet_vehicle` table does not exist when an API route is called**: If the Route Loader mounts routes before ORM execution completes (race condition), the service's raw SQL query throws. The route handler must catch this and return `{ error: "Las tablas del modulo no estan disponibles aun." }` 503.

11. **Module uninstalled while routes are mounted**: The Route Loader unmounts the module's router sub-tree on uninstall. In-flight requests to fleet routes during unmounting receive a 503 or a 404 depending on router implementation. This is documented as a known edge case; zero-downtime route removal is a future enhancement.

12. **`companyScoped: true` but `company_id` is null in the request context**: The service must reject the request with 400 if `companyId` cannot be resolved from the user context. Never execute a query without a company filter.

---

## 24. Risks

1. **Risk: `applySqlMigration` uses `$executeRawUnsafe` — SQL injection risk.** Mitigation: `generateCreateTableSql` validates every identifier against `/^[a-zA-Z_][a-zA-Z0-9_]*$/` and wraps them in double quotes. Column types come from the closed `SQL_TYPE_MAP` constant. `assertSafeMigrationSql` is called before every execution. The SQL is machine-generated, not user-supplied. Risk is low but must be documented.

2. **Risk: Physical table creation fails after `AtlasModule` is set to `INSTALLED`.** Mitigation: ORM execution runs in a Prisma transaction where possible. If the `fleet_vehicle` creation fails, the transaction rolls back and `AtlasModule` status is set to `ERROR`. The install endpoint returns a 500 with details. The module can be reinstalled after investigation.

3. **Risk: Route Loader dynamic `import()` of module `api/index.js` loads untrusted code.** Mitigation: Module code is placed on disk by a developer and committed to the repository. This is the same trust model as the rest of the codebase. No user-facing upload path exists. The Route Loader only imports from paths under `modules/official/` and `modules/custom/` — resolved using `path.resolve` with validation that the path stays within the allowed root.

4. **Risk: `AtlasCrudView` sends raw field names from blueprints to the API as query parameters.** Mitigation: The frontend only reads blueprints from authenticated endpoints. Blueprint content is server-controlled. API routes validate and sanitize all query parameters before use in SQL.

5. **Risk: `AtlasTable` renders data fetched from module endpoints — field values may contain unsanitized user data (stored XSS).** Mitigation: All values are rendered as React text nodes (not `dangerouslySetInnerHTML`). Custom column components are responsible for their own safety, and the ComponentRegistry policy forbids registering components that use `dangerouslySetInnerHTML`.

6. **Risk: `fleet_vehicle` and `fleet_maintenance` physical tables persist after module uninstall.** Mitigation: This is intentional (preserve-data default). Purge requires dry-run + `{ confirmation: "ACEPTO" }`. Table DROP never happens automatically. Future Phase 5 migration will replace these tables with Prisma-managed ones for official modules.

7. **Risk: Adding a field to `defineModel` does not automatically add the column to the existing physical table.** Mitigation: The spec documents this limitation clearly. Module authors must use manual migration SQL files in `migrations/` for additive column changes. The Atlas ORM migration plan includes a warning when a checksum change is detected but the table already exists.

8. **Risk: Route Loader adds startup latency proportional to the number of installed modules.** Mitigation: Routes are loaded once at boot, not per-request. The number of custom modules is expected to be small (under 50) in initial deployments. Route loading is parallelized.

9. **Risk: `updated_at` column staleness in module-owned tables.** The Atlas ORM generates `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` for INSERT operations but provides no PostgreSQL trigger for UPDATE operations. If a module service's UPDATE statement omits `updated_at = now()`, the column retains the INSERT timestamp indefinitely. Mitigation: All UPDATE functions in module services (starting with `fleet-service.js`) must explicitly include `updated_at = now()` in the SQL statement. Code review must verify this for every new service added. PostgreSQL trigger generation is deferred to a future phase (see Section 28).

---

## 25. Acceptance criteria

1. Given `custom.fleet` is discovered (VALID) but not yet installed, when `POST /modules/install` is called with `{ manifest: fleetManifest }`, then the `fleet_vehicle` and `fleet_maintenance` tables exist in the database and two `ModuleMigration` rows are recorded for `custom.fleet`.

2. Given `fleet_vehicle` and `fleet_maintenance` tables already exist and the module is reinstalled, when `POST /modules/install` is called again, then no duplicate SQL is executed (`alreadyApplied: true` for both migrations) and no error is returned.

3. Given `custom.fleet` is installed, when `GET /fleet/vehicles` is called with a valid JWT and `fleet.vehicles.read` permission, then the response is `{ data: [], pagination: { page: 1, pageSize: 20, total: 0 } }` (empty list).

4. Given `custom.fleet` is installed and `POST /fleet/vehicles` is called with `{ plate: "ABC-123", brand: "Toyota", model_name: "Hilux", year: 2023, status: "active" }` and a user with `fleet.vehicles.create`, then the response is `{ data: { id: "...", plate: "ABC-123", ... } }` 201 and a row exists in `fleet_vehicle`.

5. Given a user without `fleet.vehicles.create`, when `POST /fleet/vehicles` is called, then the response is 403.

6. Given `custom.fleet` is installed and DISABLED, when `GET /fleet/vehicles` is called, then the response is 403 (module access gate fails).

7. Given `custom.fleet` is installed, when `GET /blueprints` is called by an authenticated user with `fleet.access`, then the response includes `fleet.vehicle.table`, `fleet.vehicle.form`, `fleet.vehicle.detail` with `source: "atlas-view"`.

8. Given `custom.fleet` is UNINSTALLED, when `GET /blueprints` is called, then the fleet blueprint keys are absent from the response.

9. Given `custom.fleet` is installed, when a user with `fleet.vehicles.read` navigates to `/app/m/custom.fleet/vehicles` in the frontend, then the `AtlasCrudView` renders an `AtlasTable` populated by `GET /fleet/vehicles` data, with column headers matching the Spanish labels from `vehicle.model.js`.

10. Given the vehicle list is loaded, when a user with `fleet.vehicles.create` clicks "Agregar vehiculo", then an `AtlasForm` sheet opens with sections "Informacion general" and "Estado y asignacion" containing the correct fields.

11. Given the form is submitted with valid vehicle data, when the submit button is clicked, then a `POST /fleet/vehicles` request is made, the sheet closes, and the vehicle appears in the list.

12. Given `custom.fleet` is installed, when `GET /modules/custom.fleet/migrations` is called with `core.modules.read`, then the response includes two records matching `fleet_vehicle__*.sql` and `fleet_maintenance__*.sql`.

13. Given no files in `apps/api/src/index.js`, `prisma/schema.prisma`, or `apps/desktop/src/` were modified, the full end-to-end scenario (goals 1–7 in Section 5) must pass. Zero edits to those files is a hard requirement for acceptance.

14. Given `node --check modules/custom/custom.fleet/api/index.js` and `node --check modules/custom/custom.fleet/api/fleet-service.js`, both exit 0.

15. Given `pnpm --filter ./apps/desktop build:web`, the build exits 0 with `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView` present in the bundle.

16. Given `custom.fleet` is installed and `GET /blueprints` is called by an authenticated user with `fleet.access`, then each fleet blueprint with `source: "atlas-view"` includes `schema.apiPath` as a non-empty string (e.g., `"/fleet/vehicles"`). No fleet blueprint may have an undefined or null `schema.apiPath`.

17. Given a custom module's `api/index.js` contains a deliberate syntax error, when the API boots, then `GET /health` responds 200 and the broken module's `AtlasModule` record has `lifecycleConfig.routeLoader.status = 'ERROR'` in the database. Atlas Core remains fully operational.

---

## 26. Verification plan

```bash
# 1. Syntax check all new files
node --check modules/custom/custom.fleet/api/index.js
node --check modules/custom/custom.fleet/api/fleet-service.js
node --check modules/custom/custom.fleet/validators/index.js
node --check apps/api/src/services/route-loader-service.js

# 2. Prisma: no schema changes, validate existing schema
pnpm exec prisma validate
pnpm exec prisma migrate status
# Expected: schema valid, no pending migrations

# 3. API boot check — start API and verify no crash
pnpm dev:api &
curl -f http://localhost:4010/health
# Expected: { "status": "ok" }

# 4. Sync custom.fleet
TOKEN=<admin_bearer_token>
curl -s -X POST http://localhost:4010/modules/sync \
  -H "Authorization: Bearer $TOKEN" | jq '.data.valid'
# Expected: >= 1 (custom.fleet appears as VALID)

# 5. Install custom.fleet (sync + install — or use catalog in desktop)
curl -s -X POST http://localhost:4010/modules/install \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"manifest": <fleet-manifest-json>}' | jq '.data.status'
# Expected: "INSTALLED"

# 6. Verify ORM provisioned tables
pnpm exec prisma db execute --stdin <<SQL
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('fleet_vehicle','fleet_maintenance');
SQL
# Expected: both table_name rows present

# 7. Verify ModuleMigration rows
pnpm exec prisma db execute --stdin <<SQL
SELECT filename FROM "ModuleMigration" WHERE "moduleKey" = 'custom.fleet';
SQL
# Expected: two rows, filenames contain fleet_vehicle and fleet_maintenance

# 8. Fleet vehicles CRUD smoke
curl -s -X GET http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: 0 (empty list)

curl -s -X POST http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"plate":"ABC-123","brand":"Toyota","model_name":"Hilux","year":2023,"status":"active"}' \
  | jq '.data.plate'
# Expected: "ABC-123"

# 9. Blueprint API
curl -s -X GET http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" | jq '[.data[] | select(.moduleKey=="custom.fleet")] | length'
# Expected: >= 3 (fleet.vehicle.table, fleet.vehicle.form, fleet.vehicle.detail)

# 10. Migration listing
curl -s -X GET http://localhost:4010/modules/custom.fleet/migrations \
  -H "Authorization: Bearer $TOKEN" | jq '.data | length'
# Expected: 2

# 11. Permission fail-closed
curl -s -X GET http://localhost:4010/fleet/vehicles \
  -H "Authorization: Bearer $NO_PERM_TOKEN" | jq '.status? // .error'
# Expected: 403 or { "error": "..." }

# 12. Desktop build
pnpm --filter ./apps/desktop build:web
# Expected: exits 0

# 13. No forbidden file changes
git diff --name-only HEAD | grep -E "^(prisma/schema\.prisma|prisma/migrations/|packages/maps/src/|packages/validators/src/|modules/custom/custom\.fleet/module\.manifest\.js|modules/custom/custom\.fleet/models/)"
# Expected: empty output

# 14. Blueprint apiPath presence
curl -s http://localhost:4010/blueprints \
  -H "Authorization: Bearer $TOKEN" \
  | jq '[.data[] | select(.source=="atlas-view" and .moduleKey=="custom.fleet") | .schema.apiPath] | all(. != null and . != "")'
# Expected: true

# 15. Broken-module fail-soft (manual test)
# Temporarily rename modules/custom/custom.fleet/api/index.js to introduce a load failure,
# restart the API, verify:
curl -f http://localhost:4010/health
# Expected: { "status": "ok" }
# Then verify in DB: SELECT "lifecycleConfig" FROM "AtlasModule" WHERE key='custom.fleet';
# Expected: lifecycleConfig.routeLoader.status = 'ERROR'
# Restore the file and restart before continuing.
```

---

## 27. Rollback plan

### Atlas ORM (physical tables)

The `fleet_vehicle` and `fleet_maintenance` tables are created via `CREATE TABLE IF NOT EXISTS` — they are additive. Rolling back means:
1. Uninstall the module (sets `AtlasModule.status = UNINSTALLED`, deactivates permissions).
2. Physical tables remain in the database (preserve-data default). This is intentional.
3. To drop the tables, a DBA must execute `DROP TABLE fleet_vehicle CASCADE; DROP TABLE fleet_maintenance CASCADE;` manually after confirming no data is needed.
4. `ModuleMigration` rows can be deleted via SQL: `DELETE FROM "ModuleMigration" WHERE "moduleKey" = 'custom.fleet';`.

There is no automated DROP in the Atlas ORM. This is a safety guarantee.

### Route Loader

On module disable or uninstall, the Route Loader unmounts the module's router. Rolling back Route Loader changes means restarting the API — routes are loaded at boot and the Hono sub-router map is rebuilt from installed modules.

### Blueprint renderer (AtlasTable, AtlasForm, AtlasDetail, AtlasCrudView)

These are additive React components in `packages/ui/src/`. Rolling back means reverting the files in `packages/ui/src/atlas-renderer/` and rebuilding the frontend. No data is affected.

### `custom.fleet` API routes

Rolling back `modules/custom/custom.fleet/api/index.js` and `fleet-service.js` means removing those files. The Route Loader will fail to import `api/index.js` and log an ERROR status for the module — no routes mounted, data preserved.

Migrations involved: **no Prisma migrations in this spec** (none to roll back). The `ModuleMigration` ledger rows are data, not schema.

---

## 28. Future enhancements

1. **Additive column migration**: When a new field is added to `defineModel`, the Atlas ORM detects checksum drift and applies an `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` statement (Phase 4+).
2. **Hot-reload Route Loader**: Routes remounted without API restart when a module lifecycle event fires (Phase 4+).
3. **Full blueprint renderer** (`AtlasTable` with server-side sort, group-by, nested filters; `AtlasForm` with conditional field visibility; `AtlasPage` composition) — Phase 6.
4. **`AtlasCrudView` inline edit** (edit in the table row without opening a sheet) — Phase 6.
5. **ComponentRegistry advanced features**: Boot-time registration from each module's `components/index.js` is implemented in Phase 3 (see Goal 9). Advanced features — conditional registration, runtime override, nested component composition, and marketplace-style remote loading — remain deferred to Phase 6. No ZIP upload, eval, or runtime marketplace loading is permitted.
6. **Fleet vehicle CSV export** (blueprint declares export capability; generic export handler in `AtlasTable`).
7. **Contact/Employee relation** for `driver_id` field (links to HR employee entity once atlas.hr is migrated to AME3 in Phase 5).
8. **Audit log timeline** in `AtlasDetail` (embedded audit history panel driven by `AuditLog` records).
9. **Per-company module enablement** (module installed instance-wide but enabled per company) — major lifecycle feature, deferred.
10. **Blueprint versioning conflict resolution** (two modules declare blueprints with the same key — last-writer-wins policy documented as a hard error in Phase 3; Phase 4+ will add namespace enforcement).

11. **PostgreSQL trigger generation for `updated_at`**: The Atlas ORM currently generates `CREATE TABLE` DDL without triggers. Phase 3 services update `updated_at` manually in every SQL UPDATE statement. Adding `AFTER UPDATE` triggers via a dedicated migration helper (so module services no longer need to set `updated_at` manually) is deferred to Phase 4+.

---

## Appendix: Architecture dependencies and why official module migration must wait

### Why official modules cannot be migrated to AME3 before Phase 3 completes

The official Atlas modules (`atlas.contacts`, `atlas.finance`, `atlas.hr`, `atlas.ledger`) all have:
1. Prisma models in `prisma/schema.prisma` managing their tables.
2. API routes manually mounted in `apps/api/src/index.js`.
3. React screens manually registered in `apps/desktop/src/modules/`.

Migrating any official module to AME3 requires:
1. Replacing Prisma models with `defineModel` declarations → the Atlas ORM must provision physical tables.
2. Replacing manual route mounting with Route Loader auto-discovery.
3. Replacing hardcoded screens with blueprint-driven pages.

None of these replacement mechanisms exist until Phase 3 is complete. Attempting migration before Phase 3 would require keeping the old system running in parallel indefinitely, creating an unmaintainable hybrid. The correct order is:

**Phase 3 (this spec) completes** → first AME3 module (custom.fleet) works end-to-end → official module migration can begin (Phase 5) one module at a time, starting with `atlas.ledger` (simplest, fewest dependencies).

`packages/maps/` remains the source of truth for official module manifests during Phase 3 and Phase 4. It is not modified, extended, or deprecated in this spec. It is deprecated and removed only in Phase 7 after all official modules confirm operational from `modules/official/`.

### How this spec relates to prior AME3 specs

| Prior spec | Status | Relation to this spec |
|---|---|---|
| `2026-05-09-ame3-module-engine-foundation.md` | Draft | Provides `@atlas/module-engine` utilities (`generateCreateTableSql`, `assertSafeMigrationSql`, `createChecksum`). Used directly by ORM execution in this spec. |
| `2026-05-09-ame3-metadata-orm.md` | Draft | Provides `module-metadata-service.js`, `module-migration-service.js`, and the four Prisma metadata tables. The `applySqlMigration` function in migration service is the execution hook this spec wires into the install lifecycle. |
| `2026-05-09-ame3-custom-fleet-module.md` | Draft | Provides the `custom.fleet` module declaration files (manifest, models, views). This spec adds `api/index.js`, `fleet-service.js`, and `validators/index.js` to make it fully operational. |
| `2026-05-09-ame3-module-discovery-sync.md` | Draft | Provides the discovery service and `POST /modules/sync` integration. This spec depends on discovery being operational before install-time ORM execution is triggered. |
| `2026-05-09-ame3-package-resolution.md` | Draft | Solves the `@atlas/module-engine` import resolution for module files. This spec depends on it for `api/index.js` imports. |
