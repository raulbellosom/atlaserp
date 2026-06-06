import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { SyncEngine } from '../sync-engine.js'

const COMPANY_ID = '01900000-0000-7000-8000-000000000001'
let dbCounter = 0

function makeDb() {
  return new AtlasOfflineDatabase(`test-sync-engine-${++dbCounter}`)
}

function makeResponse(records, nextCursor = '2026-06-06T10:00:00Z') {
  return { records, nextCursor, hasMore: false }
}

function makeFetch(response) {
  return async (_url, _opts) => ({
    ok: true,
    json: async () => response,
  })
}

describe('SyncEngine', () => {
  let db

  beforeEach(async () => {
    db = makeDb()
    await db.open()
  })

  afterEach(async () => {
    await db.delete().catch(() => {})
  })

  it('stores pulled records in offline_records', async () => {
    const record = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: { id: 'c1', name: 'Ana', companyId: COMPANY_ID },
      version: '2026-06-06T10:00:00Z',
      deleted: false,
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([record])),
    })

    const { pulled } = await engine.pull({ modules: ['atlas.contacts'] })
    assert.equal(pulled, 1)

    const stored = await db.offline_records.get(['atlas.contacts', 'contact', 'c1'])
    assert.ok(stored)
    assert.equal(stored.data.name, 'Ana')
    assert.equal(stored.dirty, false)
  })

  it('updates sync_state with nextCursor after pull', async () => {
    const record = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: { id: 'c1', companyId: COMPANY_ID },
      version: '2026-06-06T10:00:00Z',
      deleted: false,
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([record], '2026-06-06T10:00:00Z')),
    })

    await engine.pull({ modules: ['atlas.contacts'] })

    const state = await db.sync_state.get(['atlas.contacts', 'contact'])
    assert.ok(state)
    assert.equal(state.serverCursor, '2026-06-06T10:00:00Z')
    assert.ok(state.lastPullAt)
  })

  it('removes deleted records from offline_records', async () => {
    await db.offline_records.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      data: {},
      version: '2026-06-01T00:00:00Z',
      pulledAt: '2026-06-01T00:00:00Z',
      companyId: COMPANY_ID,
      dirty: false,
    })

    const tombstone = {
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      id: 'c1',
      deleted: true,
      data: null,
      version: '2026-06-06T10:00:00Z',
    }
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([tombstone])),
    })

    await engine.pull({ modules: ['atlas.contacts'] })

    const stored = await db.offline_records.get(['atlas.contacts', 'contact', 'c1'])
    assert.equal(stored, undefined)
  })

  it('sends stored cursor in the pull request URL', async () => {
    const cursor = '2026-06-05T00:00:00Z'
    await db.sync_state.put({
      moduleKey: 'atlas.contacts',
      entityType: 'contact',
      lastPullAt: cursor,
      serverCursor: cursor,
      schemaVersion: null,
    })

    let capturedUrl = null
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async (url) => {
        capturedUrl = url
        return { ok: true, json: async () => makeResponse([]) }
      },
    })

    await engine.pull({ modules: ['atlas.contacts'] })
    assert.ok(capturedUrl.includes(`cursor=${encodeURIComponent(cursor)}`))
  })

  it('skips network call when getToken returns null', async () => {
    let fetchCalled = false
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => null,
      fetchImpl: async () => { fetchCalled = true; return { ok: true, json: async () => ({}) } },
    })

    const result = await engine.pull({ modules: ['atlas.contacts'] })
    assert.equal(result.pulled, 0)
    assert.equal(fetchCalled, false)
  })

  it('throws on non-ok HTTP response', async () => {
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
    })

    await assert.rejects(() => engine.pull({ modules: ['atlas.contacts'] }), /Pull failed/)
  })

  it('getLocalCount returns 0 on empty table', async () => {
    const engine = new SyncEngine({
      db,
      apiBaseUrl: 'http://localhost:4010',
      getToken: async () => 'tok',
      fetchImpl: makeFetch(makeResponse([])),
    })
    const count = await engine.getLocalCount({ moduleKey: 'atlas.contacts', entityType: 'contact' })
    assert.equal(count, 0)
  })
})
