import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pin, PinOff, ChevronLeft, ChevronDown, Eye, Pencil } from 'lucide-react'

const BAR_H      = 46
const STORAGE_KEY = 'atlas-editor-bar-pinned'
const STYLES_ID   = 'atlas-editor-bar-css'

const CSS = `
@keyframes _atlasPulse {
  0%,100% { opacity:1 }
  50%      { opacity:0.35 }
}
._atlasCornerLine { animation: _atlasPulse 2.2s ease-in-out infinite }
`

function injectCss() {
  if (document.getElementById(STYLES_ID)) return
  const s = document.createElement('style')
  s.id = STYLES_ID
  s.textContent = CSS
  document.head.appendChild(s)
}

export function EditorContextBar({
  site,
  page,
  pages = [],
  editMode = false,
  onPinChange,
  onToggleEdit,
  onNavigate,
  onPublishPage,
  onUnpublishPage,
  isPublishing = false,
}) {
  const navigate = useNavigate()
  const [pinned, setPinned]   = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [visible, setVisible] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const hideTimer = useRef(null)

  useEffect(() => {
    injectCss()
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
    hideTimer.current = setTimeout(() => setVisible(false), 400)
  }

  const pageStatus  = page?.status ?? 'draft'
  const isPublished = pageStatus === 'published'

  function handlePageChange(e) {
    const v = e.target.value
    if (v === '__new__') {
      navigate('/app/m/atlas.website/pages')
      return
    }
    const found = pages.find((p) => p.id === v)
    if (found) onNavigate?.(found.routePath)
  }

  // ── Shared styles ──────────────────────────────────────────────────────────

  const btnBase = {
    display: 'flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', cursor: 'pointer',
    borderRadius: 6, padding: '4px 8px',
    transition: 'all 120ms',
    whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* ── Corner trigger ──────────────────────────────────────────────── */}
      <div
        style={{ position: 'fixed', top: 0, left: 0, width: 60, height: 60, zIndex: 9999 }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {!visible && (
          <>
            <div className="_atlasCornerLine" style={{
              position: 'absolute', top: 0, left: 0,
              width: 46, height: 3,
              background: 'linear-gradient(90deg, #ef4444 0%, #f87171 55%, transparent 100%)',
              borderRadius: '0 0 2px 0',
            }} />
            <div className="_atlasCornerLine" style={{
              position: 'absolute', top: 0, left: 0,
              width: 3, height: 46,
              background: 'linear-gradient(180deg, #ef4444 0%, #f87171 55%, transparent 100%)',
              borderRadius: '0 0 2px 0',
            }} />
          </>
        )}
      </div>

      {/* ── Bar ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'fixed', top: 0, left: 0,
          width: '100%', height: BAR_H,
          zIndex: 9998,
          display: 'flex', alignItems: 'center',
          gap: 4,
          paddingLeft: 8, paddingRight: 12,
          background: 'linear-gradient(180deg, #0d0b20 0%, #100e26 100%)',
          borderBottom: '1px solid rgba(99,102,241,0.22)',
          backdropFilter: 'blur(14px)',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          opacity: visible ? 1 : 0,
          pointerEvents: visible ? 'auto' : 'none',
          transition: 'transform 170ms ease, opacity 170ms ease',
          overflow: 'hidden',
        }}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
      >
        {/* Gradient top accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa, #8b5cf6, #6366f1)',
          opacity: 0.7,
        }} />

        {/* ── Pin icon ──────────────────────────────────────────────────── */}
        <button
          onClick={togglePin}
          title={pinned ? 'Desfijar' : 'Fijar barra'}
          style={{
            ...btnBase,
            padding: '4px 6px',
            color: pinned ? '#a78bfa' : '#4b5563',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = pinned ? '#c4b5fd' : '#6b7280' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = pinned ? '#a78bfa' : '#4b5563' }}
        >
          {pinned ? <Pin size={15} /> : <PinOff size={15} />}
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* ── Back to ERP ───────────────────────────────────────────────── */}
        <button
          onClick={() => navigate('/app')}
          style={{ ...btnBase, color: '#6b7280', fontSize: 12 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = '#9ca3af' }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#6b7280' }}
        >
          <ChevronLeft size={13} />
          <span>Atlas ERP</span>
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* ── Page selector ─────────────────────────────────────────────── */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <select
            value={page?.id ?? ''}
            onChange={handlePageChange}
            style={{
              appearance: 'none',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(99,102,241,0.25)',
              color: '#c4b5fd',
              borderRadius: 7,
              padding: '4px 28px 4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none',
              maxWidth: 200,
            }}
          >
            {page && !pages.find((p) => p.id === page.id) && (
              <option value={page.id}>{page.title}</option>
            )}
            {pages.map((p) => (
              <option key={p.id} value={p.id}>{p.title}</option>
            ))}
            <option value="__new__">+ Nueva pagina</option>
          </select>
          <ChevronDown
            size={12}
            style={{ position: 'absolute', right: 8, color: '#6366f1', pointerEvents: 'none' }}
          />
        </div>

        {/* Flex spacer */}
        <div style={{ flex: 1 }} />

        {/* ── Vista / Editor toggle ─────────────────────────────────────── */}
        <div style={{
          display: 'flex',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: 2, gap: 1,
        }}>
          <button
            onClick={() => editMode && onToggleEdit?.()}
            style={{
              ...btnBase,
              padding: '3px 10px',
              fontSize: 11, fontWeight: 600,
              color: !editMode ? '#fff' : '#4b5563',
              background: !editMode ? 'rgba(99,102,241,0.75)' : 'transparent',
              cursor: !editMode ? 'default' : 'pointer',
            }}
          >
            <Eye size={11} style={{ marginRight: 3 }} />
            Vista
          </button>
          <button
            onClick={() => !editMode && onToggleEdit?.()}
            style={{
              ...btnBase,
              padding: '3px 10px',
              fontSize: 11, fontWeight: 600,
              color: editMode ? '#fff' : '#4b5563',
              background: editMode ? 'rgba(99,102,241,0.75)' : 'transparent',
              cursor: editMode ? 'default' : 'pointer',
            }}
          >
            <Pencil size={11} style={{ marginRight: 3 }} />
            Editor
          </button>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.08)', flexShrink: 0 }} />

        {/* ── Publish / Draft button ────────────────────────────────────── */}
        <button
          onClick={() => isPublished ? onUnpublishPage?.() : onPublishPage?.()}
          disabled={isPublishing}
          style={{
            ...btnBase,
            fontSize: 11, fontWeight: 700,
            padding: '4px 12px',
            border: '1px solid',
            opacity: isPublishing ? 0.6 : 1,
            cursor: isPublishing ? 'default' : 'pointer',
            ...(isPublished
              ? {
                  background: 'rgba(16,185,129,0.12)',
                  color: '#34d399',
                  borderColor: 'rgba(52,211,153,0.3)',
                }
              : {
                  background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                  color: '#fff',
                  borderColor: 'transparent',
                  boxShadow: '0 1px 8px rgba(99,102,241,0.4)',
                }),
          }}
        >
          {isPublishing ? 'Procesando...' : isPublished ? 'Publicado' : 'Publicar'}
        </button>
      </div>
    </>
  )
}
