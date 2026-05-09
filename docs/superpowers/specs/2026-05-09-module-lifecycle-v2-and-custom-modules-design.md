# Module Lifecycle v2 and Custom Module System Foundation

Date: 2026-05-09
Status: Draft
Author: Claude Code (claude-sonnet-4-6)
Spec file: docs/superpowers/specs/2026-05-09-module-lifecycle-v2-and-custom-modules-design.md
Plan file: docs/superpowers/plans/2026-05-09-module-lifecycle-v2-and-custom-modules.md (created after spec approval)

---

## 1. Feature title

Module Lifecycle v2 and Custom Module System Foundation

---

## 2. Status

Draft

---

## 3. Context

Atlas ERP is designed to be a modular ERP platform similar in spirit to Odoo, where a stable core application supports installable, disable-able, and uninstallable feature modules. The vision is for official modules (maintained by the Atlas team inside this repository) to eventually be joined by community or partner-built custom modules that extend the platform safely.

The current module lifecycle implementation handles install, disable, enable, and logical uninstall at the `AtlasModule` table level. However several critical gaps have appeared in practice:

1. **Permission visibility is not lifecycle-aware.** When a feature module is uninstalled or disabled, its `Permission` rows remain active. The Identity role editor shows all permissions from all modules regardless of install status. This means administrators can assign permissions for modules that are not installed, and the only enforcement is at the API endpoint guard level (not at the permission-assignment level in the UI).

2. **No runtime permission activation/deactivation.** There is no `Permission.active` field or equivalent. Permissions exist as rows unconditionally. The runtime permission check cannot distinguish between "permission exists but module is not installed" and "permission exists and module is installed."

3. **No reset capability.** A module administrator cannot wipe operational data from a module while keeping the module installed and permissions active. There is no dry-run, no cleanup handler registry, and no transactional data purge.

4. **No data purge policy.** Uninstall only sets `status: UNINSTALLED, enabled: false`. It does not touch the module's operational data rows. There is no distinction between preserve-data and purge-data uninstall modes.

5. **atlas.ledger was auto-installed.** The recently implemented atlas.ledger module was treated as effectively installed (its permissions were seeded and visible in Identity, and its routes are unconditionally mounted) without the user explicitly installing it through the module catalog. The seed does correctly create new feature modules with `status: UNINSTALLED, enabled: false`, but the upsert update does not revert an already-installed module, and the API routes are mounted at startup regardless of install status.

6. **No custom module system.** There is no defined folder convention, manifest discovery mechanism, namespace policy, or safety rules for community or partner modules.

---

## 4. Problem

The module lifecycle is incomplete in ways that prevent Atlas ERP from operating as a real modular ERP:

1. A module administrator can assign permissions for uninstalled modules to roles, and the Identity UI does not distinguish installed vs. uninstalled module permissions.
2. API route guards block access, but the permission-assignment layer does not — creating a confusing UX where permissions appear assignable but have no effect.
3. There is no safe path for resetting a module's data without uninstalling it.
4. There is no way for a partner or community developer to add a module without modifying the core source files.
5. `atlas.ledger` specifically needs to be corrected so it starts as uninstalled and its permissions are not visible in Identity until explicitly installed.

---

## 5. Goals

1. Add `Permission.active` field (boolean, default true) so the lifecycle service can deactivate permissions when a module is disabled or uninstalled, and runtime permission checks fail closed on inactive permissions.
2. Add `Permission.moduleInstallRequired` field or rely on module status join so Identity UI filters out permissions for uninstalled/disabled modules.
3. Implement a `module-lifecycle-service.js` that centralizes install, disable, enable, uninstall, reset, and dry-run operations including permission activation/deactivation and dependency validation.
4. Implement dry-run endpoints for uninstall and reset that return affected entities, permissions, role assignments, and a recommendation before executing.
5. Implement reset capability: purge a module's operational data while keeping it installed and permissions active, requiring typed confirmation and dry-run first.
6. Implement purge-data uninstall mode in addition to the existing preserve-data behavior.
7. Implement a `module-cleanup-registry.js` that maps module keys to cleanup handler functions so each module can declare how its data is purged.
8. Correct atlas.ledger to start as UNINSTALLED, hide its permissions from the Identity role editor when not installed, and block API route access when the module is not installed/enabled.
9. Define the Module Manifest v2 contract with explicit lifecycle fields including `installable`, `resettable`, `supportsDataPurge`, `ownedEntities`, `sharedEntities`, and `defaultUninstallPolicy`.
10. Define the folder convention, namespace rules, and manifest discovery strategy for custom/community modules (MVP: discovery from `modules/custom/` folder at build/seed time; implementation deferred to a future phase).
11. Update the Identity role/permission editor to only show permissions for core modules and currently installed+enabled feature modules.

---

## 6. Non-goals

1. Runtime dynamic loading of custom module JavaScript without a build step. Custom module code integration requires a developer build step in this phase.
2. Module-local Prisma schema fragments merged at build time. Central `prisma/schema.prisma` remains the single source of truth in this phase.
3. Module sandboxing, process isolation, or security sandboxes for custom module code.
4. A marketplace UI or external registry for discovering community modules.
5. Rollback of Prisma migrations triggered by module lifecycle events. Table drops are never performed at runtime.
6. Multi-version module coexistence (running two versions of the same module simultaneously).
7. Module signing, code integrity verification, or cryptographic trust chains.
8. Automated upgrade paths for major version bumps.

---

## 7. User stories

