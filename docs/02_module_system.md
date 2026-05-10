# Atlas ERP — Module System (AME3)

Atlas ERP is a **module engine that ships ERP modules**. Every ERP feature is a module. Modules are self-contained directories that declare everything they need — data models, views, pages, navigation, permissions, API endpoints, and optionally custom React components. The Atlas Core reads these declarations and drives all behavior from them.

For the full architecture, see [docs/architecture/atlas-module-engine-v3.md](architecture/atlas-module-engine-v3.md).

---

## Module locations

| Directory | Namespace | Owner |
|---|---|---|
| `modules/official/<moduleKey>/` | `atlas.*` | Atlas core team |
| `modules/custom/<moduleKey>/` | `custom.*`, `community.*` | Partners, community |
| `packages/maps/` | `atlas.*` | **Deprecated** — transitional only, will be removed in Phase 7 |

No new module should be added to `packages/maps/`. It exists only to keep current official modules running while they are migrated into `modules/official/`.

---

## Module manifest

Every module contains a `module.manifest.js` file at its root, exporting a `defineAtlasModule` declaration:

```js
import { defineAtlasModule } from '@atlas/module-engine'

export default defineAtlasModule({
  key: 'custom.fleet',
  name: 'Flota',
  version: '0.1.0',
  kind: 'FEATURE',
  dependencies: [{ key: 'atlas.core' }],
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: 'preserve-data',
    ownedEntities: ['Vehicle'],
    sharedEntities: ['Company', 'AuditLog'],
  },
  permissions: [
    { key: 'fleet.access',        name: 'Access Fleet' },
    { key: 'fleet.vehicles.read', name: 'Read Vehicles' },
  ],
  acl: {
    module: 'fleet.access',
    actions: { 'fleet.vehicles.read': 'fleet.vehicles.read' },
    models: { Vehicle: { read: 'fleet.vehicles.read' } },
  },
  navigation: [
    {
      label: 'Vehiculos',
      path: '/fleet/vehicles',
      icon: 'Truck',
      layout: 'main',
      permissionKey: 'fleet.vehicles.read',
    },
  ],
})
```

`createModuleManifest` from `@atlas/core` is **deprecated**. Use `defineAtlasModule` for all new modules.

---

## Prisma boundary

**Prisma models Atlas Core. Atlas Module Engine models ERP modules.**

Prisma manages only stable Atlas infrastructure models: `AtlasModule`, `Blueprint`, `Permission`, `Role`, `UserProfile`, `Company`, `FileAsset`, `AuditLog`, `InstanceConfig`, and the AME3 metadata tables (`AtlasModel`, `AtlasField`, `AtlasView`, `ModuleMigration`).

Module-owned business tables (contacts, finance, HR, fleet, etc.) are declared using `defineModel` and managed by the Atlas ORM. No module developer should add tables to `prisma/schema.prisma`.

Existing Prisma models for feature modules (Contact, FinanceAccount, HrEmployee, LedgerAccount, etc.) are **transitional**. They remain only until those modules are migrated to `modules/official/` in Phase 5.

---

## Module data layer (Atlas ORM)

A module declares its entities in `models/*.model.js` using `defineModel`. The Atlas ORM provisions and manages the physical tables, forward-only.

```js
// modules/custom/custom.fleet/models/vehicle.model.js
import { defineModel } from '@atlas/module-engine'

export default defineModel({
  key: 'vehicle',
  label: 'Vehiculo',
  tableName: 'atlas_fleet_vehicle',
  companyScoped: true,
  fields: [
    { name: 'plate',  type: 'text',   required: true },
    { name: 'status', type: 'select', options: ['active', 'maintenance', 'retired'] },
  ],
})
```

---

## Blueprints (views)

Blueprints are declarative JSON documents that describe how to render an entity. They are Atlas ERP's equivalent to Odoo XML views, designed for React rendering. A module declares views in `views/*.view.js` using `defineView`.

Supported blueprint kinds: `ENTITY`, `FORM`, `TABLE`, `DETAIL`, `PAGE`, `DASHBOARD`, `ACTION`, `RELATION`, `CUSTOM`.

Blueprints reference standard Atlas components (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`) or custom registered components (`custom.fleet:VehicleStatusBadge`).

See [docs/08_blueprints.md](08_blueprints.md) for field type reference and rendering rules.

---

## Module kinds

| Kind | Description |
|---|---|
| `CORE` | `core: true`, `uninstallable: false`. Always installed. Cannot be removed. |
| `FEATURE` | Business module. Installable, disable-able, uninstallable. |
| `INTEGRATION` | Third-party connector. Same lifecycle as FEATURE. |
| `WEBSITE` | Public-facing module. Same lifecycle as FEATURE. |

---

## Module lifecycle

```
DISCOVERED → UNINSTALLED ←→ INSTALLED ←→ DISABLED
                                ↑
                            ERROR (retry install)
```

`AtlasModule.status` holds the lifecycle state. `Permission.active` mirrors install status — permissions for uninstalled or disabled modules have `active: false` and grant no access.

Destructive operations (purge-data uninstall, reset) require:
1. A preceding dry-run call
2. Request body `{ confirmation: "ACEPTO" }`
3. A Prisma transaction that rolls back on failure

---

## Module-to-module communication

Modules communicate through:
- **Atlas API** — HTTP calls via `@atlas/sdk`
- **EventBus** — typed pub/sub events via `AtlasEventBus`
- **Exposes/consumes** — declared component or service keys in the manifest

Modules do not import each other directly. There is no shared runtime module scope.

---

## Permission conventions

Every module must declare granular permissions:

```
module.access
module.feature.read
module.feature.create
module.feature.update
module.feature.delete
```

Every navigation entry must declare `permissionKey`. Every API route must call `requirePermission`. The ACL block in the manifest must cover all declared actions and models.

---

## Adding a new module

**Every new module requires an approved spec and plan before any code is written.** See Section 14 of [docs/architecture/atlas-module-engine-v3.md](architecture/atlas-module-engine-v3.md) for the SDD mandate, required document sections, and the 13-step module workflow.

See [docs/03_custom_modules.md](03_custom_modules.md) for the full developer guide and checklist.

The short version (after spec and plan are approved):

1. Create `modules/custom/<moduleKey>/module.manifest.js` using `defineAtlasModule`
2. Declare models in `models/*.model.js` using `defineModel`
3. Declare views in `views/*.view.js` using `defineView`
4. Declare pages in `pages/*.page.js` using `definePage`
5. Optionally add `api/index.js` for custom business endpoints
6. Optionally add `components/index.js` for custom React components
7. Call `POST /modules/sync`
8. Install from the module catalog (`/modules`)

Do not add manifests to `packages/maps/`. Do not add Prisma models. Do not mount routes manually. Do not register screens manually.

---

## Deprecated: packages/maps

`packages/maps/src/core-modules.js` and `packages/maps/src/feature-modules.js` are the old manifest sources. They remain only to keep the currently running application operational during the Phase 5 migration.

- Do not add new modules to these files.
- Do not modify these files for new work.
- They will be deleted in Phase 7.

Old code that still imports from `packages/maps/` is transitional. It is not a reference or a pattern to follow.
