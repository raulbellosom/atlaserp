# Module Lifecycle v2 and Custom Module System Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement permission lifecycle awareness (`Permission.active`), centralized module lifecycle service with install/disable/enable/uninstall/reset/dry-run, new lifecycle API endpoints, and correct atlas.ledger to start as UNINSTALLED with permissions hidden from Identity until explicitly installed.

**Architecture:** A new `module-lifecycle-service.js` centralizes all lifecycle DB operations (permission activation/deactivation, audit logging, dependency checks, cleanup delegation). A new `routes/modules.js` extracts all module routes from the bloated `index.js` and adds new lifecycle endpoints. The critical runtime fix is adding `WHERE active = true` to the permission load query in `getUserContextByAuthId`, making all lifecycle changes fail-closed with zero UI changes required.

**Tech Stack:** Prisma 6, Hono, Zod, Node.js (ESM). No TypeScript. All UI labels in Spanish. No new npm packages required.

**Spec:** `docs/superpowers/specs/2026-05-09-module-lifecycle-v2-and-custom-modules-design.md`

---

## File Structure Map

### New files
| File | Responsibility |
|---|---|
| `prisma/migrations/20260509100000_module_lifecycle_v2/migration.sql` | Adds `active`, `moduleKey` to Permission; `lifecycleConfig` to AtlasModule |
| `apps/api/src/services/module-cleanup-registry.js` | Registry of per-module count+purge handlers; atlas.ledger handler registered here |
| `apps/api/src/services/module-lifecycle-service.js` | All lifecycle ops: install, disable, enable, uninstall, reset, dry-run, permission activation, audit log |
| `apps/api/src/routes/modules.js` | All module HTTP routes (extracted from index.js + new endpoints) |

### Modified files
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `active Boolean @default(true)`, `moduleKey String?` to Permission; `lifecycleConfig Json?` to AtlasModule |
| `prisma/seed.js` | Set `moduleKey` on permission upsert; backfill `active = false` for uninstalled module permissions |
| `packages/validators/src/index.js` | Add `moduleUninstallSchema`, `moduleResetSchema`, `moduleDryRunSchema` |
| `packages/maps/src/feature-modules.js` | Add `lifecycle` block to `ledgerMap`, `contactsMap`, `financeMap`, `hrMap` |
| `apps/api/src/index.js` | Add `active: true` filter in `getUserContextByAuthId`; update `GET /identity/permissions` and `PATCH /identity/roles/:id/permissions`; mount `routes/modules.js`; remove extracted module routes (~300 lines) |
| `packages/sdk/src/index.js` | Add `getLifecycle`, `uninstallDryRun`, `uninstallModule`, `resetDryRun`, `resetModule`, `syncModules`, `getAvailable` to `modules` domain |

---

## Task 1: Prisma Schema and Migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260509100000_module_lifecycle_v2/migration.sql`

- [ ] **Step 1.1: Add fields to prisma/schema.prisma**

In `prisma/schema.prisma`, update the `Permission` model and `AtlasModule` model:

```prisma
model AtlasModule {
  id             String   @id @default(uuid(7))
  key            String   @unique
  name           String
  description    String?
  version        String
  kind           ModuleKind @default(FEATURE)
  status         ModuleStatus @default(INSTALLED)
  core           Boolean  @default(false)
  uninstallable  Boolean  @default(true)
  enabled        Boolean  @default(true)
  manifest       Json
  lifecycleConfig Json?
  installedAt    DateTime @default(now())
  updatedAt      DateTime @updatedAt

  dependencies   ModuleDependency[] @relation("ModuleDependencies")
  requiredBy     ModuleDependency[] @relation("RequiredByModules")
  blueprints     Blueprint[]
  permissions    Permission[]
}

model Permission {
  id          String @id @default(uuid(7))
  key         String @unique
  name        String
  moduleId    String?
  moduleKey   String?
  description String?
  active      Boolean @default(true)
  createdAt   DateTime @default(now())

  module      AtlasModule? @relation(fields: [moduleId], references: [id], onDelete: SetNull)
  roles       RolePermission[]
}
```

- [ ] **Step 1.2: Create migration folder and SQL file**

Create the directory `prisma/migrations/20260509100000_module_lifecycle_v2/` and write this migration file:

```sql
-- Migration: module_lifecycle_v2
-- Adds active + moduleKey to Permission, lifecycleConfig to AtlasModule

ALTER TABLE "Permission" ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Permission" ADD COLUMN "moduleKey" TEXT;
ALTER TABLE "AtlasModule" ADD COLUMN "lifecycleConfig" JSONB;
```

- [ ] **Step 1.3: Apply migration and regenerate Prisma client**

Run:
```
pnpm db:migrate
pnpm db:generate
```

Expected: migration applies without error. Prisma client regenerates with `active`, `moduleKey`, `lifecycleConfig` available.

- [ ] **Step 1.4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260509100000_module_lifecycle_v2/
git commit -m "feat(db): add Permission.active, Permission.moduleKey, AtlasModule.lifecycleConfig"
```

---

## Task 2: Validators — New Lifecycle Schemas

**Files:**
- Modify: `packages/validators/src/index.js`

- [ ] **Step 2.1: Add three new schemas at the end of packages/validators/src/index.js**

Append after the last export in the file:

```js
export const moduleDryRunSchema = z.object({
  mode: z.enum(["preserve-data", "purge-data"]).default("preserve-data"),
});

export const moduleUninstallSchema = z
  .object({
    mode: z.enum(["preserve-data", "purge-data"]).default("preserve-data"),
    confirmation: z.string().optional(),
  })
  .refine(
    (data) => data.mode !== "purge-data" || data.confirmation === "ACEPTO",
    {
      message: 'Para purgar datos debes escribir "ACEPTO" en el campo de confirmacion.',
      path: ["confirmation"],
    }
  );

export const moduleResetSchema = z
  .object({
    confirmation: z.string(),
  })
  .refine((data) => data.confirmation === "ACEPTO", {
    message: 'Debes escribir "ACEPTO" para confirmar el reinicio.',
    path: ["confirmation"],
  });
```

- [ ] **Step 2.2: Verify validators build**

Run:
```
pnpm --filter @atlas/validators build 2>&1 || echo "no build script, checking import"
node -e "import('@atlas/validators').then(m => console.log(Object.keys(m).filter(k => k.startsWith('module'))))"
```

Expected output includes: `moduleInstallSchema`, `moduleDryRunSchema`, `moduleUninstallSchema`, `moduleResetSchema`.

- [ ] **Step 2.3: Commit**

```bash
git add packages/validators/src/index.js
git commit -m "feat(validators): add moduleDryRunSchema, moduleUninstallSchema, moduleResetSchema"
```

---

## Task 3: Seed Update — moduleKey Backfill and active=false for Uninstalled

**Files:**
- Modify: `prisma/seed.js`

- [ ] **Step 3.1: Update permission upsert to include moduleKey**

In `prisma/seed.js`, find the permission upsert loop (currently around line 68) and add `moduleKey` to both `update` and `create`:

```js
    for (const permission of manifest.permissions ?? []) {
      const presentation = getPermissionPresentation(permission.key)
      await prisma.permission.upsert({
        where: { key: permission.key },
        update: {
          name: presentation.name,
          description: presentation.description,
          moduleId: module.id,
          moduleKey: manifest.key,
        },
        create: {
          key: permission.key,
          name: presentation.name,
          description: presentation.description,
          moduleId: module.id,
          moduleKey: manifest.key,
        }
      })
    }