- As a system administrator, I want to install a feature module from the module catalog so that its permissions, navigation, and API capabilities become active for my company.
- As a system administrator, I want to disable a feature module temporarily so that its navigation and API access are blocked without losing data, and I can re-enable it later.
- As a system administrator, I want to uninstall a feature module with data preserved so that the operational records remain in the database but all access is blocked until the module is reinstalled.
- As a system administrator, I want to run a dry-run before purging a module so that I see exactly how many rows will be deleted before I confirm the destructive operation.
- As a system administrator, I want to reset a module's operational data (purge rows while keeping the module installed) so that I can start fresh without uninstalling or losing permissions.
- As a role editor in Identity, I want to only see permissions for installed and enabled modules so that I do not accidentally assign permissions that have no effect.
- As a developer, I want to add a custom module by placing it in a declared folder with a standard manifest so that Atlas discovers it without requiring me to modify core source files.
- As a developer, I want the module cleanup registry to allow me to declare a data purge handler for my module so that the system can safely wipe operational data on reset or purge uninstall.

---

## 8. UX requirements

**Module catalog screen (atlas.core — /modules):**

- Show three sections: (1) Core modules (always installed, no actions), (2) Installed/active feature modules, (3) Available but not installed modules.
- Each module card shows: icon, name, description, version, kind badge (Core / Modulo / Integracion), status badge (Instalado / Deshabilitado / No instalado / Disponible).
- Dependency warnings visible on the card if a required dependency is not installed.
- Action buttons per state:
  - Available: "Instalar"
  - Installed: "Deshabilitar", "Desinstalar", "Reiniciar datos" (if module declares resettable)
  - Disabled: "Habilitar", "Desinstalar"
  - Uninstalled: "Reinstalar"
- "Desinstalar" and "Reiniciar datos" buttons are destructive: clicking opens a confirmation modal with dry-run preview.
- Dry-run modal shows: affected rows per entity, permissions that will be deactivated, role assignments affected, dependent modules blocked. User must type "ACEPTO" to confirm.
- "Purgar datos" option shown only on uninstall, as an advanced checkbox. Default is preserve-data.

**Identity role/permission editor:**

- Permission tree groups by module.
- Groups for uninstalled or disabled modules are hidden or shown with a disabled/unavailable visual indicator if the UI explicitly decides to show them.
- Recommended: hide uninstalled/disabled module permission groups entirely in normal role editor view. An advanced maintenance toggle may show them with "modulo no instalado" label.
- Assigning a permission whose module is not installed must be blocked at the API level even if it somehow appears in the UI.

**General UX rules:**

- All UI labels, button text, confirmation prompts, and error messages in Spanish.
- Destructive actions require modal confirmation with "ACEPTO" typed confirmation.
- Dry-run must run and display results before any destructive button becomes enabled.
- Loading states on all async operations.
- Error states with message from API response.

---

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| /app/m/atlas.core/modules | ModuleCatalog | atlas.core | Module catalog with install/disable/uninstall actions |
| /app/m/atlas.identity/roles/:id | RoleDetail (existing) | atlas.identity | Role detail with updated permission tree that filters by install status |

No new frontend route files are required. The changes are to existing screens and the permission tree component.

---

## 10. Data model

### Modified models

**Permission (existing model)**

Add two new fields:
- `active Boolean @default(true)` — controlled by module lifecycle. Set to `false` when the module is disabled or uninstalled. Set back to `true` on re-enable or reinstall. The runtime permission check must fail closed if `active` is false even if a `RolePermission` row exists.
- `moduleKey String?` — a denormalized string copy of the owning module key for fast filtering. This complements the existing `moduleId` FK. Enables the Identity API to query `Permission WHERE moduleKey IN (SELECT key FROM AtlasModule WHERE status = 'INSTALLED' AND enabled = true)` without an expensive join chain.

**AtlasModule (existing model)**

Add one new field:
- `lifecycleConfig Json?` — stores the manifest's lifecycle declaration: `{ installable, resettable, supportsDataPurge, defaultUninstallPolicy, ownedEntities, sharedEntities }`. Populated during install. Used by the lifecycle service to decide which operations are allowed.

No other Prisma model changes are required for the MVP lifecycle features. The custom module discovery folder convention is file-system and seed-time only — no new Prisma models for the discovery system.

### New data concept: Permission.active semantics

The `active` field represents whether the permission is currently effective at runtime. The lifecycle service manages this field:

- Install or re-enable: `Permission.active = true` for all permissions of the module.
- Disable or uninstall: `Permission.active = false` for all permissions of the module.
- Purge-data uninstall: same as preserve-data regarding permissions (`active = false`).
- Reset: `Permission.active` remains `true` (module stays installed).
- Core module permissions: always `active = true` (lifecycle service never touches them).

The runtime `requirePermission` guard must check `permission.active` in addition to `RolePermission` existence.

---

## 11. Prisma impact

New models: none.

Modified models:
- `Permission` — add `active Boolean @default(true)`, add `moduleKey String?`.
- `AtlasModule` — add `lifecycleConfig Json?`.

New migration required: Yes. The migration adds the three new columns. Both are nullable or have defaults, so the migration is safe on an existing table with data. No existing rows need a data migration — defaults apply automatically.

Migration safety notes:
- `active Boolean @default(true)` — all existing permissions remain active after migration. Safe.
- `moduleKey String?` — nullable. A post-migration seed run or a one-time data migration step can backfill this from the existing `moduleId` FK join. The spec recommends a seed-time backfill rather than a migration SQL backfill to keep migrations simple.
- `lifecycleConfig Json?` — nullable. Populated on next install or seed run. Safe.

