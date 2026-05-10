import { Hono } from 'hono'
import {
  moduleInstallSchema,
  moduleDryRunSchema,
  moduleUninstallSchema,
  moduleResetSchema,
} from '@atlas/validators'
import { getPermissionPresentation, groupPermissionsForUi } from '../permission-catalog.js'
import { createModuleLifecycleService, ModuleLifecycleError } from '../services/module-lifecycle-service.js'
import { createModuleMetadataService } from '../services/module-metadata-service.js'
import { discoverModules, getDiscoveryRootInfo } from '../services/module-discovery-service.js'

const CORE_KEYS = new Set(['atlas.core', 'atlas.identity', 'atlas.files', 'atlas.company'])

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

function toErrorMessage(error) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  if (typeof error.message === 'string') return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return String(error)
  }
}

async function resolveSyncActorId(prisma, userContext) {
  const rawId = userContext?.profile?.id
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return null
  }

  const actorId = rawId.trim()
  const profile = await prisma.userProfile.findUnique({
    where: { id: actorId },
    select: { id: true },
  })
  return profile?.id ?? null
}

function serializeDiscoveredModule(record) {
  return {
    key: record?.key ?? null,
    source: record?.source ?? null,
    localPath: record?.localPath ?? null,
    moduleDir: record?.moduleDir ?? null,
    status: record?.status ?? 'ERROR',
    error: record?.error ?? null,
    modelsCount: Array.isArray(record?.models) ? record.models.length : 0,
    viewsCount: Array.isArray(record?.views) ? record.views.length : 0,
  }
}

async function upsertDiscoveredModuleError({ prisma, record }) {
  const key = typeof record?.key === 'string' && record.key.trim() ? record.key.trim() : null
  if (!key) return null

  const manifest = record?.manifest && typeof record.manifest === 'object' ? record.manifest : {}
  const isCore = CORE_KEYS.has(key)
  const name = typeof manifest.name === 'string' && manifest.name.trim() ? manifest.name.trim() : key
  const version =
    typeof manifest.version === 'string' && manifest.version.trim() ? manifest.version.trim() : '0.0.0'

  const discoveryError = {
    discovery: {
      status: 'ERROR',
      source: record.source ?? null,
      localPath: record.localPath ?? null,
      message: toErrorMessage(record.error),
      updatedAt: new Date().toISOString(),
    },
  }

  return prisma.atlasModule.upsert({
    where: { key },
    update: {
      name,
      description: typeof manifest.description === 'string' ? manifest.description : null,
      version,
      kind: manifest.kind ?? (isCore ? 'CORE' : 'FEATURE'),
      core: isCore,
      uninstallable: isCore ? false : (manifest.uninstallable ?? true),
      manifest: Object.keys(manifest).length ? manifest : { key, name, version },
      lifecycleConfig: discoveryError,
    },
    create: {
      key,
      name,
      description: typeof manifest.description === 'string' ? manifest.description : null,
      version,
      kind: manifest.kind ?? (isCore ? 'CORE' : 'FEATURE'),
      core: isCore,
      uninstallable: isCore ? false : (manifest.uninstallable ?? true),
      status: isCore ? 'INSTALLED' : 'UNINSTALLED',
      enabled: isCore,
      manifest: Object.keys(manifest).length ? manifest : { key, name, version },
      lifecycleConfig: discoveryError,
    },
  })
}

function normalizeManifestDependencies(dependencies = []) {
  const records = new Map()
  const safeDependencies = Array.isArray(dependencies) ? dependencies : []

  for (const dep of safeDependencies) {
    const rawKey = typeof dep === 'string' ? dep : dep?.key
    if (typeof rawKey !== 'string' || !rawKey.trim()) continue

    const key = rawKey.trim()
    const versionRange =
      typeof dep?.versionRange === 'string' && dep.versionRange.trim()
        ? dep.versionRange.trim()
        : null
    const optional = Boolean(dep?.optional)

    const current = records.get(key)
    if (!current) {
      records.set(key, { key, optional, versionRange })
      continue
    }

    records.set(key, {
      key,
      // If any declaration marks this dependency as required, keep required.
      optional: current.optional && optional,
      versionRange: versionRange ?? current.versionRange,
    })
  }

  return [...records.values()].sort((a, b) => a.key.localeCompare(b.key))
}

