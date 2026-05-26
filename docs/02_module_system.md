# Atlas ERP - Module System (AME3)

Atlas ERP is a module engine. Each ERP capability is modeled as a module that declares its own lifecycle metadata, permissions, navigation, data models, views, and optional API/component extensions.

## Module locations

| Directory | Namespace | Owner |
|---|---|---|
| `modules/custom/<moduleKey>/` | `custom.*`, `community.*` | Partners/community |
| `modules/official/<moduleKey>/` | `atlas.*` | Optional curated distributions |
| `apps/api/src/manifests/official/` | `atlas.*` | Internal official manifest snapshots (seed/runtime baseline) |

`packages/maps/` was decommissioned and removed on 2026-05-25.

## Manifest standard

Every AME3 module uses `defineAtlasModule` in `module.manifest.js`.

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
    { key: 'fleet.access', name: 'Access Fleet' },
    { key: 'fleet.vehicles.read', name: 'Read Vehicles' },
  ],
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

`createModuleManifest` is deprecated for new module development.

## Prisma boundary

Prisma manages platform/core models and AME3 metadata models.

Module-owned business tables should be declared through Atlas ORM (`defineModel`) and managed by the AME3 DDL pipeline, not by adding Prisma tables for new module work.

## Views and blueprints

Module views are declared with `defineView` and rendered by the AME3 renderer (`AtlasTable`, `AtlasForm`, `AtlasDetail`, `AtlasCrudView`).

See `docs/08_blueprints.md` for supported blueprint field types.

## Lifecycle model

```
DISCOVERED -> UNINSTALLED <-> INSTALLED <-> DISABLED
                             ^
                           ERROR
```

- `AtlasModule.status` stores lifecycle state.
- Core modules are protected (`core: true`, `uninstallable: false`).
- Destructive lifecycle operations require dry-run + explicit confirmation.

## Permission conventions

Each module should define:

- `module.access`
- `module.resource.read`
- `module.resource.create`
- `module.resource.update`
- `module.resource.delete`

Navigation entries require `permissionKey`, and API routes must enforce matching ACL permissions.

## New module checklist

1. Create `modules/custom/<moduleKey>/module.manifest.js` with `defineAtlasModule`.
2. Add entities in `models/*.model.js` with `defineModel`.
3. Add blueprints/views in `views/*.js` with `defineView`.
4. Add pages in `pages/*.page.js` with `definePage`.
5. Optionally add `api/index.js` for module-specific endpoints.
6. Run `POST /modules/sync`.
7. Install/enable from module catalog.

Do not introduce new work in legacy manifest paths or manual core wiring patterns.