---

## 12. API contract

### GET /modules

Existing endpoint. No change to signature.
Response should include `lifecycleConfig` and `status` from AtlasModule for each module.

### GET /modules/available

New endpoint.
Auth: required
Permission: `core.modules.read`
Description: Returns all modules known to the system (installed + uninstalled + discovered but not yet registered).
Response: `{ data: AtlasModule[] }` — includes all status values.

For MVP, this is equivalent to `GET /modules` with no status filter. The distinction becomes important when custom module discovery is implemented.

### GET /modules/:key/lifecycle

New endpoint.
Auth: required
Permission: `core.modules.read`
Description: Returns the lifecycle state of a specific module including: current status, permissions count, active permissions count, dependent modules, dependency state.
Response:
```json
{
  "data": {
    "key": "atlas.ledger",
    "status": "INSTALLED",
    "enabled": true,
    "core": false,
    "installable": true,
    "uninstallable": true,
    "resettable": true,
    "supportsDataPurge": true,
    "ownedEntities": ["LedgerAccount", "LedgerMovement"],
    "permissionsTotal": 10,
    "permissionsActive": 10,
    "dependents": [],
    "dependencies": [{ "key": "atlas.core", "status": "INSTALLED" }]
  }
}
```

### POST /modules/install

Existing endpoint. Modifications:
- Set `Permission.active = true` for all module permissions after install.
- Set `Permission.moduleKey` for all module permissions.
- Store `lifecycleConfig` from manifest into `AtlasModule.lifecycleConfig`.
- Auth: required
- Permission: `core.modules.create`

### POST /modules/:key/disable

Existing endpoint. Modifications:
- After setting `status: DISABLED, enabled: false`, set `Permission.active = false` for all permissions of this module.
- Auth: required
- Permission: `core.modules.update`

### POST /modules/:key/enable

Existing endpoint. Modifications:
- After setting `status: INSTALLED, enabled: true`, set `Permission.active = true` for all permissions of this module.
- Auth: required
- Permission: `core.modules.update`

### DELETE /modules/:key (uninstall, preserve-data)

Existing endpoint. Modifications:
- Rename semantically to "uninstall with preserve-data" (default behavior).
- Set `Permission.active = false` for all permissions of this module.
- Does not delete any operational rows (existing behavior retained).
- Auth: required
- Permission: `core.modules.delete`

### POST /modules/:key/uninstall/dry-run

New endpoint.
Auth: required
Permission: `core.modules.delete`
Body: `{ mode: "preserve-data" | "purge-data" }`
Response:
```json
{
  "data": {
    "moduleKey": "atlas.ledger",
    "operation": "uninstall",
    "mode": "preserve-data",
    "allowed": true,
    "blockingDependents": [],
    "ownedEntities": [
      { "entity": "LedgerAccount", "estimatedRows": 12, "companyScoped": true },
      { "entity": "LedgerMovement", "estimatedRows": 204, "companyScoped": true }
    ],
    "permissionsAffected": 10,
    "roleAssignmentsAffected": 3,
    "sharedEntities": ["Company", "AuditLog"],
    "sharedEntitiesWarning": "Registros en entidades compartidas no seran eliminados.",
    "filesAffected": 0,
    "rollbackAvailable": "preserve-data mode — data remains in database, reinstall restores access",
    "recommendation": "Proceder. No hay modulos dependientes. Los datos quedaran preservados."
  }
}
```

### POST /modules/:key/uninstall

Modified endpoint (replaces DELETE /modules/:key for purge mode, extends for explicit uninstall call).

For MVP, keep DELETE /modules/:key as the preserve-data uninstall path.
Add POST /modules/:key/uninstall for explicit control.

Auth: required
Permission: `core.modules.delete`
Body: `{ mode: "preserve-data" | "purge-data", confirmation: "ACEPTO" }`
- `mode` defaults to `"preserve-data"`.
- `confirmation` required when `mode = "purge-data"`.
- Dry-run must have been called for the same `(key, mode)` within the last 15 minutes (tracked in InstanceConfig or in-memory, implementation choice). Enforcement is optional in MVP — may be relaxed to just requiring `confirmation` field.

Response: `{ data: AtlasModule }` — updated module record.

For purge-data mode:
- Calls the module's registered cleanup handler in `module-cleanup-registry.js`.
- Cleanup handler runs in a Prisma transaction.
- Sets `Permission.active = false` for all module permissions.
- Sets `status: UNINSTALLED, enabled: false`.
- Writes an AuditLog entry.

### POST /modules/:key/reset/dry-run

New endpoint.
Auth: required
Permission: `core.modules.delete`
Description: Preview what would be deleted in a reset operation.
Response: same shape as uninstall dry-run but with `operation: "reset"` and note that permissions remain active.

### POST /modules/:key/reset

New endpoint.
Auth: required
Permission: `core.modules.delete`
Body: `{ confirmation: "ACEPTO" }`
Description: Purges the module's owned operational data while keeping it installed and permissions active. Module must declare `resettable: true` in manifest.
Response: `{ data: { moduleKey, entitiesReset: [...], rowsDeleted: number } }`

### POST /modules/sync

New endpoint.
Auth: required
Permission: `core.modules.create`
Description: Re-reads all manifests from `packages/maps/` (and in future from `modules/custom/`), upserts AtlasModule rows, upserts permissions and blueprints. Does not change status of already-installed modules. Used after adding a new official module manifest or a custom module manifest.
Response: `{ data: { synced: number, added: number, updated: number } }`

