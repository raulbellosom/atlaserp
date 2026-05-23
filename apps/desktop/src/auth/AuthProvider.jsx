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
    let profileLoadedForAuthUserId = null

    async function forceLogout() {
      try {
        await supabase.auth.signOut()
      } catch {}
      if (!mounted) return
      setSession(null)
      setUserProfile(null)
      profileLoadedForAuthUserId = null
    }

    function shouldForceLogout(error) {
      if (Number(error?.status) === 401) return true
      const message = String(error?.message ?? '').toLowerCase()
      return (
        message.includes('profile not found') ||
        message.includes('unauthorized') ||
        message.includes('no autorizado') ||
        message.includes('token invalido') ||
        message.includes('token inválido') ||
        message.includes('expirado') ||
        message.includes('jwt expired') ||
        message.includes('invalid jwt')
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
            .then(profile => {
              if (!mounted) return
              setUserProfile(profile)
              profileLoadedForAuthUserId = currentSession?.user?.id ?? null
            })
            .catch(async (error) => {
              if (shouldForceLogout(error)) {
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
        const eventName = String(event ?? '').toUpperCase()
        const authUserId = session?.user?.id ?? null
        // On token rotation we keep current profile to avoid noisy /me requests
        // and prevent view churn while users are editing forms.
        if (eventName === 'TOKEN_REFRESHED' && authUserId && profileLoadedForAuthUserId === authUserId) {
          return
        }
        atlas.auth.me(session.access_token)
          .then(profile => {
            if (!mounted) return
            setUserProfile(profile)
            profileLoadedForAuthUserId = authUserId
          })
          .catch(async (error) => {
            if (shouldForceLogout(error)) {
              await forceLogout()
            }
          })
      } else {
        setUserProfile(null)
        profileLoadedForAuthUserId = null
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
