import { useCallback, useEffect, useRef, useState } from 'react'

const TOKEN_KEY = 'atlas_chat_guest_token'
const SESSION_KEY = 'atlas_chat_guest_session'
const TRACKING_KEY = 'atlas_chat_tracking_code'

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

function storeTrackingCode(code) {
  try {
    if (code) localStorage.setItem(TRACKING_KEY, code)
  } catch { /* ignore */ }
}

function loadTrackingCode() {
  try {
    return localStorage.getItem(TRACKING_KEY) ?? null
  } catch { return null }
}

function clearStoredSession() {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(TRACKING_KEY)
  } catch { /* ignore */ }
}

export function useGuestChat(sdk) {
  const [screen, setScreen] = useState('welcome') // 'welcome' | 'identify' | 'resume' | 'chat'
  const [availability, setAvailability] = useState(null)
  const [session, setSession] = useState(null)
  const [trackingCode, setTrackingCode] = useState(() => loadTrackingCode())
  const [messages, setMessages] = useState([])
  const [isSending, setIsSending] = useState(false)
  const [startError, setStartError] = useState(null)
  const [resumeError, setResumeError] = useState(null)
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
            setTrackingCode(null)
            return null
          }
          setSession({ token: stored.token, conversationId: stored.conversationId, email: data.email, name: data.name })
          setScreen('chat')
          return sdk.guestChat.listMessages(stored.token)
        })
        .then((msgs) => {
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
          senderName: payload.senderName ?? null,
          senderAvatarUrl: payload.senderAvatarUrl ?? null,
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
      storeTrackingCode(res.trackingCode)
      setTrackingCode(res.trackingCode ?? null)
      setSession({ token: res.token, conversationId: res.conversationId, email: data.email, name: data.name })
      setMessages([])
      setScreen('chat')
      return res
    } catch (err) {
      setStartError(err?.message ?? 'No se pudo iniciar la sesión. Inténtalo de nuevo.')
      throw err
    }
  }, [sdk])

  const resumeByCode = useCallback(async (code, email) => {
    setResumeError(null)
    try {
      const res = await sdk.guestChat.resumeByCode(code.trim().toUpperCase(), email.trim())
      storeSession(res.token, { conversationId: res.conversationId })
      storeTrackingCode(res.trackingCode)
      setTrackingCode(res.trackingCode ?? code)
      setSession({ token: res.token, conversationId: res.conversationId, email })
      const msgs = await sdk.guestChat.listMessages(res.token)
      if (Array.isArray(msgs)) setMessages(msgs)
      setScreen('chat')
      return res
    } catch (err) {
      const msg = err?.message ?? 'No se pudo encontrar la conversación. Verifica el número y correo.'
      setResumeError(msg)
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

  const sendFile = useCallback(async (file) => {
    if (!session?.token || !file) return
    setIsSending(true)
    try {
      const res = await sdk.guestChat.sendFileMessage(session.token, {
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        file,
      })
      setMessages((prev) => [...prev, {
        id: res.messageId,
        body: file.name,
        sender_type: 'guest',
        message_type: 'file',
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
    setTrackingCode(null)
    setMessages([])
    setScreen('welcome')
  }, [sdk, session])

  return {
    screen,
    setScreen,
    availability,
    session,
    trackingCode,
    messages,
    isSending,
    startError,
    resumeError,
    startSession,
    resumeByCode,
    sendMessage,
    sendFile,
    closeSession,
  }
}