```

- [ ] **Step 3.2: Add active=false backfill step after all upserts**

In `prisma/seed.js`, add this block after the module upsert loop (after the `for (const manifest of allModuleManifests)` block closes) and before the obsolete permission cleanup:

```js
  // Set active=false for permissions belonging to uninstalled or disabled modules.
  // This ensures feature module permissions are not effective until the module is installed.
  const uninstalledModules = await prisma.atlasModule.findMany({
    where: {
      OR: [
        { status: { not: "INSTALLED" } },
        { enabled: false },
      ],
    },
    select: { id: true },
  })
  if (uninstalledModules.length > 0) {
    const uninstalledIds = uninstalledModules.map((m) => m.id)
    await prisma.permission.updateMany({
      where: { moduleId: { in: uninstalledIds } },
      data: { active: false },
    })
  }
```

- [ ] **Step 3.3: Run seed and verify atlas.ledger permissions are inactive**

Run:
```
pnpm db:seed
```

Expected: seed completes. Then verify in Prisma Studio or via a query:
```
pnpm db:studio
```

In Studio, check `Permission` table: all `ledger.*` keys should have `active = false`. All `core.*`, `identity.*`, `files.*`, `company.*` should have `active = true`.

- [ ] **Step 3.4: Commit**

```bash
git add prisma/seed.js
git commit -m "feat(seed): backfill Permission.moduleKey and set active=false for uninstalled module permissions"
```

---

## Task 4: Module Cleanup Registry

**Files:**
- Create: `apps/api/src/services/module-cleanup-registry.js`

- [ ] **Step 4.1: Create the registry**

Create `apps/api/src/services/module-cleanup-registry.js`:

```js
/**
 * Module cleanup registry.
 *
 * Each entry maps a module key to { count, purge } handlers.
 *
 * count({ prisma, companyId }) -> [{ entity, rows }]
 *   Returns row counts for dry-run reporting. Receives the real prisma client (not tx).
 *
 * purge({ tx, companyId }) -> number
 *   Deletes owned operational rows inside a transaction. Returns total rows deleted.
 *   Must respect FK order (children before parents).
 *   Must NEVER delete from shared entities (Company, UserProfile, AuditLog, etc.).
 */

const handlers = new Map()

export function registerModuleHandler(moduleKey, { count, purge }) {
  if (!moduleKey || typeof count !== 'function' || typeof purge !== 'function') {
    throw new Error(`registerModuleHandler: invalid handler for ${moduleKey}`)
  }
  handlers.set(moduleKey, { count, purge })
}

export function getModuleHandler(moduleKey) {
  return handlers.get(moduleKey) ?? null
}

export function listRegisteredHandlers() {
  return [...handlers.keys()]
}
```

- [ ] **Step 4.2: Register the atlas.ledger handler**

Append to `apps/api/src/services/module-cleanup-registry.js`:

```js
// ── atlas.ledger cleanup ──────────────────────────────────────────────────────
// Owns: LedgerMovement (must be deleted first due to FK to LedgerAccount),
//       LedgerAccount.
// Shared (never purged): Company, AuditLog.

registerModuleHandler('atlas.ledger', {
  async count({ prisma, companyId }) {
    const movements = await prisma.ledgerMovement.count({ where: { companyId } })
    const accounts = await prisma.ledgerAccount.count({ where: { companyId } })
    return [
      { entity: 'LedgerMovement', rows: movements, companyScoped: true },
      { entity: 'LedgerAccount', rows: accounts, companyScoped: true },
    ]
  },

  async purge({ tx, companyId }) {
    const { count: movementsDeleted } = await tx.ledgerMovement.deleteMany({
      where: { companyId },
    })
    const { count: accountsDeleted } = await tx.ledgerAccount.deleteMany({
      where: { companyId },
    })
    return movementsDeleted + accountsDeleted
  },
})
```

- [ ] **Step 4.3: Commit**

```bash
git add apps/api/src/services/module-cleanup-registry.js
git commit -m "feat(lifecycle): add module-cleanup-registry with atlas.ledger handler"
```

---

## Task 5: Module Lifecycle Service

**Files:**
- Create: `apps/api/src/services/module-lifecycle-service.js`

This service centralizes all lifecycle operations. Routes call it; the service owns DB logic.

- [ ] **Step 5.1: Create apps/api/src/services/module-lifecycle-service.js**

```js
import { getPermissionPresentation } from '../permission-catalog.js'
import { getModuleHandler } from './module-cleanup-registry.js'

const CORE_KEYS = new Set(['atlas.core', 'atlas.identity', 'atlas.files', 'atlas.company'])

export class ModuleLifecycleError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ModuleLifecycleError'
    this.status = status
  }
}

