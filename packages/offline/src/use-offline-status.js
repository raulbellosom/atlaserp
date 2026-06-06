import { useOfflineStore } from './offline-store.js'

export function useOfflineStatus() {
  return useOfflineStore((s) => ({
    isOnline: s.isOnline,
    lastSyncAt: s.lastSyncAt,
    pendingCount: s.pendingCount,
    isSyncing: s.isSyncing,
  }))
}
