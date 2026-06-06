import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOfflineStore } from '../offline-store.js'

test('createOfflineStore - initial state', () => {
  const store = createOfflineStore()
  const state = store.getState()
  assert.equal(state.isOnline, true)
  assert.equal(state.pendingCount, 0)
  assert.equal(state.lastSyncAt, null)
  assert.equal(state.isSyncing, false)
})

test('createOfflineStore - setOnline updates isOnline', () => {
  const store = createOfflineStore()
  store.getState().setOnline(false)
  assert.equal(store.getState().isOnline, false)
  store.getState().setOnline(true)
  assert.equal(store.getState().isOnline, true)
})

test('createOfflineStore - setPendingCount updates pendingCount', () => {
  const store = createOfflineStore()
  store.getState().setPendingCount(5)
  assert.equal(store.getState().pendingCount, 5)
})

test('createOfflineStore - setLastSyncAt updates lastSyncAt', () => {
  const store = createOfflineStore()
  const ts = new Date().toISOString()
  store.getState().setLastSyncAt(ts)
  assert.equal(store.getState().lastSyncAt, ts)
})

test('createOfflineStore - setSyncing updates isSyncing', () => {
  const store = createOfflineStore()
  store.getState().setSyncing(true)
  assert.equal(store.getState().isSyncing, true)
})
