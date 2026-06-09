const CACHE_TTL_MS = 30_000

/**
 * Factory for the sdk.discovery namespace. Results are cached for 30s and deduplicated.
 * @param {{ request: Function }} deps
 * @returns {{ blueprints, modules, hasModule, introspect }}
 */
export function createDiscoveryNamespace({ request }) {
  let _bpCache = null
  let _bpCacheAt = 0
  let _bpInflight = null

  let _modCache = null
  let _modCacheAt = 0
  let _modInflight = null

  async function blueprints() {
    if (_bpCache && Date.now() - _bpCacheAt < CACHE_TTL_MS) return _bpCache
    if (_bpInflight) return _bpInflight
    _bpInflight = request('GET', '/public/blueprints')
      .then(res => {
        _bpCache = res.data
        _bpCacheAt = Date.now()
        _bpInflight = null
        return _bpCache
      })
      .catch(err => {
        _bpInflight = null
        throw err
      })
    return _bpInflight
  }

  async function modules() {
    if (_modCache && Date.now() - _modCacheAt < CACHE_TTL_MS) return _modCache
    if (_modInflight) return _modInflight
    _modInflight = request('GET', '/public/modules')
      .then(res => {
        _modCache = res.data
        _modCacheAt = Date.now()
        _modInflight = null
        return _modCache
      })
      .catch(err => {
        _modInflight = null
        throw err
      })
    return _modInflight
  }

  async function hasModule(moduleKey) {
    const mods = await modules()
    return mods.some(m => m.key === moduleKey)
  }

  async function introspect() {
    const [mods, bps] = await Promise.all([modules(), blueprints()])
    const byKey = {}
    for (const m of mods) {
      byKey[m.key] = { ...m, blueprints: [] }
    }
    for (const bp of bps) {
      if (bp.moduleKey && byKey[bp.moduleKey]) {
        byKey[bp.moduleKey].blueprints.push(bp)
      }
    }
    return {
      modules: mods,
      blueprints: bps,
      byModuleKey: byKey,
    }
  }

  return { blueprints, modules, hasModule, introspect }
}