### GET /permissions

Existing endpoint (assumed to exist or derive from Identity permission list calls).
Modification: Filter by `active: true` in the default view. Add query param `?includeInactive=true` for admin maintenance use.

---

## 13. SDK contract

Domain: `modules`

New or modified methods:

- `getModuleLifecycle(key, token)` — calls `GET /modules/:key/lifecycle`. Returns lifecycle state object.
- `uninstallDryRun(key, mode, token)` — calls `POST /modules/:key/uninstall/dry-run`. Returns dry-run report.
- `uninstallModule(key, mode, confirmation, token)` — calls `POST /modules/:key/uninstall`.
- `resetDryRun(key, token)` — calls `POST /modules/:key/reset/dry-run`.
- `resetModule(key, confirmation, token)` — calls `POST /modules/:key/reset`.
- `syncModules(token)` — calls `POST /modules/sync`.
- `getAvailableModules(token)` — calls `GET /modules/available`.

Existing methods:
- `installModule(manifest, token)` — no signature change, behavior updated (now also activates permissions).
- `disableModule(key, token)` — no signature change, behavior updated (now also deactivates permissions).
- `enableModule(key, token)` — no signature change, behavior updated (now also reactivates permissions).

---

## 14. Validator contract

New Zod schemas in `@atlas/validators`:

- `moduleUninstallSchema` — validates: `{ mode: z.enum(["preserve-data", "purge-data"]).default("preserve-data"), confirmation: z.string().optional() }`. Refines: if `mode === "purge-data"`, `confirmation` must equal `"ACEPTO"`.
- `moduleResetSchema` — validates: `{ confirmation: z.string() }`. Refines: `confirmation` must equal `"ACEPTO"`.
- `moduleDryRunSchema` — validates: `{ mode: z.enum(["preserve-data", "purge-data"]).default("preserve-data") }`.
- `moduleSyncSchema` — N/A (no body required for sync).

Existing schemas:
- `moduleInstallSchema` — no change to signature. Implementation may add optional `lifecycleConfig` passthrough.

---

## 15. Module manifest impact

The Module Manifest v2 contract extends the existing manifest with a `lifecycle` block.

**Updated manifest contract:**

```js
createModuleManifest({
  key: "atlas.ledger",
  name: "Cuentas y Movimientos",
  version: "0.1.0",
  kind: MODULE_KINDS.FEATURE,
  core: false,
  uninstallable: true,

  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: "preserve-data",
    ownedEntities: ["LedgerAccount", "LedgerMovement"],
    sharedEntities: ["Company", "AuditLog"],
    purgeStrategy: "service-defined",
    resetStrategy: "service-defined",
  },

  // ... existing fields
})
```

**Manifest v2 lifecycle fields:**

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `installable` | boolean | no | true | Whether the module can be installed through the catalog |
| `uninstallable` | boolean | no | true | Whether the module can be uninstalled (mirrors top-level `uninstallable`) |
| `resettable` | boolean | no | false | Whether the module supports data reset while staying installed |
| `supportsDataPurge` | boolean | no | false | Whether the module provides a purge handler for purge-data uninstall |
| `defaultUninstallPolicy` | "preserve-data" \| "purge-data" | no | "preserve-data" | Default mode when uninstall is triggered |
| `ownedEntities` | string[] | no | [] | Prisma model names whose rows this module owns and can purge |
| `sharedEntities` | string[] | no | [] | Prisma model names this module uses but does not own (never purged) |
| `purgeStrategy` | "service-defined" \| "none" | no | "none" | How data purge is implemented |
| `resetStrategy` | "service-defined" \| "none" | no | "none" | How data reset is implemented |

**Core module manifest rules:**
- Core modules MUST NOT declare `lifecycle.resettable: true` or `lifecycle.supportsDataPurge: true`.
- Core module `uninstallable` is always `false` and the lifecycle service enforces this regardless of manifest value.
- Core module permissions are never touched by the lifecycle service (never set `active = false`).

**atlas.ledger manifest update required:**
- Add `lifecycle` block as shown above.
- Verify `core: false` (currently correct).
- Verify `uninstallable: true` (currently correct in feature-modules.js).

**No new manifest files are required for MVP.** The `lifecycle` block is added to existing manifests in `packages/maps/src/feature-modules.js`.

---

## 16. Navigation impact

No new navigation items. The module catalog already lives at `/modules` under atlas.core navigation.

The existing "Modulos" navigation entry at `/modules` (permissionKey: `core.modules.read`) is sufficient.

---

## 17. Blueprint impact

N/A. No new blueprints are required for the lifecycle system.

---

## 18. RBAC/permissions

No new permission keys are required. The lifecycle operations reuse existing core permissions:

| Permission key | Guards endpoint(s) | Notes |
|---|---|---|
| `core.modules.read` | GET /modules, GET /modules/available, GET /modules/:key/lifecycle | Existing |
| `core.modules.create` | POST /modules/install, POST /modules/sync | Existing |
| `core.modules.update` | POST /modules/:key/disable, POST /modules/:key/enable | Existing |
| `core.modules.delete` | DELETE /modules/:key, POST /modules/:key/uninstall, POST /modules/:key/uninstall/dry-run, POST /modules/:key/reset, POST /modules/:key/reset/dry-run | Existing |

The `core.modules.delete` permission name should be updated to "Desinstalar / Reiniciar modulos" to reflect the expanded scope. The permission key does not change.

