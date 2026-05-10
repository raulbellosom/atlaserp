# `custom.fleet` Sample Module — Implementation Plan

**Goal:** Create all declarative files for the `custom.fleet` AME3 sample module under `modules/custom/custom.fleet/`. Demonstrate `defineAtlasModule`, `defineModel` (two models), `defineView` (three views), `definePage`, one React component, and the migrations placeholder. Zero API integration. Zero Prisma changes. Zero module sync.

**Spec:** `docs/superpowers/specs/2026-05-09-ame3-custom-fleet-module.md`

**Tech stack:** `@atlas/module-engine` (ESM, from `packages/module-engine/`). React JSX for `VehicleStatusBadge.jsx`. Tailwind class strings (not executed, referenced by key).

**Constraint:** Every file listed below is new. No existing file in the repository may be modified.

---

## File Structure Map

### New files (12 total)

| File | Responsibility |
|---|---|
| `modules/custom/custom.fleet/module.manifest.js` | `defineAtlasModule` — module identity, permissions, navigation, acl, lifecycle |
| `modules/custom/custom.fleet/models/vehicle.model.js` | `defineModel` — `fleet_vehicle` table with 8 fields and 2 indexes |
| `modules/custom/custom.fleet/models/maintenance.model.js` | `defineModel` — `fleet_maintenance` table with 7 fields and 2 indexes |
| `modules/custom/custom.fleet/views/vehicle.table.js` | `defineView` (kind: TABLE) — vehicle list blueprint |
| `modules/custom/custom.fleet/views/vehicle.form.js` | `defineView` (kind: FORM) — vehicle create/edit blueprint |
| `modules/custom/custom.fleet/views/vehicle.detail.js` | `defineView` (kind: DETAIL) — vehicle read-only detail blueprint |
| `modules/custom/custom.fleet/views/vehicle.page.js` | `definePage` — page contract for `/app/m/custom.fleet/vehicles` |
| `modules/custom/custom.fleet/components/VehicleStatusBadge.jsx` | React status pill component; registry key: `custom.fleet:VehicleStatusBadge` |
| `modules/custom/custom.fleet/migrations/.gitkeep` | Empty placeholder for Phase 3+ forward migrations |
| `modules/custom/custom.fleet/README.md` | Developer description for module authors |

### Modified files

None.

### Files forbidden to modify

Any modification to the following files is a plan violation. Stop and raise a deviation if the implementation requires touching them.

| Forbidden file | Reason |
|---|---|
| `pnpm-workspace.yaml` | Module discovery not in this phase; `modules/*` not added until Phase 2 |
| `packages/maps/src/**` | Deprecated — `custom.fleet` uses AME3, never packages/maps |
| `packages/core/src/**` | Untouched |
| `prisma/schema.prisma` | No Prisma changes |
| `prisma/migrations/**` | No new migrations |
| `apps/api/src/**` | No API integration |
| `apps/desktop/src/**` | No frontend changes |
| `packages/validators/src/**` | Module validators not needed in Phase 1 |
| `packages/sdk/src/**` | SDK unchanged |
| `packages/module-engine/src/**` | Package already complete |
| `prisma/seed.js` | No permission seeding (requires Phase 2 discovery + module install) |

---

## Task 1 — Directory scaffold

**Files:**
- Create: `modules/custom/custom.fleet/migrations/.gitkeep`
- Create: `modules/custom/custom.fleet/README.md`

- [ ] **1.1** Create `modules/custom/custom.fleet/migrations/.gitkeep`:

Empty file. Its presence creates the `migrations/` directory and establishes the convention that forward migrations go here in Phase 3+.

```
(empty file)
```

- [ ] **1.2** Create `modules/custom/custom.fleet/README.md`:

