import { useEffect, useState } from 'react'

// Subscribes to a SupabaseYjsProvider's Y.js awareness state and returns the
// list of *other* users currently viewing the same note (local user excluded).
// CollaborationCursor already writes { id, name, color, avatarUrl } into each
// client's awareness state under the 'user' field — this hook just reads it.
export function usePresence(provider, localUserId) {
  const [users, setUsers] = useState([])

  useEffect(() => {
    const awareness = provider?.awareness
    if (!awareness) {
      setUsers([])
      return
    }

    function sync() {
      const next = []
      awareness.getStates().forEach((state, clientId) => {
        const user = state?.user
        if (!user || user.id === localUserId) return
        next.push({ clientId, ...user })
      })
      setUsers(next)
    }

    sync()
    awareness.on('update', sync)
    return () => awareness.off('update', sync)
  }, [provider, localUserId])

  return users
}
