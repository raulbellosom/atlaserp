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

const ROUTE_METHOD_SET = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])

function normalizeRouteMethod(value) {
  const method = typeof value === 'string' ? value.trim().toUpperCase() : ''
  return method
}

function normalizeRoutePath(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed === '/') return '/'
  const withSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  return withSlash.replace(/\/+$/, '')
}

function toRouteSignature(method, routePath) {
  return `${method} ${routePath}`
}

export function collectRouteSignatures(moduleRouter) {
  if (!moduleRouter || !Array.isArray(moduleRouter.routes)) return []
  const signatures = []
  for (const route of moduleRouter.routes) {
    const method = normalizeRouteMethod(route?.method)
    if (!ROUTE_METHOD_SET.has(method)) continue
    const routePath = normalizeRoutePath(route?.path)
    if (!routePath) continue
    signatures.push({
      method,
      path: routePath,
      signature: toRouteSignature(method, routePath),
    })
  }
  return signatures
}

class RouteCollisionError extends Error {
  constructor({ moduleKey, method, path: routePath, conflictingModuleKey }) {
    super(
      `Conflicto de ruta detectado (${method} ${routePath}) entre modulos ${conflictingModuleKey} y ${moduleKey}.`
    )
    this.name = 'RouteCollisionError'
    this.code = 'ROUTE_COLLISION'
    this.moduleKey = moduleKey
    this.method = method
    this.path = routePath
    this.conflictingModuleKey = conflictingModuleKey
  }
}

