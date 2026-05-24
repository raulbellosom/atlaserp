# Atlas Module Engine v3 — Architecture

Status: Active  
Date: 2026-05-09  
Authority: This document supersedes any prior module architecture description.

---

> **"Prisma models Atlas Core. Atlas Module Engine models ERP modules."**
>
> **"Atlas ERP is no longer an ERP with modules. Atlas ERP is a module engine that ships ERP modules."**

---

## 1. Problem Statement

The original Atlas ERP module system required every new feature — including any future community or partner module — to modify multiple core files:

- `packages/maps/src/feature-modules.js` — hardcode the manifest
- `prisma/schema.prisma` — add Prisma models for module-owned tables
- `apps/api/src/index.js` — mount API routes manually
- `apps/desktop/src/` — add frontend screens and route registrations
- `packages/validators/src/index.js` — add Zod schemas

This model cannot scale. It forces every module to be baked into the core application at build time. There is no path for a partner or community developer to add a module without forking the entire repository.

Atlas Module Engine v3 (AME3) eliminates this constraint. It is not a layer on top of the old system. It replaces the old system.

---

## 2. Core Principle

A module in AME3 is a self-contained directory. It declares everything it needs — data models, views, pages, navigation, permissions, API endpoints, and optionally custom React components — inside its own folder. The Atlas Core reads these declarations and drives all behavior from them.

**No new module should ever require editing:**
- `packages/maps/src/feature-modules.js`
- `prisma/schema.prisma` (for module-owned business tables)
- `apps/api/src/index.js` (to mount module routes)
- `apps/desktop/src/main.jsx` or any hardcoded route file
- `packages/validators/src/index.js` (for module-local validators)

If a proposed module requires any of the above, the implementation does not yet conform to AME3. It must wait until the relevant AME3 layer is available, or the AME3 layer must be built first.

---

## 3. Module API

Every AME3 module uses `defineAtlasModule` from `@atlas/module-engine`:

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.fleet',
  name: 'Flota',
  version: '0.1.0',
  // ...
})
```

`createModuleManifest` from `@atlas/core` is **deprecated**. It exists only in legacy code during migration. Documentation does not present it as a recommended path. New modules must not use it.

---

## 4. Module Locations

| Directory | Namespace | Owner |
|---|---|---|
| `modules/official/<moduleKey>/` | `atlas.*` | Atlas core team |
| `modules/custom/<moduleKey>/` | `custom.*`, `community.*` | Partners, community |
| `packages/maps/` | `atlas.*` | **Deprecated** — migration target only |

`packages/maps/src/feature-modules.js` and `packages/maps/src/core-modules.js` are deprecated. They remain only to keep the current application running while official modules are migrated into `modules/official/`. No new module should be added to these files.

---

## 5. Module Folder Structure

```
modules/
  official/
    atlas.core/
      module.manifest.js
      models/
      views/
      pages/
      api/
        index.js
      components/
    atlas.identity/
      module.manifest.js
      ...
    atlas.company/
    atlas.files/
    atlas.contacts/
    atlas.finance/
    atlas.hr/
    atlas.ledger/
  custom/
    custom.fleet/
      module.manifest.js
      models/
        vehicle.model.js
        driver.model.js
      views/
        vehicle.list.view.js
        vehicle.detail.view.js
      pages/
        fleet.page.js
      api/
        index.js
        fleet-service.js
      components/
        VehicleStatusBadge.jsx
        index.js
      validators/
        index.js
      migrations/
        0001_create_vehicle.sql
