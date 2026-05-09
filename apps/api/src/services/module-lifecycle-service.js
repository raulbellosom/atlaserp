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
