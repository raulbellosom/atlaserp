import { useCallback, useEffect, useRef, useState } from 'react'
import { useGuestChat } from './useGuestChat.js'

const DEFAULT_ACCENT = '#c7f049'
const DEFAULT_BG = '#111118'
const DEFAULT_BG2 = '#1a1a24'
const DEFAULT_BG3 = '#252535'

function s(base, extra = {}) {
  return { ...base, ...extra }
}

export function ChatWidget({ sdk, companyName = 'Chat', accentColor = DEFAULT_ACCENT }) {
  const [open, setOpen] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [emailError, setEmailError] = useState('')
  const [textInput, setTextInput] = useState('')
  const messagesEndRef = useRef(null)

  const {
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
  } = useGuestChat(sdk)

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open && screen === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open, screen])

  const handleStartChat = useCallback(async () => {
    if (!emailInput.trim() || !/\S+@\S+\.\S+/.test(emailInput)) {
      setEmailError('Ingresa un correo válido.')
      return
    }
    setEmailError('')
    await startSession({ email: emailInput.trim(), name: nameInput.trim() || undefined })
  }, [emailInput, nameInput, startSession])

  const handleSend = useCallback(async () => {
    if (!textInput.trim()) return
    const body = textInput.trim()
    setTextInput('')
    await sendMessage(body)
  }, [textInput, sendMessage])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  const agentsOnline = availability?.agentsOnline ?? 0
  const isAvailable = availability?.available ?? false

  // ── Styles ──────────────────────────────────────────────────────────────
  const styles = {
    // Fixed tab on right edge
    tab: {
      position: 'fixed',
      right: 0,
      top: '50%',
      transform: 'translateY(-50%)',
      zIndex: 9999,
      background: accentColor,
      color: '#0f0f13',
      fontWeight: 700,
      fontSize: 11,
      letterSpacing: '0.08em',
      padding: '10px 5px',
      borderRadius: '6px 0 0 6px',
      writingMode: 'vertical-rl',
      cursor: 'pointer',
      userSelect: 'none',
      boxShadow: '-2px 0 12px rgba(0,0,0,0.3)',
      display: open ? 'none' : 'block',
    },
    // Panel
    panel: {
      position: 'fixed',
      top: 0,
      right: open ? 0 : -340,
      width: 320,
      height: '100vh',
      background: DEFAULT_BG,
      borderLeft: `2px solid ${accentColor}`,
      zIndex: 9998,
      display: 'flex',
      flexDirection: 'column',
      transition: 'right 0.25s ease',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '-4px 0 24px rgba(0,0,0,0.4)',
    },
    header: {
      padding: '12px 16px',
      borderBottom: `1px solid ${DEFAULT_BG3}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexShrink: 0,
    },
    headerTitle: {
      color: accentColor,
      fontWeight: 700,
      fontSize: 13,
    },
    closeBtn: {
      background: 'none',
      border: 'none',
      color: '#666',
      fontSize: 18,
      cursor: 'pointer',
      lineHeight: 1,
      padding: '0 2px',
    },
    body: {
      flex: 1,
      overflowY: 'auto',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    },
    // Welcome screen
    welcomeCard: {
      background: DEFAULT_BG2,
      borderRadius: 8,
      padding: 14,
      marginBottom: 6,
    },
    welcomeTitle: {
      color: '#ddd',
      fontWeight: 700,
      fontSize: 14,
      marginBottom: 6,
    },
    availBadge: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      marginBottom: 4,
    },
    dot: {
      width: 7,
      height: 7,
      borderRadius: '50%',
      background: isAvailable ? '#22c55e' : '#666',
      flexShrink: 0,
    },
    availText: {
      color: isAvailable ? '#86efac' : '#888',
      fontSize: 11,
    },
    responseTime: {
      color: '#555',
      fontSize: 11,
      marginTop: 2,
    },
    optionBtn: {
      width: '100%',
      background: DEFAULT_BG2,
      border: `1px solid ${DEFAULT_BG3}`,
      borderRadius: 6,
      padding: '10px 12px',
      color: '#ccc',
      fontSize: 12,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      textAlign: 'left',
    },
    // Identify screen
    label: {
      color: '#888',
      fontSize: 11,
      marginBottom: 3,
    },
    input: {
      width: '100%',
      background: DEFAULT_BG2,
      border: `1px solid ${DEFAULT_BG3}`,
      borderRadius: 5,
      padding: '8px 10px',
      color: '#ddd',
      fontSize: 12,
      outline: 'none',
      boxSizing: 'border-box',
    },
    inputError: {
      borderColor: '#ef4444',
    },
    errorMsg: {
      color: '#f87171',
      fontSize: 10,
      marginTop: 2,
    },
    primaryBtn: {
      width: '100%',
      background: accentColor,
      border: 'none',
      borderRadius: 5,
      padding: '9px 12px',
      color: '#0f0f13',
      fontWeight: 700,
      fontSize: 12,
      cursor: 'pointer',
      marginTop: 4,
    },
    ghostBtn: {
      background: 'none',
      border: 'none',
      color: '#555',
      fontSize: 11,
      cursor: 'pointer',
      padding: '6px 0',
      textAlign: 'center',
      width: '100%',
    },
    backBtn: {
      background: 'none',
      border: 'none',
      color: '#666',
      fontSize: 11,
      cursor: 'pointer',
      padding: '0 0 8px',
      textAlign: 'left',
    },
    // Chat screen
    msgBubbleGuest: {
      alignSelf: 'flex-end',
      background: accentColor,
      color: '#0f0f13',
      borderRadius: '10px 10px 2px 10px',
      padding: '7px 10px',
      fontSize: 12,
      maxWidth: '80%',
      wordBreak: 'break-word',
    },
    msgBubbleOperator: {
      alignSelf: 'flex-start',
      background: DEFAULT_BG2,
      color: '#ddd',
      borderRadius: '10px 10px 10px 2px',
      padding: '7px 10px',
      fontSize: 12,
      maxWidth: '80%',
      wordBreak: 'break-word',
    },
    chatFooter: {
      padding: '10px 12px',
      borderTop: `1px solid ${DEFAULT_BG3}`,
      display: 'flex',
      gap: 6,
      flexShrink: 0,
    },
    textArea: {
      flex: 1,
      background: DEFAULT_BG2,
      border: `1px solid ${DEFAULT_BG3}`,
      borderRadius: 5,
      padding: '7px 9px',
      color: '#ddd',
      fontSize: 12,
      resize: 'none',
      outline: 'none',
      fontFamily: 'inherit',
      minHeight: 36,
      maxHeight: 100,
    },
    sendBtn: {
      background: accentColor,
      border: 'none',
      borderRadius: 5,
      width: 36,
      height: 36,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderWelcome() {
    return (
      <>
        <div style={styles.welcomeCard}>
          <div style={styles.welcomeTitle}>¿Cómo te podemos ayudar?</div>
          <div style={styles.availBadge}>
            <span style={styles.dot} />
            <span style={styles.availText}>
              {isAvailable ? `${agentsOnline} agente${agentsOnline !== 1 ? 's' : ''} disponible${agentsOnline !== 1 ? 's' : ''}` : 'Sin agentes disponibles ahora'}
            </span>
          </div>
          {isAvailable && (
            <div style={styles.responseTime}>Tiempo de respuesta típico: &lt;5 min</div>
          )}
        </div>

        {isAvailable ? (
          <button
            style={styles.optionBtn}
            onClick={() => setScreen('identify')}
          >
            <ChatIcon color={accentColor} />
            Hablar con un agente
          </button>
        ) : (
          <button
            style={styles.optionBtn}
            onClick={() => setScreen('identify')}
          >
            <MailIcon color={accentColor} />
            Dejar un mensaje
          </button>
        )}
      </>
    )
  }

  function renderIdentify() {
    return (
      <>
        <button style={styles.backBtn} onClick={() => setScreen('welcome')}>← Atrás</button>
        <div style={{ color: '#ddd', fontWeight: 700, fontSize: 13, marginBottom: 4 }}>Antes de empezar</div>
        <div style={{ color: '#666', fontSize: 11, marginBottom: 14 }}>
          Tu correo nos permite darte seguimiento si la conversación se interrumpe.
        </div>

        <div style={{ marginBottom: 10 }}>
          <div style={styles.label}>Nombre (opcional)</div>
          <input
            style={styles.input}
            type="text"
            placeholder="Tu nombre"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={styles.label}>Correo electrónico *</div>
          <input
            style={s(styles.input, emailError ? styles.inputError : {})}
            type="email"
            placeholder="tu@correo.com"
            value={emailInput}
            onChange={(e) => { setEmailInput(e.target.value); setEmailError('') }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleStartChat() }}
          />
          {emailError && <div style={styles.errorMsg}>{emailError}</div>}
        </div>

        <button style={styles.primaryBtn} onClick={handleStartChat}>
          Iniciar chat
        </button>
        {startError && <div style={styles.errorMsg}>{startError}</div>}
        <button style={styles.ghostBtn} onClick={() => startSession({}).catch(() => {})}>
          Continuar sin correo
        </button>
      </>
    )
  }

  function renderChat() {
    return (
      <>
        <div style={s(styles.body, { padding: '12px 14px' })}>
          {messages.length === 0 && (
            <div style={{ color: '#555', fontSize: 11, textAlign: 'center', marginTop: 20 }}>
              Escribe tu primer mensaje para iniciar la conversación.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              style={msg.sender_type === 'guest' ? styles.msgBubbleGuest : styles.msgBubbleOperator}
            >
              {msg.body}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div style={styles.chatFooter}>
          <textarea
            style={styles.textArea}
            placeholder="Escribe un mensaje..."
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          <button
            style={s(styles.sendBtn, isSending ? { opacity: 0.5 } : {})}
            onClick={handleSend}
            disabled={isSending}
            aria-label="Enviar mensaje"
          >
            <SendIcon />
          </button>
        </div>
      </>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────

  return (
    <>
      {/* Tab trigger */}
      <div style={styles.tab} onClick={() => setOpen(true)} role="button" aria-label="Abrir chat">
        CHAT
      </div>

      {/* Slide panel */}
      <div style={styles.panel} role="dialog" aria-label="Chat de soporte">
        {/* Header */}
        <div style={styles.header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {screen === 'chat' && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            )}
            <span style={styles.headerTitle}>{companyName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {screen === 'chat' && (
              <button
                style={s(styles.closeBtn, { fontSize: 11, color: '#555' })}
                onClick={closeSession}
                title="Cerrar conversación"
              >
                Cerrar
              </button>
            )}
            <button style={styles.closeBtn} onClick={() => setOpen(false)} aria-label="Cerrar panel">
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        {screen !== 'chat' ? (
          <div style={styles.body}>
            {screen === 'welcome' && renderWelcome()}
            {screen === 'identify' && renderIdentify()}
          </div>
        ) : (
          renderChat()
        )}
      </div>

      {/* Overlay to close on outside click */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9997 }}
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  )
}

// ── Icon helpers ─────────────────────────────────────────────────────────────

function ChatIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function MailIcon({ color }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" aria-hidden="true">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0f0f13" strokeWidth="2.5" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  )
}
