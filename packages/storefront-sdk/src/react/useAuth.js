import { useState, useCallback } from 'react'
import { useStorefront } from './context.js'
import { useSession } from './useSession.js'

export function useAuth() {
  const client = useStorefront()
  const session = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = useCallback(async ({ email, password }) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await client.auth.login({ email, password })
      return result
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const register = useCallback(async ({ email, password, name, role }) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await client.auth.register({ email, password, name, role })
      return result
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const logout = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      await client.auth.logout()
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await client.auth.refresh()
      return result
    } catch (err) {
      setError(err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [client])

  return {
    user: session?.user ?? null,
    session,
    isAuthenticated: session !== null,
    isLoading,
    error,
    login,
    register,
    logout,
    refresh,
  }
}
