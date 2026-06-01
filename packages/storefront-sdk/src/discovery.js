export function createDiscoveryNamespace({ request }) {
  async function blueprints() {
    const res = await request('GET', '/public/blueprints')
    return res.data
  }

  async function hasModule(moduleKey) {
    const bps = await blueprints()
    return bps.some(bp => bp.module?.key === moduleKey)
  }

  return { blueprints, hasModule }
}
