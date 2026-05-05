import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { atlas } from '../lib/atlas'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function forceLogout() {
      try {
        await supabase.auth.signOut()
      } catch {}
      if (!mounted) return
      setSession(null)
      setUserProfile(null)
    }

    function isMissingProfileError(error) {
      const message = String(error?.message ?? '')
      return (
        message.includes('Profile not found') ||
        message.includes('Unauthorized') ||
        message.includes('"error":"Profile not found"') ||
        message.includes('"error":"Unauthorized"')
      )
    }

    async function hydrateSession() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        const currentSession = data?.session ?? null
        setSession(currentSession)
        if (currentSession) {
          atlas.auth.me(currentSession.access_token)
            .then(profile => { if (mounted) setUserProfile(profile) })
            .catch(async (error) => {
              if (isMissingProfileError(error)) {
                await forceLogout()
              }
            })
        } else {
          setUserProfile(null)
        }
      } catch {
        if (mounted) {
          setSession(null)
          setUserProfile(null)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setSession(session)
      setLoading(false)
      if (session) {
        atlas.auth.me(session.access_token)
          .then(profile => { if (mounted) setUserProfile(profile) })
          .catch(async (error) => {
            if (isMissingProfileError(error)) {
              await forceLogout()
            }
          })
      } else {
        setUserProfile(null)
      }
    })

    hydrateSession()

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function refreshProfile(activeSession = session) {
    if (!activeSession?.access_token) return null
    try {
      const profile = await atlas.auth.me(activeSession.access_token)
      setUserProfile(profile)
      return profile
    } catch {
      return null
    }
  }

  return (
    <AuthContext.Provider value={{
      session,
      userProfile,
      loading,
      refreshProfile,
      logout: () => supabase.auth.signOut()
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
