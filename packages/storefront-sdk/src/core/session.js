function _mapSupabaseSession(supabaseSession) {
  if (!supabaseSession) return null
  return {
    token: supabaseSession.access_token,
    refreshToken: supabaseSession.refresh_token,
    expiresAt: supabaseSession.expires_at,
    user: null,
  }
}

export function createSupabaseSessionAdapter({ supabase, onSessionChange = null }) {
  let _cached = null
  const _listeners = new Set()

  function _notify(session) {
    if (typeof onSessionChange === 'function') onSessionChange(session)
    for (const listener of _listeners) listener(session)
  }

  // onAuthStateChange fires INITIAL_SESSION synchronously if a session exists in storage.
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, supabaseSession) => {
    _cached = _mapSupabaseSession(supabaseSession)
    _notify(_cached)
  })

  return {
    get() { return _cached },
    setUser(user) {
      if (_cached) {
        _cached = { ..._cached, user }
        _notify(_cached)
      }
    },
    clear() {
      _cached = null
      _notify(null)
    },
    subscribe(fn) {
      _listeners.add(fn)
      return () => _listeners.delete(fn)
    },
    dispose() {
      subscription.unsubscribe()
    },
  }
}
