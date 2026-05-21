import { getPermissionPresentation } from '../permission-catalog.js'
import { getModuleHandler } from './module-cleanup-registry.js'
import { createModuleMigrationService } from './module-migration-service.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { resolveProjectRoot } from './module-discovery-service.js'

const CORE_KEYS = new Set(['atlas.core', 'atlas.identity', 'atlas.files', 'atlas.company'])
const FAILED_INSTALL_CLEAR_MODES = new Set(['metadata-only', 'preserve-data', 'purge-empty-tables'])
const TABLE_NAME_PATTERN = /^[a-z][a-z0-9_]*$/

export class ModuleLifecycleError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ModuleLifecycleError'
    this.status = status
  }
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }
  return value
}

function uniqueStrings(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).filter((value) => typeof value === 'string' && value.trim()).map((value) => value.trim()))]
}

function classifyInstallFailureStage(err) {
  if (typeof err?.stage === 'string' && err.stage.trim()) return err.stage.trim()
  if (err?.name === 'ModuleOrmMigrationError') return 'orm_migration'
  if (err?.code === 'AME_ORM_MIGRATION_FAILED') return 'orm_migration'
  if (err?.code === 'AME_SQL_MIGRATION_EXECUTION_FAILED') return 'orm_migration'
  if (err?.name === 'ZodError') return 'validation'
  if (err?.code === 'DEPENDENCY_NOT_FOUND') return 'dependency_sync'
  if (err instanceof ModuleLifecycleError) return 'install'
  return 'unknown'
}

function isInstallFailureRetryable(stage, code) {
  if (stage === 'validation') return false
  if (code === 'DEPENDENCY_NOT_FOUND') return false
  return true
}

function gatherInstallDiagnostics(err) {
  const affectedTables = uniqueStrings([err?.tableName, err?.cause?.tableName])
  const affectedMigrations = uniqueStrings([err?.filename, err?.cause?.filename])
  return { affectedTables, affectedMigrations }
}

function toModuleTableName(tableName) {
  if (typeof tableName !== 'string' || !tableName.trim()) return null
  const trimmed = tableName.trim()
  if (!TABLE_NAME_PATTERN.test(trimmed)) return null
  return trimmed
}

