import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createDiscoveryNamespace } from '../discovery.js'

function makeRequest(response) {
  return async () => response
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

describe('sdk.discovery.hasModule', () => {
  it('returns true when module key is present in blueprints', async () => {
    const bps = [{ key: 'catalog.product.entity', kind: 'ENTITY', module: { key: 'atlas.catalog' } }]
    const req = makeRequest({ data: bps })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.hasModule('atlas.catalog')
    assert.equal(result, true)
  })

  it('returns false when module key is not present', async () => {
    const req = makeRequest({ data: [] })
    const discovery = createDiscoveryNamespace({ request: req })
    const result = await discovery.hasModule('custom.reservations')
    assert.equal(result, false)
  })
})
