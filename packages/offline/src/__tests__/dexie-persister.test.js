import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { createDexiePersister } from '../dexie-persister.js'

let database
let persister

const MOCK_CLIENT = {
  buster: 'v1',
  timestamp: Date.now(),
  clientState: { mutations: [], queries: [{ queryKey: ['test'], state: { data: 'hello' } }] },
}

before(async () => {
  database = new AtlasOfflineDatabase('test-dexie-persister')
  await database.open()
  persister = createDexiePersister(database)
})

after(async () => {
  await database.delete()
})

test('createDexiePersister - restoreClient() returns undefined when empty', async () => {
  const result = await persister.restoreClient()
  assert.equal(result, undefined)
})

test('createDexiePersister - persistClient() stores dehydrated cache', async () => {
  await persister.persistClient(MOCK_CLIENT)
  const row = await database._query_cache.get('persisted')
  assert.ok(row, 'row must exist in _query_cache')
  assert.equal(row.data.buster, 'v1')
})

test('createDexiePersister - restoreClient() returns stored cache', async () => {
  const restored = await persister.restoreClient()
  assert.ok(restored, 'must return stored client')
  assert.equal(restored.buster, 'v1')
  assert.equal(restored.clientState.queries[0].state.data, 'hello')
})

test('createDexiePersister - removeClient() deletes stored cache', async () => {
  await persister.removeClient()
  const restored = await persister.restoreClient()
  assert.equal(restored, undefined)
})

test('createDexiePersister - persistClient() silently swallows errors', async () => {
  const badPersister = createDexiePersister({ _query_cache: { put: async () => { throw new Error('disk full') } } })
  await assert.doesNotReject(() => badPersister.persistClient(MOCK_CLIENT))
})
