import { useShallow } from 'zustand/react/shallow'
import { useOfflineStore } from './offline-store.js'

export function useOfflineStatus() {
  return useOfflineStore(useShallow((s) => ({
    isOnline: s.isOnline,
    lastSyncAt: s.lastSyncAt,
    pendingCount: s.pendingCount,
    isSyncing: s.isSyncing,
  })))
}