export function createRouteLoaderService({ prisma, authMiddleware, requirePermission, cache = null }) {
  let modulesRoot = null
  const routerMap = new Map()
  const routeOwnerMap = new Map()
  const routeSignaturesByModule = new Map()
  const routeStatusMap = new Map()
  const componentRegistryStore = new Map()
  const activeModuleKeySet = new Set()
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

  function normalizeModuleKey(value) {
    if (typeof value !== 'string' || !value.trim()) return null
    return value.trim()
  }

  function unloadModuleComponents(moduleKey) {
    const key = normalizeModuleKey(moduleKey)
    if (!key) return false
    activeModuleKeySet.delete(key)
    return componentRegistryStore.delete(key)
  }

  function unloadModuleRoutes(moduleKey) {
    const key = normalizeModuleKey(moduleKey)
    if (!key) return
    const signatures = routeSignaturesByModule.get(key) ?? []
    for (const signature of signatures) {
      const owner = routeOwnerMap.get(signature)
      if (owner?.moduleKey === key) {
        routeOwnerMap.delete(signature)
      }
    }
    routeSignaturesByModule.delete(key)
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

  async function markModuleRouteError(moduleKey, errorMessage, details = null) {
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
      ...(details && typeof details === 'object' ? details : {}),
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

  async function markModuleRouteLoaded(moduleKey, apiPath) {
    const mod = await prisma.atlasModule.findUnique({
      where: { key: moduleKey },
      select: { lifecycleConfig: true },
    })
    if (!mod) return
    const lifecycleConfig = toPlainObject(mod.lifecycleConfig)
    const existing = toPlainObject(lifecycleConfig.routeLoader)
    if (existing.status === 'LOADED') return
    await prisma.atlasModule.update({
      where: { key: moduleKey },
      data: {
        lifecycleConfig: {
          ...lifecycleConfig,
          routeLoader: {
            status: 'LOADED',
            apiPath,
            loadedAt: new Date().toISOString(),
          },
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
      cache,
      moduleContext: {
        moduleKey,
        manifest: moduleRow.manifest ?? null,
      },
    })

    if (!moduleRouter || typeof moduleRouter.fetch !== 'function' || !moduleRouter.router?.match) {
      throw new Error(`Router factory for ${moduleKey} did not return a valid Hono app.`)
    }

    const routeSignatures = collectRouteSignatures(moduleRouter)
    const collision = routeSignatures.find((routeInfo) => {
      const owner = routeOwnerMap.get(routeInfo.signature)
      return owner && owner.moduleKey !== moduleKey
    })
    if (collision) {
      const owner = routeOwnerMap.get(collision.signature)
      throw new RouteCollisionError({
        moduleKey,
        method: collision.method,
        path: collision.path,
        conflictingModuleKey: owner?.moduleKey ?? 'unknown',
      })
    }

    routeSignaturesByModule.set(moduleKey, routeSignatures.map((routeInfo) => routeInfo.signature))
    for (const routeInfo of routeSignatures) {
      routeOwnerMap.set(routeInfo.signature, {
        moduleKey,
        method: routeInfo.method,
        path: routeInfo.path,
      })
    }

    const securedRouter = wrapWithAuth(moduleRouter)
    routerMap.set(moduleKey, {
      moduleKey,
      apiPath,
      router: moduleRouter,
      securedRouter,
      routeSignatures,
      loadedAt: new Date().toISOString(),
    })
    activeModuleKeySet.add(moduleKey)

    setModuleRouteStatus(moduleKey, 'LOADED', { apiPath })
    markModuleRouteLoaded(moduleKey, apiPath).catch((err) => {
      console.error(`[route-loader] failed to persist LOADED status for ${moduleKey}:`, err.message)
    })
    return { loaded: true, reason: 'ok' }
  }

  async function loadModuleComponents(moduleRow) {
    const moduleKey = moduleRow.key
    unloadModuleComponents(moduleKey)
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

    await syncInstalledModules()

    if (!middlewareRegistered) {
      app.use('*', buildDelegationMiddleware())
      middlewareRegistered = true
    }
  }

  async function reloadModule(moduleKey) {
    const key = typeof moduleKey === 'string' ? moduleKey.trim() : ''
    if (!key) return { loaded: false, reason: 'invalid_module_key' }

    routerMap.delete(key)
    unloadModuleRoutes(key)
    unloadModuleComponents(key)
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
      if (err instanceof RouteCollisionError) {
        const collision = {
          code: err.code,
          moduleKey: key,
          conflictingModuleKey: err.conflictingModuleKey,
          method: err.method,
          path: err.path,
          signature: toRouteSignature(err.method, err.path),
        }
        setModuleRouteStatus(key, 'ERROR', { error: message, collision })
        await markModuleRouteError(key, message, { collision })
        return { loaded: false, reason: 'route_collision', error: message, collision }
      }
      setModuleRouteStatus(key, 'ERROR', { error: message })
      await markModuleRouteError(key, message)
      return { loaded: false, reason: 'error', error: message }
    }
  }

  function unloadModule(moduleKey) {
    const key = typeof moduleKey === 'string' ? moduleKey.trim() : ''
    if (!key) return false
    const removed = routerMap.delete(key)
    unloadModuleRoutes(key)
    unloadModuleComponents(key)
    setModuleRouteStatus(key, 'UNLOADED', { reason: 'manual_unload' })
    return removed
  }

  async function syncInstalledModules({ limitToModuleKeys = null } = {}) {
    const normalizedFilter = Array.isArray(limitToModuleKeys)
      ? [...new Set(limitToModuleKeys.map((key) => normalizeModuleKey(key)).filter(Boolean))]
      : null

    const whereClause = {
      status: 'INSTALLED',
      enabled: true,
      ...(normalizedFilter ? { key: { in: normalizedFilter } } : {}),
    }
    const installedModules = await prisma.atlasModule.findMany({
      where: whereClause,
      orderBy: [{ core: 'desc' }, { key: 'asc' }],
      select: {
        key: true,
        manifest: true,
        lifecycleConfig: true,
      },
    })

    const installedKeySet = new Set(installedModules.map((row) => row.key))
    const unloadCandidates = []
    for (const loadedKey of routerMap.keys()) {
      const inScope = !normalizedFilter || normalizedFilter.includes(loadedKey)
      if (inScope && !installedKeySet.has(loadedKey)) {
        unloadCandidates.push(loadedKey)
      }
    }
    for (const moduleKey of unloadCandidates) {
      unloadModule(moduleKey)
    }

    const reloaded = []
    for (const moduleRow of installedModules) {
      const status = await reloadModule(moduleRow.key)
      reloaded.push({ moduleKey: moduleRow.key, ...status })
    }

    return {
      loaded: getLoadedModules(),
      reloaded,
      unloaded: unloadCandidates,
      activeComponents: [...activeModuleKeySet.values()],
    }
  }

  function getLoadedModules() {
    return [...routerMap.values()].map((entry) => ({
      moduleKey: entry.moduleKey,
      apiPath: entry.apiPath,
      routes: Array.isArray(entry.routeSignatures)
        ? entry.routeSignatures.map((routeInfo) => ({
            method: routeInfo.method,
            path: routeInfo.path,
          }))
        : [],
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
    syncInstalledModules,
    getLoadedModules,
    getModuleRouteStatus,
  }
}
