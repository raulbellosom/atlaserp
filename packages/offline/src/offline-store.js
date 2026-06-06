import { createStore } from 'zustand/vanilla'
import { create } from 'zustand'

const stateCreator = (set) => ({
  isOnline: true,
  pendingCount: 0,
  lastSyncAt: null,
  isSyncing: false,
  setOnline: (isOnline) => set({ isOnline }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
  setSyncing: (isSyncing) => set({ isSyncing }),
})

// Vanilla store used in tests and non-React contexts
export function createOfflineStore() {
  return createStore(stateCreator)
}

// React hook for components
export const useOfflineStore = create(stateCreator)