```

Only `module.manifest.js` is required. Every other directory is optional.

---

## 6. Module Manifest v2

`module.manifest.js` exports a default object created with `defineAtlasModule`:

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.fleet',
  name: 'Flota',
  description: 'Gestion de vehiculos y conductores.',
  version: '0.1.0',
  kind: 'FEATURE',

  dependencies: [
    { key: 'atlas.core' },
    { key: 'atlas.identity' },
  ],

  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: 'preserve-data',
    ownedEntities: ['Vehicle', 'Driver'],
    sharedEntities: ['Company', 'AuditLog'],
  },

  permissions: [
    { key: 'fleet.access',          name: 'Access Fleet' },
    { key: 'fleet.vehicles.read',   name: 'Read Vehicles' },
    { key: 'fleet.vehicles.create', name: 'Create Vehicles' },
    { key: 'fleet.vehicles.update', name: 'Update Vehicles' },
    { key: 'fleet.vehicles.delete', name: 'Delete Vehicles' },
    { key: 'fleet.drivers.read',    name: 'Read Drivers' },
    { key: 'fleet.drivers.manage',  name: 'Manage Drivers' },
  ],

  acl: {
    module: 'fleet.access',
    actions: {
      'fleet.vehicles.read':   'fleet.vehicles.read',
      'fleet.vehicles.create': 'fleet.vehicles.create',
      'fleet.vehicles.update': 'fleet.vehicles.update',
      'fleet.vehicles.delete': 'fleet.vehicles.delete',
      'fleet.drivers.read':    'fleet.drivers.read',
      'fleet.drivers.manage':  'fleet.drivers.manage',
    },
    models: {
      Vehicle: {
        read:   'fleet.vehicles.read',
        create: 'fleet.vehicles.create',
        update: 'fleet.vehicles.update',
        delete: 'fleet.vehicles.delete',
      },
      Driver: {
        read:   'fleet.drivers.read',
        create: 'fleet.drivers.manage',
        update: 'fleet.drivers.manage',
        delete: 'fleet.drivers.manage',
      },
    },
  },

  navigation: [
    {
      label: 'Vehiculos',
      path: '/fleet/vehicles',
      icon: 'Truck',
      layout: 'main',
      permissionKey: 'fleet.vehicles.read',
    },
    {
      label: 'Conductores',
      path: '/fleet/drivers',
      icon: 'Users',
      layout: 'main',
      permissionKey: 'fleet.drivers.read',
    },
  ],
})
```

---

## 7. Prisma Boundary

Prisma is the persistence layer for **Atlas Core stable infrastructure only**.

### Core Prisma models (permanent)

| Model | Owner |
|---|---|
| `AtlasModule` | atlas.core |
| `ModuleDependency` | atlas.core |
| `Blueprint` | atlas.core |
| `Permission`, `Role`, `RolePermission` | atlas.identity |
| `UserProfile`, `Membership` | atlas.identity |
| `Company`, `BrandingConfig` | atlas.company |
| `FileAsset` | atlas.files |
| `AuditLog` | atlas.core |
| `InstanceConfig` | atlas.core |
| `Notification` | atlas.core |

### AME3 metadata models (added as AME3 is built)

| Model | Purpose |
|---|---|
| `AtlasModel` | Module-declared entity metadata |
| `AtlasField` | Field definitions per model |
| `AtlasView` | Blueprint/view metadata per model |
| `ModuleMigration` | Module-local forward migration log |

### Transitional models (will move to AME3)

The following Prisma models exist today for feature modules. They are transitional: they remain in `prisma/schema.prisma` only until Phase 5 migrates those modules into `modules/official/` with AME3 model declarations.

| Transitional model | Belongs to |
|---|---|
| `Contact` | atlas.contacts |
| `FinanceAccount`, `FinanceDocument`, `FinanceJournalEntry`, `FinanceJournalLine`, `FinanceTaxRate`, `FinanceFxRate`, `FinanceDocumentApplication` | atlas.finance |
| `HrEmployee`, `HrDepartment`, `HrJobTitle` | atlas.hr |
| `LedgerAccount`, `LedgerMovement` | atlas.ledger |

No new feature module tables should be added to `prisma/schema.prisma`. Wait for Atlas ORM (Phase 3) or declare data structures in the module's `migrations/` directory.

### Identifier policy (hard rule)

- Atlas identifier strategy is **UUID v7 only**.
- Primary keys and relationship identifiers must use UUID-compatible schema types and UUID validation contracts.
- `cuid` is considered legacy and must not be introduced in new or modified source files.
- For AME3 dynamic tables and module SQL, prefer DB-side `uuidv7()` defaults when the table owns ID generation.

---

## 8. Atlas ORM — Metadata-Driven Entity Layer

The Atlas ORM is the data layer for module-owned entities. Modules declare their models in `models/`, and the Atlas ORM provisions and manages the physical tables.

### Model declaration

