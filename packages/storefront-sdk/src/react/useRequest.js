import { useState, useCallback } from 'react'
import { useStorefront } from './context.js'

export function useRequest() {
  const client = useStorefront()
  const [data, setData] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const execute = useCallback(async (method, path, body = null, options = {}) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await client.request(method, path, body, options)
      setData(result)
      return result
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
  }, [])

  return { execute, data, isLoading, error, reset }
}
