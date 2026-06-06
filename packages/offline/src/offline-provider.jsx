import { createContext, useContext, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { SessionVault } from './session-vault.js'
import { SyncEngine } from './sync-engine.js'
import { useOfflineStore } from './offline-store.js'

// Tier 1 modules pulled on every sync cycle.
// Phase 3 will derive this list from installed module manifests with offline.enabled = true.
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet']

const PULL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const engineRef = useRef(null)
  const intervalRef = useRef(null)

  const setOnline = useOfflineStore((s) => s.setOnline)
  const setLastSyncAt = useOfflineStore((s) => s.setLastSyncAt)
  const setSyncing = useOfflineStore((s) => s.setSyncing)

  useEffect(() => {
    const database = new AtlasOfflineDatabase()
    dbRef.current = database
    database.open().catch((err) => {
      console.warn('[atlas/offline] IndexedDB failed to open — offline features unavailable', err)
    })

    const vault = new SessionVault(database)
    const engine = new SyncEngine({
      db: database,
      apiBaseUrl,
      getToken: () => vault.load().then((s) => s?.accessToken ?? null),
    })
    engineRef.current = engine

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    // Sync our detector with TanStack Query's onlineManager so React Query
    // pauses queries when offline and resumes (and re-fetches) on reconnect.
    const initialOnline = detector.isOnline()
    setOnline(initialOnline)
    onlineManager.setOnline(initialOnline)

    async function runPull() {
      setSyncing(true)
      try {
        await engine.pull({ modules: OFFLINE_MODULES })
        setLastSyncAt(new Date().toISOString())
      } catch (err) {
        console.warn('[atlas/offline] Pull failed', err?.message ?? err)
      } finally {
        setSyncing(false)
      }
    }

    detector.onChange((isOnline) => {
      setOnline(isOnline)
      onlineManager.setOnline(isOnline)
      if (isOnline) {
        // Trigger an immediate pull when connectivity is restored
        runPull()
      }
    })

    // Schedule periodic pulls while the app is running
    intervalRef.current = setInterval(() => {
      if (detector.isOnline()) runPull()
    }, PULL_INTERVAL_MS)

    // Run an initial pull if we start online
    if (initialOnline) {
      runPull()
    }

    return () => {
      detector.destroy()
      database.close()
      clearInterval(intervalRef.current)
    }
  }, [apiBaseUrl, setOnline, setLastSyncAt, setSyncing])

  return (
    <OfflineContext.Provider value={{ dbRef, engineRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