```js
// modules/custom/custom.fleet/models/vehicle.model.js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle',
  label: 'Vehiculo',
  tableName: 'atlas_fleet_vehicle',
  companyScoped: true,
  softDelete: true,
  fields: [
    { name: 'plate',       type: 'text',    required: true, maxLength: 20, label: 'Placa' },
    { name: 'brand',       type: 'text',    required: true, maxLength: 100, label: 'Marca' },
    { name: 'model',       type: 'text',    required: true, maxLength: 100, label: 'Modelo' },
    { name: 'year',        type: 'number',  required: true, label: 'Anio' },
    { name: 'status',      type: 'select',  required: true, label: 'Estado',
      options: ['active', 'maintenance', 'retired'], default: 'active' },
    { name: 'driverId',    type: 'relation', relatedModel: 'driver', label: 'Conductor' },
    { name: 'notes',       type: 'textarea', label: 'Notas' },
  ],
  indexes: [
    { fields: ['companyId', 'plate'], unique: true },
    { fields: ['companyId', 'status'] },
  ],
})
```

### Field types

| Type | SQL column | UI rendering |
|---|---|---|
| `text` | `varchar(N)` | Text input |
| `textarea` | `text` | Textarea |
| `number` | `integer` | Number input |
| `decimal` | `numeric(18,4)` | Decimal input |
| `boolean` | `boolean` | Toggle |
| `select` | `varchar(64)` | Dropdown (single) |
| `multiselect` | `text[]` | Dropdown (multi) |
| `date` | `date` | Date picker |
| `datetime` | `timestamptz` | Datetime picker |
| `email` | `varchar(255)` | Email input |
| `phone` | `varchar(64)` | Phone input |
| `relation` | `uuid FK` | Entity picker |
| `file` | `uuid FK → FileAsset` | File upload |
| `json` | `jsonb` | JSON editor |
| `markdown` | `text` | Markdown editor |
| `color` | `varchar(32)` | Color picker |
| `richtext` | `text` | Rich text |

### Migration safety rules

1. Forward-only. The Atlas ORM never drops or renames a column automatically.
2. Adding a field adds a nullable or defaulted column. No data loss.
3. Purge requires dry-run + typed confirmation `"ACEPTO"` in the request body.
4. Table drops never happen at runtime. Removal is a developer-performed migration after permanent module retirement.
5. Company-scoped purge only. Cleanup handlers must scope all deletes to `WHERE companyId = ?`.
6. Shared entities are never purged by cleanup handlers.
7. AME3 tables use the `atlas_` prefix to avoid schema collisions.

---

## 9. Blueprint System

Blueprints are Atlas ERP's equivalent to Odoo XML views — declarative JSON documents that describe how to render or interact with a module entity. They are designed for React component rendering, not XML template evaluation.

### Blueprint kinds

| Kind | Purpose |
|---|---|
| `ENTITY` | Entity and its field definitions |
| `FORM` | Form with section groupings and conditional fields |
| `TABLE` | List view with column, filter, and sort config |
| `DETAIL` | Read-only detail view of a single record |
| `PAGE` | Full page layout composing sub-blueprints |
| `DASHBOARD` | Dashboard widget composition |
| `ACTION` | Button or action that triggers a workflow or API call |
| `RELATION` | Relationship view between two entities |
| `CUSTOM` | Pointer to a registered Component Registry key |

### Blueprint layout and component keys

Blueprints may declare layout and component keys that the renderer resolves:

```js
// modules/custom/custom.fleet/views/vehicle.list.view.js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.list',
  kind: 'TABLE',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    label: 'Vehiculos',
    shell: 'atlas.dashboardShell',        // top-level shell wrapper
    layout: 'atlas.crudLayout',           // standard CRUD page layout
    component: 'AtlasTable',              // generic table renderer
    columns: ['plate', 'brand', 'model', 'year', 'status', 'driverId'],
    defaultSort: { field: 'plate', direction: 'asc' },
    filters: [
      { field: 'status', type: 'select', label: 'Estado' },
    ],
    actions: [
      { key: 'create', label: 'Agregar vehiculo', permissionKey: 'fleet.vehicles.create' },
    ],
  },
})
```

```js
// modules/custom/custom.fleet/views/vehicle.form.view.js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.form',
  kind: 'FORM',
  version: '0.1.0',
  schema: {
    entity: 'vehicle',
    label: 'Vehiculo',
    layout: 'atlas.crudLayout',
    component: 'AtlasForm',
    sections: [
      {
        title: 'Identificacion',
        columns: 2,
        fields: ['plate', 'brand', 'model', 'year'],
      },
      {
        title: 'Estado',
        columns: 2,
        fields: ['status', 'driverId'],
      },
      {
        title: 'Notas',
        columns: 1,
        fields: ['notes'],
      },
    ],
  },
})
```

