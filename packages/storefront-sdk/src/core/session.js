export function createSessionStore({ initialSession = null, onSessionChange = null } = {}) {
  let _session = initialSession ?? null
  const _listeners = new Set()

  function _notify(session) {
    if (typeof onSessionChange === 'function') onSessionChange(session)
    for (const listener of _listeners) listener(session)
  }

  return {
    get() { return _session },
    set(session) { _session = session; _notify(session) },
    clear() { _session = null; _notify(null) },
    subscribe(fn) {
      _listeners.add(fn)
      return () => _listeners.delete(fn)
    },
  }
}
