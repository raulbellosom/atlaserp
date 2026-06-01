import { useState, useEffect } from 'react'
import { useStorefront } from './context.js'

export function useBlueprints() {
  const client = useStorefront()
  const [blueprints, setBlueprints] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    client.discovery.blueprints()
      .then((data) => { if (!cancelled) setBlueprints(data) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [client])

  return { blueprints, isLoading, error }
}

export function useHasModule(moduleKey) {
  const client = useStorefront()
  const [hasModule, setHasModule] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    client.discovery.hasModule(moduleKey)
      .then((result) => { if (!cancelled) setHasModule(result) })
      .catch(() => { if (!cancelled) setHasModule(false) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [client, moduleKey])

  return { hasModule, isLoading }
}