### Using a custom component in a blueprint

```js
import { defineView } from '@atlas/module-engine'

export default defineView({
  key: 'fleet.vehicle.status-card',
  kind: 'CUSTOM',
  version: '0.1.0',
  schema: {
    componentKey: 'custom.fleet:VehicleStatusBadge',
    props: {
      showDriver: true,
      compact: false,
    },
  },
})
```

### Blueprint rendering pipeline

```
GET /blueprints (or GET /blueprints/:key)
  → Blueprint Engine returns JSON
  → React renderer receives blueprint
  → If kind = TABLE   → AtlasTable
  → If kind = FORM    → AtlasForm
  → If kind = DETAIL  → AtlasDetail
  → If kind = PAGE    → AtlasPage (composes sub-blueprints)
  → If kind = CUSTOM  → ComponentRegistry.resolve(componentKey)
```

### Blueprint rules

- Blueprints are UI hints. Business rules live in the API service layer.
- Blueprints for uninstalled modules are stored but not served by `GET /blueprints` by default.
- Blueprint versioning follows module versioning.
- Every blueprint must reference a declared model (`entity` key) or a registered component (`componentKey`).

---

## 10. Component Registry

The Component Registry maps string keys to React component implementations. Modules register custom components that blueprints of kind `CUSTOM` can reference, or that other modules can consume via `exposes`.

### Registration

```js
// modules/custom/custom.fleet/components/index.js
import { registry } from '@atlas/module-engine'
import { VehicleStatusBadge } from './VehicleStatusBadge.jsx'
import { FleetKanbanBoard } from './FleetKanbanBoard.jsx'

registry.register('custom.fleet:VehicleStatusBadge', VehicleStatusBadge)
registry.register('custom.fleet:FleetKanbanBoard', FleetKanbanBoard)
```

### Rules

- Component keys use the format `moduleKey:ComponentName`.
- A module may only register keys under its own namespace.
- Core component keys (`atlas.core:*`, `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) are provided by the Atlas Core renderer.
- Uninstalled module components are not registered at runtime. Blueprints referencing an unregistered key render a `ComponentNotFound` placeholder.
- Components are bundled at build time. No runtime ZIP upload or dynamic remote loading.

---

## 11. Module Discovery

### Discovery sources (priority order)

1. `modules/official/` — Atlas team modules (Phase 5 migration target)
2. `modules/custom/` — Community and partner modules (available from Phase 2)
3. `packages/maps/` — Deprecated. Read only until official module migration is complete.

### Discovery contract

A discoverable module directory must contain `module.manifest.js` exporting a `defineAtlasModule` result.

### Discovery timing

- **Phase 2:** File-system scan of `modules/custom/` at API boot and on `POST /modules/sync`.
- **Phase 5:** `modules/official/` added to scan. `packages/maps/` scan deprecated.
- **Phase 7:** `packages/maps/` scan removed entirely.

### Validation rules

1. Missing `module.manifest.js` → directory silently skipped.
2. Invalid manifest → `status: ERROR`, logged, discovery continues.
3. Reserved namespace (`atlas.*`, `core.*`, `system.*`, `identity.*`) used by a custom module → `ERROR`.
4. Duplicate `key` → first found wins; official modules take precedence over custom.
5. Discovery never executes module code beyond loading the manifest file.

---

## 12. Module Installation Lifecycle

### State machine

```
DISCOVERED → UNINSTALLED ←→ INSTALLED ←→ DISABLED
                                ↑
                            ERROR (retry install)
```

### Install sequence

1. Validate manifest schema
2. Check dependencies are `INSTALLED`
3. Check namespace is not reserved (for custom modules)
4. Upsert `AtlasModule` row (`status: INSTALLED, enabled: true`)
5. Upsert `Permission` rows (`active: true`)
6. Upsert `Blueprint` rows
7. Store `lifecycleConfig` in `AtlasModule.lifecycleConfig`
8. Provision Atlas ORM tables if module declares models (Phase 3+)
9. Mount API routes (Route Loader — Phase 4+)
10. Register component keys (Component Registry — Phase 4+)
11. Emit `module.installed` event on EventBus
12. Write AuditLog entry

### Destructive operations (uninstall purge / reset)

All destructive operations require:
- A dry-run call beforehand that shows affected row counts
- Request body `{ confirmation: "ACEPTO" }` to execute
- Prisma transaction that rolls back on any handler failure
- AuditLog entry recording `rowsDeleted`

---

## 13. Security

1. **No runtime arbitrary code execution.** Custom module code is placed on disk by a developer and included in the next build. No ZIP upload, no dynamic remote import, no eval.
2. **Namespace enforcement.** Custom modules using reserved namespaces are rejected at discovery with `ERROR` status.
3. **Fail-closed permissions.** `Permission.active = true` is required for any permission grant. The `requirePermission` middleware checks both `RolePermission` existence and `Permission.active`.
4. **Route isolation.** Module routes are mounted only when the module is `INSTALLED` and `enabled`. An uninstalled module has no reachable routes.
5. **Company-scoped data.** All module queries and cleanup handlers include a `companyId` filter. Cross-company access is structurally prevented by the Atlas ORM query builder.
6. **Module-to-module communication.** Modules communicate via Atlas API (HTTP), EventBus (typed events), or the `exposes`/`consumes` manifest contract. No direct cross-module function imports.

---

## 14. Spec-Driven Development for AME3

### 14.1 The mandate

No AME3 work may begin implementation without:

1. A **spec file** in `docs/superpowers/specs/` that has been reviewed and approved.
2. An **implementation plan file** in `docs/superpowers/plans/` that maps the spec to exact files, steps, and validation commands.

This applies without exception to every:
- `@atlas/module-engine` package feature
- Atlas ORM feature (`defineModel`, table provisioning, migrations)
- Blueprint renderer (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`, `AtlasPage`)
- Module discovery service
- Route Loader
- Component Registry
- Module lifecycle change (install, disable, uninstall, reset, dry-run)
- Atlas Core metadata table addition (`AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`)
- Official module migration from `packages/maps/` to `modules/official/`
- Any new custom module

