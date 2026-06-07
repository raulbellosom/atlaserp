import { createContext, useContext, useEffect, useRef } from 'react'
import { onlineManager } from '@tanstack/react-query'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { SessionVault } from './session-vault.js'
import { SyncEngine } from './sync-engine.js'
import { createOfflineTransport } from './offline-transport.js'
import { useOfflineStore } from './offline-store.js'
import { OFFLINE_MODULES } from './offline-modules.js'
import { LedgerSQLiteStore, isTauriAvailable } from './ledger-sqlite.js'
import { LedgerSyncAdapter } from './ledger-sync-adapter.js'

const PULL_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes
const LEDGER_MODULE_KEY = 'atlas.ledger'

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl, onTransportReady }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const engineRef = useRef(null)
  const intervalRef = useRef(null)
  const ledgerStoreRef = useRef(null)
  const ledgerSyncAdapterRef = useRef(null)

  const setOnline = useOfflineStore((s) => s.setOnline)
  const setLastSyncAt = useOfflineStore((s) => s.setLastSyncAt)
  const setSyncing = useOfflineStore((s) => s.setSyncing)
  const setPendingCount = useOfflineStore((s) => s.setPendingCount)

  useEffect(() => {
    const database = new AtlasOfflineDatabase()
    dbRef.current = database
    database.open().catch((err) => {
      console.warn('[atlas/offline] IndexedDB failed to open - offline features unavailable', err)
    })

    const vault = new SessionVault(database)
    const engine = new SyncEngine({
      db: database,
      apiBaseUrl,
      getToken: () => vault.load().then((session) => session?.accessToken ?? null),
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

    async function disposeLedgerRuntime() {
      ledgerSyncAdapterRef.current = null
      const ledgerStore = ledgerStoreRef.current
      ledgerStoreRef.current = null
      if (ledgerStore) {
        await ledgerStore.close().catch(() => {})
      }
    }

    async function ensureLedgerRuntime() {
      if (!isTauriAvailable()) return null

      const session = await vault.load()
      const companyId = session?.companyId ?? null

      if (!companyId) {
        await disposeLedgerRuntime()
        return null
      }

      const existingStore = ledgerStoreRef.current
      if (existingStore?.companyId === companyId && ledgerSyncAdapterRef.current) {
        return ledgerSyncAdapterRef.current
      }

      await disposeLedgerRuntime()

      const ledgerStore = new LedgerSQLiteStore({ companyId })
      await ledgerStore.open()

      const ledgerSyncAdapter = new LedgerSyncAdapter({
        db: database,
        apiBaseUrl,
        getToken: () => vault.load().then((currentSession) => currentSession?.accessToken ?? null),
        ledgerStore,
      })

      ledgerStoreRef.current = ledgerStore
      ledgerSyncAdapterRef.current = ledgerSyncAdapter
      return ledgerSyncAdapter
    }

    async function runSync() {
      setSyncing(true)
      try {
        let ledgerSyncAdapter = null
        if (isTauriAvailable()) {
          try {
            ledgerSyncAdapter = await ensureLedgerRuntime()
          } catch (err) {
            console.warn('[atlas/offline] Ledger SQLite unavailable - atlas.ledger stays online-only', err?.message ?? err)
          }
        }

        // Push first, then pull so the server sees our changes before we refresh.
        await engine.push().catch((err) => {
          console.warn('[atlas/offline] Push failed', err?.message ?? err)
        })
        await engine.pull({ modules: OFFLINE_MODULES.filter((moduleKey) => moduleKey !== LEDGER_MODULE_KEY) })
        if (ledgerSyncAdapter) {
          await ledgerSyncAdapter.pull().catch((err) => {
            console.warn('[atlas/offline] Ledger pull failed', err?.message ?? err)
          })
        }
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

    detector.onChange((online) => {
      setOnline(online)
      onlineManager.setOnline(online)
      if (online) runSync()
    })

    intervalRef.current = setInterval(() => {
      if (detector.isOnline()) runSync()
    }, PULL_INTERVAL_MS)

    if (initialOnline) runSync()

    return () => {
      detector.destroy()
      disposeLedgerRuntime().catch(() => {})
      database.close()
      clearInterval(intervalRef.current)
    }
  }, [apiBaseUrl, setOnline, setLastSyncAt, setSyncing, setPendingCount, onTransportReady])

  return (
    <OfflineContext.Provider value={{ dbRef, engineRef, ledgerStoreRef, ledgerSyncAdapterRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
