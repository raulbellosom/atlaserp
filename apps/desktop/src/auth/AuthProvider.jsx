import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { atlas } from '../lib/atlas'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) {
        atlas.auth.me(session.access_token).then(setUserProfile).catch(() => {})
      }
    }).catch(() => setLoading(false))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        atlas.auth.me(session.access_token).then(setUserProfile).catch(() => {})
      } else {
        setUserProfile(null)
      }
    })

    return () => subscription.unsubscribe()
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
