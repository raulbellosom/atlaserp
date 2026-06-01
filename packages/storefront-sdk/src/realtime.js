export function createRealtimeNamespace({ request }) {
  let _supabase = null
  let _channel = null
  const _handlers = new Map() // event -> Set<handler>
  let _configPromise = null

  async function _ensureConnected() {
    if (_supabase && _channel) return

    if (!_configPromise) {
      _configPromise = request('GET', '/public/storefront/realtime-config')
        .then(res => res.data)
    }
    const { supabaseUrl, supabaseAnonKey, companyId } = await _configPromise

    const { createClient } = await import('@supabase/supabase-js')
    _supabase = createClient(supabaseUrl, supabaseAnonKey)

    _channel = _supabase
      .channel(`storefront:company:${companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const eventKey = `${payload.table}.${payload.eventType?.toLowerCase()}`
        const handlers = _handlers.get(eventKey) ?? new Set()
        for (const handler of handlers) handler(payload.new ?? payload.old)
      })
      .subscribe()
  }

  function on(event, handler) {
    if (!_handlers.has(event)) _handlers.set(event, new Set())
    _handlers.get(event).add(handler)
    _ensureConnected().catch(console.error)
  }

  function off(event, handler) {
    _handlers.get(event)?.delete(handler)
  }

  async function dispose() {
    if (_channel) await _supabase.removeChannel(_channel)
    _channel = null
    _supabase = null
    _configPromise = null
    _handlers.clear()
  }

  return { on, off, dispose }
}