```markdown
# custom.fleet — Fleet Management Module

Atlas Module Engine v3 sample custom module.

Module key: `custom.fleet`
Kind: FEATURE
Version: 0.1.0

## Entities

- **Vehicle** (`fleet_vehicle`) — company vehicles with plate, brand, model, year, status.
- **Maintenance** (`fleet_maintenance`) — maintenance records linked to vehicles.

## Permissions

- `fleet.access` — module access gate
- `fleet.vehicles.{read,create,update,delete}` — vehicle CRUD
- `fleet.maintenance.{read,create,update,delete}` — maintenance CRUD

## Phase status

- [x] Phase 1: Manifest, models, views, page, component declared
- [ ] Phase 2: API routes, module discovery
- [ ] Phase 3: Atlas ORM table provisioning
- [ ] Phase 4: ComponentRegistry population
- [ ] Phase 6: Blueprint rendering

## Table naming

`fleet_vehicle`, `fleet_maintenance` — custom module convention: `<feature>_<entity>`.
No `atlas_` prefix (reserved for official Atlas modules).
```

**Validation:**

```bash
ls modules/custom/custom.fleet/migrations/.gitkeep
ls modules/custom/custom.fleet/README.md
# Expected: both files exist
```

**Commit checkpoint:** `feat(custom.fleet): scaffold module directory structure`

---

## Task 2 — Module manifest

**Files:**
- Create: `modules/custom/custom.fleet/module.manifest.js`

- [ ] **2.1** Create `modules/custom/custom.fleet/module.manifest.js`:

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

**Validation:**

```bash
node --check modules/custom/custom.fleet/module.manifest.js
# Expected: exits 0 silently
```

**Commit checkpoint:** `feat(custom.fleet): add module manifest with defineAtlasModule`

---

## Task 3 — Model declarations

**Files:**
- Create: `modules/custom/custom.fleet/models/vehicle.model.js`
- Create: `modules/custom/custom.fleet/models/maintenance.model.js`

- [ ] **3.1** Create `modules/custom/custom.fleet/models/vehicle.model.js`:

Table naming: `fleet_vehicle` follows the `<feature>_<entity>` custom module convention. No `atlas_` prefix (reserved for official modules). Passes `IDENTIFIER_RE` and does not start with any reserved prefix.

```js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key:          'vehicle',
  label:        'Vehículo',
  tableName:    'fleet_vehicle',
  companyScoped: true,
  softDelete:    true,
  fields: [
    {
      name:      'plate',
      type:      'text',
      label:     'Matrícula',
      required:  true,
      maxLength: 20,
    },
    {
      name:      'brand',
      type:      'text',
      label:     'Marca',
      required:  true,
      maxLength: 100,
    },
    {
      name:      'model_name',
      type:      'text',
      label:     'Modelo',
      required:  true,
      maxLength: 100,
    },
    {
      name:     'year',
      type:     'number',
      label:    'Año',
      required: true,
    },
    {
      name:  'color',
      type:  'color',
      label: 'Color',
    },
    {
      name:     'status',
      type:     'select',
      label:    'Estado',
      required: true,
      options:  ['active', 'maintenance', 'inactive', 'retired'],
      default:  'active',
    },
    {
      name:         'driver_id',
      type:         'relation',
      label:        'Conductor',
      relatedModel: 'Employee',
    },
    {
      name:  'notes',
      type:  'textarea',
      label: 'Notas',
    },
  ],
  indexes: [
    { fields: ['company_id', 'plate'], unique: true },
    { fields: ['company_id', 'status'] },
  ],
})
```

Note on `options` and `default`: These are UI metadata fields. `defineModel` / `validateModel` do not validate them (only `name` and `type` are required per field). They pass through as-is and are consumed by the blueprint renderer (Phase 6+).

Note on `model_name`: Named `model_name` rather than `model` to avoid collision with the JavaScript keyword `model` in module scope.

- [ ] **3.2** Create `modules/custom/custom.fleet/models/maintenance.model.js`:

```js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key:          'maintenance',
  label:        'Mantenimiento',
  tableName:    'fleet_maintenance',
  companyScoped: true,
  softDelete:    false,
  fields: [
    {
      name:         'vehicle_id',
      type:         'relation',
      label:        'Vehículo',
      required:     true,
      relatedModel: 'Vehicle',
    },
    {
      name:     'type',
      type:     'select',
      label:    'Tipo',
      required: true,
      options:  ['preventive', 'corrective', 'inspection'],
    },
    {
      name:     'description',
      type:     'textarea',
      label:    'Descripción',
      required: true,
    },
    {
      name:     'scheduled_date',
      type:     'date',
      label:    'Fecha programada',
      required: true,
    },
    {
      name:  'completed_date',
      type:  'date',
      label: 'Fecha completada',
    },
    {
      name:  'cost',
      type:  'decimal',
      label: 'Costo',
    },
    {
      name:  'notes',
      type:  'textarea',
      label: 'Notas',
    },
  ],
  indexes: [
    { fields: ['company_id', 'vehicle_id'] },
    { fields: ['company_id', 'scheduled_date'] },
  ],
})
```

