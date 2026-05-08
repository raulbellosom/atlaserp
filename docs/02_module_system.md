# Atlas ERP — Module System

## What is a module?

Every ERP feature in Atlas is a **module** (also called a **map**). Modules are self-describing via manifests: they declare their permissions, navigation, blueprints, dependencies, and what they expose to or consume from other modules.

Manifests are defined in `packages/maps/` and seeded into the `AtlasModule` table via `prisma/seed.js`.

## Manifest contract

```js
import { createModuleManifest, MODULE_KINDS } from '@atlas/core'

export const myModule = createModuleManifest({
  key: 'atlas.mymodule',        // unique — use reverse domain format
  name: 'My Module',
  description: '...',
  version: '0.1.0',             // semver
  kind: MODULE_KINDS.FEATURE,   // CORE | FEATURE | INTEGRATION | WEBSITE
  core: false,
  uninstallable: true,
  dependencies: [{ key: 'atlas.core' }],
  permissions: [
    { key: 'mymodule.read', name: 'Read My Module' },
    { key: 'mymodule.manage', name: 'Manage My Module' }
  ],
  navigation: [
    { label: 'Mi Módulo', path: '/mymodule', icon: 'Package', layout: 'main' }
  ],
  blueprints: [],
  exposes: {},
  consumes: {}
})
```

Required fields: `key`, `name`, `version`. All others have defaults via `createModuleManifest`.

## ACL contract (required)

Atlas RBAC/ACL is server-authoritative and fail-closed.

Every new module must declare ACL in its manifest:

- `acl.module`: base permission to access module runtime
- `navigation[].permissionKey`: permission needed to expose each menu entry
- `acl.actions`: action-to-permission map
- `acl.models`: CRUD model-to-permission map

Rules:

- Navigation item without `permissionKey` is not exposed in runtime.
- Module without `acl.module` is not exposed in runtime for non-admin users.
- API routes must enforce the same permissions with `requirePermission`, `requireAnyPermission`, or `requireModuleAccess`.

## Granular permission convention (mandatory)

Every new module **MUST** use the granular pattern below:

- `module.access`
- `module.feature.read`
- `module.feature.create`
- `module.feature.update`
- `module.feature.delete`

Only add non-CRUD keys when strictly required (example: `finance.applications.reverse`).

Hard rule for new modules:

1. Declare all required permission keys in `manifest.permissions`.
2. Map each menu entry in `navigation[]` with `permissionKey`.
3. Map each API capability in `acl.actions`.
4. Map each persisted model in `acl.models`.
5. Protect API routes with the same permission key used in ACL.
6. Add authorization tests (`rol x endpoint`) before marking the module complete.

## Module kinds

| Kind | Description |
|---|---|
| CORE | `core: true`, `uninstallable: false`. Always present. |
| FEATURE | Business module. Installable, removable, versioned. |
| INTEGRATION | Third-party connector. Same lifecycle as FEATURE. |
| WEBSITE | Public-facing module. Same lifecycle as FEATURE. |

## Core vs. feature rules

**Core:** Cannot be removed or disabled via API. `DELETE /modules/:key` returns 403.

**Feature:** Can be installed, disabled, and logically uninstalled. Uninstall sets `status: UNINSTALLED` and `enabled: false` — never hard-deletes data.

## Module lifecycle

```
INSTALLED → DISABLED → UNINSTALLED
              ↑
           re-enable
```

Status stored in `AtlasModule.status` (enum: INSTALLED, DISABLED, UNINSTALLED, ERROR).

## ModuleRegistry (in-memory)

```js
import { ModuleRegistry } from '@atlas/core'
const registry = new ModuleRegistry()
registry.register(myModule)
registry.list()                // all modules
registry.get('atlas.mymodule') // one module
registry.resolveNavigation()   // flattened nav from enabled modules
registry.resolveBlueprints()   // flattened blueprints from all modules
registry.assertDependencies()  // throws if a dependency is missing
```

## AtlasEventBus

```js
import { AtlasEventBus } from '@atlas/core'
const bus = new AtlasEventBus()
const unsubscribe = bus.on('contact.created', async (payload) => { ... })
await bus.emit('contact.created', { id: '...' })
unsubscribe()
```

## Module-to-module communication

Current: modules communicate via declared `exposes`/`consumes` in manifests, Atlas API endpoints, and AtlasEventBus events.

Future: service registry, hooks, workflow engine.

## Versioning (SemVer)

- **Patch** (0.1.1): internal fixes, no API/schema changes
- **Minor** (0.2.0): new features, backwards-compatible
- **Major** (1.0.0): breaking changes — requires migration plan

## Adding a new feature module checklist

1. Add manifest to `packages/maps/src/feature-modules.js`
2. Declare module ACL (`acl.module`, `navigation[].permissionKey`, `acl.actions`, `acl.models`)
3. Add Prisma model(s) to `prisma/schema.prisma`
4. Run `pnpm db:migrate`
5. Add API routes to `apps/api/src/` with permission guards
6. Add service to `apps/api/src/services/`
7. Add Zod schema to `packages/validators/src/index.js`
8. Ensure runtime visibility works through `GET /runtime/modules`
9. Add authorization tests (role x endpoint matrix)
10. Update `docs/TASKS.md`
