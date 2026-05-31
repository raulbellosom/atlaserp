import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, PinOff } from 'lucide-react'

const BAR_HEIGHT = 44
const STORAGE_KEY = 'atlas-editor-bar-pinned'

const STYLES_ID = 'atlas-editor-bar-styles'
const CSS = `
@keyframes atlas-pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.45; }
}
@keyframes atlas-glow {
  0%, 100% { box-shadow: 0 0 6px 2px rgba(99,102,241,0.55); }
  50%       { box-shadow: 0 0 14px 5px rgba(139,92,246,0.75); }
}
.atlas-corner-line { animation: atlas-pulse 2s ease-in-out infinite; }
.atlas-corner-dot  { animation: atlas-glow  2s ease-in-out infinite; }
`

function injectStyles() {
  if (document.getElementById(STYLES_ID)) return
  const el = document.createElement('style')
  el.id = STYLES_ID
  el.textContent = CSS
  document.head.appendChild(el)
}

export function EditorContextBar({ site, page, onPinChange, onEditPage }) {
  const navigate = useNavigate()
  const [pinned, setPinned]   = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const hideTimer = useRef(null)

  useEffect(() => {
    injectStyles()
    return () => clearTimeout(hideTimer.current)
  }, [])

  function togglePin() {
    const next = !pinned
    setPinned(next)
    localStorage.setItem(STORAGE_KEY, String(next))
    if (!next) setVisible(false)
    onPinChange?.(next)
  }

  function show() {
    clearTimeout(hideTimer.current)
    setVisible(true)
  }

  function scheduleHide() {
    if (pinned) return
    hideTimer.current = setTimeout(() => setVisible(false), 220)
  }

  const status      = site?.status ?? 'draft'
  const isPublished = status === 'published'
  const statusLabel = isPublished ? 'Publicado' : 'Borrador'
  const statusStyle = isPublished
    ? { background: 'rgba(16,185,129,0.18)', color: '#34d399', border: '1px solid rgba(52,211,153,0.35)' }
    : { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }

  return (
    <>
      {/* ── Corner trigger ──────────────────────────────────────────────────── */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, width: 64, height: 64, zIndex: 9999 }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {!visible && (
          <>
            {/* Horizontal gradient line */}
            <div
              className="atlas-corner-line"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: 48, height: 3,
                background: 'linear-gradient(90deg, #6366f1 0%, #a78bfa 60%, transparent 100%)',
                borderRadius: '0 0 3px 0',
              }}
            />
            {/* Vertical gradient line */}
            <div
              className="atlas-corner-line"
              style={{
                position: 'absolute', top: 0, left: 0,
                width: 3, height: 48,
                background: 'linear-gradient(180deg, #6366f1 0%, #a78bfa 60%, transparent 100%)',
                borderRadius: '0 0 3px 0',
              }}
            />
            {/* Glowing corner dot */}
            <div
              className="atlas-corner-dot"
              style={{
                position: 'absolute', top: 1, left: 1,
                width: 9, height: 9,
                borderRadius: 2,
                background: 'radial-gradient(circle at 30% 30%, #818cf8, #6366f1)',
              }}
            />
          </>
        )}
      </div>

      {/* ── Bar ─────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed',
          top: 0, left: 0,
          width: '100%',
          height: BAR_HEIGHT,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          paddingLeft: 10,
          paddingRight: 14,
          background: 'linear-gradient(180deg, rgba(22,18,58,0.97) 0%, rgba(15,12,42,0.97) 100%)',
          borderBottom: '1px solid rgba(99,102,241,0.28)',
          backdropFilter: 'blur(12px)',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 180ms ease, opacity 180ms ease',
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {/* Pin toggle */}
        <button
          onClick={togglePin}
          title={pinned ? 'Desfijar barra' : 'Fijar barra'}
          style={{
            flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 28, height: 28,
            borderRadius: 6,
            background: pinned ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.06)',
            border: pinned ? '1px solid rgba(99,102,241,0.45)' : '1px solid rgba(255,255,255,0.1)',
            color: pinned ? '#a78bfa' : '#6b7280',
            cursor: 'pointer',
            transition: 'all 150ms',
          }}
        >
          {pinned ? <Pin size={13} /> : <PinOff size={13} />}
        </button>

        {/* Status chip */}
        <span style={{
          flexShrink: 0,
          fontSize: 11, fontWeight: 700,
          padding: '2px 9px',
          borderRadius: 9999,
          letterSpacing: '0.02em',
          ...statusStyle,
        }}>
          {statusLabel}
        </span>

        {/* Divider */}
        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

        {/* Site · Page */}
        <span style={{
          fontSize: 12, color: '#9ca3af', flex: 1,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
          letterSpacing: '0.01em',
        }}>
          <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{site?.name}</span>
          {page?.title && (
            <span style={{ color: '#6b7280' }}> · {page.title}</span>
          )}
        </span>

        {/* Edit button */}
        {page?.id && (
          <button
            onClick={() => onEditPage ? onEditPage() : navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
            style={{
              flexShrink: 0,
              fontSize: 12, fontWeight: 600,
              color: '#fff',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              border: 'none',
              borderRadius: 7,
              padding: '5px 14px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 1px 8px rgba(99,102,241,0.4)',
              transition: 'opacity 150ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            Editar esta pagina
          </button>
        )}

        {/* Panel link */}
        <button
          onClick={() => navigate('/app/m/atlas.website')}
          style={{
            flexShrink: 0,
            fontSize: 12,
            color: '#6b7280',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            padding: '4px 6px',
            borderRadius: 5,
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#9ca3af' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
        >
          Panel
        </button>
      </div>
    </>
  )
}