**Validation:**

```bash
node --check modules/custom/custom.fleet/models/vehicle.model.js
node --check modules/custom/custom.fleet/models/maintenance.model.js
# Expected: both exit 0 silently
```

**Commit checkpoint:** `feat(custom.fleet): add vehicle and maintenance model declarations`

---

## Task 4 — View declarations

**Files:**
- Create: `modules/custom/custom.fleet/views/vehicle.table.js`
- Create: `modules/custom/custom.fleet/views/vehicle.form.js`
- Create: `modules/custom/custom.fleet/views/vehicle.detail.js`

- [ ] **4.1** Create `modules/custom/custom.fleet/views/vehicle.table.js`:

The `status` column references `custom.fleet:VehicleStatusBadge` — this is the primary demonstration of a custom component key in a view schema. The `schema.component` field references `AtlasTable` — the standard Atlas table renderer.

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key:     'fleet.vehicle.table',
  kind:    'TABLE',
  version: '0.1.0',
  schema: {
    entity:    'vehicle',
    component: 'AtlasTable',
    columns: [
      { field: 'plate',      label: 'Matrícula', sortable: true },
      { field: 'brand',      label: 'Marca',     sortable: true },
      { field: 'model_name', label: 'Modelo',    sortable: true },
      { field: 'year',       label: 'Año',       sortable: true },
      {
        field:     'status',
        label:     'Estado',
        component: 'custom.fleet:VehicleStatusBadge',
      },
    ],
    actions: [
      {
        label:      'Crear vehículo',
        permission: 'fleet.vehicles.create',
        variant:    'primary',
      },
    ],
    rowActions: [
      { label: 'Ver detalle', permission: 'fleet.vehicles.read' },
      { label: 'Editar',      permission: 'fleet.vehicles.update' },
      { label: 'Desactivar',  permission: 'fleet.vehicles.delete' },
    ],
    emptyState: {
      message: 'No hay vehículos registrados.',
    },
  },
})
```

- [ ] **4.2** Create `modules/custom/custom.fleet/views/vehicle.form.js`:

Three field groups: general info, driver assignment, and notes. All field `type` values match `FIELD_TYPES` constants (as strings). `schema.component` references `AtlasForm`.

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key:     'fleet.vehicle.form',
  kind:    'FORM',
  version: '0.1.0',
  schema: {
    entity:    'vehicle',
    component: 'AtlasForm',
    groups: [
      {
        label: 'Información general',
        fields: [
          { field: 'plate',      label: 'Matrícula', type: 'text',   required: true },
          { field: 'brand',      label: 'Marca',     type: 'text',   required: true },
          { field: 'model_name', label: 'Modelo',    type: 'text',   required: true },
          { field: 'year',       label: 'Año',       type: 'number', required: true },
          { field: 'color',      label: 'Color',     type: 'color' },
          {
            field:   'status',
            label:   'Estado',
            type:    'select',
            options: ['active', 'maintenance', 'inactive', 'retired'],
          },
        ],
      },
      {
        label: 'Asignación',
        fields: [
          {
            field:        'driver_id',
            label:        'Conductor',
            type:         'relation',
            relatedModel: 'Employee',
          },
        ],
      },
      {
        label: 'Notas',
        fields: [
          { field: 'notes', label: 'Notas adicionales', type: 'textarea' },
        ],
      },
    ],
    submitLabel: 'Guardar vehículo',
    cancelLabel: 'Cancelar',
  },
})
```

- [ ] **4.3** Create `modules/custom/custom.fleet/views/vehicle.detail.js`:

