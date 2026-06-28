import { useCallback, useEffect, useRef, useState } from 'react'

const TOKEN_KEY = 'atlas_chat_guest_token'
const SESSION_KEY = 'atlas_chat_guest_session'

function loadStoredSession() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(SESSION_KEY)
    if (!token || !raw) return null
    return { token, ...JSON.parse(raw) }
  } catch {
    return null
  }
}

function storeSession(token, sessionData) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData))
  } catch { /* storage might be disabled */ }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
  } catch { /* ignore */ }
}

export function useGuestChat(sdk) {
  const [screen, setScreen] = useState('welcome') // 'welcome' | 'identify' | 'chat'
  const [availability, setAvailability] = useState(null)
  const [session, setSession] = useState(null)
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [startError, setStartError] = useState(null)
  const unsubscribeRef = useRef(null)

  // Load availability + restore session on mount
  useEffect(() => {
    sdk.guestChat.getAvailability()
      .then(setAvailability)
      .catch(() => setAvailability({ available: false, agentsOnline: 0 }))

    const stored = loadStoredSession()
    if (stored?.token && stored?.conversationId) {
      sdk.guestChat.getSession(stored.token)
        .then((data) => {
          if (data?.conversation?.status === 'closed') {
            clearStoredSession()
            return null
          }
          setSession({ token: stored.token, conversationId: stored.conversationId, email: data.email, name: data.name })
          setScreen('chat')
          return sdk.guestChat.listMessages(stored.token)
        })
        .then((msgs) => {
          // listMessages now returns the array directly
          if (Array.isArray(msgs)) setMessages(msgs)
        })
        .catch(() => clearStoredSession())
    }
  }, [sdk])

  // Subscribe to realtime replies when session is active
  useEffect(() => {
    if (!session?.conversationId) return

    const unsub = sdk.guestChat.subscribeToReplies(session.conversationId, (payload) => {
      setMessages((prev) => {
        const isDuplicate = prev.some((m) => m.id === payload.messageId)
        if (isDuplicate) return prev
        return [...prev, {
          id: payload.messageId,
          body: payload.body,
          sender_type: payload.senderType,
          created_at: payload.createdAt,
        }]
      })
    })

    unsubscribeRef.current = unsub
    return () => {
      unsub()
      unsubscribeRef.current = null
    }
  }, [sdk, session?.conversationId])

  const startSession = useCallback(async (data = {}) => {
    setStartError(null)
    try {
      const res = await sdk.guestChat.createSession({
        ...data,
        pageUrl: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof document !== 'undefined' && document.referrer ? document.referrer : undefined,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      })
      storeSession(res.token, { conversationId: res.conversationId })
      setSession({ token: res.token, conversationId: res.conversationId, email: data.email, name: data.name })
      setMessages([])
      setScreen('chat')
      return res
    } catch (err) {
      setStartError(err?.message ?? 'No se pudo iniciar la sesión. Inténtalo de nuevo.')
      throw err
    }
  }, [sdk])

  const sendMessage = useCallback(async (body) => {
    if (!session?.token || !body?.trim()) return
    setIsSending(true)
    try {
      const res = await sdk.guestChat.sendMessage(session.token, body)
      setMessages((prev) => [...prev, {
        id: res.messageId,
        body,
        sender_type: 'guest',
        created_at: res.createdAt,
      }])
    } finally {
      setIsSending(false)
    }
  }, [sdk, session])

  const closeSession = useCallback(async () => {
    if (session?.token) {
      await sdk.guestChat.closeSession(session.token).catch(() => {})
    }
    clearStoredSession()
    setSession(null)
    setMessages([])
    setScreen('welcome')
  }, [sdk, session])

  return {
    screen,
    setScreen,
    availability,
    session,
    messages,
    isSending,
    startError,
    startSession,
    sendMessage,
    closeSession,
  }
}
