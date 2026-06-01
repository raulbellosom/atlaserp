import { useState, useEffect } from 'react'
import { useStorefront } from './context.js'

export function useCompanyConfig() {
  const client = useStorefront()
  const [config, setConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    client.request('GET', '/public/storefront/config')
      .then(res => { if (!cancelled) setConfig(res.data) })
      .catch(err => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [client])

  return { config, isLoading, error }
}
