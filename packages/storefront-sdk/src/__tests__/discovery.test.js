import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createDiscoveryNamespace } from '../discovery.js'

function makeRequest(response) {
  return async () => response
}

function makeRouteRequest(routes) {
  return async (method, path) => routes[path] ?? { data: [] }
}

describe('sdk.discovery.blueprints', () => {
  it('returns the data array from /public/blueprints', async () => {
    const bps = [{ key: 'catalog.product.entity', kind: 'ENTITY' }]
    const req = makeRequest({ data: bps })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.blueprints()
    assert.deepEqual(result, bps)
  })
})

describe('sdk.discovery.modules', () => {
  it('returns the data array from /public/modules', async () => {
    const mods = [{ key: 'atlas.catalog', name: 'Catalog', version: '1.0.0', kind: 'FEATURE', enabled: true, navigation: [], exposes: [] }]
    const req = makeRouteRequest({ '/public/modules': { data: mods } })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.modules()
    assert.deepEqual(result, mods)
  })

  it('deduplicates concurrent calls', async () => {
    let callCount = 0
    const req = async () => {
      callCount++
      return { data: [{ key: 'atlas.hr' }] }
    }
    const discovery = createDiscoveryNamespace({ request: req })
    await Promise.all([discovery.modules(), discovery.modules()])
    assert.equal(callCount, 1)
  })

  it('returns cached result within TTL', async () => {
    let callCount = 0
    const req = async () => {
      callCount++
      return { data: [{ key: 'atlas.files' }] }
    }
    const discovery = createDiscoveryNamespace({ request: req })
    await discovery.modules()
    await discovery.modules()
    assert.equal(callCount, 1)
  })
})

describe('sdk.discovery.hasModule', () => {
  it('returns true when module key is present', async () => {
    const mods = [{ key: 'atlas.catalog' }]
    const req = makeRouteRequest({ '/public/modules': { data: mods } })
    const discovery = createDiscoveryNamespace({ request: req })
    assert.equal(await discovery.hasModule('atlas.catalog'), true)
  })

  it('returns false when module key is not present', async () => {
    const req = makeRouteRequest({ '/public/modules': { data: [] } })
    const discovery = createDiscoveryNamespace({ request: req })
    assert.equal(await discovery.hasModule('custom.reservations'), false)
  })
})

describe('sdk.discovery.introspect', () => {
  it('merges modules and blueprints by moduleKey', async () => {
    const mods = [{ key: 'atlas.catalog', name: 'Catalog', navigation: [], exposes: [] }]
    const bps = [
      { key: 'catalog.product.entity', kind: 'ENTITY', moduleKey: 'atlas.catalog' },
      { key: 'catalog.product.form', kind: 'FORM', moduleKey: 'atlas.catalog' },
    ]
    const req = makeRouteRequest({
      '/public/modules': { data: mods },
      '/public/blueprints': { data: bps },
    })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.introspect()

    assert.deepEqual(result.modules, mods)
    assert.deepEqual(result.blueprints, bps)
    assert.equal(result.byModuleKey['atlas.catalog'].blueprints.length, 2)
    assert.equal(result.byModuleKey['atlas.catalog'].name, 'Catalog')
  })

  it('ignores blueprints with unknown moduleKey', async () => {
    const mods = [{ key: 'atlas.catalog', navigation: [], exposes: [] }]
    const bps = [{ key: 'orphan.bp', kind: 'ENTITY', moduleKey: 'custom.unknown' }]
    const req = makeRouteRequest({
      '/public/modules': { data: mods },
      '/public/blueprints': { data: bps },
    })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.introspect()
    assert.equal(result.byModuleKey['atlas.catalog'].blueprints.length, 0)
    assert.equal(result.byModuleKey['custom.unknown'], undefined)
  })
})
