import { useState, useEffect } from 'react'
import { useStorefront } from './context.js'

export function useSession() {
  const client = useStorefront()
  const [session, setSession] = useState(() => client.auth.getSession())

  useEffect(() => {
    setSession(client.auth.getSession())
    const unsub = client.auth.onAuthStateChange(setSession)
    return unsub
  }, [client])

  return session
}
