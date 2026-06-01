import { useState, useEffect, useCallback } from 'react'
import { useStorefront } from './context.js'

export function useProducts(options = {}) {
  const client = useStorefront()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const optionsKey = JSON.stringify(options)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    client.catalog.products(options)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, optionsKey])

  return { data, isLoading, error }
}

export function useProduct(id) {
  const client = useStorefront()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!id) { setIsLoading(false); return }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    client.catalog.getProduct(id)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [client, id])

  return { data, isLoading, error }
}

export function useCategories(options = {}) {
  const client = useStorefront()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)

  const optionsKey = JSON.stringify(options)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    client.catalog.categories(options)
      .then((res) => { if (!cancelled) setData(res) })
      .catch((err) => { if (!cancelled) setError(err) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, optionsKey])

  return { data, isLoading, error }
}