If the relevant AME3 layer does not yet exist, write the spec for the layer first. Do not implement workarounds in old-system code while a spec exists for the AME3 solution.

### 14.2 Spec and plan file locations

| Artifact | Location |
|---|---|
| Spec | `docs/superpowers/specs/YYYY-MM-DD-ame3-<feature-name>.md` |
| Plan | `docs/superpowers/plans/YYYY-MM-DD-ame3-<feature-name>.md` |

Examples:
- `docs/superpowers/specs/2026-05-10-ame3-module-engine-package.md`
- `docs/superpowers/plans/2026-05-10-ame3-module-engine-package.md`
- `docs/superpowers/specs/2026-05-11-ame3-custom-fleet-module.md`
- `docs/superpowers/plans/2026-05-11-ame3-custom-fleet-module.md`

### 14.3 Required spec sections (AME3)

Every AME3 spec must include all of the following sections:

| Section | Description |
|---|---|
| Feature title | Clear name for the feature or change |
| Problem | What gap or limitation is being solved |
| Goals | Numbered list of specific outcomes |
| Non-goals | Explicit exclusions from scope |
| Architecture impact | How this changes or extends AME3 |
| Module impact | Which modules are affected or changed |
| Prisma impact | New models, fields, or migrations — or "none" |
| Atlas ORM / metadata impact | New `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` changes — or "none" |
| Blueprint impact | New blueprint kinds, fields, or rendering behavior — or "none" |
| API impact | New or changed endpoints, permissions, validators |
| Frontend impact | New or changed screens, components, or navigation |
| Security considerations | Permission model, namespace enforcement, data isolation |
| Migration safety | Rollback plan, dry-run requirements, typed confirmation if destructive |
| Acceptance criteria | Numbered, testable conditions for "done" |
| Validation commands | Exact shell commands to verify each acceptance criterion |

Specs that do not include all sections must be completed before implementation begins.

### 14.4 Required plan sections (AME3)

Every AME3 implementation plan must include:

| Section | Description |
|---|---|
| Files to create | Exact paths and purpose of every new file |
| Files to modify | Exact paths and description of every change |
| Files forbidden to modify | Explicit list of files the plan must not touch |
| Step-by-step tasks | Numbered checklist with sub-steps; each step is atomic and commit-able |
| Validation commands per step | Exact commands to run after each step to verify it succeeded |
| Expected output | What a passing validation looks like |
| Commit checkpoint | Suggested commit message after each logical group of steps |

