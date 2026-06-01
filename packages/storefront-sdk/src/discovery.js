const CACHE_TTL_MS = 30_000

export function createDiscoveryNamespace({ request }) {
  let _cache = null
  let _cacheAt = 0
  let _inflight = null

  async function blueprints() {
    if (_cache && Date.now() - _cacheAt < CACHE_TTL_MS) return _cache
    if (_inflight) return _inflight
    _inflight = request('GET', '/public/blueprints')
      .then(res => {
        _cache = res.data
        _cacheAt = Date.now()
        _inflight = null
        return _cache
      })
      .catch(err => {
        _inflight = null
        throw err
      })
    return _inflight
  }

  async function hasModule(moduleKey) {
    const bps = await blueprints()
    return bps.some(bp => bp.module?.key === moduleKey)
  }

  return { blueprints, hasModule }
}
