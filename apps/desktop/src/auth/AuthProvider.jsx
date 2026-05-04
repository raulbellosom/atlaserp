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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      setSession(session)
      setLoading(false)
      if (session) {
        atlas.auth.me(session.access_token)
          .then(profile => { if (mounted) setUserProfile(profile) })
          .catch(() => {})
      } else {
        setUserProfile(null)
      }
    })

    supabase.auth.getSession().catch(() => {
      if (mounted) setLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{
      session,
      userProfile,
      loading,
      logout: () => supabase.auth.signOut()
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
