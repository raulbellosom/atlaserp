import { createContext, useContext, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { SessionVault } from './session-vault.js'
import { SyncEngine } from './sync-engine.js'
import { createOfflineTransport } from './offline-transport.js'
import { useOfflineStore } from './offline-store.js'

// Tier 1 modules synced on every cycle.
// Phase 4 will derive this list from installed module manifests with offline.enabled = true.
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet', 'atlas.calendar', 'atlas.catalog']

const PULL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl, onTransportReady }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const engineRef = useRef(null)
  const intervalRef = useRef(null)

  const setOnline = useOfflineStore((s) => s.setOnline)
  const setLastSyncAt = useOfflineStore((s) => s.setLastSyncAt)
  const setSyncing = useOfflineStore((s) => s.setSyncing)
  const setPendingCount = useOfflineStore((s) => s.setPendingCount)

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

    const transport = createOfflineTransport({
      db: database,
      getSession: () => vault.load(),
    })

    if (onTransportReady) {
      onTransportReady(transport)
    }

    async function updatePendingCount() {
      try {
        const count = await transport.mutationQueue.getPendingCount()
        setPendingCount(count)
      } catch (err) {
        console.warn('[atlas/offline] getPendingCount failed', err?.message ?? err)
      }
    }

    async function runSync() {
      setSyncing(true)
      try {
        // Push first, then pull — so the server sees our changes before we refresh
        await engine.push().catch((err) => {
          console.warn('[atlas/offline] Push failed', err?.message ?? err)
        })
        await engine.pull({ modules: OFFLINE_MODULES })
        setLastSyncAt(new Date().toISOString())
      } catch (err) {
        console.warn('[atlas/offline] Pull failed', err?.message ?? err)
      } finally {
        setSyncing(false)
        await updatePendingCount()
      }
    }

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    const initialOnline = detector.isOnline()
    setOnline(initialOnline)
    onlineManager.setOnline(initialOnline)

    detector.onChange((isOnline) => {
      setOnline(isOnline)
      onlineManager.setOnline(isOnline)
      if (isOnline) runSync()
    })

    intervalRef.current = setInterval(() => {
      if (detector.isOnline()) runSync()
    }, PULL_INTERVAL_MS)

    if (initialOnline) runSync()

    return () => {
      detector.destroy()
      database.close()
      clearInterval(intervalRef.current)
    }
  }, [apiBaseUrl, setOnline, setLastSyncAt, setSyncing, setPendingCount, onTransportReady])

  return (
    <OfflineContext.Provider value={{ dbRef, engineRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