async function syncDiscoveredModuleDependencies({ prisma, moduleKey, dependencies = [] }) {
  const moduleRow = await prisma.atlasModule.findUnique({
    where: { key: moduleKey },
    select: { id: true, key: true },
  })

  if (!moduleRow) {
    return {
      key: moduleKey,
      declared: 0,
      synced: 0,
      removed: 0,
      missingRequired: [],
      missingOptional: [],
      error: {
        code: 'MODULE_NOT_FOUND_AFTER_SYNC',
        message: `No se encontro el modulo ${moduleKey} despues del sync lifecycle.`,
      },
    }
  }

  const normalizedDependencies = normalizeManifestDependencies(dependencies)
  const keys = normalizedDependencies.map((dep) => dep.key)
  const dependencyRows =
    keys.length > 0
      ? await prisma.atlasModule.findMany({
          where: { key: { in: keys } },
          select: { id: true, key: true },
        })
      : []

  const dependencyByKey = new Map(dependencyRows.map((row) => [row.key, row.id]))
  const missingRequired = normalizedDependencies
    .filter((dep) => !dep.optional && !dependencyByKey.has(dep.key))
    .map((dep) => dep.key)
  const missingOptional = normalizedDependencies
    .filter((dep) => dep.optional && !dependencyByKey.has(dep.key))
    .map((dep) => dep.key)
  const resolvable = normalizedDependencies.filter((dep) => dependencyByKey.has(dep.key))
  const desiredDependencyIds = new Set(resolvable.map((dep) => dependencyByKey.get(dep.key)))

  const txResult = await prisma.$transaction(async (tx) => {
    for (const dep of resolvable) {
      await tx.moduleDependency.upsert({
        where: {
          moduleId_dependencyId: {
            moduleId: moduleRow.id,
            dependencyId: dependencyByKey.get(dep.key),
          },
        },
        create: {
          moduleId: moduleRow.id,
          dependencyId: dependencyByKey.get(dep.key),
          optional: dep.optional,
          versionRange: dep.versionRange,
        },
        update: {
          optional: dep.optional,
          versionRange: dep.versionRange,
        },
      })
    }

    const currentRows = await tx.moduleDependency.findMany({
      where: { moduleId: moduleRow.id },
      select: { id: true, dependencyId: true },
    })
    const staleRowIds = currentRows
      .filter((row) => !desiredDependencyIds.has(row.dependencyId))
      .map((row) => row.id)

    if (staleRowIds.length > 0) {
      await tx.moduleDependency.deleteMany({
        where: {
          moduleId: moduleRow.id,
          id: { in: staleRowIds },
        },
      })
    }

    return {
      removed: staleRowIds.length,
      synced: resolvable.length,
    }
  })

  return {
    key: moduleRow.key,
    declared: normalizedDependencies.length,
    synced: txResult.synced,
    removed: txResult.removed,
    missingRequired,
    missingOptional,
    error: null,
  }
}

export function createModulesRouter({ prisma, authMiddleware, requirePermission }) {
  const app = new Hono()
  const svc = createModuleLifecycleService({ prisma })
  const metadataSvc = createModuleMetadataService({ prisma })

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
      const actorId = await resolveSyncActorId(prisma, c.get('userContext'))
      const discoveryRootInfo = await getDiscoveryRootInfo()
      const discovered = await discoverModules({ rootDir: discoveryRootInfo.projectRoot })

      const validModules = discovered.filter((record) => record.status === 'VALID' && record.manifest)
      const invalidModules = discovered.filter((record) => record.status !== 'VALID')

      let lifecycleSync = { synced: 0, added: 0, updated: 0 }
      if (validModules.length > 0) {
        lifecycleSync = await svc.syncModules({
          manifests: validModules.map((record) => record.manifest),
          actorId,
        })
      }

      const dependencySync = {
        synced: 0,
        removed: 0,
        errors: [],
        warnings: [],
        modules: [],
      }
      for (const record of validModules) {
        try {
          const moduleResult = await syncDiscoveredModuleDependencies({
            prisma,
            moduleKey: record.manifest.key,
            dependencies: record.manifest.dependencies ?? [],
          })
          dependencySync.synced += moduleResult.synced
          dependencySync.removed += moduleResult.removed
          dependencySync.modules.push(moduleResult)

          if (moduleResult.error) {
            dependencySync.errors.push({
              key: moduleResult.key,
              code: moduleResult.error.code,
              message: moduleResult.error.message,
            })
          }

          if (moduleResult.missingRequired.length > 0) {
            dependencySync.errors.push({
              key: moduleResult.key,
              code: 'MISSING_REQUIRED_DEPENDENCY',
              message: `Dependencias requeridas faltantes: ${moduleResult.missingRequired.join(', ')}`,
              missing: moduleResult.missingRequired,
            })
          }

          if (moduleResult.missingOptional.length > 0) {
            dependencySync.warnings.push({
              key: moduleResult.key,
              code: 'MISSING_OPTIONAL_DEPENDENCY',
              message: `Dependencias opcionales no encontradas: ${moduleResult.missingOptional.join(', ')}`,
              missing: moduleResult.missingOptional,
            })
          }
        } catch (error) {
          dependencySync.errors.push({
            key: record.key ?? record.manifest?.key ?? null,
            code: 'DEPENDENCY_SYNC_FAILED',
            message: toErrorMessage(error),
          })
        }
      }

      const metadataSync = {
        synced: 0,
        errors: [],
      }

      for (const record of validModules) {
        try {
          await metadataSvc.syncModuleMetadata({
            manifest: record.manifest,
            models: record.models ?? [],
            views: record.views ?? [],
          })
          metadataSync.synced += 1
        } catch (error) {
          metadataSync.errors.push({
            key: record.key ?? null,
            source: record.source ?? null,
            localPath: record.localPath ?? null,
            code: 'METADATA_SYNC_FAILED',
            message: toErrorMessage(error),
          })
        }
      }

      const invalidUpserts = []
      for (const record of invalidModules) {
        if (!record.key) continue
        const upserted = await upsertDiscoveredModuleError({ prisma, record })
        if (!upserted) continue
        invalidUpserts.push({
          key: upserted.key,
          status: upserted.status,
          enabled: upserted.enabled,
        })
      }

      const payload = {
        discovered: discovered.length,
        valid: validModules.length,
        invalid: invalidModules.length,
        lifecycleSync,
        dependencySync,
        metadataSync,
        invalidUpserts,
        modules: discovered.map(serializeDiscoveredModule),
      }

      if (process.env.NODE_ENV !== 'production') {
        payload.debug = {
          cwd: discoveryRootInfo.cwd,
          projectRoot: discoveryRootInfo.projectRoot,
          modulesDirExists: discoveryRootInfo.modulesDirExists,
          customModulesDirExists: discoveryRootInfo.customModulesDirExists,
        }
      }

      return c.json({ data: payload })
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