Plans that reference "TBD", "similar to X", or "add validation" without specific commands are not approved for implementation.

### 14.5 New module workflow

Every new module — official or custom — must follow this workflow:

1. **Write the module spec** at `docs/superpowers/specs/YYYY-MM-DD-ame3-<moduleKey>-design.md`
2. **Review and approve the spec** before writing any code
3. **Write the module implementation plan** at `docs/superpowers/plans/YYYY-MM-DD-ame3-<moduleKey>.md`
4. **Create the module folder** at `modules/official/<moduleKey>/` or `modules/custom/<moduleKey>/`
5. **Define `module.manifest.js`** using `defineAtlasModule`
6. **Define models** with `defineModel` in `models/*.model.js`
7. **Define views and pages** with `defineView` and `definePage`
8. **Define permissions and navigation** in the manifest
9. **Add `api/index.js`** only when generic blueprint-driven CRUD is insufficient for the feature
10. **Add `components/index.js`** only for custom React components not available in Atlas Core
11. **Call `POST /modules/sync`** and install from the module catalog
12. **Validate** permissions, generated UI, and acceptance criteria from the spec
13. **Mark checklist items complete** in `docs/TASKS.md` with `Verified: YYYY-MM-DD (commands)`

### 14.6 AME3 platform change workflow

Every change to the AME3 platform itself — the `@atlas/module-engine` package, Atlas ORM, Blueprint renderer, Route Loader, Component Registry, or module lifecycle — must follow:

1. **Write a platform spec** covering architecture impact, migration safety, and acceptance criteria
2. **Review and approve the spec** before writing any code
3. **Write the implementation plan** with exact files, steps, and validation commands
4. **Implement only the approved plan** — no scope creep during implementation
5. **Validate build, tests, and migrations** using the plan's validation commands
6. **Update this document** if the implemented behavior differs from what was previously documented

### 14.7 Agent workflow rules

These rules apply when any AI agent or engineer is implementing AME3 work:

1. **Agents must not proceed from spec to implementation automatically.** A spec must be explicitly approved by the user before implementation begins.

2. **A plan must be explicitly approved before the first code change is made.** Approval of a spec does not imply approval of the plan.

3. **If implementation deviates from the approved spec, stop.** Either update the spec first and get re-approval, or stop and ask for review. An agent that continues past a deviation without acknowledgment is out of compliance.

4. **Asking clarifying questions before writing a spec is required, not optional.** An agent that writes a plan without first understanding the problem is out of compliance.

5. **Checklist items in `docs/TASKS.md` must be marked complete with verification evidence.** The format is: `Verified: YYYY-MM-DD (exact commands executed and expected output confirmed)`. Marking complete without evidence is a violation.

### 14.8 Roadmap spec and plan requirements

Each AME3 roadmap phase requires a spec and plan before any code is written for that phase:

| Phase | Required spec | Required plan |
|---|---|---|
| AME3 Phase 1 — `@atlas/module-engine` package | `YYYY-MM-DD-ame3-module-engine-package.md` | `YYYY-MM-DD-ame3-module-engine-package.md` |
| AME3 Phase 2 — Custom module sample (`custom.fleet`) | `YYYY-MM-DD-ame3-custom-fleet-module.md` | `YYYY-MM-DD-ame3-custom-fleet-module.md` |
| AME3 Phase 3 — Metadata tables and Atlas ORM | `YYYY-MM-DD-ame3-atlas-orm-metadata.md` | `YYYY-MM-DD-ame3-atlas-orm-metadata.md` |
| AME3 Phase 3 — Blueprint renderer | `YYYY-MM-DD-ame3-blueprint-renderer.md` | `YYYY-MM-DD-ame3-blueprint-renderer.md` |
| AME3 Phase 4 — Module discovery and Route Loader | `YYYY-MM-DD-ame3-module-discovery.md` | `YYYY-MM-DD-ame3-module-discovery.md` |
| AME3 Phase 5 — Official module migration (per module) | `YYYY-MM-DD-ame3-migrate-<moduleKey>.md` | `YYYY-MM-DD-ame3-migrate-<moduleKey>.md` |
| AME3 Phase 6 — CRUD renderer | `YYYY-MM-DD-ame3-crud-renderer.md` | `YYYY-MM-DD-ame3-crud-renderer.md` |
| AME3 Phase 7 — Remove `packages/maps/` | `YYYY-MM-DD-ame3-remove-packages-maps.md` | `YYYY-MM-DD-ame3-remove-packages-maps.md` |