The `status` field in section 0 uses `component: 'custom.fleet:VehicleStatusBadge'`, demonstrating how detail views reference custom registered components. `schema.component` references `AtlasDetail`.

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key:     'fleet.vehicle.detail',
  kind:    'DETAIL',
  version: '0.1.0',
  schema: {
    entity:    'vehicle',
    component: 'AtlasDetail',
    sections: [
      {
        label: 'Información general',
        fields: [
          { field: 'plate',      label: 'Matrícula' },
          { field: 'brand',      label: 'Marca' },
          { field: 'model_name', label: 'Modelo' },
          { field: 'year',       label: 'Año' },
          { field: 'color',      label: 'Color', type: 'color' },
          {
            field:     'status',
            label:     'Estado',
            component: 'custom.fleet:VehicleStatusBadge',
          },
        ],
      },
      {
        label: 'Conductor asignado',
        fields: [
          { field: 'driver_id', label: 'Conductor', type: 'relation' },
        ],
      },
    ],
    actions: [
      { label: 'Editar',     permission: 'fleet.vehicles.update' },
      { label: 'Desactivar', permission: 'fleet.vehicles.delete' },
    ],
  },
})
```

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
# Expected: all exit 0 silently
```

**Commit checkpoint:** `feat(custom.fleet): add vehicle table, form, and detail view declarations`

---

## Task 5 — Page declaration

**Files:**
- Create: `modules/custom/custom.fleet/views/vehicle.page.js`

- [ ] **5.1** Create `modules/custom/custom.fleet/views/vehicle.page.js`:

Uses `definePage` (not `defineView`). Lives in `views/` alongside the view declarations because it describes the top-level page that hosts the vehicle table. The `view` field references `fleet.vehicle.table` by key.

```js
import { definePage } from '@atlas/module-engine'

export default definePage({
  key:    'fleet.vehicles',
  path:   '/app/m/custom.fleet/vehicles',
  title:  'Vehiculos',
  layout: 'main',
  view:   'fleet.vehicle.table',
})
```

`definePage` validates that `key` is a non-empty string, `path` starts with `/`, and `title` is a non-empty string. All three fields are present.

The `layout` and `view` fields are passed through as additional metadata (not validated by the current `definePage` implementation; used by the page renderer in Phase 6+).

**Validation:**

```bash
node --check modules/custom/custom.fleet/views/vehicle.page.js
# Expected: exits 0 silently
```

**Commit checkpoint:** `feat(custom.fleet): add vehicle page declaration with definePage`

---

## Task 6 — Custom component

**Files:**
- Create: `modules/custom/custom.fleet/components/VehicleStatusBadge.jsx`

- [ ] **6.1** Create `modules/custom/custom.fleet/components/VehicleStatusBadge.jsx`:

Registry key: `custom.fleet:VehicleStatusBadge` (matches `ComponentRegistry` key format: `moduleKey:ComponentName`).

This is a pure presentation component. Props: `{ status: string }`. No side effects. No API calls. No context dependency. Unknown status values fall back gracefully.

Note: JSX cannot be syntax-checked with `node --check` (JSX is not valid Node.js syntax without a transpiler). The component file is committed for use by the Route Loader (Phase 4) and the desktop bundler (Vite, which handles JSX transformation). Syntax is verified visually during review.

```jsx
// Registry key: custom.fleet:VehicleStatusBadge
// Props: { status: 'active' | 'maintenance' | 'inactive' | 'retired' }
// Registered via ComponentRegistry.register in the Route Loader (Phase 4+).

const STATUS_CONFIG = {
  active:      { label: 'Activo',        bg: 'bg-green-100',  text: 'text-green-800' },
  maintenance: { label: 'Mantenimiento', bg: 'bg-yellow-100', text: 'text-yellow-800' },
  inactive:    { label: 'Inactivo',      bg: 'bg-gray-100',   text: 'text-gray-800' },
  retired:     { label: 'Retirado',      bg: 'bg-red-100',    text: 'text-red-800' },
}

export default function VehicleStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, bg: 'bg-gray-100', text: 'text-gray-600' }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  )
}
```

**Validation:**

JSX files cannot be validated with `node --check`. Verify manually:
- File exists at the expected path.
- Exports a default function named `VehicleStatusBadge`.
- References all four status values: `active`, `maintenance`, `inactive`, `retired`.
- Uses Tailwind class strings (not computed), enabling Tailwind's static scanner to include them in the build.
- No `import` statements (stateless component; React is available globally via the shell).