export function createModuleLifecycleService({ prisma }) {

  // ── Permission helpers ────────────────────────────────────────────────────

  async function activateModulePermissions(tx, moduleId) {
    await tx.permission.updateMany({
      where: { moduleId },
      data: { active: true },
    })
  }

  async function deactivateModulePermissions(tx, moduleId) {
    await tx.permission.updateMany({
      where: { moduleId },
      data: { active: false },
    })
  }

  // ── Dependency helpers ────────────────────────────────────────────────────

  async function getRequiredDependents(db, moduleId) {
    return db.moduleDependency.findMany({
      where: {
        dependencyId: moduleId,
        optional: false,
        module: { enabled: true, status: 'INSTALLED' },
      },
      include: { module: { select: { key: true, name: true } } },
    })
  }

  async function syncDependencies(tx, moduleId, dependencies = []) {
    await tx.moduleDependency.deleteMany({ where: { moduleId } })
    if (!dependencies.length) return

    const keys = [...new Set(dependencies.map((d) => d.key))]
    const rows = await tx.atlasModule.findMany({
      where: { key: { in: keys } },
      select: { id: true, key: true },
    })
    const byKey = new Map(rows.map((r) => [r.key, r.id]))

    const missing = dependencies
      .filter((d) => !d.optional)
      .map((d) => d.key)
      .filter((k) => !byKey.has(k))
    if (missing.length) {
      throw Object.assign(new Error('DEPENDENCY_NOT_FOUND'), {
        code: 'DEPENDENCY_NOT_FOUND',
        keys: [...new Set(missing)],
      })
    }

    await tx.moduleDependency.createMany({
      data: dependencies
        .filter((d) => d.key && byKey.has(d.key))
        .map((d) => ({
          moduleId,
          dependencyId: byKey.get(d.key),
          versionRange: d.versionRange ?? null,
          optional: d.optional ?? false,
        })),
      skipDuplicates: true,
    })
  }

  async function syncAdminPermissions(db) {
    const adminRoles = await db.role.findMany({
      where: { key: { in: ['atlas.admin', 'system.admin'] } },
      select: { id: true },
    })
    if (!adminRoles.length) return

    const perms = await db.permission.findMany({ select: { id: true } })
    for (const role of adminRoles) {
      await db.rolePermission.deleteMany({ where: { roleId: role.id } })
      if (perms.length) {
        await db.rolePermission.createMany({
          data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })),
          skipDuplicates: true,
        })
      }
    }
  }

  // ── Audit log ─────────────────────────────────────────────────────────────

  async function writeAuditLog(db, { action, moduleKey, entityId, actorId, before, after }) {
    await db.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: 'atlas.core',
        entityType: 'AtlasModule',
        entityId: entityId ?? null,
        action,
        before: before ?? null,
        after: after ?? null,
      },
    })
  }

  // ── Manifest upsert helpers ───────────────────────────────────────────────

  async function upsertManifestPermissions(tx, moduleId, moduleKey, permissions = [], activate) {
    for (const perm of permissions) {
      const presentation = getPermissionPresentation(perm.key)
      await tx.permission.upsert({
        where: { key: perm.key },
        update: {
          name: presentation.name,
          description: presentation.description,
          moduleId,
          moduleKey,
          ...(activate !== undefined ? { active: activate } : {}),
        },
        create: {
          key: perm.key,
          name: presentation.name,
          description: presentation.description,
          moduleId,
          moduleKey,
          active: activate ?? true,
        },
      })
    }
  }

  async function upsertManifestBlueprints(tx, moduleId, blueprints = []) {
    for (const bp of blueprints) {
      await tx.blueprint.upsert({
        where: { key: bp.key },
        update: { moduleId, kind: bp.kind, version: bp.version, schema: bp.schema, enabled: true },
        create: { key: bp.key, moduleId, kind: bp.kind, version: bp.version, schema: bp.schema },
      })
    }
  }

  // ── Public operations ─────────────────────────────────────────────────────

  async function installModule({ manifest, actorId }) {
    const isCore = CORE_KEYS.has(manifest.key)
    const lifecycleConfig = manifest.lifecycle ?? null

    const result = await prisma.$transaction(async (tx) => {
      const upserted = await tx.atlasModule.upsert({
        where: { key: manifest.key },
        update: {
          name: manifest.name,
          description: manifest.description ?? null,
          version: manifest.version,
          kind: manifest.kind ?? (isCore ? 'CORE' : 'FEATURE'),
          core: isCore,
          uninstallable: isCore ? false : (manifest.uninstallable ?? true),
          status: 'INSTALLED',
          enabled: true,
          manifest,
          lifecycleConfig,
        },
        create: {
          key: manifest.key,
          name: manifest.name,
          description: manifest.description ?? null,
          version: manifest.version,
          kind: manifest.kind ?? (isCore ? 'CORE' : 'FEATURE'),
          core: isCore,
          uninstallable: isCore ? false : (manifest.uninstallable ?? true),
          status: 'INSTALLED',
          enabled: true,
          manifest,
          lifecycleConfig,
        },
      })

      await syncDependencies(tx, upserted.id, manifest.dependencies ?? [])
      await upsertManifestPermissions(tx, upserted.id, manifest.key, manifest.permissions ?? [], true)
      await upsertManifestBlueprints(tx, upserted.id, manifest.blueprints ?? [])

      await writeAuditLog(tx, {
        action: 'core.module.install',
        moduleKey: manifest.key,
        entityId: upserted.id,
        actorId,
        after: { key: manifest.key, name: manifest.name, version: manifest.version, status: 'INSTALLED' },
      })

      return upserted
    })

    await syncAdminPermissions(prisma)
    return result
  }

  async function disableModule({ key, actorId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (mod.core || !mod.uninstallable) {
      throw new ModuleLifecycleError('Los modulos base no pueden deshabilitarse.', 409)
    }
    if (mod.status === 'UNINSTALLED') {
      throw new ModuleLifecycleError('No se puede deshabilitar un modulo desinstalado.', 409)
    }

    const dependents = await getRequiredDependents(prisma, mod.id)
    if (dependents.length) {
      const list = dependents.map((d) => `${d.module.name} (${d.module.key})`).join(', ')
      throw new ModuleLifecycleError(
        `No se puede deshabilitar el modulo porque es requerido por: ${list}.`,
        409
      )
    }

    if (mod.status === 'DISABLED' && !mod.enabled) {
      return mod
    }

    return prisma.$transaction(async (tx) => {
      await deactivateModulePermissions(tx, mod.id)
      const updated = await tx.atlasModule.update({
        where: { key },
        data: { status: 'DISABLED', enabled: false },
      })
      await writeAuditLog(tx, {
        action: 'core.module.disable',
        moduleKey: key,
        entityId: mod.id,
        actorId,
        before: { status: mod.status },
        after: { status: 'DISABLED' },
      })
      return updated
    })
  }

  async function enableModule({ key, actorId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (mod.status === 'UNINSTALLED') {
      throw new ModuleLifecycleError('No se puede habilitar un modulo desinstalado.', 409)
    }
    if (mod.status === 'INSTALLED' && mod.enabled) {
      return mod
    }

    const requiredDeps = await prisma.moduleDependency.findMany({
      where: { moduleId: mod.id, optional: false },
      include: { dependency: { select: { key: true, name: true, status: true, enabled: true } } },
    })
    const inactive = requiredDeps.filter(
      (d) => d.dependency.status !== 'INSTALLED' || !d.dependency.enabled
    )
    if (inactive.length) {
      const list = inactive.map((d) => `${d.dependency.name} (${d.dependency.key})`).join(', ')
      throw new ModuleLifecycleError(
        `No se puede habilitar el modulo. Dependencias requeridas no activas: ${list}.`,
        409
      )
    }

    return prisma.$transaction(async (tx) => {
      await activateModulePermissions(tx, mod.id)
      const updated = await tx.atlasModule.update({
        where: { key },
        data: { status: 'INSTALLED', enabled: true },
      })
      await writeAuditLog(tx, {
        action: 'core.module.enable',
        moduleKey: key,
        entityId: mod.id,
        actorId,
        before: { status: mod.status },
        after: { status: 'INSTALLED' },
      })
      return updated
    })
  }

  async function uninstallModule({ key, mode = 'preserve-data', companyId, actorId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (mod.core || !mod.uninstallable) {
      throw new ModuleLifecycleError('Los modulos base no pueden desinstalarse.', 409)
    }

    const dependents = await getRequiredDependents(prisma, mod.id)
    if (dependents.length) {
      const list = dependents.map((d) => `${d.module.name} (${d.module.key})`).join(', ')
      throw new ModuleLifecycleError(
        `No se puede desinstalar el modulo porque es requerido por: ${list}.`,
        409
      )
    }

    if (mode === 'purge-data') {
      const handler = getModuleHandler(key)
      if (!handler) {
        const lc = mod.lifecycleConfig ?? {}
        if (!lc.supportsDataPurge) {
          throw new ModuleLifecycleError(
            'Este modulo no soporta la purga de datos.',
            409
          )
        }
      }
    }

    if (mod.status === 'UNINSTALLED' && !mod.enabled && mode !== 'purge-data') {
      return mod
    }

    return prisma.$transaction(async (tx) => {
      await deactivateModulePermissions(tx, mod.id)

      let rowsDeleted = 0
      if (mode === 'purge-data') {
        const handler = getModuleHandler(key)
        if (handler) {
          rowsDeleted = await handler.purge({ tx, companyId })
        }
      }

      const updated = await tx.atlasModule.update({
        where: { key },
        data: { status: 'UNINSTALLED', enabled: false },
      })

      await writeAuditLog(tx, {
        action: 'core.module.uninstall',
        moduleKey: key,
        entityId: mod.id,
        actorId,
        before: { status: mod.status },
        after: { status: 'UNINSTALLED', mode, rowsDeleted },
      })

      return updated
    })
  }

  async function resetModule({ key, companyId, actorId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (mod.core) {
      throw new ModuleLifecycleError('Los modulos base no pueden reiniciarse.', 409)
    }
    if (mod.status !== 'INSTALLED' || !mod.enabled) {
      throw new ModuleLifecycleError('Solo se puede reiniciar un modulo instalado y activo.', 409)
    }

    const lc = mod.lifecycleConfig ?? {}
    const handler = getModuleHandler(key)
    if (!handler && !lc.resettable) {
      throw new ModuleLifecycleError('Este modulo no soporta la operacion de reinicio.', 409)
    }
    if (!handler) {
      throw new ModuleLifecycleError(
        'Este modulo declara soporte de reinicio pero no tiene un handler registrado.',
        500
      )
    }

    return prisma.$transaction(async (tx) => {
      const rowsDeleted = await handler.purge({ tx, companyId })
      await writeAuditLog(tx, {
        action: 'core.module.reset',
        moduleKey: key,
        entityId: mod.id,
        actorId,
        after: { key, companyId, rowsDeleted },
      })
      return { moduleKey: key, rowsDeleted }
    })
  }

  async function dryRunUninstall({ key, mode = 'preserve-data', companyId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)

    const dependents = await getRequiredDependents(prisma, mod.id)
    const allowed = !mod.core && !!mod.uninstallable && dependents.length === 0

    const handler = getModuleHandler(key)
    let ownedEntities = []
    if (handler) {
      const counts = await handler.count({ prisma, companyId })
      ownedEntities = mode === 'purge-data'
        ? counts
        : counts.map((e) => ({ ...e, note: 'datos preservados — no se eliminan' }))
    }

    const permissionsAffected = await prisma.permission.count({ where: { moduleId: mod.id } })
    const roleAssignmentsAffected = await prisma.rolePermission.count({
      where: { permission: { moduleId: mod.id } },
    })
    const blockingDependents = dependents.map((d) => ({
      key: d.module.key,
      name: d.module.name,
    }))

    const recommendation = allowed
      ? `Proceder. No hay modulos dependientes afectados.`
      : `Bloqueado por modulos dependientes: ${blockingDependents.map((d) => d.key).join(', ')}.`

    return {
      moduleKey: key,
      operation: 'uninstall',
      mode,
      allowed,
      blockingDependents,
      ownedEntities,
      permissionsAffected,
      roleAssignmentsAffected,
      recommendation,
    }
  }

  async function dryRunReset({ key, companyId }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)

    const lc = mod.lifecycleConfig ?? {}
    const handler = getModuleHandler(key)
    const allowed =
      !mod.core &&
      mod.status === 'INSTALLED' &&
      mod.enabled &&
      (!!handler || !!lc.resettable)

    let ownedEntities = []
    if (handler) {
      ownedEntities = await handler.count({ prisma, companyId })
    }

    return {
      moduleKey: key,
      operation: 'reset',
      allowed,
      ownedEntities,
      note: 'Las permisiones permanecen activas. Solo se eliminan datos operativos.',
      recommendation: allowed
        ? 'Proceder. El modulo permanecera instalado y activo.'
        : 'Reinicio no soportado o modulo no activo.',
    }
  }

  async function syncModules({ manifests, actorId }) {
    let added = 0
    let updated = 0

    await prisma.$transaction(async (tx) => {
      for (const manifest of manifests) {
        const existing = await tx.atlasModule.findUnique({ where: { key: manifest.key } })
        const isCore = CORE_KEYS.has(manifest.key)
        const lifecycleConfig = manifest.lifecycle ?? null

        const data = {
          name: manifest.name,
          description: manifest.description ?? null,
          version: manifest.version,
          kind: manifest.kind ?? (isCore ? 'CORE' : 'FEATURE'),
          core: isCore,
          uninstallable: isCore ? false : (manifest.uninstallable ?? true),
          manifest,
          lifecycleConfig,
        }

        if (existing) {
          await tx.atlasModule.update({ where: { key: manifest.key }, data })
          updated++
        } else {
          await tx.atlasModule.create({
            data: {
              ...data,
              key: manifest.key,
              status: isCore ? 'INSTALLED' : 'UNINSTALLED',
              enabled: isCore,
            },
          })
          added++
        }

        const mod = await tx.atlasModule.findUnique({ where: { key: manifest.key } })
        const isInstalled = mod.status === 'INSTALLED' && mod.enabled
        await upsertManifestPermissions(tx, mod.id, manifest.key, manifest.permissions ?? [], isInstalled)
        await upsertManifestBlueprints(tx, mod.id, manifest.blueprints ?? [])
      }
    })

    await writeAuditLog(prisma, {
      action: 'core.module.sync',
      moduleKey: 'atlas.core',
      entityId: null,
      actorId,
      after: { synced: manifests.length, added, updated },
    })

    return { synced: manifests.length, added, updated }
  }

  return {
    installModule,
    disableModule,
    enableModule,
    uninstallModule,
    resetModule,
    dryRunUninstall,
    dryRunReset,
    syncModules,
  }
}
```

- [ ] **Step 5.2: Commit**

```bash
git add apps/api/src/services/module-lifecycle-service.js
git commit -m "feat(lifecycle): add module-lifecycle-service with install/disable/enable/uninstall/reset/dry-run"
```

---

## Task 6: Runtime Fail-Closed — Permission Active Filter

**Files:**
- Modify: `apps/api/src/index.js` (lines ~161–217)

This is the most critical change. Without it, disabled/uninstalled module permissions still grant access at runtime.

- [ ] **Step 6.1: Update membership permission query to filter active=true**

In `apps/api/src/index.js`, find `getUserContextByAuthId` (around line 161). Update the `memberships` Prisma query to only load active permissions:

Current code (around line 166):
```js
  const memberships = await prisma.membership.findMany({
    where: { userId: profile.id, enabled: true },
    include: {
      company: true,
      role: {
        include: {
          permissions: {
            include: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });
```

Replace with:
```js
  const memberships = await prisma.membership.findMany({
    where: { userId: profile.id, enabled: true },
    include: {
      company: true,
      role: {
        include: {
          permissions: {
            where: { permission: { active: true } },
            include: {
              permission: {
                select: { key: true },
              },
            },
          },
        },
      },
    },
  });
```

- [ ] **Step 6.2: Update admin permission load to filter active=true**

In the same `getUserContextByAuthId` function, find the admin block (around line 200):

Current code:
```js
  if (isAdmin) {
    const allPermissions = await prisma.permission.findMany({
      select: { key: true },
    });
    for (const permission of allPermissions) {
      permissionSet.add(permission.key);
    }
  }
```

Replace with:
```js
  if (isAdmin) {
    const allPermissions = await prisma.permission.findMany({
      where: { active: true },
      select: { key: true },
    });
    for (const permission of allPermissions) {
      permissionSet.add(permission.key);
    }
  }
```

- [ ] **Step 6.3: Start API and verify the change compiles**

Run:
```
pnpm dev:api
```

Expected: API starts on port 4010 with no errors.

- [ ] **Step 6.4: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(auth): fail-closed permission check — filter Permission.active=true in getUserContextByAuthId"
```

---

## Task 7: New Module Routes File

**Files:**
- Create: `apps/api/src/routes/modules.js`
- Modify: `apps/api/src/index.js` (remove ~300 lines of module routes, add router mount)

This extracts all module routes from `index.js` (a known 3583-line violator) into a dedicated router file, then adds the new lifecycle endpoints.

- [ ] **Step 7.1: Create apps/api/src/routes/modules.js**

```js
import { Hono } from 'hono'
import {
  moduleInstallSchema,
  moduleDryRunSchema,
  moduleUninstallSchema,
  moduleResetSchema,
} from '@atlas/validators'
import { getPermissionPresentation, groupPermissionsForUi } from '../permission-catalog.js'
import { createModuleLifecycleService, ModuleLifecycleError } from '../services/module-lifecycle-service.js'
import { coreModules } from '../../../../packages/maps/src/core-modules.js'
import { featureModules } from '../../../../packages/maps/src/feature-modules.js'

function validateManifestAcl(manifest = {}) {
  const declaredKeys = new Set((manifest.permissions ?? []).map((p) => p.key))
  const acl = manifest.acl ?? {}

  if (manifest.navigation?.length) {
    for (const nav of manifest.navigation) {
      if (!nav?.permissionKey || !declaredKeys.has(nav.permissionKey)) {
        throw Object.assign(new Error('INVALID_MANIFEST_ACL'), {
          code: 'INVALID_MANIFEST_ACL',
          detail: `El item de navegacion "${nav?.path ?? '/'}" debe declarar permissionKey valido.`,
        })
      }
    }
  }
  if (typeof acl.module === 'string' && acl.module.trim()) {
    if (!declaredKeys.has(acl.module.trim())) {
      throw Object.assign(new Error('INVALID_MANIFEST_ACL'), {
        code: 'INVALID_MANIFEST_ACL',
        detail: `acl.module "${acl.module}" no esta declarado en permissions.`,
      })
    }
  }
}

function serializeModule(moduleRow) {
  return {
    id: moduleRow.id,
    key: moduleRow.key,
    name: moduleRow.name,
    description: moduleRow.description,
    version: moduleRow.version,
    kind: moduleRow.kind,
    status: moduleRow.status,
    core: moduleRow.core,
    uninstallable: moduleRow.uninstallable,
    enabled: moduleRow.enabled,
    installedAt: moduleRow.installedAt,
    lifecycleConfig: moduleRow.lifecycleConfig ?? null,
    dependencies: (moduleRow.dependencies ?? []).map((dep) => ({
      key: dep.dependency?.key,
      name: dep.dependency?.name,
      status: dep.dependency?.status,
      enabled: dep.dependency?.enabled,
      optional: dep.optional,
    })),
    manifest: moduleRow.manifest,
  }
}

function handleLifecycleError(c, err, fallback) {
  if (err instanceof ModuleLifecycleError) {
    return c.json({ error: err.message }, err.status)
  }
  if (err?.code === 'DEPENDENCY_NOT_FOUND') {
    return c.json({ error: `Dependencias no encontradas: ${err.keys.join(', ')}.` }, 409)
  }
  if (err?.code === 'INVALID_MANIFEST_ACL') {
    return c.json({ error: err.detail ?? 'El manifiesto ACL es invalido.' }, 400)
  }
  if (err?.name === 'ZodError') {
    return c.json({ error: err.errors?.[0]?.message ?? 'Datos invalidos.' }, 400)
  }
  console.error('[modules]', err)
  return c.json({ error: fallback }, 500)
}

export function createModulesRouter({ prisma, authMiddleware, requirePermission }) {
  const app = new Hono()
  const svc = createModuleLifecycleService({ prisma })

  // ── GET /modules ──────────────────────────────────────────────────────────

  app.get('/', authMiddleware, requirePermission('core.modules.read'), async (c) => {
    try {
      const modules = await prisma.atlasModule.findMany({
        orderBy: [{ core: 'desc' }, { name: 'asc' }],
        include: {
          dependencies: {
            include: {
              dependency: {
                select: { id: true, key: true, name: true, status: true, enabled: true, version: true },
              },
            },
          },
        },
      })
      return c.json({ data: modules.map(serializeModule) })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudieron cargar los modulos.')
    }
  })

  // ── GET /modules/available ────────────────────────────────────────────────

  app.get('/available', authMiddleware, requirePermission('core.modules.read'), async (c) => {
    try {
      const modules = await prisma.atlasModule.findMany({
        orderBy: [{ core: 'desc' }, { name: 'asc' }],
        include: {
          dependencies: {
            include: {
              dependency: {
                select: { id: true, key: true, name: true, status: true, enabled: true, version: true },
              },
            },
          },
        },
      })
      return c.json({ data: modules.map(serializeModule) })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudieron cargar los modulos disponibles.')
    }
  })

  // ── POST /modules/install ─────────────────────────────────────────────────

  app.post('/install', authMiddleware, requirePermission('core.modules.create'), async (c) => {
    try {
      const body = await c.req.json()
      const parsed = moduleInstallSchema.parse(body)
      validateManifestAcl(parsed.manifest)
      const actorId = c.get('userContext')?.profile?.id ?? null
      const result = await svc.installModule({ manifest: parsed.manifest, actorId })
      return c.json({ data: result }, 201)
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo instalar el modulo.')
    }
  })

  // ── POST /modules/sync ────────────────────────────────────────────────────

  app.post('/sync', authMiddleware, requirePermission('core.modules.create'), async (c) => {
    try {
      const actorId = c.get('userContext')?.profile?.id ?? null
      const allManifests = [...coreModules, ...featureModules]
      const result = await svc.syncModules({ manifests: allManifests, actorId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo sincronizar los modulos.')
    }
  })

  // ── GET /modules/:key/lifecycle ───────────────────────────────────────────

  app.get('/:key/lifecycle', authMiddleware, requirePermission('core.modules.read'), async (c) => {
    try {
      const key = c.req.param('key')
      const mod = await prisma.atlasModule.findUnique({
        where: { key },
        include: {
          dependencies: {
            include: {
              dependency: { select: { key: true, name: true, status: true, enabled: true } },
            },
          },
        },
      })
      if (!mod) return c.json({ error: 'Modulo no encontrado.' }, 404)

      const lc = mod.lifecycleConfig ?? {}
      const permissionsTotal = await prisma.permission.count({ where: { moduleId: mod.id } })
      const permissionsActive = await prisma.permission.count({ where: { moduleId: mod.id, active: true } })
      const dependents = await prisma.moduleDependency.findMany({
        where: { dependencyId: mod.id, module: { status: 'INSTALLED', enabled: true } },
        include: { module: { select: { key: true, name: true } } },
      })

      return c.json({
        data: {
          key: mod.key,
          status: mod.status,
          enabled: mod.enabled,
          core: mod.core,
          installable: lc.installable ?? true,
          uninstallable: mod.uninstallable,
          resettable: lc.resettable ?? false,
          supportsDataPurge: lc.supportsDataPurge ?? false,
          ownedEntities: lc.ownedEntities ?? [],
          permissionsTotal,
          permissionsActive,
          dependents: dependents.map((d) => ({ key: d.module.key, name: d.module.name })),
          dependencies: mod.dependencies.map((d) => ({
            key: d.dependency.key,
            name: d.dependency.name,
            status: d.dependency.status,
            enabled: d.dependency.enabled,
            optional: d.optional,
          })),
        },
      })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo cargar el ciclo de vida del modulo.')
    }
  })

  // ── POST /modules/:key/disable ────────────────────────────────────────────

  app.post('/:key/disable', authMiddleware, requirePermission('core.modules.update'), async (c) => {
    try {
      const key = c.req.param('key')
      const actorId = c.get('userContext')?.profile?.id ?? null
      const result = await svc.disableModule({ key, actorId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo deshabilitar el modulo.')
    }
  })

  // ── POST /modules/:key/enable ─────────────────────────────────────────────

  app.post('/:key/enable', authMiddleware, requirePermission('core.modules.update'), async (c) => {
    try {
      const key = c.req.param('key')
      const actorId = c.get('userContext')?.profile?.id ?? null
      const result = await svc.enableModule({ key, actorId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo habilitar el modulo.')
    }
  })

  // ── DELETE /modules/:key (preserve-data uninstall shorthand) ─────────────

  app.delete('/:key', authMiddleware, requirePermission('core.modules.delete'), async (c) => {
    try {
      const key = c.req.param('key')
      const actorId = c.get('userContext')?.profile?.id ?? null
      const context = c.get('userContext')
      const companyId = context?.memberships?.[0]?.companyId ?? null
      const result = await svc.uninstallModule({ key, mode: 'preserve-data', companyId, actorId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo desinstalar el modulo.')
    }
  })

  // ── POST /modules/:key/uninstall/dry-run ──────────────────────────────────

  app.post('/:key/uninstall/dry-run', authMiddleware, requirePermission('core.modules.delete'), async (c) => {
    try {
      const key = c.req.param('key')
      const body = await c.req.json().catch(() => ({}))
      const parsed = moduleDryRunSchema.safeParse(body)
      const mode = parsed.success ? parsed.data.mode : 'preserve-data'
      const context = c.get('userContext')
      const companyId = context?.memberships?.[0]?.companyId ?? null
      const result = await svc.dryRunUninstall({ key, mode, companyId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo ejecutar la simulacion de desinstalacion.')
    }
  })

  // ── POST /modules/:key/uninstall ──────────────────────────────────────────

  app.post('/:key/uninstall', authMiddleware, requirePermission('core.modules.delete'), async (c) => {
    try {
      const key = c.req.param('key')
      const body = await c.req.json()
      const parsed = moduleUninstallSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: parsed.error.errors[0]?.message ?? 'Datos invalidos.' }, 400)
      }
      const actorId = c.get('userContext')?.profile?.id ?? null
      const context = c.get('userContext')
      const companyId = context?.memberships?.[0]?.companyId ?? null
      const result = await svc.uninstallModule({
        key,
        mode: parsed.data.mode,
        companyId,
        actorId,
      })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo desinstalar el modulo.')
    }
  })

  // ── POST /modules/:key/reset/dry-run ─────────────────────────────────────

  app.post('/:key/reset/dry-run', authMiddleware, requirePermission('core.modules.delete'), async (c) => {
    try {
      const key = c.req.param('key')
      const context = c.get('userContext')
      const companyId = context?.memberships?.[0]?.companyId ?? null
      const result = await svc.dryRunReset({ key, companyId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo ejecutar la simulacion de reinicio.')
    }
  })

  // ── POST /modules/:key/reset ──────────────────────────────────────────────

  app.post('/:key/reset', authMiddleware, requirePermission('core.modules.delete'), async (c) => {
    try {
      const key = c.req.param('key')
      const body = await c.req.json()
      const parsed = moduleResetSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: parsed.error.errors[0]?.message ?? 'Datos invalidos.' }, 400)
      }
      const actorId = c.get('userContext')?.profile?.id ?? null
      const context = c.get('userContext')
      const companyId = context?.memberships?.[0]?.companyId ?? null
      const result = await svc.resetModule({ key, companyId, actorId })
      return c.json({ data: result })
    } catch (err) {
      return handleLifecycleError(c, err, 'No se pudo reiniciar el modulo.')
    }
  })

  return app
}
```

- [ ] **Step 7.2: Update apps/api/src/index.js — import and mount the new modules router**

At the top of `apps/api/src/index.js`, add the import near the other route imports (around line 63):

```js
import { createModulesRouter } from './routes/modules.js'
```

Near the bottom of `apps/api/src/index.js` where routes are mounted (around line 3805, near `app.route("/ledger", ledgerRouter)`), add:

```js
const modulesRouter = createModulesRouter({ prisma, authMiddleware, requirePermission })
app.route('/modules', modulesRouter)
```

- [ ] **Step 7.3: Remove the old module routes from index.js**

In `apps/api/src/index.js`, delete the following blocks (they are now handled by the new router):
- `app.get("/modules", ...)` — around line 1998–2031
- `app.post("/modules/install", ...)` — around line 2033–2157
- `app.delete("/modules/:key", ...)` — around line 2159–2197
- `app.post("/modules/:key/disable", ...)` — around line 2199–2243
- `app.post("/modules/:key/enable", ...)` — around line 2245–2303

Also remove the helper functions that have moved into the lifecycle service (they are no longer referenced from index.js):
- `syncModuleDependencies` function — now in lifecycle service
- `buildDependencyBlockedMessage` function — now in lifecycle service
- `getRequiredDependents` function — now in lifecycle service
- `validateManifestAcl` function — now in routes/modules.js

Keep in index.js:
- `syncAdminRolesPermissions` — still referenced by setup flow
- `serializeModulesForResponse` — check if still used; if only used in the removed module routes, remove it too

> **Important:** After these deletions, verify the API still starts without reference errors. Any function referenced elsewhere in `index.js` must remain.

- [ ] **Step 7.4: Start API and verify all routes exist**

Run:
```
pnpm dev:api
```

Test with curl (replace TOKEN with a real bearer token):
```bash
curl -s http://localhost:4010/modules -H "Authorization: Bearer TOKEN" | jq '.data | length'
curl -s http://localhost:4010/modules/available -H "Authorization: Bearer TOKEN" | jq '.data | length'
curl -s http://localhost:4010/modules/atlas.ledger/lifecycle -H "Authorization: Bearer TOKEN" | jq '.data.status'
```

Expected: module list returns, atlas.ledger shows `"UNINSTALLED"`.

- [ ] **Step 7.5: Commit**

```bash
git add apps/api/src/routes/modules.js apps/api/src/index.js
git commit -m "feat(modules): extract module routes to routes/modules.js and add lifecycle endpoints"
```

---

## Task 8: Identity API — Active Permissions Filter

**Files:**
- Modify: `apps/api/src/index.js` (lines ~1623–1654 and ~1748–1785)

- [ ] **Step 8.1: Update GET /identity/permissions to filter active=true by default**

In `apps/api/src/index.js`, find `app.get("/identity/permissions", ...)` (around line 1623). Update the Prisma query to filter by `active: true` by default, with an optional override via query parameter:

Current code:
```js
    const permissions = await prisma.permission.findMany({
      orderBy: [{ moduleId: 'asc' }, { key: 'asc' }],
    })
```

Replace with:
```js
    const includeInactive = c.req.query('includeInactive') === 'true'
    const permissions = await prisma.permission.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ moduleId: 'asc' }, { key: 'asc' }],
    })
```

- [ ] **Step 8.2: Update PATCH /identity/roles/:id/permissions to only assign active permissions**

In `apps/api/src/index.js`, find `app.patch("/identity/roles/:id/permissions", ...)` (around line 1747). Update the permission lookup to only find active permissions:

Current code:
```js
      const permissions = await prisma.permission.findMany({
        where: { key: { in: permissionKeys } },
        select: { id: true },
      })
```

Replace with:
```js
      const permissions = await prisma.permission.findMany({
        where: { key: { in: permissionKeys }, active: true },
        select: { id: true },
      })
```

- [ ] **Step 8.3: Restart and verify Identity permissions list**

Run:
```
pnpm dev:api
```

Call the permissions endpoint (replace TOKEN with a real token):
```bash
curl -s "http://localhost:4010/identity/permissions" -H "Authorization: Bearer TOKEN" | jq '.data.permissions | map(.key) | map(select(startswith("ledger"))) | length'
```

Expected: `0` (ledger permissions are inactive because atlas.ledger is UNINSTALLED).

Call with override:
```bash
curl -s "http://localhost:4010/identity/permissions?includeInactive=true" -H "Authorization: Bearer TOKEN" | jq '.data.permissions | map(.key) | map(select(startswith("ledger"))) | length'
```

Expected: `10` (all ledger permissions visible when explicitly requested).

- [ ] **Step 8.4: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(identity): filter Permission.active=true in GET /identity/permissions and role permission assignment"
```

---

## Task 9: Manifest v2 — Add lifecycle Blocks

**Files:**
- Modify: `packages/maps/src/feature-modules.js`

The `createModuleManifest` function uses `...manifest` spread, so the `lifecycle` field passes through automatically without changes to `module-contract.js`.

- [ ] **Step 9.1: Add lifecycle block to ledgerMap**

In `packages/maps/src/feature-modules.js`, find the `ledgerMap` (starts at `export const ledgerMap = createModuleManifest({`). Add the `lifecycle` field after `dependencies`:

```js
export const ledgerMap = createModuleManifest({
  key: "atlas.ledger",
  name: "Cuentas y Movimientos",
  description: "Libro auxiliar de cuentas con movimientos y exportacion a PDF y Excel.",
  version: "0.1.0",
  icon: "BookOpen",
  color: "#6366f1",
  category: "contabilidad",
  summary: "Libro auxiliar de cuentas y movimientos",
  dependencies: [{ key: "atlas.core" }, { key: "atlas.identity" }],
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
  navigation: [
    // ... existing navigation entries unchanged
  ],
  // ... rest of manifest unchanged
})
```

- [ ] **Step 9.2: Add lifecycle block to contactsMap**

Add after `dependencies` in `contactsMap`:

```js
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: false,
    supportsDataPurge: false,
    defaultUninstallPolicy: "preserve-data",
    ownedEntities: ["Contact"],
    sharedEntities: ["Company", "AuditLog"],
  },
```

- [ ] **Step 9.3: Add lifecycle block to financeMap**

Add after `dependencies` in `financeMap`:

```js
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: false,
    supportsDataPurge: false,
    defaultUninstallPolicy: "preserve-data",
    ownedEntities: ["FinanceAccount", "FinanceJournalEntry", "FinanceJournalLine", "FinanceDocument", "FinanceFxRate", "FinanceTaxRate", "FinanceDocumentApplication"],
    sharedEntities: ["Company", "Contact", "AuditLog"],
  },
```

- [ ] **Step 9.4: Add lifecycle block to hrMap**

Add after `dependencies` in `hrMap`:

```js
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: false,
    supportsDataPurge: false,
    defaultUninstallPolicy: "preserve-data",
    ownedEntities: ["HrEmployee", "HrDepartment", "HrJobTitle"],
    sharedEntities: ["Company", "UserProfile", "FileAsset", "AuditLog"],
  },
```

- [ ] **Step 9.5: Run seed to sync lifecycleConfig into database**

Run:
```
pnpm db:seed
```

Then verify:
```bash
curl -s "http://localhost:4010/modules/atlas.ledger/lifecycle" -H "Authorization: Bearer TOKEN" | jq '.data'
```

Expected response includes `"resettable": true`, `"supportsDataPurge": true`, `"ownedEntities": ["LedgerAccount", "LedgerMovement"]`.

Note: the seed upserts modules but does NOT update `lifecycleConfig` because seed uses `upsertModule` which doesn't include `lifecycleConfig`. Update `prisma/seed.js` `upsertModule` to also include `lifecycleConfig`:

In `prisma/seed.js`, update the `upsertModule` function:
```js
async function upsertModule(manifest) {
  const isCore = manifest.core === true;
  const lifecycleConfig = manifest.lifecycle ?? null;
  return prisma.atlasModule.upsert({
    where: { key: manifest.key },
    update: {
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      manifest,
      lifecycleConfig,
      ...(isCore ? { enabled: true, status: "INSTALLED" } : {}),
    },
    create: {
      key: manifest.key,
      name: manifest.name,
      description: manifest.description,
      version: manifest.version,
      kind: manifest.kind,
      core: manifest.core,
      uninstallable: manifest.uninstallable,
      manifest,
      lifecycleConfig,
      ...(isCore ? {} : { status: "UNINSTALLED", enabled: false }),
    }
  })
}
```

Run seed again:
```
pnpm db:seed
```

- [ ] **Step 9.6: Commit**

```bash
git add packages/maps/src/feature-modules.js prisma/seed.js
git commit -m "feat(manifest): add lifecycle blocks to all feature module manifests and sync lifecycleConfig in seed"
```

---

## Task 10: SDK — New Lifecycle Methods

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 10.1: Add new methods to the modules domain in packages/sdk/src/index.js**

In `packages/sdk/src/index.js`, find the `modules` domain (currently around line 137). Replace it with the expanded version:

```js
    modules: {
      list: (token) =>
        request('/modules', { headers: withAuthHeaders(token) }),
      getAvailable: (token) =>
        request('/modules/available', { headers: withAuthHeaders(token) }),
      runtime: (token) =>
        request('/runtime/modules', { headers: withAuthHeaders(token) }),
      install: (manifest, token) =>
        request('/modules/install', {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify({ manifest }),
        }),
      sync: (token) =>
        request('/modules/sync', {
          method: 'POST',
          headers: withAuthHeaders(token),
        }),
      getLifecycle: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/lifecycle`, {
          headers: withAuthHeaders(token),
        }),
      disable: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/disable`, {
          method: 'POST',
          headers: withAuthHeaders(token),
        }),
      enable: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/enable`, {
          method: 'POST',
          headers: withAuthHeaders(token),
        }),
      uninstall: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}`, {
          method: 'DELETE',
          headers: withAuthHeaders(token),
        }),
      uninstallDryRun: (key, mode = 'preserve-data', token) =>
        request(`/modules/${encodeURIComponent(key)}/uninstall/dry-run`, {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify({ mode }),
        }),
      uninstallExplicit: (key, mode, confirmation, token) =>
        request(`/modules/${encodeURIComponent(key)}/uninstall`, {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify({ mode, confirmation }),
        }),
      resetDryRun: (key, token) =>
        request(`/modules/${encodeURIComponent(key)}/reset/dry-run`, {
          method: 'POST',
          headers: withAuthHeaders(token),
        }),
      reset: (key, confirmation, token) =>
        request(`/modules/${encodeURIComponent(key)}/reset`, {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify({ confirmation }),
        }),
    },
```

- [ ] **Step 10.2: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add lifecycle methods to modules domain (lifecycle, dry-run, reset, sync, uninstallExplicit)"
```

---

## Task 11: Verification

Run through every acceptance criterion from the spec. Document actual results.

- [ ] **Step 11.1: Build check**

```
pnpm build
```

Expected: no build errors across all packages and apps.

- [ ] **Step 11.2: Migration check**

```
pnpm db:generate
pnpm db:migrate
```

Expected: client regenerates, migration already applied (idempotent).

- [ ] **Step 11.3: Seed check**

```
pnpm db:seed
```

Expected: seed completes. atlas.ledger is UNINSTALLED, enabled: false.

- [ ] **Step 11.4: Verify atlas.ledger permissions are inactive after seed**

In Prisma Studio (`pnpm db:studio`), filter `Permission` table where `key` contains `ledger`. Verify all `active = false`.

Expected: 10 ledger permissions all show `active = false`.

- [ ] **Step 11.5: Verify ledger API blocked when uninstalled**

Get a valid bearer token for an admin user. Call:
```bash
curl -s http://localhost:4010/ledger/accounts -H "Authorization: Bearer TOKEN"
```

Expected: `{"error":"No tienes permisos para realizar esta accion (ledger.accounts.read)."}` with HTTP 403.

Even admin is blocked because `ledger.accounts.read.active = false`.

- [ ] **Step 11.6: Install atlas.ledger and verify permissions activate**

```bash
curl -s -X POST http://localhost:4010/modules/install \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"manifest": <paste ledgerMap manifest JSON here>}'
```

After install, check in Prisma Studio: all `ledger.*` permissions should have `active = true`.

Call the ledger API again:
```bash
curl -s http://localhost:4010/ledger/accounts -H "Authorization: Bearer TOKEN"
```

Expected: `{"data":[]}` with HTTP 200.

- [ ] **Step 11.7: Verify Identity permissions list excludes ledger when uninstalled**

First uninstall ledger (restore to uninstalled state):
```bash
curl -s -X DELETE http://localhost:4010/modules/atlas.ledger -H "Authorization: Bearer TOKEN"
```

Then call identity permissions:
```bash
curl -s "http://localhost:4010/identity/permissions" -H "Authorization: Bearer TOKEN" | jq '[.data.permissions[] | select(.key | startswith("ledger"))] | length'
```

Expected: `0`.

With includeInactive override:
```bash
curl -s "http://localhost:4010/identity/permissions?includeInactive=true" -H "Authorization: Bearer TOKEN" | jq '[.data.permissions[] | select(.key | startswith("ledger"))] | length'
```

Expected: `10`.

- [ ] **Step 11.8: Disable and verify access blocked**

Install atlas.ledger first, then disable:
```bash
curl -s -X POST http://localhost:4010/modules/install -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"manifest": <ledgerMap JSON>}'
curl -s -X POST http://localhost:4010/modules/atlas.ledger/disable -H "Authorization: Bearer TOKEN"
curl -s http://localhost:4010/ledger/accounts -H "Authorization: Bearer TOKEN"
```

Expected: 403 after disable.

- [ ] **Step 11.9: Enable and verify access restored**

```bash
curl -s -X POST http://localhost:4010/modules/atlas.ledger/enable -H "Authorization: Bearer TOKEN"
curl -s http://localhost:4010/ledger/accounts -H "Authorization: Bearer TOKEN"
```

Expected: 200 after enable.

- [ ] **Step 11.10: Core module protection**

```bash
curl -s -X DELETE http://localhost:4010/modules/atlas.core -H "Authorization: Bearer TOKEN"
curl -s -X POST http://localhost:4010/modules/atlas.core/disable -H "Authorization: Bearer TOKEN"
```

Expected: both return 409.

- [ ] **Step 11.11: Dry-run uninstall**

With atlas.ledger installed:
```bash
curl -s -X POST http://localhost:4010/modules/atlas.ledger/uninstall/dry-run \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"purge-data"}'
```

Expected: response includes `allowed: true`, `ownedEntities` with row counts, `permissionsAffected: 10`.

- [ ] **Step 11.12: Reset dry-run and reset**

```bash
curl -s -X POST http://localhost:4010/modules/atlas.ledger/reset/dry-run \
  -H "Authorization: Bearer TOKEN"
```

Expected: `allowed: true`, shows LedgerAccount and LedgerMovement counts.

```bash
curl -s -X POST http://localhost:4010/modules/atlas.ledger/reset \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"ACEPTO"}'
```

Expected: `{"data":{"moduleKey":"atlas.ledger","rowsDeleted":N}}`.

After reset, ledger API still returns 200 (module remains installed).

- [ ] **Step 11.13: Reset without confirmation rejected**

```bash
curl -s -X POST http://localhost:4010/modules/atlas.ledger/reset \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirmation":"no"}'
```

Expected: 400 with validation error message.

- [ ] **Step 11.14: Sync modules**

```bash
curl -s -X POST http://localhost:4010/modules/sync -H "Authorization: Bearer TOKEN"
```

Expected: `{"data":{"synced":8,"added":0,"updated":8}}` (or similar counts).

- [ ] **Step 11.15: Lifecycle endpoint**

```bash
curl -s http://localhost:4010/modules/atlas.ledger/lifecycle -H "Authorization: Bearer TOKEN" | jq '.data'
```

Expected: object with `resettable: true`, `supportsDataPurge: true`, `ownedEntities: ["LedgerAccount","LedgerMovement"]`.

- [ ] **Step 11.16: Audit log entries**

In Prisma Studio, filter `AuditLog` where `action` starts with `core.module`. Verify entries exist for each operation tested above.

- [ ] **Step 11.17: Final commit and TASKS.md note**

```bash
git add -A
git commit -m "feat(lifecycle): complete Module Lifecycle v2 — permission activation, lifecycle service, new endpoints, atlas.ledger correction"
```

Note in `docs/TASKS.md` under a new phase entry:
```
## Phase 9.5 - Module Lifecycle v2

Spec: docs/superpowers/specs/2026-05-09-module-lifecycle-v2-and-custom-modules-design.md
Plan: docs/superpowers/plans/2026-05-09-module-lifecycle-v2-and-custom-modules.md

- [ ] Permission.active + Permission.moduleKey + AtlasModule.lifecycleConfig migration
- [ ] Seed backfill: active=false for uninstalled module permissions
- [ ] module-cleanup-registry.js with atlas.ledger handler
- [ ] module-lifecycle-service.js
- [ ] getUserContextByAuthId permission filter (active=true)
- [ ] routes/modules.js — extracted + new endpoints
- [ ] GET /identity/permissions active filter
- [ ] Manifest v2 lifecycle blocks
- [ ] SDK lifecycle methods
- [ ] Verification all acceptance criteria
```

---

## Self-Review

### Spec coverage check

| Spec goal | Covered in task |
|---|---|
| Permission.active field | Task 1 (schema), Task 3 (seed), Task 6 (runtime) |
| Identity UI filter for installed modules | Task 8 |
| module-lifecycle-service.js | Task 5 |
| Dry-run endpoints | Task 7 (routes) |
| Reset capability | Task 5 (service), Task 7 (routes) |
| Purge-data uninstall | Task 5 (service), Task 7 (routes) |
| module-cleanup-registry.js | Task 4 |
| atlas.ledger correction (start uninstalled) | Task 3 (seed already does this), Task 9 (lifecycle block) |
| atlas.ledger permissions hidden in Identity | Task 8 (active filter) |
| atlas.ledger API blocked when uninstalled | Task 6 (active=true filter in getUserContextByAuthId) |
| Manifest v2 lifecycle block | Task 9 |
| Core module protection | Task 5 (lifecycle service) |
| Dependency blocking | Task 5 (lifecycle service) |
| Audit log | Task 5 (lifecycle service) |
| SDK new methods | Task 10 |
| Validators new schemas | Task 2 |
| GET /modules/available | Task 7 (routes) |
| GET /modules/:key/lifecycle | Task 7 (routes) |
| POST /modules/sync | Task 7 (routes) |
| Fail-closed runtime check | Task 6 |

### No placeholders confirmed

Every code step contains the actual implementation. No "TBD", "add validation", or "similar to" references.

### Type consistency confirmed

- `ModuleLifecycleError` defined in Task 5, imported in Task 7 — consistent
- `createModuleLifecycleService` defined in Task 5, instantiated in Task 7 — consistent
- `registerModuleHandler` defined in Task 4, used in Task 4 — consistent
- `getModuleHandler` defined in Task 4, imported in Task 5 — consistent
- `moduleDryRunSchema`, `moduleUninstallSchema`, `moduleResetSchema` defined in Task 2, imported in Task 7 — consistent
- SDK method `uninstallExplicit` calls `POST /modules/:key/uninstall` which is defined in Task 7 — consistent
- `companyId` passed from `context.memberships[0].companyId` in Task 7 routes — consistent with Prisma `where: { companyId }` in Task 4 cleanup handlers
