import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import 'fake-indexeddb/auto'
import { AtlasOfflineDatabase } from '../db.js'
import { SessionVault } from '../session-vault.js'

let database
let vault

before(async () => {
  database = new AtlasOfflineDatabase('test-session-vault')
  await database.open()
  vault = new SessionVault(database)
})

after(async () => {
  await database.delete()
})

test('SessionVault - store() persists session fields', async () => {
  await vault.store({
    accessToken: 'access-123',
    refreshToken: 'refresh-123',
    expiresAt: '2026-06-07T00:00:00Z',
    userProfile: { id: 'u1', name: 'Test' },
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  const row = await database.session_vault.get('current')
  assert.equal(row.accessToken, 'access-123')
  assert.equal(row.companyId, 'c1')
})

test('SessionVault - load() returns stored session', async () => {
  const session = await vault.load()
  assert.equal(session.accessToken, 'access-123')
  assert.equal(session.refreshToken, 'refresh-123')
})

test('SessionVault - load() returns null when vault is empty', async () => {
  const emptyDb = new AtlasOfflineDatabase('test-session-vault-empty')
  await emptyDb.open()
  const emptyVault = new SessionVault(emptyDb)
  const result = await emptyVault.load()
  assert.equal(result, null)
  await emptyDb.delete()
})

test('SessionVault - update() patches existing session', async () => {
  await vault.update({ accessToken: 'new-access-456' })
  const session = await vault.load()
  assert.equal(session.accessToken, 'new-access-456')
  assert.equal(session.refreshToken, 'refresh-123') // unchanged
})

test('SessionVault - clear() removes stored session', async () => {
  await vault.clear()
  const session = await vault.load()
  assert.equal(session, null)
})

test('SessionVault - isExpired() returns true when past expiresAt', async () => {
  await vault.store({
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: new Date(Date.now() - 1000).toISOString(),
    userProfile: {},
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  assert.equal(await vault.isExpired(), true)
})

test('SessionVault - isExpired() returns false when within validity window', async () => {
  await vault.store({
    accessToken: 'tok',
    refreshToken: 'ref',
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    userProfile: {},
    companyId: 'c1',
    apiBaseUrl: 'https://api.test',
  })
  assert.equal(await vault.isExpired(), false)
})

test('SessionVault - update() on empty vault does nothing', async () => {
  const freshDb = new AtlasOfflineDatabase('test-sv-update-empty')
  await freshDb.open()
  const freshVault = new SessionVault(freshDb)
  await assert.doesNotReject(() => freshVault.update({ accessToken: 'x' }))
  assert.equal(await freshVault.load(), null)
  await freshDb.delete()
})

test('SessionVault - isExpired() returns true when vault is empty', async () => {
  const freshDb = new AtlasOfflineDatabase('test-sv-expired-empty')
  await freshDb.open()
  const freshVault = new SessionVault(freshDb)
  assert.equal(await freshVault.isExpired(), true)
  await freshDb.delete()
})
