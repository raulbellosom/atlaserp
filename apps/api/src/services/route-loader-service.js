import fs from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Hono } from 'hono'
import { resolveProjectRoot } from './module-discovery-service.js'

function isWithinPath(parentPath, childPath) {
  const rel = path.relative(parentPath, childPath)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function toPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value
}

export function createRouteLoaderService({ prisma, authMiddleware, requirePermission }) {
  let modulesRoot = null
  const routerMap = new Map()
  const routeStatusMap = new Map()
  const componentRegistryStore = new Map()
  let middlewareRegistered = false

  const ComponentRegistry = {
    __activeModuleKey: null,
    register(moduleKeyOrName, nameOrComponent, maybeComponent) {
      let moduleKey = null
      let name = null
      let component = null

      if (typeof maybeComponent !== 'undefined') {
        moduleKey = moduleKeyOrName
        name = nameOrComponent
        component = maybeComponent
      } else {
        moduleKey = this.__activeModuleKey
        name = moduleKeyOrName
        component = nameOrComponent
      }

      if (typeof moduleKey !== 'string' || !moduleKey.trim()) {
        throw new Error('ComponentRegistry.register requires moduleKey (or active module context).')
      }
      if (typeof name !== 'string' || !name.trim()) {
        throw new Error('ComponentRegistry.register requires a component name.')
      }

      const safeModuleKey = moduleKey.trim()
      const safeName = name.trim()
      const byModule = componentRegistryStore.get(safeModuleKey) ?? new Map()
      byModule.set(safeName, component)
      componentRegistryStore.set(safeModuleKey, byModule)
    },
    has(moduleKey, name) {
      return componentRegistryStore.get(moduleKey)?.has(name) ?? false
    },
    get(moduleKey, name) {
      return componentRegistryStore.get(moduleKey)?.get(name) ?? null
    },
    getModuleComponents(moduleKey) {
      const byModule = componentRegistryStore.get(moduleKey)
      if (!byModule) return {}
      return Object.fromEntries(byModule.entries())
    },
  }

  function setModuleRouteStatus(moduleKey, status, details = {}) {
    routeStatusMap.set(moduleKey, {
      moduleKey,
      status,
      updatedAt: new Date().toISOString(),
      ...details,
    })
  }

  function ensurePathInsideModules(resolvedPath, label) {
    if (!modulesRoot) {
      throw new Error('Route loader modules root is not initialized.')
    }
    const absolutePath = path.resolve(resolvedPath)
    if (!isWithinPath(modulesRoot, absolutePath)) {
      throw new Error(`${label} resolves outside modules root: ${absolutePath}`)
    }
    return absolutePath
  }

  async function resolveModuleDir(moduleRow) {
    if (!modulesRoot) {
      const projectRoot = await resolveProjectRoot()
      modulesRoot = path.resolve(projectRoot, 'modules')
    }
    const lifecycleConfig = toPlainObject(moduleRow.lifecycleConfig)
    const discovery = toPlainObject(lifecycleConfig.discovery)
    const localPath =
      typeof discovery.localPath === 'string' && discovery.localPath.trim()
        ? discovery.localPath.trim()
        : null

    if (localPath) {
      const projectRoot = path.dirname(modulesRoot)
      const fromDiscovery = ensurePathInsideModules(
        path.resolve(projectRoot, localPath),
        `module directory for ${moduleRow.key}`
      )
      if (await pathExists(fromDiscovery)) {
        return fromDiscovery
      }
    }

    const customDir = ensurePathInsideModules(
      path.resolve(modulesRoot, 'custom', moduleRow.key),
      `custom module directory for ${moduleRow.key}`
    )
    if (await pathExists(customDir)) return customDir

    const officialDir = ensurePathInsideModules(
      path.resolve(modulesRoot, 'official', moduleRow.key),
      `official module directory for ${moduleRow.key}`
    )
    if (await pathExists(officialDir)) return officialDir

    return customDir
  }

  async function resolveModuleApiPath(moduleRow) {
    const moduleDir = await resolveModuleDir(moduleRow)
    return ensurePathInsideModules(
      path.resolve(moduleDir, 'api', 'index.js'),
      `api/index.js for ${moduleRow.key}`
    )
  }

  async function resolveModuleComponentsPath(moduleRow) {
    const moduleDir = await resolveModuleDir(moduleRow)
    return ensurePathInsideModules(
      path.resolve(moduleDir, 'components', 'index.js'),
      `components/index.js for ${moduleRow.key}`
    )
  }

  async function markModuleRouteError(moduleKey, errorMessage) {
    const mod = await prisma.atlasModule.findUnique({
      where: { key: moduleKey },
      select: { lifecycleConfig: true },
    })
    if (!mod) return
    const lifecycleConfig = toPlainObject(mod.lifecycleConfig)
    const routeLoader = {
      status: 'ERROR',
      error: typeof errorMessage === 'string' ? errorMessage : 'Unknown route loader error',
      updatedAt: new Date().toISOString(),
    }
    await prisma.atlasModule.update({
      where: { key: moduleKey },
      data: {
        lifecycleConfig: {
          ...lifecycleConfig,
          routeLoader,
        },
      },
    })
  }

  function wrapWithAuth(moduleRouter) {
    const securedRouter = new Hono()
    securedRouter.use('*', authMiddleware)
    securedRouter.route('/', moduleRouter)
    return securedRouter
  }

  async function loadModuleRouter(moduleRow) {
    const moduleKey = moduleRow.key
    const apiPath = await resolveModuleApiPath(moduleRow)

    if (!(await pathExists(apiPath))) {
      setModuleRouteStatus(moduleKey, 'MISSING_API', { apiPath })
      return { loaded: false, reason: 'missing_api' }
    }

    const moduleNamespace = await import(pathToFileURL(apiPath).href)
    const factory =
      typeof moduleNamespace.default === 'function'
        ? moduleNamespace.default
        : typeof moduleNamespace.createRouter === 'function'
          ? moduleNamespace.createRouter
          : null

    if (!factory) {
      throw new Error(`api/index.js does not export a router factory function for ${moduleKey}.`)
    }

    const moduleRouter = await factory({
      prisma,
      requirePermission,
      moduleContext: {
        moduleKey,
        manifest: moduleRow.manifest ?? null,
      },
    })

    if (!moduleRouter || typeof moduleRouter.fetch !== 'function' || !moduleRouter.router?.match) {
      throw new Error(`Router factory for ${moduleKey} did not return a valid Hono app.`)
    }

    const securedRouter = wrapWithAuth(moduleRouter)
    routerMap.set(moduleKey, {
      moduleKey,
      apiPath,
      router: moduleRouter,
      securedRouter,
      loadedAt: new Date().toISOString(),
    })

    setModuleRouteStatus(moduleKey, 'LOADED', { apiPath })
    return { loaded: true, reason: 'ok' }
  }

  async function loadModuleComponents(moduleRow) {
    const moduleKey = moduleRow.key
    const componentsPath = await resolveModuleComponentsPath(moduleRow)

    if (!(await pathExists(componentsPath))) {
      return { loaded: false, reason: 'missing_components' }
    }

    const moduleNamespace = await import(pathToFileURL(componentsPath).href)
    const registerFn =
      typeof moduleNamespace.register === 'function'
        ? moduleNamespace.register
        : typeof moduleNamespace.default?.register === 'function'
          ? moduleNamespace.default.register
          : null

    if (!registerFn) {
      return { loaded: false, reason: 'no_register_export' }
    }

    const previousActive = ComponentRegistry.__activeModuleKey
    ComponentRegistry.__activeModuleKey = moduleKey
    try {
      await registerFn(ComponentRegistry)
    } finally {
      ComponentRegistry.__activeModuleKey = previousActive
    }

    return { loaded: true, reason: 'ok' }
  }

  function buildDelegationMiddleware() {
    return async (c, next) => {
      const method = c.req.method.toUpperCase()
      const requestPath = c.req.path

      for (const entry of routerMap.values()) {
        const matches = entry.router.router.match(method, requestPath)
        const hasMatch = Array.isArray(matches?.[0]) && matches[0].length > 0
        if (!hasMatch) continue

        let executionCtx
        try {
          executionCtx = c.executionCtx
        } catch {
          executionCtx = undefined
        }

        if (typeof executionCtx === 'undefined') {
          return entry.securedRouter.fetch(c.req.raw, c.env)
        }

        return entry.securedRouter.fetch(c.req.raw, c.env, executionCtx)
      }

      await next()
    }
  }

  async function initialize(app) {
    if (!modulesRoot) {
      const projectRoot = await resolveProjectRoot()
      modulesRoot = path.resolve(projectRoot, 'modules')
    }

    const installedModules = await prisma.atlasModule.findMany({
      where: { status: 'INSTALLED', enabled: true },
      orderBy: [{ core: 'desc' }, { key: 'asc' }],
      select: {
        key: true,
        manifest: true,
        lifecycleConfig: true,
      },
    })

    for (const moduleRow of installedModules) {
      try {
        await loadModuleRouter(moduleRow)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[route-loader] ${moduleRow.key}: ${message}`)
        setModuleRouteStatus(moduleRow.key, 'ERROR', { error: message })
        await markModuleRouteError(moduleRow.key, message)
      }

      try {
        await loadModuleComponents(moduleRow)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[route-loader] components ${moduleRow.key}: ${message}`)
      }
    }

    if (!middlewareRegistered) {
      app.use('*', buildDelegationMiddleware())
      middlewareRegistered = true
    }
  }

  async function reloadModule(moduleKey) {
    const key = typeof moduleKey === 'string' ? moduleKey.trim() : ''
    if (!key) return { loaded: false, reason: 'invalid_module_key' }

    routerMap.delete(key)
    const moduleRow = await prisma.atlasModule.findUnique({
      where: { key },
      select: { key: true, status: true, enabled: true, manifest: true, lifecycleConfig: true },
    })
    if (!moduleRow || moduleRow.status !== 'INSTALLED' || !moduleRow.enabled) {
      setModuleRouteStatus(key, 'UNLOADED', { reason: 'module_not_active' })
      return { loaded: false, reason: 'module_not_active' }
    }

    try {
      const result = await loadModuleRouter(moduleRow)
      try {
        await loadModuleComponents(moduleRow)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[route-loader] components ${key}: ${message}`)
      }
      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[route-loader] ${key}: ${message}`)
      setModuleRouteStatus(key, 'ERROR', { error: message })
      await markModuleRouteError(key, message)
      return { loaded: false, reason: 'error', error: message }
    }
  }

  function unloadModule(moduleKey) {
    const key = typeof moduleKey === 'string' ? moduleKey.trim() : ''
    if (!key) return false
    const removed = routerMap.delete(key)
    setModuleRouteStatus(key, 'UNLOADED', { reason: 'manual_unload' })
    return removed
  }

  function getLoadedModules() {
    return [...routerMap.values()].map((entry) => ({
      moduleKey: entry.moduleKey,
      apiPath: entry.apiPath,
      loadedAt: entry.loadedAt,
    }))
  }

  function getModuleRouteStatus(moduleKey) {
    if (typeof moduleKey === 'string' && moduleKey.trim()) {
      return routeStatusMap.get(moduleKey.trim()) ?? null
    }
    return Object.fromEntries(routeStatusMap.entries())
  }

  return {
    initialize,
    reloadModule,
    unloadModule,
    getLoadedModules,
    getModuleRouteStatus,
  }
}
