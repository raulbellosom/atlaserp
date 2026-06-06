import { createContext, useContext, useEffect, useRef } from 'react'
import { AtlasOfflineDatabase } from './db.js'
import { OnlineDetector } from './online-detector.js'
import { useOfflineStore } from './offline-store.js'

const OfflineContext = createContext(null)

export function OfflineProvider({ children, apiBaseUrl }) {
  const detectorRef = useRef(null)
  const dbRef = useRef(null)
  const setOnline = useOfflineStore((s) => s.setOnline)

  useEffect(() => {
    const database = new AtlasOfflineDatabase()
    dbRef.current = database
    database.open().catch(() => {})

    const detector = new OnlineDetector({
      probeUrl: apiBaseUrl ? `${apiBaseUrl}/health` : null,
    })
    detectorRef.current = detector

    setOnline(detector.isOnline())
    detector.onChange((isOnline) => setOnline(isOnline))

    return () => {
      detector.destroy()
      database.close()
    }
  }, [apiBaseUrl, setOnline])

  return (
    <OfflineContext.Provider value={{ dbRef }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function useOfflineContext() {
  return useContext(OfflineContext)
}