The next required spec before any Phase 1 code is written:

```
docs/superpowers/specs/YYYY-MM-DD-ame3-module-engine-package.md
```

This spec must cover: the `@atlas/module-engine` package structure, the `defineAtlasModule`, `defineModel`, `defineView`, and `definePage` APIs, the `modules/custom/` discovery scan, integration with the existing `ModuleRegistry` and `createModuleManifest` deprecation path, and all acceptance criteria for Phase 1 AME3 Phase 1.

---

## 15. Non-Goals

1. Runtime ZIP upload or remote module install.
2. Module sandboxing or OS-level process isolation.
3. Module code signing or cryptographic trust chains.
4. A marketplace UI or external registry browsing.
5. Multi-version module coexistence (two versions of the same key simultaneously).
6. Table drops triggered by module uninstall at runtime.
7. Hot module replacement at runtime (changes require rebuild).
8. Module-local database connections (all modules share the Atlas Postgres connection).
9. Per-company module enablement in Phase 1–4 (instance-wide only).
10. Automatic major version upgrade paths.

---

## 16. Phased Roadmap

**Every phase requires an approved spec and plan before any code is written for that phase. See Section 14.**

### Phase 1 — AME3 Documentation and Package Foundation (current)

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-module-engine-package.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-module-engine-package.md`

- [x] Master architecture document (`docs/architecture/atlas-module-engine-v3.md`)
- [x] Custom modules developer guide (`docs/03_custom_modules.md`)
- [x] Module system rewrite (`docs/02_module_system.md`)
- [x] SDD mandate for AME3 (this section)
- [x] Module Lifecycle v2: `Permission.active`, dry-run, reset, purge-data uninstall
- [ ] *Spec approved* → Create `packages/module-engine/` package: `defineAtlasModule`, `defineModel`, `defineView`, `definePage`
- [ ] *Spec approved* → Implement file-system discovery from `modules/custom/` at API boot
- [ ] *Spec approved* → Implement `POST /modules/sync` with custom discovery

### Phase 2 — Module Folder Structure and Custom Sample Module

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-custom-fleet-module.md`  
**Required plan:** `docs/superpowers/plans/YYYY-MM-DD-ame3-custom-fleet-module.md`

- [ ] *Spec approved* → Create `modules/official/` and `modules/custom/` directories
- [ ] *Spec approved* → Route Loader: auto-mount `api/index.js` from installed custom modules
- [ ] *Spec approved* → Build complete sample custom module (`custom.fleet` or `custom.demo`)
- [ ] *Spec approved* → Module-local validators auto-discovered from `validators/index.js`

### Phase 3 — AME3 Metadata Tables and Services

**Required spec (ORM):** `docs/superpowers/specs/YYYY-MM-DD-ame3-atlas-orm-metadata.md`  
**Required spec (renderer):** `docs/superpowers/specs/YYYY-MM-DD-ame3-blueprint-renderer.md`

- [ ] *Spec approved* → Add `AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration` to `prisma/schema.prisma`
- [ ] *Spec approved* → Atlas ORM: provisions `atlas_*` tables from `defineModel` declarations
- [ ] *Spec approved* → Blueprint renderer: `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`
- [ ] *Spec approved* → Component Registry
- [ ] *Spec approved* → First AME3 module end-to-end: zero Prisma edits, zero manual route mounting

### Phase 4 — Module Discovery and Sync as Primary Source

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-module-discovery.md`

- [ ] *Spec approved* → API boot reads `modules/custom/` and `modules/official/` as primary sources
- [ ] *Spec approved* → Route Loader: mount and unmount routers by lifecycle state
- [ ] *Spec approved* → Component Registry: load and unload registrations by lifecycle state
- [ ] *Spec approved* → `packages/maps/` fallback only

### Phase 5 — Migrate Official Modules to modules/official/

**Required spec per module:** `docs/superpowers/specs/YYYY-MM-DD-ame3-migrate-<moduleKey>.md`

Migration order: atlas.ledger → atlas.contacts → atlas.hr → atlas.finance → atlas.identity → atlas.files → atlas.company → atlas.core

For each module:
- [ ] *Spec approved* → Move code into `modules/official/<moduleKey>/`
- [ ] *Spec approved* → Replace Prisma model with Atlas ORM `defineModel`
- [ ] *Spec approved* → Replace manual route mounting with Route Loader
- [ ] *Spec approved* → Replace hardcoded screens with blueprint-driven pages

### Phase 6 — Blueprint Renderer and Generic CRUD

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-crud-renderer.md`

