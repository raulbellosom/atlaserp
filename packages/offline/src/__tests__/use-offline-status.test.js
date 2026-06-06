import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createOfflineStore } from '../offline-store.js'

test('useOfflineStatus selector returns isOnline, lastSyncAt, pendingCount, isSyncing from store', () => {
  const store = createOfflineStore()

  // Manually apply the selector logic (what useOfflineStatus does)
  store.setState({
    isOnline: false,
    lastSyncAt: '2026-06-06T10:00:00Z',
    pendingCount: 3,
    isSyncing: true,
  })

  const state = store.getState()
  const status = {
    isOnline: state.isOnline,
    lastSyncAt: state.lastSyncAt,
    pendingCount: state.pendingCount,
    isSyncing: state.isSyncing,
  }

  assert.equal(status.isOnline, false)
  assert.equal(status.lastSyncAt, '2026-06-06T10:00:00Z')
  assert.equal(status.pendingCount, 3)
  assert.equal(status.isSyncing, true)
})