**Runtime permission check update (critical):**

The `requirePermission` middleware must be updated to also verify `Permission.active === true` in addition to `RolePermission` existence. A user with a `RolePermission` row for a disabled module's permission must be denied (403) because `permission.active` is false.

Current check (conceptual): `RolePermission WHERE roleId = user.roleId AND permissionId IN (Permission WHERE key = requiredKey)`

Updated check (conceptual): `RolePermission WHERE roleId = user.roleId AND permissionId IN (Permission WHERE key = requiredKey AND active = true)`

This is the fail-closed guarantee: even if an administrator manually added a `RolePermission` row for a disabled module's permission, the API returns 403.

---

## 19. Multi-company behavior

All module lifecycle operations (install, disable, enable, uninstall) apply to the entire Atlas instance, not to individual companies. A module installed for the instance is available to all companies. A module disabled affects all companies.

Data purge (reset and purge-data uninstall) is company-scoped: the cleanup handler receives a company context and must only delete rows belonging to that company. For a single-company instance this is equivalent to full purge. For future multi-company support, the reset/purge endpoint must accept an optional `companyId` parameter.

For MVP (single company): cleanup handlers delete all rows in `ownedEntities` for the current company. `companyId` is read from the authenticated user's active company context.

Shared entities (e.g., `Company`, `AuditLog`, `UserProfile`) are never purged by module cleanup handlers regardless of company scope.

---

## 20. Files/storage impact

N/A for the lifecycle service itself.

Module cleanup handlers that own entities with file attachments (e.g., a hypothetical module that owns entities with FileAsset links) must:
1. Collect FileAsset IDs before deleting owned entities.
2. Delete from Supabase Storage via the files service.
3. Delete FileAsset rows.
4. Then delete the owned entity rows.

atlas.ledger does not own any FileAsset-linked entities. No storage impact for the ledger cleanup handler.

---

## 21. Export/import requirements

N/A for the lifecycle system itself.

The dry-run response could optionally be exported as a JSON report for audit purposes. This is a future enhancement — not required for MVP.

---

## 22. Audit log requirements

| Action key | Trigger | Payload shape |
|---|---|---|
| `core.module.install` | POST /modules/install | `after: { key, name, version, status: "INSTALLED" }` |
| `core.module.disable` | POST /modules/:key/disable | `before: { status: "INSTALLED" }, after: { status: "DISABLED" }` |
| `core.module.enable` | POST /modules/:key/enable | `before: { status: "DISABLED" }, after: { status: "INSTALLED" }` |
| `core.module.uninstall` | DELETE or POST /modules/:key/uninstall | `before: { status }, after: { status: "UNINSTALLED", mode: "preserve-data"/"purge-data" }` |
| `core.module.reset` | POST /modules/:key/reset | `after: { key, entitiesReset: [...], rowsDeleted: N }` |
| `core.module.sync` | POST /modules/sync | `after: { synced: N, added: M, updated: K }` |

All audit log entries include `moduleKey: "atlas.core"` (lifecycle is a core operation), `entityType: "AtlasModule"`, `entityId: <moduleId>`, and `actorId` from the authenticated user.

---

## 23. Edge cases

1. **User has RolePermission for a disabled module permission, then module is re-enabled.** The `RolePermission` row was never deleted. On re-enable, `Permission.active = true` is set and the existing RolePermission immediately grants access again. No manual re-assignment required.

2. **Uninstall with purge-data fails mid-cleanup.** The cleanup handler runs in a Prisma transaction. If it fails, all deletes roll back and the module status remains unchanged. The error is returned to the API caller with a 500.

3. **Reinstall after preserve-data uninstall.** The module goes from UNINSTALLED to INSTALLED. Permissions are reactivated. Previous operational data is still in the database from before the uninstall. The reinstall does not provide a prompt about existing data — the UI should display a note that previous data exists if the cleanup handler's dry-run count was > 0.

4. **Reinstall after purge-data uninstall.** Previous operational data was deleted. Reinstall creates a clean slate.

5. **Dependency is disabled while a dependent module is installed.** `POST /modules/:key/disable` checks for installed/enabled dependents and blocks with a 409 if found. The administrator must disable the dependent first.

6. **Module manifest in `feature-modules.js` has `lifecycle` block but the module was already seeded without it.** The seed upsert or `POST /modules/sync` will update `AtlasModule.lifecycleConfig` from the current manifest. No migration needed.

7. **Admin role has RolePermission for all permissions including disabled module permissions.** The `requirePermission` check still fails closed because it checks `Permission.active`. Admin role does not bypass the active check.

8. **`resetModule` called on a module that does not declare `resettable: true`.** API returns 409 with "Este modulo no soporta la operacion de reinicio."

9. **`purge-data` uninstall called on a module that does not declare `supportsDataPurge: true`.** API returns 409 with "Este modulo no soporta la purga de datos."

10. **`pnpm db:seed` run on a fresh database.** Feature modules are created with `status: UNINSTALLED, enabled: false`. `Permission.active` defaults to `true` for all seeded permissions. This is intentional — the seed creates the permission catalog for assignment but the permissions are for uninstalled modules. A follow-up seeder step should set `Permission.active = false` for all permissions belonging to uninstalled modules. This is a new seed behavior required by this spec.

11. **atlas.ledger API routes are mounted unconditionally at API startup.** The routes exist but each endpoint checks permission via `requirePermission`. If `ledger.accounts.read.active = false`, the check fails closed. However, to be clean, the mount should ideally be conditional on module status. MVP accepts unconditional mount because the permission-level guard is sufficient for access control.

