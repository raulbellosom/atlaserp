import { useState, useEffect } from 'react'
import { useOfflineContext } from './offline-provider.jsx'

const ACTIVE_STATUSES = ['PENDING', 'SYNCING', 'CONFLICT', 'FAILED']
const POLL_INTERVAL_MS = 3000

export function usePendingMutations() {
  const ctx = useOfflineContext()
  const [mutations, setMutations] = useState([])

  useEffect(() => {
    if (!ctx?.dbRef?.current) return
    const db = ctx.dbRef.current
    let mounted = true

    async function load() {
      try {
        const items = await db.mutation_queue
          .where('status')
          .anyOf(ACTIVE_STATUSES)
          .sortBy('queuedAt')
        if (mounted) setMutations(items)
      } catch (err) {
        console.warn('[atlas/offline] load pending mutations failed', err?.message ?? err)
      }
    }

    load()
    const timer = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [ctx?.dbRef])

  return mutations
}
