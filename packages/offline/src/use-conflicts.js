import { useState, useEffect } from 'react'
import { useOfflineContext } from './offline-provider.jsx'

const POLL_INTERVAL_MS = 3000

export function useConflicts() {
  const ctx = useOfflineContext()
  const [conflicts, setConflicts] = useState([])

  useEffect(() => {
    if (!ctx?.dbRef?.current) return
    const db = ctx.dbRef.current
    let mounted = true

    async function load() {
      try {
        const items = await db.conflicts.where('status').equals('PENDING').sortBy('detectedAt')
        if (mounted) setConflicts(items)
      } catch (err) {
        console.warn('[atlas/offline] load conflicts failed', err?.message ?? err)
      }
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [ctx?.dbRef])

  return conflicts
}
