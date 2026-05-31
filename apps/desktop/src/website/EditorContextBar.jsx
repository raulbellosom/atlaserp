import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, PinOff } from 'lucide-react'

const BAR_HEIGHT = 40
const STORAGE_KEY = 'atlas-editor-bar-pinned'
const ACCENT = '#6366f1'

export function EditorContextBar({ site, page, onPinChange }) {
  const navigate = useNavigate()
  const [pinned, setPinned] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const hideTimer = useRef(null)

  useEffect(() => () => clearTimeout(hideTimer.current), [])

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
    hideTimer.current = setTimeout(() => setVisible(false), 150)
  }

  const status = site?.status ?? 'draft'
  const statusLabel = status === 'published' ? 'Publicado' : 'Borrador'
  const statusStyle = status === 'published'
    ? { backgroundColor: '#f0fdf4', color: '#15803d', borderColor: '#bbf7d0' }
    : { backgroundColor: '#fefce8', color: '#a16207', borderColor: '#fde68a' }

  return (
    <>
      {/* Corner trigger — always present, reveals bar on hover */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, width: 64, height: 64, zIndex: 9999 }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {!visible && (
          <>
            <div style={{ position: 'absolute', top: 0, left: 0, width: 48, height: 2, backgroundColor: ACCENT, borderRadius: 1 }} />
            <div style={{ position: 'absolute', top: 0, left: 0, width: 2, height: 48, backgroundColor: ACCENT, borderRadius: 1 }} />
          </>
        )}
      </div>

      {/* Bar */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: BAR_HEIGHT,
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          paddingLeft: 12,
          paddingRight: 16,
          backgroundColor: 'rgba(15, 15, 15, 0.88)',
          backdropFilter: 'blur(8px)',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: visible ? 1 : 0,
          transition: 'transform 200ms ease, opacity 200ms ease',
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {/* Pin toggle */}
        <button
          onClick={togglePin}
          title={pinned ? 'Desfijar barra' : 'Fijar barra'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: 4,
            display: 'flex', alignItems: 'center',
            color: pinned ? ACCENT : '#6b7280',
            transition: 'color 150ms',
          }}
        >
          {pinned ? <Pin size={14} /> : <PinOff size={14} />}
        </button>

        {/* Status chip */}
        <span style={{
          fontSize: 11, fontWeight: 600, padding: '2px 8px',
          borderRadius: 9999, border: '1px solid',
          ...statusStyle,
        }}>
          {statusLabel}
        </span>

        {/* Site + page name */}
        <span style={{
          fontSize: 12, color: '#9ca3af', flex: 1,
          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
        }}>
          {site?.name}
          {page?.title ? ` · ${page.title}` : ''}
        </span>

        {/* Edit page button */}
        {page?.id && (
          <button
            onClick={() => navigate(`/app/m/atlas.website/pages/${page.id}/editor`)}
            style={{
              fontSize: 12, color: '#e5e7eb', cursor: 'pointer', whiteSpace: 'nowrap',
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, padding: '4px 12px',
            }}
          >
            Editar esta pagina
          </button>
        )}

        {/* Panel link */}
        <button
          onClick={() => navigate('/app/m/atlas.website')}
          style={{
            fontSize: 12, color: '#9ca3af',
            background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
          }}
        >
          Panel
        </button>
      </div>
    </>
  )
}
