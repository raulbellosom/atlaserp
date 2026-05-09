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