12. **Custom module folder exists but contains an invalid manifest.** Discovery logs the error and skips the invalid module. It does not crash the API. The invalid module appears in a `GET /modules/available` response with `status: ERROR` and an error message field.

---

## 24. Risks

1. **Risk:** The `Permission.active` field check adds a database join or condition to every authenticated API request via `requirePermission`. If implemented naively (re-querying `Permission WHERE active = true` on every request), this could add latency.
   **Mitigation:** The user permissions are already loaded from the database once per request in `getOrLoadUserContext`. The existing load query should be updated to `JOIN Permission ON Permission.active = true`. Permissions for inactive modules are simply not present in the loaded set.

2. **Risk:** Setting `Permission.active = false` for a disabled module deactivates permissions that the admin role's RolePermission rows still reference. If the admin somehow relied on assigning these permissions manually, those assignments become silently inactive.
   **Mitigation:** The behavior is correct by design and is clearly documented. The dry-run response explicitly lists "permissionsAffected: N, roleAssignmentsAffected: M" before any operation executes.

3. **Risk:** The cleanup handler registry (`module-cleanup-registry.js`) adds coupling between the lifecycle service and each module's cleanup implementation. If a module's cleanup handler has a bug, it can fail the entire reset/purge operation.
   **Mitigation:** Cleanup handlers run inside a Prisma transaction that rolls back on failure. The error is surfaced to the API caller. The cleanup handler registration is optional — if a module does not register a handler, `supportsDataPurge: true` in the manifest should trigger a warning during seed validation.

4. **Risk:** `Permission.moduleKey` is a denormalized field that can drift out of sync with the actual `Permission.moduleId` FK.
   **Mitigation:** The field is populated during install (lifecycle service) and seed (seed.js). A validation utility in the lifecycle service can verify consistency. The field is a convenience for queries — the authoritative source remains `Permission.moduleId`.

5. **Risk:** The Identity role editor currently shows all permissions regardless of module status. Changing this behavior may confuse administrators who previously assigned permissions to roles and now see those permissions disappear from the editor.
   **Mitigation:** Add clear UI communication: "Algunos permisos no aparecen porque el modulo correspondiente no esta instalado." The permissions are not deleted — they are hidden. Re-installing the module makes them visible again.

6. **Risk:** The `pnpm db:seed` run currently sets all seeded permissions to `active: true` by default (because the column default is true). Feature module permissions should be `active: false` if the module is not installed.
   **Mitigation:** After upserting all permissions, the seed adds a step: `UPDATE Permission SET active = false WHERE moduleId IN (SELECT id FROM AtlasModule WHERE status != 'INSTALLED' OR enabled = false)`. This fixes the state on every seed run.

7. **Risk:** atlas.ledger's Prisma models (LedgerAccount, LedgerMovement) are in the central schema and have FK relationships to Company. If a cleanup handler deletes all LedgerMovement and LedgerAccount rows for a company, subsequent reinstall creates a clean slate. But if the FK cascade behavior is wrong, cascade deletes could unexpectedly affect related data.
   **Mitigation:** Review the FK cascade strategy in the cleanup handler. LedgerMovement has `onDelete: Cascade` from LedgerAccount, so deleting LedgerAccount rows will cascade-delete LedgerMovement rows. The cleanup handler should delete LedgerMovement rows first (respecting FK order), then LedgerAccount rows — or rely on the cascade. Document the chosen strategy.

---

## 25. Acceptance criteria

1. Given a fresh `pnpm db:seed`, when I call `GET /modules`, then `atlas.ledger` appears with `status: "UNINSTALLED"` and `enabled: false`.
2. Given `atlas.ledger` is uninstalled (status: UNINSTALLED), when I call `GET /permissions` (or the Identity permission list), then no `ledger.*` permissions appear with `active: true`.
3. Given `atlas.ledger` is uninstalled, when I open the Identity role editor, then no "Libro Auxiliar" permission group is shown.
4. Given `atlas.ledger` is uninstalled, when I call `GET /ledger/accounts` with a valid JWT and a role that was previously assigned ledger permissions, then the API returns 403.
5. Given I call `POST /modules/install` with the atlas.ledger manifest, when the install succeeds, then `atlas.ledger.status = "INSTALLED"`, `atlas.ledger.enabled = true`, and all `ledger.*` permissions have `active: true`.
6. Given `atlas.ledger` is installed, when I call `POST /modules/atlas.ledger/disable`, then `atlas.ledger.status = "DISABLED"`, `atlas.ledger.enabled = false`, and all `ledger.*` permissions have `active: false`.
7. Given `atlas.ledger` is disabled, when I call `GET /ledger/accounts` with any valid JWT, then the API returns 403.
8. Given `atlas.ledger` is disabled, when I call `POST /modules/atlas.ledger/enable`, then `atlas.ledger.status = "INSTALLED"`, `atlas.ledger.enabled = true`, and all `ledger.*` permissions have `active: true`.
9. Given `atlas.ledger` is installed, when I call `POST /modules/atlas.ledger/uninstall/dry-run` with `mode: "purge-data"`, then the response includes `allowed: true`, estimated row counts for LedgerAccount and LedgerMovement, and the number of affected role assignments.
10. Given I call `POST /modules/atlas.ledger/reset` without `confirmation: "ACEPTO"`, then the API returns 400 with a validation error.
11. Given I call `POST /modules/atlas.ledger/reset` with `confirmation: "ACEPTO"` and atlas.ledger declares `resettable: true`, then LedgerAccount and LedgerMovement rows are deleted for the active company, the module remains INSTALLED, and an AuditLog entry `core.module.reset` is written.
12. Given I call `DELETE /modules/atlas.core`, then the API returns 409 (core module cannot be uninstalled).
13. Given `atlas.contacts` is installed and `atlas.finance` depends on `atlas.contacts`, when I call `POST /modules/atlas.contacts/disable`, then the API returns 409 because atlas.finance is an installed dependent. (Note: atlas.finance lists atlas.contacts as optional; verify manifest before testing.)
14. Given `requirePermission("ledger.accounts.read")` is called and `Permission["ledger.accounts.read"].active = false`, when the authenticated user has a `RolePermission` row for this permission, then the API still returns 403.
15. Given `POST /modules/sync` is called, when a new manifest exists in `packages/maps/src/feature-modules.js` for a module not yet in the database, then the module is created with `status: UNINSTALLED` and its permissions are created with `active: false`.
16. Given `atlas.ledger` is uninstalled with mode `preserve-data`, when I reinstall it, then the existing LedgerAccount and LedgerMovement rows from before the uninstall are still accessible.

