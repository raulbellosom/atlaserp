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

  it('queue returns null for non-mutation methods (GET)', async () => {
    const result = await transport.queue('/contacts', { method: 'GET' })
    assert.equal(result, null)
    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 0)
  })

  it('CREATE enqueues mutation AND inserts optimistic record into offline_records with dirty: true', async () => {
    await transport.queue('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Bob', type: 'company' }),
    })
    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 1)
    const queuedId = items[0].id
    const localRecord = await db.offline_records.where('[moduleKey+entityType+id]').equals(['atlas.contacts', 'contact', queuedId]).first()
    assert.ok(localRecord)
    assert.equal(localRecord.dirty, true)
    assert.equal(localRecord.data.name, 'Bob')
  })

  it('UPDATE patches existing offline_record with dirty: true', async () => {
    const existingId = 'existing-c1'
    await db.offline_records.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: existingId,
      data: { id: existingId, name: 'Old Name', companyId: 'co-1' },
      version: '2026-06-06T00:00:00Z',
      pulledAt: '2026-06-06T00:00:00Z',
      companyId: 'co-1',
      dirty: false,
    })
    await transport.queue(`/contacts/${existingId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    })
    const updated = await db.offline_records.where('[moduleKey+entityType+id]').equals(['atlas.contacts', 'contact', existingId]).first()
    assert.ok(updated)
    assert.equal(updated.dirty, true)
    assert.equal(updated.data.name, 'New Name')
  })

  it('UPDATE mutation stores clientUpdatedAt from existing offline record', async () => {
    const existingUpdatedAt = '2026-06-06T09:00:00.000Z'
    await db.offline_records.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c-existing',
      data: { id: 'c-existing', name: 'Old Name', companyId: 'co-1', updatedAt: existingUpdatedAt },
      version: existingUpdatedAt,
      pulledAt: existingUpdatedAt,
      companyId: 'co-1',
      dirty: false,
    })

    await transport.queue('/contacts/c-existing', {
      method: 'PUT',
      body: JSON.stringify({ name: 'New Name' }),
    })

    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 1)
    assert.equal(items[0].clientUpdatedAt, existingUpdatedAt)
  })

  it('CREATE mutation stores clientUpdatedAt as null', async () => {
    await transport.queue('/contacts', {
      method: 'POST',
      body: JSON.stringify({ name: 'Brand New' }),
    })

    const items = await db.mutation_queue.toArray()
    assert.equal(items.length, 1)
    assert.equal(items[0].clientUpdatedAt, null)
  })
})
