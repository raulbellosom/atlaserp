# `custom.fleet` — AME3 Sample Custom Module (Phase 2 Deliverable)

Date: 2026-05-09
Status: Draft
Author: Claude Code (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-09-ame3-custom-fleet-module.md
Plan file: docs/superpowers/plans/2026-05-09-ame3-custom-fleet-module.md

---

## 1. Feature title

`custom.fleet` — AME3 Sample Custom Fleet Module

---

## 2. Status

Draft

---

## 3. Context

`@atlas/module-engine` (Phase 1) ships `defineAtlasModule`, `defineModel`, `defineView`, `definePage`, and three registries. The APIs exist and are tested, but no real module has ever called them. Before building the discovery service, the Route Loader, or the Atlas ORM, a concrete end-to-end example is needed to:

1. Prove the AME3 API contract is ergonomic and complete enough for real module authors.
2. Establish the canonical folder structure and file naming convention that all future modules will follow.
3. Give the discovery service (Phase 2) a real target to load and validate against.

The fleet domain was chosen because it is simple (two entities, two navigation items), visually distinct (status badges are a natural custom component demo), and unambiguous (no overlap with existing Atlas core modules or the current official modules in `packages/maps/`).

---

## 4. Problem

No existing custom module uses `defineAtlasModule`, `defineModel`, `defineView`, or `definePage`. The module system documentation (docs/03_custom_modules.md) describes the API but has no running example. Without a concrete module, it is impossible to:

- Verify the file layout convention works as described.
- Verify that `defineAtlasModule` accepts the real-world manifest shape (multiple permissions, navigation entries with permissionKey, acl block).
- Verify that `defineModel` handles the field types used in real ERP entities (select with options, relation for FKs, decimal for currency).
- Verify that `defineView` produces schema objects that match what the future blueprint renderer will expect.
- Show module authors how to reference a custom registered component (`custom.fleet:VehicleStatusBadge`) from a view schema.
- Establish what `migrations/.gitkeep` and `README.md` look like inside a module.

---

## 5. Goals

1. Create a fully operational declarative module at `modules/custom/custom.fleet/` using only `@atlas/module-engine` APIs — no Prisma, no API routes, no module sync in this phase.
2. Demonstrate all four AME3 declaration APIs in a single module: `defineAtlasModule`, `defineModel` (two models), `defineView` (three views), `definePage` (one page).
3. Show the complete permission structure: `fleet.access`, four vehicle permissions, four maintenance permissions — 9 permissions total.
4. Show the navigation contract: two entries with Spanish labels and permissionKey bindings.
5. Show one custom component reference (`custom.fleet:VehicleStatusBadge`) in a view schema, and provide the corresponding React component file.
6. Show one standard Atlas component reference (`AtlasTable`, `AtlasForm`, `AtlasDetail`) as the primary renderer in each view schema.
7. Establish the `migrations/` directory with `.gitkeep` as the forward-migration placeholder convention.
8. Syntax-check all `.js` files with `node --check`. Validate all declarations by running the module's logical content through the live `@atlas/module-engine` API in a standalone smoke test.

---

## 6. Non-goals

1. API routes — no `api/index.js`, no Hono router, no HTTP endpoints in this phase.
2. Module discovery — `POST /modules/sync` does not load `modules/custom/` yet (Phase 2 discovery service).
3. Atlas ORM table provisioning — `generateCreateTableSql` is not called against a live database.
4. Blueprint rendering — `AtlasTable`, `AtlasForm`, `AtlasDetail` render nothing yet; they are referenced by key only.
5. Component Registry population — `VehicleStatusBadge.jsx` is not registered via `ComponentRegistry.register` yet (Route Loader, Phase 4).
6. Prisma model or migration — no Prisma schema change, no migration file.
7. SDK domain — no `@atlas/sdk` additions.
8. `packages/validators/` additions — validators live inside the module when needed (Phase 2+).
9. Desktop screens — no files in `apps/desktop/src/`.
10. pnpm workspace entry — `modules/custom/*` is not added to `pnpm-workspace.yaml` in this phase. Module files import from `@atlas/module-engine` using the package name; this resolves when the discovery service loads files from the API's Node.js context (Phase 2).
11. Navigation rendering in the shell — the manifest navigation entries are declared but not yet mounted into the Atlas shell sidebar.

---

## 7. Folder structure

Every file listed here is new. No existing file is modified.

```
modules/
  custom/
    custom.fleet/
      module.manifest.js          — defineAtlasModule call; the module's identity
      models/
        vehicle.model.js          — defineModel for fleet_vehicle table
        maintenance.model.js      — defineModel for fleet_maintenance table
      views/
        vehicle.table.js          — defineView (kind: TABLE) — vehicle list blueprint
        vehicle.form.js           — defineView (kind: FORM)  — create/edit vehicle blueprint
        vehicle.detail.js         — defineView (kind: DETAIL) — vehicle detail blueprint
        vehicle.page.js           — definePage — /app/m/custom.fleet/vehicles page contract
      components/
        VehicleStatusBadge.jsx    — React component for status pill; key: custom.fleet:VehicleStatusBadge
      migrations/
        .gitkeep                  — empty placeholder; forward migrations go here (Phase 3+)
      README.md                   — module description for developers
```

Total new files: 10 (plus `.gitkeep` = 11, plus `README.md` = 12).

---

## 8. Manifest contract

File: `modules/custom/custom.fleet/module.manifest.js`

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key:         'custom.fleet',
  name:        'Flota',
  version:     '0.1.0',
  kind:        'FEATURE',
  description: 'Gestión de flota vehicular: vehículos, mantenimiento y asignación de conductores.',
  icon:        'Truck',
  dependencies: [{ key: 'atlas.core' }],
  lifecycle: {
    installable:            true,
    uninstallable:          true,
    resettable:             true,
    supportsDataPurge:      true,
    defaultUninstallPolicy: 'preserve-data',
    ownedEntities:          ['Vehicle', 'Maintenance'],
    sharedEntities:         ['Company', 'AuditLog'],
  },
  permissions: [
    { key: 'fleet.access',             name: 'Acceso a Flota' },
    { key: 'fleet.vehicles.read',      name: 'Ver vehículos' },
    { key: 'fleet.vehicles.create',    name: 'Crear vehículos' },
    { key: 'fleet.vehicles.update',    name: 'Editar vehículos' },
    { key: 'fleet.vehicles.delete',    name: 'Desactivar vehículos' },
    { key: 'fleet.maintenance.read',   name: 'Ver mantenimiento' },
    { key: 'fleet.maintenance.create', name: 'Registrar mantenimiento' },
    { key: 'fleet.maintenance.update', name: 'Editar mantenimiento' },
    { key: 'fleet.maintenance.delete', name: 'Eliminar registros de mantenimiento' },
  ],
  acl: {
    module: 'fleet.access',
    actions: {
      'fleet.vehicles.read':      'fleet.vehicles.read',
      'fleet.vehicles.create':    'fleet.vehicles.create',
      'fleet.vehicles.update':    'fleet.vehicles.update',
      'fleet.vehicles.delete':    'fleet.vehicles.delete',
      'fleet.maintenance.read':   'fleet.maintenance.read',
      'fleet.maintenance.create': 'fleet.maintenance.create',
      'fleet.maintenance.update': 'fleet.maintenance.update',
      'fleet.maintenance.delete': 'fleet.maintenance.delete',
    },
    models: {
      Vehicle: {
        read:   'fleet.vehicles.read',
        create: 'fleet.vehicles.create',
        update: 'fleet.vehicles.update',
        delete: 'fleet.vehicles.delete',
      },
      Maintenance: {
        read:   'fleet.maintenance.read',
        create: 'fleet.maintenance.create',
        update: 'fleet.maintenance.update',
        delete: 'fleet.maintenance.delete',
      },
    },
  },
  navigation: [
    {
      label:         'Vehiculos',
      path:          '/app/m/custom.fleet/vehicles',
      icon:          'Truck',
      layout:        'main',
      permissionKey: 'fleet.vehicles.read',
    },
    {
      label:         'Mantenimiento',
      path:          '/app/m/custom.fleet/maintenance',
      icon:          'Wrench',
      layout:        'main',
      permissionKey: 'fleet.maintenance.read',
    },
  ],
})
```

Validation rules enforced by `defineAtlasModule`:
- `key` must have at least one dot separator and no path traversal characters. `custom.fleet` satisfies this.
- `kind` must be one of `CORE`, `FEATURE`, `INTEGRATION`, `WEBSITE`. `FEATURE` is correct.
- `version` must match semver. `0.1.0` satisfies this.
- Every `navigation[i]` must have `label`, `path` (starting with `/`), and `permissionKey`.
- Every `permissions[i]` must have `key` and `name`.

---

## 9. Models

### 9.1 Vehicle model

File: `modules/custom/custom.fleet/models/vehicle.model.js`

| Field | Type | Required | Notes |
|---|---|---|---|
| `plate` | `text` | yes | `maxLength: 20`. Unique per company (enforced via index). UI label: Matrícula |
| `brand` | `text` | yes | `maxLength: 100`. UI label: Marca |
| `model_name` | `text` | yes | `maxLength: 100`. Uses `model_name` not `model` to avoid naming collision. UI label: Modelo |
| `year` | `number` | yes | 4-digit integer. UI label: Año |
| `color` | `color` | no | Hex color string. UI label: Color |
| `status` | `select` | yes | Options: `active`, `maintenance`, `inactive`, `retired`. Default: `active`. UI label: Estado |
| `driver_id` | `relation` | no | Future FK → Employee. UI label: Conductor |
| `notes` | `textarea` | no | Free text. UI label: Notas |

Meta:
- `tableName: 'fleet_vehicle'` — valid SQL identifier; no reserved prefix.
- `companyScoped: true` — `company_id UUID NOT NULL` column is generated.
- `softDelete: true` — `enabled BOOLEAN NOT NULL DEFAULT true` column is generated.
- Indexes: `(company_id, plate)` UNIQUE; `(company_id, status)`.

### 9.2 Maintenance model

File: `modules/custom/custom.fleet/models/maintenance.model.js`

| Field | Type | Required | Notes |
|---|---|---|---|
| `vehicle_id` | `relation` | yes | FK → Vehicle. UI label: Vehículo |
| `type` | `select` | yes | Options: `preventive`, `corrective`, `inspection`. UI label: Tipo |
| `description` | `textarea` | yes | Work description. UI label: Descripción |
| `scheduled_date` | `date` | yes | Planned service date. UI label: Fecha programada |
| `completed_date` | `date` | no | Actual completion. UI label: Fecha completada |
| `cost` | `decimal` | no | `NUMERIC(18,4)`. UI label: Costo |
| `notes` | `textarea` | no | Additional notes. UI label: Notas |

Meta:
- `tableName: 'fleet_maintenance'` — valid SQL identifier; no reserved prefix.
- `companyScoped: true`.
- `softDelete: false`.
- Indexes: `(company_id, vehicle_id)`; `(company_id, scheduled_date)`.

### 9.3 Table naming convention

Both table names follow the custom module convention: `<module>_<entity>` (e.g., `fleet_vehicle`, `fleet_maintenance`). The `atlas_` prefix is reserved for official Atlas modules. The `custom_` prefix is an alternative accepted form.

---

## 10. Views

All view files export a result of `defineView`. The `schema` object is passed through as-is (the validator only checks for its presence as a plain object).

### 10.1 Vehicle table view

File: `modules/custom/custom.fleet/views/vehicle.table.js`
Kind: `TABLE`
Key: `fleet.vehicle.table`

The schema describes a tabular list of vehicles:
- Primary renderer: `AtlasTable` (standard Atlas component, referenced by string key).
- Columns: `plate`, `brand`, `model_name`, `year`, `status`.
- `status` column uses `component: 'custom.fleet:VehicleStatusBadge'` to render the custom badge.
- Toolbar action: "Crear vehículo" guarded by `fleet.vehicles.create`.
- Row actions: "Ver detalle" (`fleet.vehicles.read`), "Editar" (`fleet.vehicles.update`), "Desactivar" (`fleet.vehicles.delete`).
- `emptyState.message`: `'No hay vehículos registrados.'`

### 10.2 Vehicle form view

File: `modules/custom/custom.fleet/views/vehicle.form.js`
Kind: `FORM`
Key: `fleet.vehicle.form`

The schema describes the create/edit form:
- Primary renderer: `AtlasForm`.
- Three groups: "Información general" (plate, brand, model_name, year, color, status), "Asignación" (driver_id), "Notas" (notes).
- `submitLabel`: `'Guardar vehículo'`, `cancelLabel`: `'Cancelar'`.

### 10.3 Vehicle detail view

File: `modules/custom/custom.fleet/views/vehicle.detail.js`
Kind: `DETAIL`
Key: `fleet.vehicle.detail`

The schema describes the read-only detail panel:
- Primary renderer: `AtlasDetail`.
- Two sections: "Información general" (plate, brand, model_name, year, color, status) and "Conductor asignado" (driver_id).
- `status` field uses `component: 'custom.fleet:VehicleStatusBadge'` — this is the primary demonstration of a custom component referenced from a view schema.

---

## 11. Page

File: `modules/custom/custom.fleet/views/vehicle.page.js`

Uses `definePage` (not `defineView`). This is the page-level declaration for the vehicles listing screen.

| Field | Value |
|---|---|
| `key` | `fleet.vehicles` |
| `path` | `/app/m/custom.fleet/vehicles` |
| `title` | `Vehiculos` |
| `layout` | `main` |
| `view` | `fleet.vehicle.table` |

The `view` field references the table view key. The page renderer (Phase 6+) uses this to know which blueprint to render inside the page shell.

`definePage` validates that `key` is non-empty, `path` starts with `/`, and `title` is non-empty. All three fields are present.

---

## 12. Permissions

### Full permission catalog

| Key | Name | Guards | Gates navigation |
|---|---|---|---|
| `fleet.access` | Acceso a Flota | Module access gate | No |
| `fleet.vehicles.read` | Ver vehículos | Vehicle list and detail | Yes (`/app/m/custom.fleet/vehicles`) |
| `fleet.vehicles.create` | Crear vehículos | Vehicle create action | No |
| `fleet.vehicles.update` | Editar vehículos | Vehicle edit action | No |
| `fleet.vehicles.delete` | Desactivar vehículos | Vehicle soft-delete action | No |
| `fleet.maintenance.read` | Ver mantenimiento | Maintenance list and detail | Yes (`/app/m/custom.fleet/maintenance`) |
| `fleet.maintenance.create` | Registrar mantenimiento | Maintenance create action | No |
| `fleet.maintenance.update` | Editar mantenimiento | Maintenance edit action | No |
| `fleet.maintenance.delete` | Eliminar registros de mantenimiento | Maintenance soft-delete action | No |

Total: 9 permissions.

### Naming convention compliance

`fleet.access` — module access key, always required.
`fleet.vehicles.*` — follows `module.feature.action` pattern.
`fleet.maintenance.*` — follows `module.feature.action` pattern.

No permission key uses `atlas.*` namespace. All keys use the `fleet.*` namespace owned by the `custom.fleet` module.

---

## 13. Navigation

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Vehiculos | `/app/m/custom.fleet/vehicles` | `Truck` | `main` | `fleet.vehicles.read` |
| Mantenimiento | `/app/m/custom.fleet/maintenance` | `Wrench` | `main` | `fleet.maintenance.read` |

Notes:
- Paths use the `/app/m/<moduleKey>/` convention established in `docs/02_module_system.md`.
- Icons are Lucide icon names (strings) consumed by the Atlas shell's `NavItem` renderer.
- `layout: 'main'` places these items in the primary sidebar navigation group.
- Every navigation entry declares a `permissionKey` pointing to a `feature.read` key, not to `fleet.access`, matching the Atlas permission convention.

---

## 14. Component usage

### 14.1 Standard Atlas components

Standard components are referenced by their string key in view schemas. They are resolved by the blueprint renderer at render time (Phase 6+).

| Component key | Used in | Purpose |
|---|---|---|
| `AtlasTable` | `vehicle.table.js` → `schema.component` | Primary table renderer |
| `AtlasForm` | `vehicle.form.js` → `schema.component` | Create/edit form renderer |
| `AtlasDetail` | `vehicle.detail.js` → `schema.component` | Read-only detail renderer |

### 14.2 Custom component: `VehicleStatusBadge`

Registry key: `custom.fleet:VehicleStatusBadge`
File: `modules/custom/custom.fleet/components/VehicleStatusBadge.jsx`

Referenced in:
- `vehicle.table.js` → `columns[4].component` (status column)
- `vehicle.detail.js` → `sections[0].fields[5].component` (status field in detail)

**Component contract:**
- Props: `{ status: string }` where status is one of `active`, `maintenance`, `inactive`, `retired`.
- Renders a pill badge with a Spanish label and Tailwind color class.
- Falls back gracefully to the raw status string for unknown values.
- Pure presentation component — no side effects, no API calls, no context dependency.

**Status mapping:**

| status | Spanish label | Tailwind classes |
|---|---|---|
| `active` | Activo | `bg-green-100 text-green-800` |
| `maintenance` | Mantenimiento | `bg-yellow-100 text-yellow-800` |
| `inactive` | Inactivo | `bg-gray-100 text-gray-800` |
| `retired` | Retirado | `bg-red-100 text-red-800` |

**Registration (Phase 4+):** The Route Loader will call `componentRegistry.register('custom.fleet:VehicleStatusBadge', VehicleStatusBadge)` when it discovers the module. This is not done in this phase. The `.jsx` file is created here so the component exists when Phase 4 wires it up.

### 14.3 Component key format

`custom.fleet:VehicleStatusBadge` follows the format `moduleKey:ComponentName`:
- `moduleKey` segment: `custom.fleet` (letters, dots, allowed by `ComponentRegistry` regex)
- `ComponentName` segment: `VehicleStatusBadge` (starts with uppercase letter)

This key is valid for `ComponentRegistry.register('custom.fleet:VehicleStatusBadge', ...)`.

---

## 15. Prisma impact

None. Zero changes to `prisma/schema.prisma`, zero new migration files, zero Prisma client calls.

The `models/*.model.js` files declare entities for the Atlas ORM (Phase 3). Until Phase 3 provisions these tables, no physical tables exist for the fleet module.

---

## 16. API impact

None. No `api/index.js`, no HTTP routes, no SDK additions in this phase.

---

## 17. Security considerations

**Key isolation:** `custom.fleet` uses the `fleet.*` permission namespace. The discovery service (Phase 2) will enforce that only modules in `modules/custom/` or `modules/official/` (the `atlas.*` namespace) may declare those namespaces respectively. `validateManifest` validates key structure only; namespace ownership enforcement happens at discovery time.

**Table name safety:** `fleet_vehicle` and `fleet_maintenance` both pass `IDENTIFIER_RE` (`/^[a-zA-Z_][a-zA-Z0-9_]*$/`) and do not start with `pg_`, `_pg_`, or `sql_`. `generateCreateTableSql` would accept both names when called by the Atlas ORM in Phase 3.

**VehicleStatusBadge XSS:** The component renders only from a closed `STATUS_CONFIG` lookup table. Unknown status values fall back to displaying the raw status string inside a `<span>`. The `status` prop is rendered as text content (not `dangerouslySetInnerHTML`), so XSS is not possible.

**No path traversal in module key:** `custom.fleet` contains one dot, no slashes, no backslashes, no `..`. `validateManifest` would accept it.

---

## 18. Acceptance criteria

1. `modules/custom/custom.fleet/module.manifest.js` exists and calling `defineAtlasModule` with its manifest body does not throw.
2. `validateManifest` called with the manifest body returns `{ valid: true, errors: [] }`.
3. The manifest has exactly 9 permissions in the `permissions` array.
4. Both navigation entries have `permissionKey` set and each `path` starts with `/`.
5. `modules/custom/custom.fleet/models/vehicle.model.js` exports a valid `defineModel` result with `tableName === 'fleet_vehicle'`, `companyScoped === true`, `softDelete === true`, and 8 fields.
6. `validateModel` called with the vehicle model body returns `{ valid: true, errors: [] }`.
7. `modules/custom/custom.fleet/models/maintenance.model.js` exports a valid `defineModel` result with `tableName === 'fleet_maintenance'` and 7 fields.
8. `validateModel` called with the maintenance model body returns `{ valid: true, errors: [] }`.
9. `vehicle.table.js` exports a `defineView` result with `kind === 'TABLE'` and its schema references `'custom.fleet:VehicleStatusBadge'` in the status column.
10. `vehicle.form.js` exports a `defineView` result with `kind === 'FORM'`.
11. `vehicle.detail.js` exports a `defineView` result with `kind === 'DETAIL'` and its schema references `'custom.fleet:VehicleStatusBadge'` in the status field.
12. `vehicle.page.js` exports a `definePage` result with `key === 'fleet.vehicles'` and `path === '/app/m/custom.fleet/vehicles'`.
13. `VehicleStatusBadge.jsx` exists, exports a default function, and references all four status values (`active`, `maintenance`, `inactive`, `retired`).
14. `node --check` passes on all `.js` files in `modules/custom/custom.fleet/` (excluding `.jsx`).
15. A standalone smoke test that calls `defineAtlasModule`, `defineModel` (×2), `defineView` (×3), and `definePage` with the module's actual content (imported from `packages/module-engine/src/index.js` directly) exits 0 with all validations reporting success.
16. `pnpm --filter ./apps/desktop build:web` exits 0 (no regression in existing build).

---

## 19. Validation commands

```bash
# Step 1: Syntax check all JS files in the module
node --check modules/custom/custom.fleet/module.manifest.js
node --check modules/custom/custom.fleet/models/vehicle.model.js
node --check modules/custom/custom.fleet/models/maintenance.model.js
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
node --check modules/custom/custom.fleet/views/vehicle.page.js
# Expected: all exit 0 silently

# Step 2: Standalone smoke test (Phase 1 workaround — uses direct path to @atlas/module-engine)
# @atlas/module-engine resolves from packages/module-engine/src/index.js.
# This validates the CONTENT of each file against the live AME3 API.
node -e "
import { defineAtlasModule, validateManifest,
         defineModel, validateModel,
         defineView,  validateView,
         definePage,  validatePage } from './packages/module-engine/src/index.js'

// --- manifest ---
const manifest = defineAtlasModule({
  key: 'custom.fleet', name: 'Flota', version: '0.1.0', kind: 'FEATURE',
  permissions: [
    { key: 'fleet.access',             name: 'Acceso a Flota' },
    { key: 'fleet.vehicles.read',      name: 'Ver vehículos' },
    { key: 'fleet.vehicles.create',    name: 'Crear vehículos' },
    { key: 'fleet.vehicles.update',    name: 'Editar vehículos' },
    { key: 'fleet.vehicles.delete',    name: 'Desactivar vehículos' },
    { key: 'fleet.maintenance.read',   name: 'Ver mantenimiento' },
    { key: 'fleet.maintenance.create', name: 'Registrar mantenimiento' },
    { key: 'fleet.maintenance.update', name: 'Editar mantenimiento' },
    { key: 'fleet.maintenance.delete', name: 'Eliminar registros de mantenimiento' },
  ],
  navigation: [
    { label: 'Vehiculos',      path: '/app/m/custom.fleet/vehicles',   icon: 'Truck',  layout: 'main', permissionKey: 'fleet.vehicles.read' },
    { label: 'Mantenimiento',  path: '/app/m/custom.fleet/maintenance', icon: 'Wrench', layout: 'main', permissionKey: 'fleet.maintenance.read' },
  ],
})
console.log('manifest key:', manifest.key)
console.log('permissions:', manifest.permissions.length)
console.log('navigation:',  manifest.navigation.length)

// --- vehicle model ---
const vm = validateModel({ key: 'vehicle', tableName: 'fleet_vehicle', companyScoped: true, softDelete: true,
  fields: [
    { name: 'plate',      type: 'text' },
    { name: 'brand',      type: 'text' },
    { name: 'model_name', type: 'text' },
    { name: 'year',       type: 'number' },
    { name: 'color',      type: 'color' },
    { name: 'status',     type: 'select' },
    { name: 'driver_id',  type: 'relation' },
    { name: 'notes',      type: 'textarea' },
  ]})
console.log('vehicle model valid:', vm.valid, vm.errors.length === 0 ? '' : vm.errors)

// --- maintenance model ---
const mm = validateModel({ key: 'maintenance', tableName: 'fleet_maintenance', companyScoped: true,
  fields: [
    { name: 'vehicle_id',     type: 'relation' },
    { name: 'type',           type: 'select' },
    { name: 'description',    type: 'textarea' },
    { name: 'scheduled_date', type: 'date' },
    { name: 'completed_date', type: 'date' },
    { name: 'cost',           type: 'decimal' },
    { name: 'notes',          type: 'textarea' },
  ]})
console.log('maintenance model valid:', mm.valid, mm.errors.length === 0 ? '' : mm.errors)

// --- views ---
const tv = validateView({ key: 'fleet.vehicle.table',  kind: 'TABLE',  schema: { entity: 'vehicle' } })
const fv = validateView({ key: 'fleet.vehicle.form',   kind: 'FORM',   schema: { entity: 'vehicle' } })
const dv = validateView({ key: 'fleet.vehicle.detail', kind: 'DETAIL', schema: { entity: 'vehicle' } })
console.log('table view valid:', tv.valid)
console.log('form view valid:', fv.valid)
console.log('detail view valid:', dv.valid)

// --- page ---
const pp = validatePage({ key: 'fleet.vehicles', path: '/app/m/custom.fleet/vehicles', title: 'Vehiculos' })
console.log('page valid:', pp.valid)

console.log('ALL DECLARATIONS OK')
" --input-type=module
# Expected output:
# manifest key: custom.fleet
# permissions: 9
# navigation: 2
# vehicle model valid: true
# maintenance model valid: true
# table view valid: true
# form view valid: true
# detail view valid: true
# page valid: true
# ALL DECLARATIONS OK

# Step 3: Desktop build regression
pnpm --filter ./apps/desktop build:web
# Expected: exits 0
```

---

## 20. Rollback plan

This phase creates only new files in `modules/custom/`. No existing file is modified. Rollback is a directory deletion:

```bash
rm -rf modules/custom/custom.fleet/
```

No Prisma migrations, no database changes, no seed modifications. Rollback is completely safe.

---

## 21. Future enhancements

1. API routes (`api/index.js`) — Hono router with CRUD endpoints for vehicles and maintenance records. Phase 2.
2. Module discovery — the discovery service loads and registers `module.manifest.js` via `POST /modules/sync`. Phase 2.
3. Atlas ORM provisioning — `fleet_vehicle` and `fleet_maintenance` tables created in the database via `generateCreateTableSql`. Phase 3.
4. ComponentRegistry population — `VehicleStatusBadge` registered at module load time via the Route Loader. Phase 4.
5. Blueprint rendering — `AtlasTable`, `AtlasForm`, `AtlasDetail`, `VehicleStatusBadge` render actual data. Phase 6.
6. Maintenance module views — `maintenance.table.js`, `maintenance.form.js`, `maintenance.detail.js`. Phase 2+.
7. Contact/Employee relation — `driver_id` relation linked to a real Employee entity once the HR module exposes one. Phase 5+.
8. CSV export for vehicle fleet list. Future.
9. Audit log for vehicle status changes. Future.