---

## 26. Verification plan

**Build and schema:**
- `pnpm build` — no build errors across all packages and apps.
- `pnpm db:generate` — Prisma client regenerates cleanly after schema change.
- `pnpm db:migrate` — new migration applies without errors (adds `active`, `moduleKey` to Permission, `lifecycleConfig` to AtlasModule).
- `pnpm db:seed` — seed completes; verify `atlas.ledger` in AtlasModule has `status: UNINSTALLED, enabled: false`.

**Permission active field:**
- After seed: `SELECT key, active FROM Permission WHERE key LIKE 'ledger.%'` — all should have `active = false` because atlas.ledger is uninstalled.
- After `POST /modules/install` (atlas.ledger): same query — all should have `active = true`.
- After `POST /modules/atlas.ledger/disable`: same query — all should have `active = false`.

**Runtime access control:**
- Authenticate as admin user. Call `GET /ledger/accounts` while atlas.ledger is UNINSTALLED — expect 403.
- Install atlas.ledger. Call `GET /ledger/accounts` — expect 200 (if user has `ledger.accounts.read` permission assigned).
- Disable atlas.ledger. Call `GET /ledger/accounts` — expect 403 even with admin user.

**Identity UI filter:**
- Install atlas.ledger. Open Identity role editor. Confirm "Libro Auxiliar" permission group is visible.
- Disable atlas.ledger. Open Identity role editor. Confirm "Libro Auxiliar" permission group is hidden or visually marked as unavailable.

**Dry-run:**
- Call `POST /modules/atlas.ledger/uninstall/dry-run` with `mode: "purge-data"` — expect a response with `allowed: true`, row count estimates, and no blocking dependents.

**Reset:**
- Create 3 LedgerAccount rows and 10 LedgerMovement rows.
- Call `POST /modules/atlas.ledger/reset/dry-run` — expect 3 accounts and 10 movements reported.
- Call `POST /modules/atlas.ledger/reset` with `confirmation: "ACEPTO"`.
- Verify LedgerAccount and LedgerMovement counts are 0.
- Verify `atlas.ledger.status = "INSTALLED"` and `ledger.*` permissions still have `active = true`.

**Core module protection:**
- `DELETE /modules/atlas.core` — expect 409.
- `POST /modules/atlas.core/disable` — expect 409.
- `POST /modules/atlas.core/reset` — expect 409 ("modulo core no soporta reinicio").

**Dependency blocking:**
- Verify any module with required dependents returns 409 on disable/uninstall.

**Audit logs:**
- After each lifecycle operation, verify an AuditLog row exists with the correct action key.

---

## 27. Rollback plan

**Prisma migration rollback:**
The migration adds three nullable or defaulted columns. To roll back, a new forward migration must:
1. `ALTER TABLE Permission DROP COLUMN active;`
2. `ALTER TABLE Permission DROP COLUMN moduleKey;`
3. `ALTER TABLE AtlasModule DROP COLUMN lifecycleConfig;`

These are non-destructive drops (no data constraint conflicts). The rollback migration is straightforward.

**Feature flag / module disable path:**
The lifecycle service changes are non-breaking for the existing lifecycle. Existing endpoints (`POST /modules/install`, `POST /modules/:key/disable`, `POST /modules/:key/enable`, `DELETE /modules/:key`) retain their current behavior with additive changes (permission activation). The new endpoints (`/dry-run`, `/reset`, `/sync`) are net-new and can be disabled by removing route registrations without affecting existing behavior.

**atlas.ledger correction rollback:**
If the ledger correction (seed marking it UNINSTALLED by default) causes problems, the seed can be reverted to the previous behavior by removing the `active = false` backfill step. The `Permission.active` column default of `true` means all existing permissions remain accessible until explicitly deactivated.

---

## 28. Future enhancements

1. **Custom module discovery at boot time.** Implement a file-system scanner that discovers manifests in `modules/custom/*/module.manifest.js` at API boot time and registers them into ModuleRegistry without a manual `pnpm modules:sync` call.

2. **Module-local Prisma schema fragments.** Allow each module to declare its own `schema.fragment.prisma` file that is merged into `prisma/schema.prisma` at build/sync time. Requires custom tooling to merge schemas and detect conflicts.

3. **Module-local API route auto-loading.** Discover and mount module API routes from `modules/custom/*/api/index.js` at boot time without requiring modification of `apps/api/src/index.js`.