function isWithinPath(parentPath, childPath) {
  const rel = path.relative(parentPath, childPath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

export function createModuleLifecycleService({ prisma }) {
  const migrationSvc = createModuleMigrationService({ prisma })

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
      throw new ModuleLifecycleError(
        `Dependencias requeridas no encontradas: ${[...new Set(missing)].join(', ')}.`,
        409
      )
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

  async function resolveRecoverableOwnedTables(moduleKey, lifecycleConfig) {
    const moduleModels = await prisma.atlasModel.findMany({
      where: { moduleKey },
      select: { tableName: true },
    })
    const modelTables = new Set(
      moduleModels
        .map((model) => toModuleTableName(model.tableName))
        .filter(Boolean)
    )
    const configuredTables = uniqueStrings(toPlainObject(lifecycleConfig).ownedTables)
      .map(toModuleTableName)
      .filter(Boolean)
    return configuredTables.filter((tableName) => modelTables.has(tableName))
  }

  async function getTableRowCount(tableName) {
    const safeTable = toModuleTableName(tableName)
    if (!safeTable) {
      throw new ModuleLifecycleError(`Nombre de tabla invalido: ${tableName ?? ''}.`, 400)
    }

    const existsRows = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ${safeTable}
      LIMIT 1
    `
    const exists = existsRows.length > 0
    if (!exists) return { tableName: safeTable, exists: false, rowCount: 0, hasData: false }

    const countRows = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::bigint AS count FROM "${safeTable}"`)
    const rowCount = Number(countRows?.[0]?.count ?? 0)
    return { tableName: safeTable, exists: true, rowCount, hasData: rowCount > 0 }
  }

  async function dryRunFailedInstallCleanup({ key }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)

    const ownedTables = await resolveRecoverableOwnedTables(mod.key, mod.lifecycleConfig)
    const tableChecks = []
    for (const tableName of ownedTables) {
      tableChecks.push(await getTableRowCount(tableName))
    }

    const dropCandidates = tableChecks.filter((entry) => entry.exists && !entry.hasData)
    const blockedByData = tableChecks.filter((entry) => entry.exists && entry.hasData)

    return {
      moduleKey: mod.key,
      status: mod.status,
      supported: ownedTables.length > 0,
      mode: 'purge-empty-tables',
      ownedTables,
      tableChecks,
      dropCandidates: dropCandidates.map((entry) => entry.tableName),
      blockedByData: blockedByData.map((entry) => ({ tableName: entry.tableName, rowCount: entry.rowCount })),
      requiresConfirmation: dropCandidates.length > 0,
    }
  }

  async function clearModuleInstallError({
    key,
    actorId,
    mode = 'preserve-data',
    confirmation = null,
  }) {
    if (!FAILED_INSTALL_CLEAR_MODES.has(mode)) {
      throw new ModuleLifecycleError('Modo de recuperacion invalido.', 400)
    }

    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (mod.core) {
      throw new ModuleLifecycleError('Los modulos base no pueden limpiarse por este flujo.', 409)
    }
    if (mod.status !== 'ERROR') {
      throw new ModuleLifecycleError('Solo se puede limpiar una instalacion fallida en estado ERROR.', 409)
    }

    const lifecycleConfig = toPlainObject(mod.lifecycleConfig)
    const priorError = toPlainObject(lifecycleConfig.lastError)
    const recoveredAt = new Date().toISOString()

    let droppedTables = []
    let removedMigrations = []

    if (mode === 'purge-empty-tables') {
      const dryRun = await dryRunFailedInstallCleanup({ key })
      if (!dryRun.supported) {
        throw new ModuleLifecycleError('Este modulo no soporta limpieza fisica segura.', 409)
      }
      if (confirmation !== 'ACEPTO') {
        throw new ModuleLifecycleError('Debes escribir "ACEPTO" para confirmar la limpieza.', 400)
      }

      for (const candidate of dryRun.dropCandidates) {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${candidate}"`)
        droppedTables.push(candidate)
      }

      if (droppedTables.length > 0) {
        const migrationRows = await prisma.moduleMigration.findMany({
          where: { moduleKey: key },
          select: { id: true, filename: true },
        })
        const toDeleteIds = migrationRows
          .filter((row) => droppedTables.some((tableName) => row.filename.startsWith(`${tableName}__`)))
          .map((row) => row.id)

        if (toDeleteIds.length > 0) {
          await prisma.moduleMigration.deleteMany({ where: { id: { in: toDeleteIds } } })
          removedMigrations = migrationRows
            .filter((row) => toDeleteIds.includes(row.id))
            .map((row) => row.filename)
        }
      }
    }

    const updated = await prisma.$transaction(async (tx) => {
      await deactivateModulePermissions(tx, mod.id)
      const nextLifecycleConfig = {
        ...lifecycleConfig,
        lastRecovery: {
          mode,
          recoveredAt,
          actorId: actorId ?? null,
          previousStatus: mod.status,
          previousEnabled: mod.enabled,
          droppedTables,
          removedMigrations,
        },
        lastError: priorError,
      }
      const result = await tx.atlasModule.update({
        where: { key },
        data: { status: 'UNINSTALLED', enabled: false, lifecycleConfig: nextLifecycleConfig },
      })
      await writeAuditLog(tx, {
        action: mode === 'purge-empty-tables' ? 'core.module.failed_install.cleanup' : 'core.module.failed_install.clear',
        moduleKey: key,
        entityId: mod.id,
        actorId,
        before: { status: mod.status, enabled: mod.enabled },
        after: {
          status: result.status,
          enabled: result.enabled,
          mode,
          droppedTables,
          removedMigrations,
        },
      })
      return result
    })

    return {
      module: updated,
      recovery: {
        mode,
        droppedTables,
        removedMigrations,
      },
    }
  }

  async function persistInstallFailure({
    moduleKey,
    actorId,
    requestId = null,
    err,
  }) {
    if (!moduleKey) return
    const mod = await prisma.atlasModule.findUnique({ where: { key: moduleKey } })
    if (!mod) return

    const stage = classifyInstallFailureStage(err)
    const code = err?.code ?? (err instanceof ModuleLifecycleError ? 'LIFECYCLE_ERROR' : 'INTERNAL_ERROR')
    const diagnostics = gatherInstallDiagnostics(err)
    const retryable = isInstallFailureRetryable(stage, code)
    const lifecycleConfig = toPlainObject(mod.lifecycleConfig)
    const lastError = {
      code,
      stage,
      message: err?.message ?? 'No se pudo instalar el modulo.',
      cause: err?.cause?.message ?? null,
      requestId: requestId ?? null,
      failedAt: new Date().toISOString(),
      retryable,
      affectedTables: diagnostics.affectedTables,
      affectedMigrations: diagnostics.affectedMigrations,
    }

    await prisma.$transaction(async (tx) => {
      await deactivateModulePermissions(tx, mod.id)
      await tx.atlasModule.update({
        where: { key: moduleKey },
        data: {
          status: 'ERROR',
          enabled: false,
          lifecycleConfig: {
            ...lifecycleConfig,
            lastError,
          },
        },
      })
      await writeAuditLog(tx, {
        action: 'core.module.install.error',
        moduleKey,
        entityId: mod.id,
        actorId,
        before: { status: mod.status, enabled: mod.enabled },
        after: {
          status: 'ERROR',
          enabled: false,
          lastError,
        },
      })
    })
  }

  async function clearLastInstallError(moduleKey) {
    if (!moduleKey) return
    const mod = await prisma.atlasModule.findUnique({ where: { key: moduleKey } })
    if (!mod) return
    const lifecycleConfig = toPlainObject(mod.lifecycleConfig)
    if (!Object.prototype.hasOwnProperty.call(lifecycleConfig, 'lastError')) {
      return
    }
    const nextLifecycleConfig = { ...lifecycleConfig }
    delete nextLifecycleConfig.lastError
    await prisma.atlasModule.update({
      where: { key: moduleKey },
      data: { lifecycleConfig: nextLifecycleConfig },
    })
  }

  async function upsertManifestPermissions(tx, moduleId, moduleKey, permissions = [], activate) {
    if (!permissions.length) return
    const keys = permissions.map((p) => p.key)

    // Insert only new permissions in one batch; skip existing ones
    await tx.permission.createMany({
      data: permissions.map((p) => {
        const presentation = getPermissionPresentation(p.key)
        return {
          key: p.key,
          name: presentation.name,
          description: presentation.description,
          moduleId,
          moduleKey,
          active: activate ?? true,
        }
      }),
      skipDuplicates: true,
    })

    // Sync moduleId, moduleKey, and active for all permissions in one batch
    await tx.permission.updateMany({
      where: { key: { in: keys } },
      data: {
        moduleId,
        moduleKey,
        ...(activate !== undefined ? { active: activate } : {}),
      },
    })
  }

  async function upsertManifestBlueprints(tx, moduleId, blueprints = []) {
    if (!blueprints.length) return

    await tx.blueprint.createMany({
      data: blueprints.map((bp) => ({
        key: bp.key,
        moduleId,
        kind: bp.kind,
        version: bp.version,
        schema: bp.schema,
      })),
      skipDuplicates: true,
    })

    for (const bp of blueprints) {
      await tx.blueprint.update({
        where: { key: bp.key },
        data: { moduleId, kind: bp.kind, version: bp.version, schema: bp.schema, enabled: true },
      })
    }
  }

  async function resolveModuleDirectory({ moduleKey, lifecycleConfig }) {
    const projectRoot = await resolveProjectRoot()
    const modulesRoot = path.resolve(projectRoot, 'modules')
    const discovery = toPlainObject(lifecycleConfig).discovery
    const localPath = typeof discovery?.localPath === 'string' ? discovery.localPath.trim() : ''
    const candidates = []
    if (localPath) {
      candidates.push(path.resolve(projectRoot, localPath))
    }
    candidates.push(path.resolve(modulesRoot, 'custom', moduleKey))
    candidates.push(path.resolve(modulesRoot, 'official', moduleKey))

    for (const candidate of candidates) {
      if (!candidate || !isWithinPath(modulesRoot, candidate)) continue
      try {
        const stat = await fs.stat(candidate)
        if (stat.isDirectory()) return candidate
      } catch {
        continue
      }
    }
    return null
  }

  async function applyModuleManifestMigrations({ moduleKey, manifest, lifecycleConfig, actorId }) {
    const migrations = Array.isArray(manifest?.migrations) ? manifest.migrations : []
    if (!migrations.length) return []

    const moduleDir = await resolveModuleDirectory({ moduleKey, lifecycleConfig })
    if (!moduleDir) {
      throw new Error(`Manifest migrations require module directory for "${moduleKey}", but none was found.`)
    }

    const results = []
    for (let i = 0; i < migrations.length; i += 1) {
      const migration = migrations[i]
      if (!migration || typeof migration !== 'object' || Array.isArray(migration)) {
        throw new Error(`manifest.migrations[${i}] must be an object`)
      }
      const declaredPath =
        typeof migration.path === 'string' && migration.path.trim() ? migration.path.trim() : null
      if (!declaredPath) {
        throw new Error(`manifest.migrations[${i}].path is required`)
      }
      const declaredChecksum =
        typeof migration.checksum === 'string' && migration.checksum.trim()
          ? migration.checksum.trim().toLowerCase()
          : null
      if (!declaredChecksum) {
        throw new Error(`manifest.migrations[${i}].checksum is required`)
      }

      const migrationPath = path.resolve(moduleDir, declaredPath)
      if (!isWithinPath(moduleDir, migrationPath)) {
        throw new Error(`manifest.migrations[${i}] path resolves outside module directory`)
      }
      const sql = await fs.readFile(migrationPath, 'utf8')
      const computedChecksum = createHash('sha256').update(sql).digest('hex')
      if (computedChecksum !== declaredChecksum) {
        throw new Error(
          `Checksum mismatch for ${declaredPath}: expected ${declaredChecksum}, got ${computedChecksum}`
        )
      }

      const filename = `manifest__${declaredPath.replaceAll('\\', '/').replaceAll('/', '__')}`
      const applyResult = await migrationSvc.applySqlMigration({
        moduleKey,
        filename,
        sql,
      })

      if (applyResult.applied && applyResult.migration?.id) {
        await prisma.auditLog.create({
          data: {
            actorId: actorId ?? null,
            moduleKey: 'atlas.core',
            entityType: 'ModuleMigration',
            entityId: applyResult.migration.id,
            action: 'atlas.orm.migrate.manifest',
            before: null,
            after: {
              moduleKey,
              filename,
              sourcePath: declaredPath,
              checksum: computedChecksum,
            },
          },
        })
      }

      results.push({
        filename,
        path: declaredPath,
        applied: applyResult.applied,
      })
    }

    return results
  }

  // ── ORM migration helpers ─────────────────────────────────────────────────

  async function applyModuleOrmMigrations({ moduleKey, actorId }) {
    const models = await prisma.atlasModel.findMany({
      where: { moduleKey },
      select: { schema: true },
    })
    if (!models.length) return

    const modelSchemas = models.map((m) => m.schema)
    const plans = await migrationSvc.planModelMigrations({ moduleKey, models: modelSchemas })

    for (const plan of plans) {
      if (!plan.shouldApply) continue
      let applyResult
      try {
        applyResult = await migrationSvc.applySqlMigration({
          moduleKey: plan.moduleKey,
          filename: plan.filename,
          sql: plan.sql,
        })
      } catch (err) {
        const ormErr = new Error(
          `ORM migration failed for table '${plan.tableName}' (${plan.filename}): ${err.message}`
        )
        ormErr.name = 'ModuleOrmMigrationError'
        ormErr.code = 'AME_ORM_MIGRATION_FAILED'
        ormErr.moduleKey = moduleKey
        ormErr.tableName = plan.tableName
        ormErr.filename = plan.filename
        ormErr.stage = 'orm_migration'
        ormErr.cause = err
        throw ormErr
      }
      const { migration } = applyResult
      await prisma.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: 'atlas.core',
          entityType: 'ModuleMigration',
          entityId: migration.id,
          action: 'atlas.orm.migrate',
          before: null,
          after: {
            moduleKey: plan.moduleKey,
            filename: plan.filename,
            tableName: plan.tableName,
            checksum: plan.checksum,
          },
        },
      })
    }
  }

  // ── Public operations ─────────────────────────────────────────────────────

  async function installModule({ manifest, actorId, requestId = null }) {
    const isCore = CORE_KEYS.has(manifest.key)
    const lifecycleConfig = manifest.lifecycle ?? null
    let result = null

    try {
      result = await prisma.$transaction(async (tx) => {
        const existing = await tx.atlasModule.findUnique({
          where: { key: manifest.key },
          select: { lifecycleConfig: true },
        })
        const mergedLifecycleConfig = {
          ...toPlainObject(existing?.lifecycleConfig),
          ...toPlainObject(lifecycleConfig),
        }
        delete mergedLifecycleConfig.lastError

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
            lifecycleConfig: mergedLifecycleConfig,
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
            lifecycleConfig: mergedLifecycleConfig,
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

      try {
        await syncAdminPermissions(prisma)
      } catch (err) {
        console.error('[lifecycle] syncAdminPermissions failed after install:', err)
      }

      await applyModuleOrmMigrations({ moduleKey: manifest.key, actorId })
      await applyModuleManifestMigrations({
        moduleKey: manifest.key,
        manifest,
        lifecycleConfig: result?.lifecycleConfig ?? manifest.lifecycle ?? null,
        actorId,
      })
      await clearLastInstallError(manifest.key)
      return result
    } catch (err) {
      await persistInstallFailure({
        moduleKey: manifest?.key ?? null,
        actorId,
        requestId,
        err,
      })
      throw err
    }
  }

  async function getModuleInstallError({ key }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    return {
      key: mod.key,
      status: mod.status,
      enabled: mod.enabled,
      lastError: toPlainObject(mod.lifecycleConfig).lastError ?? null,
      lifecycleConfig: mod.lifecycleConfig ?? null,
    }
  }

  async function retryInstallModule({ key, actorId, requestId = null }) {
    const mod = await prisma.atlasModule.findUnique({ where: { key } })
    if (!mod) throw new ModuleLifecycleError('Modulo no encontrado.', 404)
    if (!mod.manifest || typeof mod.manifest !== 'object') {
      throw new ModuleLifecycleError('El modulo no tiene manifiesto persistido para reintentar.', 409)
    }

    const manifest = mod.manifest
    if (manifest.key !== key) {
      throw new ModuleLifecycleError('El manifiesto persistido no coincide con la clave del modulo.', 409)
    }

    return installModule({ manifest, actorId, requestId })
  }

  async function clearFailedInstall({ key, actorId, mode = 'preserve-data', confirmation = null }) {
    const normalizedMode = typeof mode === 'string' ? mode.trim() : ''
    if (normalizedMode === 'purge-empty-tables') {
      return clearModuleInstallError({ key, actorId, mode: normalizedMode, confirmation })
    }
    if (!FAILED_INSTALL_CLEAR_MODES.has(normalizedMode)) {
      throw new ModuleLifecycleError('Modo de recuperacion invalido.', 400)
    }
    return clearModuleInstallError({ key, actorId, mode: normalizedMode })
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
      if (!companyId) throw new ModuleLifecycleError('Se requiere companyId para calcular datos del modulo.', 400)
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

    // Process each module in its own short transaction to avoid timeout on large permission sets
    for (const manifest of manifests) {
      await prisma.$transaction(async (tx) => {
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
      })
    }

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
    retryInstallModule,
    getModuleInstallError,
    clearFailedInstall,
    dryRunFailedInstallCleanup,
    disableModule,
    enableModule,
    uninstallModule,
    resetModule,
    dryRunUninstall,
    dryRunReset,
    syncModules,
  }
}