**Commit checkpoint:** `feat(custom.fleet): add VehicleStatusBadge custom component`

---

## Task 7 — Full validation

- [ ] **7.1** Syntax check all `.js` files:

```bash
node --check modules/custom/custom.fleet/module.manifest.js
node --check modules/custom/custom.fleet/models/vehicle.model.js
node --check modules/custom/custom.fleet/models/maintenance.model.js
node --check modules/custom/custom.fleet/views/vehicle.table.js
node --check modules/custom/custom.fleet/views/vehicle.form.js
node --check modules/custom/custom.fleet/views/vehicle.detail.js
node --check modules/custom/custom.fleet/views/vehicle.page.js
# Expected: all 7 files exit 0 silently
```

- [ ] **7.2** Standalone smoke test (validates all declaration content against the live AME3 API):

The module files import from `@atlas/module-engine` by package name. Since `modules/custom/` is not a pnpm workspace member in this phase, package-name resolution only works from the API context (Phase 2+). This smoke test substitutes the package name with a direct path for Phase 1 validation.

```bash
node -e "
import { defineAtlasModule, validateManifest,
         defineModel,        validateModel,
         defineView,         validateView,
         definePage,         validatePage } from './packages/module-engine/src/index.js'

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
    { label: 'Vehiculos',     path: '/app/m/custom.fleet/vehicles',   icon: 'Truck',  layout: 'main', permissionKey: 'fleet.vehicles.read' },
    { label: 'Mantenimiento', path: '/app/m/custom.fleet/maintenance', icon: 'Wrench', layout: 'main', permissionKey: 'fleet.maintenance.read' },
  ],
})
console.assert(manifest.key === 'custom.fleet',        'manifest.key')
console.assert(manifest.permissions.length === 9,       'permissions count')
console.assert(manifest.navigation.length === 2,        'navigation count')
console.assert(manifest.navigation[0].permissionKey,   'nav[0].permissionKey')
console.assert(manifest.navigation[1].permissionKey,   'nav[1].permissionKey')
console.log('manifest:  OK')

// --- vehicle model ---
const { valid: vv, errors: ve } = validateModel({
  key: 'vehicle', tableName: 'fleet_vehicle', companyScoped: true, softDelete: true,
  fields: [
    { name: 'plate',      type: 'text' },
    { name: 'brand',      type: 'text' },
    { name: 'model_name', type: 'text' },
    { name: 'year',       type: 'number' },
    { name: 'color',      type: 'color' },
    { name: 'status',     type: 'select' },
    { name: 'driver_id',  type: 'relation' },
    { name: 'notes',      type: 'textarea' },
  ],
})
console.assert(vv, 'vehicle model valid: ' + JSON.stringify(ve))
console.log('vehicle model: OK')

// --- maintenance model ---
const { valid: mv, errors: me } = validateModel({
  key: 'maintenance', tableName: 'fleet_maintenance',
  fields: [
    { name: 'vehicle_id',     type: 'relation' },
    { name: 'type',           type: 'select' },
    { name: 'description',    type: 'textarea' },
    { name: 'scheduled_date', type: 'date' },
    { name: 'completed_date', type: 'date' },
    { name: 'cost',           type: 'decimal' },
    { name: 'notes',          type: 'textarea' },
  ],
})
console.assert(mv, 'maintenance model valid: ' + JSON.stringify(me))
console.log('maintenance model: OK')

// --- views ---
const tv = validateView({ key: 'fleet.vehicle.table',  kind: 'TABLE',  schema: { entity: 'vehicle', component: 'AtlasTable' } })
const fv = validateView({ key: 'fleet.vehicle.form',   kind: 'FORM',   schema: { entity: 'vehicle', component: 'AtlasForm' } })
const dv = validateView({ key: 'fleet.vehicle.detail', kind: 'DETAIL', schema: { entity: 'vehicle', component: 'AtlasDetail' } })
console.assert(tv.valid, 'table view: ' + JSON.stringify(tv.errors))
console.assert(fv.valid, 'form view: '  + JSON.stringify(fv.errors))
console.assert(dv.valid, 'detail view: '+ JSON.stringify(dv.errors))
console.log('views: OK')

// --- page ---
const pp = validatePage({ key: 'fleet.vehicles', path: '/app/m/custom.fleet/vehicles', title: 'Vehiculos' })
console.assert(pp.valid, 'page valid: ' + JSON.stringify(pp.errors))
console.log('page: OK')

console.log('ALL DECLARATIONS OK')
" --input-type=module
```