4. **Module namespace enforcement.** Validate that custom module keys follow the `custom.vendor.module` namespace pattern and reject `atlas.*` or `system.*` keys from community modules.

5. **Module version upgrade path.** When a module's manifest version is bumped (minor or major), implement a version-aware upsert strategy that runs module-declared upgrade hooks and handles backwards-incompatible changes.

6. **CLI commands.** Implement `pnpm modules:discover`, `pnpm modules:sync`, `pnpm modules:validate`, `pnpm modules:install <key>`, `pnpm modules:reset <key> --dry-run`, `pnpm modules:uninstall <key> --purge --dry-run` as npm scripts calling the API or running directly against Prisma.

7. **Module marketplace.** UI for discovering community modules from an external registry, with install-from-registry support.

8. **Dry-run result caching.** Cache dry-run results server-side (e.g., in InstanceConfig or Redis) for 15 minutes to enforce "dry-run required before purge" policy.

9. **Multi-company module lifecycle.** For SaaS deployments, support per-company module enablement rather than instance-wide installation.

10. **Reset scoped to a date range.** Allow resetting only data from a specific time window rather than all data for a company.

11. **Module health check endpoint.** `GET /modules/:key/health` that runs module-declared health checks and reports on schema integrity, required seed data presence, and dependency satisfaction.

---

## Appendix A: Module Folder Convention (Design Decision)

This section defines the intended folder convention for when custom module discovery is implemented. No code changes are required for MVP.

**Current state (MVP):**
All official module manifests live in `packages/maps/src/core-modules.js` and `packages/maps/src/feature-modules.js`. Code lives in `apps/api/src/`, `apps/desktop/src/modules/`, `packages/validators/`, etc.

**Target structure (future phases):**

```
modules/
  official/                        # Official Atlas team modules (future migration target)
    atlas.ledger/
      module.manifest.js           # Module manifest v2
      prisma/                      # Schema fragment (future)
        schema.fragment.prisma
      api/                         # Route and service files
        index.js                   # Hono router factory
        ledger-service.js
        ledger-export-service.js
      desktop/                     # Frontend screens and components
        screens/
        components/
      validators/                  # Module-local Zod schemas
        index.js
      sdk/                         # Module SDK domain
        index.js
      tests/                       # Module tests
      docs/                        # Module docs
  custom/                          # Community/partner modules
    custom.vendor.mymodule/
      module.manifest.js
      prisma/
      api/
      desktop/
      validators/
      sdk/
      tests/
      docs/
```

**MVP decision:** Keep the current centralized structure. Add `lifecycle` to manifests in `packages/maps/`. The folder convention above is documented for future migration. No files are moved in this phase.

**Custom module namespace rules:**
- Official modules: `atlas.*` namespace. Maintained by the Atlas team.
- Partner/verified modules: `atlas.partner.*` namespace. Requires review by Atlas team.
- Community modules: `custom.*` or `community.*` namespace. Self-declared.
- Prohibited: custom modules using `atlas.*`, `core.*`, `system.*`, or `identity.*` namespace.
- Duplicate key detection: if a custom module key conflicts with an official module key, the sync rejects it with an error.

---

## Appendix B: Module Cleanup Registry Design

The cleanup registry maps module keys to cleanup handler functions. Each handler receives a Prisma transaction client and a company context.

```js
// apps/api/src/services/module-cleanup-registry.js

const cleanupHandlers = new Map()

export function registerCleanupHandler(moduleKey, handler) {
  cleanupHandlers.set(moduleKey, handler)
}

export function getCleanupHandler(moduleKey) {
  return cleanupHandlers.get(moduleKey) ?? null
}

// Atlas ledger cleanup handler registered in ledger-service.js or index.js:
// registerCleanupHandler('atlas.ledger', async ({ tx, companyId }) => {
//   await tx.ledgerMovement.deleteMany({ where: { companyId } })
//   await tx.ledgerAccount.deleteMany({ where: { companyId } })
//   return { rowsDeleted: movementsDeleted + accountsDeleted }
// })
```

Registration happens at API startup (imported from each module's service file or from a centralized registration file). For MVP, registrations are explicit imports in `apps/api/src/index.js` or in the lifecycle service initialization.

---

## Appendix C: atlas.ledger Correction Checklist

The following specific corrections are required for atlas.ledger as part of implementing this spec. These are not new features but corrections to bring atlas.ledger into compliance with the intended module lifecycle.

- [ ] atlas.ledger manifest in `packages/maps/src/feature-modules.js` adds `lifecycle` block with `resettable: true`, `supportsDataPurge: true`, `ownedEntities: ["LedgerAccount", "LedgerMovement"]`.
- [ ] `pnpm db:seed` correctly creates atlas.ledger with `status: UNINSTALLED, enabled: false` on first run (already implemented in seed.js — verify behavior).
- [ ] New seed step: after upserting all permissions, set `Permission.active = false` WHERE `moduleId IN (AtlasModule WHERE status != INSTALLED OR enabled = false)`.
- [ ] `requirePermission` middleware updated to include `Permission.active = true` in its permission check query.
- [ ] Identity role editor API (GET /permissions or equivalent) filters to `active: true` by default.
- [ ] `PermissionFeatureTree.jsx` receives only active permissions from the API and does not independently query or display inactive permissions.
- [ ] atlas.ledger cleanup handler registered in `module-cleanup-registry.js`.
- [ ] `POST /modules/atlas.ledger/reset` works end-to-end with typed confirmation.
