import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { createOfflineTransport, parseMutationRoute } from '../offline-transport.js'

let dbCounter = 0
function makeDb() {
  return new AtlasOfflineDatabase(`test-transport-${++dbCounter}`)
}

const SESSION = {
  companyId: 'co-1',
  userProfile: { id: 'u-1' },
  accessToken: 'tok',
}

describe('parseMutationRoute', () => {
  it('maps POST /contacts to atlas.contacts CREATE', () => {
    const result = parseMutationRoute('/contacts', 'POST')
    assert.deepEqual(result, { moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'CREATE', recordId: null })
  })

  it('maps PUT /contacts/:id to atlas.contacts UPDATE', () => {
    const result = parseMutationRoute('/contacts/abc-123', 'PUT')
    assert.deepEqual(result, { moduleKey: 'atlas.contacts', entityType: 'contact', operation: 'UPDATE', recordId: 'abc-123' })
  })

  it('maps POST /fleet/vehicles to custom.fleet vehicle CREATE', () => {
    const result = parseMutationRoute('/fleet/vehicles', 'POST')
    assert.deepEqual(result, { moduleKey: 'custom.fleet', entityType: 'vehicle', operation: 'CREATE', recordId: null })
  })

  it('returns null for unmapped paths', () => {
    const result = parseMutationRoute('/finance/accounts', 'POST')
    assert.equal(result, null)
  })
})

describe('createOfflineTransport.queue', () => {
  let db
  let transport

  beforeEach(async () => {
    db = makeDb()
    await db.open()
    transport = createOfflineTransport({ db, getSession: async () => SESSION })
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('queue enqueues mutation with PENDING status for a CREATE', async () => {
    const result = await transport.queue('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana', type: 'person' }),
    })
    assert.ok(result?.queued)
    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 1)
    assert.equal(items[0].status, 'PENDING')
    assert.equal(items[0].moduleKey, 'atlas.contacts')
    assert.equal(items[0].operation, 'CREATE')
  })
})