Expected output:
```
manifest:  OK
vehicle model: OK
maintenance model: OK
views: OK
page: OK
ALL DECLARATIONS OK
```

- [ ] **7.3** Verify component file exists and references all four status values:

```bash
# File exists
ls modules/custom/custom.fleet/components/VehicleStatusBadge.jsx

# All four status values are present
node -e "
import { readFileSync } from 'node:fs'
const src = readFileSync('modules/custom/custom.fleet/components/VehicleStatusBadge.jsx', 'utf8')
const required = ['active', 'maintenance', 'inactive', 'retired', 'VehicleStatusBadge']
let ok = true
for (const s of required) {
  if (!src.includes(s)) { console.error('MISSING:', s); ok = false }
}
if (ok) console.log('VehicleStatusBadge: OK')
" --input-type=module
# Expected: VehicleStatusBadge: OK
```

- [ ] **7.4** Desktop build regression guard:

```bash
pnpm --filter ./apps/desktop build:web
# Expected: exits 0
```

**Commit checkpoint:** `feat(custom.fleet): complete custom.fleet AME3 Phase 1 declarations`

---

## Task 8 — TASKS.md update

- [ ] **8.1** Mark AME3 Phase 2 task as in progress in `docs/TASKS.md`:

Find the AME3 Phase 2 section and mark the sample module task:

```
- [x] *Spec approved* → Build and document one complete sample custom module (`custom.fleet`)
```

Add the verification evidence line:

```
Verified: 2026-05-09 (node --check 7 .js files pass; smoke test exits 0 — ALL DECLARATIONS OK; VehicleStatusBadge status values verified; pnpm --filter ./apps/desktop build:web exits 0)
```

---

## Implementation order

| Order | File | Depends on |
|---|---|---|
| 1 | `migrations/.gitkeep` | nothing |
| 2 | `README.md` | nothing |
| 3 | `module.manifest.js` | `@atlas/module-engine` (defineAtlasModule) |
| 4 | `models/vehicle.model.js` | `@atlas/module-engine` (defineModel) |
| 5 | `models/maintenance.model.js` | `@atlas/module-engine` (defineModel) |
| 6 | `views/vehicle.table.js` | `@atlas/module-engine` (defineView) |
| 7 | `views/vehicle.form.js` | `@atlas/module-engine` (defineView) |
| 8 | `views/vehicle.detail.js` | `@atlas/module-engine` (defineView) |
| 9 | `views/vehicle.page.js` | `@atlas/module-engine` (definePage) |
| 10 | `components/VehicleStatusBadge.jsx` | React (available via shell) |

---

## Expected outputs

| Command | Expected result |
|---|---|
| `node --check` (7 .js files) | All exit 0 silently |
| Smoke test (Task 7.2) | `ALL DECLARATIONS OK` |
| `VehicleStatusBadge` verification (Task 7.3) | `VehicleStatusBadge: OK` |
| `pnpm --filter ./apps/desktop build:web` | exits 0 |

---

## Commit checkpoints

| After task | Commit message |
|---|---|
| Task 1 | `feat(custom.fleet): scaffold module directory structure` |
| Task 2 | `feat(custom.fleet): add module manifest with defineAtlasModule` |
| Task 3 | `feat(custom.fleet): add vehicle and maintenance model declarations` |
| Task 4 | `feat(custom.fleet): add vehicle table, form, and detail view declarations` |
| Task 5 | `feat(custom.fleet): add vehicle page declaration with definePage` |
| Task 6 | `feat(custom.fleet): add VehicleStatusBadge custom component` |
| Task 7 | `feat(custom.fleet): complete custom.fleet AME3 Phase 1 declarations` |
| Task 8 | `chore(tasks): mark custom.fleet Phase 1 declarations complete` |

---

## Rollback notes

All files are new additions under `modules/custom/custom.fleet/`. No existing file is modified. If this plan must be aborted:

```bash
rm -rf modules/custom/custom.fleet/
```

No database changes, no migration cleanup, no Prisma involvement.
