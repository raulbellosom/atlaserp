export function createGuestChatDomain(request, supabaseUrl, supabaseAnonKey) {
  async function createSession(data = {}) {
    const res = await request('POST', '/public/chat/session', data)
    return res.data
  }

  async function getSession(token) {
    const res = await request('GET', `/public/chat/session/${token}`)
    return res.data
  }

  async function sendMessage(token, body, messageType = 'text') {
    const res = await request('POST', `/public/chat/session/${token}/messages`, { body, messageType })
    return res.data
  }

  async function listMessages(token, { limit = 40, before = null } = {}) {
    const params = new URLSearchParams({ limit: String(limit) })
    if (before) params.set('before', before)
    const res = await request('GET', `/public/chat/session/${token}/messages?${params}`)
    return res.data
  }

  async function closeSession(token) {
    return request('POST', `/public/chat/session/${token}/close`)
  }

  async function getAvailability() {
    const res = await request('GET', '/public/storefront/chat/availability')
    return res.data
  }

  function subscribeToReplies(conversationId, onMessage) {
    if (!supabaseUrl || !supabaseAnonKey) {
      return () => {}
    }

    let channel = null
    let supabaseClient = null
    let cancelled = false

    import('@supabase/supabase-js')
      .then(({ createClient }) => {
        if (cancelled) return
        supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
          auth: { storageKey: 'atlas-guest-chat', persistSession: false },
        })
        channel = supabaseClient
          .channel(`chat:conv:${conversationId}`)
          .on('broadcast', { event: 'new_operator_message' }, ({ payload }) => {
            onMessage(payload)
          })
          .subscribe()
      })
      .catch(() => {})

    return function unsubscribe() {
      cancelled = true
      if (channel && supabaseClient) {
        supabaseClient.removeChannel(channel).catch(() => {})
        supabaseClient.removeAllChannels().catch(() => {})
      }
    }
  }

  return {
    createSession,
    getSession,
    sendMessage,
    listMessages,
    closeSession,
    getAvailability,
    subscribeToReplies,
  }
}