- [ ] *Spec approved* → `AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`, `AtlasPage`
- [ ] *Spec approved* → Shell and layout key resolution: `atlas.dashboardShell`, `atlas.crudLayout`

### Phase 7 — Remove packages/maps

**Required spec:** `docs/superpowers/specs/YYYY-MM-DD-ame3-remove-packages-maps.md`

- [ ] *Spec approved* → All official modules confirmed operational in `modules/official/`
- [ ] *Spec approved* → `packages/maps/src/feature-modules.js` deleted
- [ ] *Spec approved* → `packages/maps/src/core-modules.js` deleted or absorbed
- [ ] *Spec approved* → `packages/maps/` removed from monorepo

---

## 17. Acceptance Criteria

### Phase 1 acceptance criteria

1. `defineAtlasModule` is importable from `@atlas/module-engine`.
2. A developer places `modules/custom/custom.fleet/module.manifest.js` (using `defineAtlasModule`), calls `POST /modules/sync`, and sees `custom.fleet` in `GET /modules` with `status: UNINSTALLED`.
3. A module with a reserved namespace (`atlas.core`) is rejected with `status: ERROR`.
4. After install, all module permissions have `active: true`. After disable/uninstall, `active: false`.
5. `GET /ledger/accounts` returns 403 when atlas.ledger is UNINSTALLED, for any user including admin.
6. Dry-run returns row counts before any destructive operation.
7. `{ confirmation: "ACEPTO" }` is required for all data purge operations.
8. Zero core files (`packages/maps/`, `prisma/schema.prisma`, `apps/api/src/index.js`) are modified to add a new custom module.

### Phase 3 acceptance criteria

9. A custom module declares a model in `models/vehicle.model.js` using `defineModel`. After install, the Atlas ORM provisions the `atlas_fleet_vehicle` table with no Prisma migration authored by the developer.
10. `GET /fleet/vehicles` returns data from the Atlas ORM table with zero manual route mounting.

### Phase 7 acceptance criteria

11. `packages/maps/` does not exist in the repository.
12. All official modules are fully operational from `modules/official/`.
13. No file in `apps/api/src/index.js` mounts a module-specific router explicitly.

---

## Appendix A: Glossary

| Term | Definition |
|---|---|
| AME3 | Atlas Module Engine v3 — this architecture |
| Blueprint | Declarative JSON document describing an entity, form, table, page, or UI element |
| Component Registry | Runtime map from component key strings to React component implementations |
| Cleanup Handler | Module-registered function that deletes the module's owned data rows in a transaction |
| `defineAtlasModule` | The new module manifest API from `@atlas/module-engine` |
| `defineModel` | Declares an AME3 entity model; replaces Prisma model additions for module-owned tables |
| `defineView` | Declares a blueprint/view for a model |
| `definePage` | Declares a full page layout in the module |
| Atlas ORM | Metadata-driven entity layer that provisions tables from `defineModel` declarations |
| Route Loader | API boot component that dynamically mounts module API routers based on install status |
| `packages/maps/` | Deprecated manifest source; replaced by `modules/official/` and `modules/custom/` |
| Transitional model | A Prisma model for a feature module that exists until Atlas ORM replaces it in Phase 5 |

## Appendix B: Deprecated APIs

| Deprecated | Replaced by | When |
|---|---|---|
| `createModuleManifest` from `@atlas/core` | `defineAtlasModule` from `@atlas/module-engine` | Phase 1 |
| `packages/maps/src/feature-modules.js` | `modules/official/*/module.manifest.js` | Phase 5 |
| `packages/maps/src/core-modules.js` | `modules/official/*/module.manifest.js` | Phase 7 |
| Manual Prisma model additions for feature tables | `defineModel` in Atlas ORM | Phase 3 |
| Manual route mounting in `apps/api/src/index.js` | Route Loader auto-discovery | Phase 4 |
| Manual screen registration in `apps/desktop/src/` | Blueprint-driven pages via `definePage` | Phase 6 |
| Manual validator additions in `packages/validators/src/index.js` | Module-local `validators/index.js` | Phase 2 |
