import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'

let db

before(async () => {
  db = new AtlasOfflineDatabase('test-atlas-offline')
  await db.open()
})

after(async () => {
  await db.delete()
})

test('db - opens without error', async () => {
  assert.equal(db.isOpen(), true)
})

test('db - has offline_records table', () => {
  assert.ok(db.offline_records, 'offline_records table must exist')
})

test('db - has mutation_queue table', () => {
  assert.ok(db.mutation_queue, 'mutation_queue table must exist')
})

test('db - has sync_state table', () => {
  assert.ok(db.sync_state, 'sync_state table must exist')
})

test('db - has session_vault table', () => {
  assert.ok(db.session_vault, 'session_vault table must exist')
})

test('db - has conflicts table', () => {
  assert.ok(db.conflicts, 'conflicts table must exist')
})

test('db - has _query_cache table', () => {
  assert.ok(db._query_cache, '_query_cache table must exist')
})

test('offline_records - can put and get a record', async () => {
  await db.offline_records.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    id: 'test-id-1',
    data: { name: 'Raul' },
    version: new Date().toISOString(),
    pulledAt: new Date().toISOString(),
    companyId: 'company-1',
    dirty: false,
  })
  const row = await db.offline_records.get(['atlas.contacts', 'contact', 'test-id-1'])
  assert.equal(row.data.name, 'Raul')
})

test('mutation_queue - can put and get a mutation', async () => {
  await db.mutation_queue.put({
    id: 'mut-1',
    idempotencyKey: 'idem-1',
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    recordId: null,
    operation: 'CREATE',
    payload: { name: 'New Contact' },
    status: 'PENDING',
    queuedAt: new Date().toISOString(),
    attempts: 0,
    lastError: null,
    companyId: 'company-1',
    userId: 'user-1',
  })
  const row = await db.mutation_queue.get('mut-1')
  assert.equal(row.operation, 'CREATE')
  assert.equal(row.status, 'PENDING')
})

test('sync_state - can put and get cursor', async () => {
  await db.sync_state.put({
    moduleKey: 'atlas.contacts',
    entityType: 'contact',
    lastPullAt: new Date().toISOString(),
    serverCursor: '2026-06-06T00:00:00Z',
    schemaVersion: '0.1.0',
  })
  const row = await db.sync_state.get(['atlas.contacts', 'contact'])
  assert.equal(row.schemaVersion, '0.1.0')
})

test('session_vault - can put and retrieve session', async () => {
  await db.session_vault.put({
    id: 'current',
    accessToken: 'tok-abc',
    refreshToken: 'ref-abc',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    userProfile: { id: 'user-1', name: 'Raul' },
    companyId: 'company-1',
    apiBaseUrl: 'https://api.example.com',
    storedAt: new Date().toISOString(),
  })
  const row = await db.session_vault.get('current')
  assert.equal(row.accessToken, 'tok-abc')
})
