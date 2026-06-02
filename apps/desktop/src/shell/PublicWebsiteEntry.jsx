import { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { PublicPageLoader, storePublicSiteHint } from '../components/PublicPageLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
import { EditorContextBar } from '../website/EditorContextBar.jsx'
import WebsitePageEditorScreen from '../modules/atlas.website/screens/WebsitePageEditorScreen.jsx'
import { BAR_H_PX } from '../website/EditorContextBar.jsx'
import { toast } from 'sonner'

function titleToSlug(title) {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '') || 'pagina'
}

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

async function fetchWebsiteResolve(pathname) {
  const url = `${getApiUrl()}/public/website/resolve?path=${encodeURIComponent(pathname)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function fetchEditorCheck(token) {
  const res = await fetch(`${getApiUrl()}/website/site`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

// ── "En construccion" screen for anonymous visitors ───────────────────────────

const CS_CSS = `
  @keyframes _cs_fadeUp {
    from { opacity: 0; transform: translateY(28px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes _cs_lineGrow {
    from { transform: scaleX(0) }
    to   { transform: scaleX(1) }
  }
  @keyframes _cs_float {
    0%, 100% { transform: translateY(0) }
    50%       { transform: translateY(-20px) }
  }
  @keyframes _cs_grain {
    0%,100%{ transform:translate(0,0) }
    10%    { transform:translate(-2%,-3%) }
    20%    { transform:translate(-4%,2%) }
    30%    { transform:translate(3%,-4%) }
    40%    { transform:translate(2%,3%) }
    50%    { transform:translate(-1%,-2%) }
    60%    { transform:translate(4%,1%) }
    70%    { transform:translate(-3%,4%) }
    80%    { transform:translate(1%,-1%) }
    90%    { transform:translate(-2%,2%) }
  }
  @keyframes _cs_glow {
    0%,100% { opacity: 0.35 }
    50%      { opacity: 0.65 }
  }
  ._cs1 { animation: _cs_fadeUp .9s cubic-bezier(.16,1,.3,1) .05s both }
  ._cs2 { animation: _cs_fadeUp .9s cubic-bezier(.16,1,.3,1) .2s  both }
  ._cs3 { animation: _cs_fadeUp .9s cubic-bezier(.16,1,.3,1) .35s both }
  ._cs4 { animation: _cs_fadeUp .9s cubic-bezier(.16,1,.3,1) .5s  both }
  ._cs5 { animation: _cs_fadeUp .9s cubic-bezier(.16,1,.3,1) .65s both }
  ._csLine  { animation: _cs_lineGrow 1.4s cubic-bezier(.16,1,.3,1) .55s both; transform-origin: left }
  ._csFloat { animation: _cs_float 7s ease-in-out infinite }
  ._csGlow  { animation: _cs_glow  5s ease-in-out infinite }
  ._csGrain { animation: _cs_grain 9s steps(1) infinite }
`

function ComingSoonScreen({ siteName }) {
  return (
    <>
      <style>{CS_CSS}</style>
      <div style={{
        minHeight: '100vh',
        background: '#07090f',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-start',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* ── Diagonal grid ── */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            repeating-linear-gradient(-45deg,
              rgba(255,255,255,.018) 0px, rgba(255,255,255,.018) 1px,
              transparent 1px, transparent 64px)
          `,
        }} />

        {/* ── Ambient glow — gold left ── */}
        <div className="_csFloat _csGlow" style={{
          position: 'absolute', top: '-25%', left: '-18%',
          width: '72vw', height: '72vw',
          background: 'radial-gradient(circle, rgba(210,160,60,.14) 0%, transparent 65%)',
          zIndex: 0, pointerEvents: 'none',
        }} />

        {/* ── Ambient glow — indigo right ── */}
        <div style={{
          position: 'absolute', bottom: '-20%', right: '-12%',
          width: '55vw', height: '55vw',
          background: 'radial-gradient(circle, rgba(99,102,241,.1) 0%, transparent 65%)',
          zIndex: 0, pointerEvents: 'none',
        }} />

        {/* ── Top scan line ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2,
          background: 'linear-gradient(90deg, transparent 0%, rgba(210,160,60,.7) 30%, rgba(210,160,60,1) 50%, rgba(210,160,60,.7) 70%, transparent 100%)',
        }} />

        {/* ── SVG grain overlay ── */}
        <div className="_csGrain" style={{
          position: 'absolute', inset: '-50%', width: '200%', height: '200%',
          zIndex: 1, opacity: .45, pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.07'/%3E%3C/svg%3E")`,
        }} />

        {/* ── Ghost year — far right ── */}
        <div style={{
          position: 'absolute', right: '-3%', top: '50%',
          transform: 'translateY(-50%)',
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(140px, 22vw, 320px)',
          fontWeight: 700, lineHeight: 1,
          color: 'transparent',
          WebkitTextStroke: '1px rgba(255,255,255,.035)',
          userSelect: 'none', zIndex: 0, letterSpacing: '-0.05em',
          whiteSpace: 'nowrap',
        }}>
          {new Date().getFullYear()}
        </div>

        {/* ── Vertical label — far left edge ── */}
        <div style={{
          position: 'absolute', left: 24, top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'center center',
          color: 'rgba(255,255,255,.12)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.25em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          zIndex: 2,
        }}>
          Atlas ERP · Sitio web
        </div>

        {/* ── Main content ── */}
        <div style={{
          position: 'relative', zIndex: 3,
          padding: 'clamp(40px, 8vw, 100px)',
          paddingLeft: 'clamp(64px, 10vw, 140px)',
          maxWidth: 900, width: '100%',
        }}>

          {/* Badge */}
          <div className="_cs1" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(210,160,60,.1)',
            border: '1px solid rgba(210,160,60,.28)',
            borderRadius: 100, padding: '5px 14px 5px 10px',
            marginBottom: 36,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#d2a03c',
              boxShadow: '0 0 10px #d2a03c, 0 0 20px rgba(210,160,60,.4)',
            }} />
            <span style={{ color: '#d2a03c', fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Proximamente
            </span>
          </div>

          {/* Company name */}
          <h1 className="_cs2" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(42px, 8.5vw, 104px)',
            fontWeight: 700, color: '#ede8df',
            lineHeight: 1.0, letterSpacing: '-0.025em',
            margin: 0, marginBottom: 8,
          }}>
            {siteName || 'Nuevo sitio web'}
          </h1>

          {/* Subheader */}
          <p className="_cs3" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(16px, 2.2vw, 24px)',
            fontWeight: 400, fontStyle: 'italic',
            color: 'rgba(255,255,255,.28)',
            margin: 0, marginBottom: 40,
          }}>
            en construccion
          </p>

          {/* Gold divider line */}
          <div className="_csLine" style={{
            width: 'min(520px, 80vw)', height: 1, marginBottom: 40,
            background: 'linear-gradient(90deg, rgba(210,160,60,.9) 0%, rgba(210,160,60,.15) 100%)',
          }} />

          {/* Description */}
          <p className="_cs4" style={{
            color: 'rgba(255,255,255,.38)',
            fontSize: 'clamp(13px, 1.4vw, 16px)',
            lineHeight: 1.8, maxWidth: 460,
            margin: 0, marginBottom: 52,
          }}>
            Estamos construyendo algo especial para ti.<br />
            Vuelve pronto para descubrir el resultado.
          </p>

          {/* Admin link */}
          <a className="_cs5" href="/app" style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            color: 'rgba(255,255,255,.25)',
            fontSize: 11, fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            textDecoration: 'none',
            transition: 'color 200ms, gap 200ms',
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,.55)'
            e.currentTarget.style.gap = '14px'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255,255,255,.25)'
            e.currentTarget.style.gap = '10px'
          }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 13, height: 13 }}>
              <path d="M10 12l-4-4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Panel de administracion
          </a>
        </div>

        {/* ── Decorative corner lines — bottom right ── */}
        <div style={{
          position: 'absolute', bottom: 44, right: 56,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5,
          zIndex: 2, opacity: .18,
        }}>
          {[108, 72, 36].map((w, i) => (
            <div key={i} style={{ width: w, height: 1, background: '#d2a03c', borderRadius: 1 }} />
          ))}
        </div>

        {/* ── Decorative dot grid — top right ── */}
        <div style={{
          position: 'absolute', top: 48, right: 56,
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10,
          zIndex: 2, opacity: .12,
        }}>
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#d2a03c' }} />
          ))}
        </div>
      </div>
    </>
  )
}

// ── Draft page preview for editors in view mode ──────────────────────────────

const DRAFT_CSS = `
  @keyframes _dr_fadeUp {
    from { opacity: 0; transform: translateY(22px) }
    to   { opacity: 1; transform: translateY(0) }
  }
  @keyframes _dr_pulse {
    0%, 100% { opacity: 0.35; transform: scale(1) }
    50%       { opacity: 1;    transform: scale(1.15) }
  }
  @keyframes _dr_float {
    0%, 100% { transform: translateY(0px) rotate(0deg) }
    33%       { transform: translateY(-10px) rotate(0.5deg) }
    66%       { transform: translateY(-5px) rotate(-0.5deg) }
  }
  @keyframes _dr_scanline {
    0%   { transform: translateY(-100%) }
    100% { transform: translateY(100vh) }
  }
  @keyframes _dr_drawDash {
    from { stroke-dashoffset: 800 }
    to   { stroke-dashoffset: 0 }
  }
  @keyframes _dr_glow {
    0%,100% { opacity: 0.06 }
    50%      { opacity: 0.14 }
  }
  ._dr1 { animation: _dr_fadeUp .75s cubic-bezier(.16,1,.3,1) .05s both }
  ._dr2 { animation: _dr_fadeUp .75s cubic-bezier(.16,1,.3,1) .18s both }
  ._dr3 { animation: _dr_fadeUp .75s cubic-bezier(.16,1,.3,1) .32s both }
  ._dr4 { animation: _dr_fadeUp .75s cubic-bezier(.16,1,.3,1) .46s both }
  ._dr5 { animation: _dr_fadeUp .75s cubic-bezier(.16,1,.3,1) .60s both }
  ._drPulse { animation: _dr_pulse 2.2s ease-in-out infinite }
  ._drFloat { animation: _dr_float 6s ease-in-out infinite }
  ._drGlow  { animation: _dr_glow  4s ease-in-out infinite }
  ._drDraw  {
    stroke-dasharray: 800;
    animation: _dr_drawDash 2.4s cubic-bezier(.16,1,.3,1) .3s both
  }
`

function DraftViewScreen({ onOpenEditor, topOffset = 0 }) {
  return (
    <>
      <style>{DRAFT_CSS}</style>
      <div style={{
        height: `calc(100dvh - ${topOffset}px)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#07090f',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>

        {/* Blueprint grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: `
            linear-gradient(rgba(255,255,255,.022) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.022) 1px, transparent 1px)
          `,
          backgroundSize: '52px 52px',
        }} />

        {/* Ambient indigo glow */}
        <div className="_drGlow" style={{
          position: 'absolute', top: '-20%', left: '20%',
          width: '65vw', height: '65vw',
          background: 'radial-gradient(circle, rgba(99,102,241,.12) 0%, transparent 65%)',
          zIndex: 0, pointerEvents: 'none',
        }} />

        {/* Top scan line accent */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2, zIndex: 2,
          background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,.6) 30%, rgba(99,102,241,1) 50%, rgba(99,102,241,.6) 70%, transparent 100%)',
        }} />

        {/* Floating page wireframe — right side */}
        <div className="_drFloat" style={{
          position: 'absolute', right: '6%', top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1, opacity: 0.22,
          filter: 'blur(0.3px)',
        }}>
          <svg width="220" height="270" viewBox="0 0 220 270" fill="none">
            <rect className="_drDraw" x="12" y="12" width="196" height="246" rx="10"
              stroke="rgba(99,102,241,.9)" strokeWidth="1.5" />
            <rect x="30" y="38" width="110" height="12" rx="3" fill="rgba(99,102,241,.35)" />
            <rect x="30" y="62" width="160" height="6" rx="2" fill="rgba(255,255,255,.14)" />
            <rect x="30" y="75" width="130" height="6" rx="2" fill="rgba(255,255,255,.1)" />
            <rect x="30" y="88" width="148" height="6" rx="2" fill="rgba(255,255,255,.07)" />
            <rect x="30" y="110" width="160" height="78" rx="6"
              fill="rgba(255,255,255,.04)" stroke="rgba(255,255,255,.09)" strokeWidth="1" />
            <line x1="30" y1="110" x2="190" y2="188" stroke="rgba(255,255,255,.06)" strokeWidth="1" />
            <line x1="190" y1="110" x2="30" y2="188" stroke="rgba(255,255,255,.06)" strokeWidth="1" />
            <rect x="30" y="204" width="80" height="6" rx="2" fill="rgba(255,255,255,.09)" />
            <rect x="30" y="218" width="50" height="6" rx="2" fill="rgba(255,255,255,.06)" />
          </svg>
        </div>

        {/* Vertical label */}
        <div style={{
          position: 'absolute', left: 20, top: '50%',
          transform: 'translateY(-50%) rotate(-90deg)',
          transformOrigin: 'center center',
          color: 'rgba(255,255,255,.1)',
          fontSize: 10, fontWeight: 700, letterSpacing: '0.22em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
          zIndex: 2,
        }}>
          Atlas ERP · Editor
        </div>

        {/* Corner dots decoration */}
        <div style={{
          position: 'absolute', bottom: 40, right: 48,
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 9,
          zIndex: 2, opacity: .1,
        }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#6366f1' }} />
          ))}
        </div>

        {/* Main content */}
        <div style={{
          position: 'relative', zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          textAlign: 'center',
          padding: 'clamp(48px, 8vw, 80px) 40px',
          maxWidth: 460,
        }}>

          {/* Animated pencil icon */}
          <div className="_dr1 _drFloat" style={{
            marginBottom: 28,
            width: 68, height: 68,
            borderRadius: 22,
            background: 'rgba(99,102,241,.1)',
            border: '1px solid rgba(99,102,241,.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 32px rgba(99,102,241,.12)',
          }}>
            <svg viewBox="0 0 24 24" fill="none" style={{ width: 30, height: 30 }}>
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke="rgba(99,102,241,.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke="rgba(99,102,241,.85)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          {/* Borrador badge */}
          <div className="_dr2" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(234,179,8,.07)',
            border: '1px solid rgba(234,179,8,.22)',
            borderRadius: 100, padding: '5px 14px 5px 10px',
            marginBottom: 22,
          }}>
            <div className="_drPulse" style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#eab308',
              boxShadow: '0 0 8px #eab308, 0 0 16px rgba(234,179,8,.4)',
            }} />
            <span style={{
              color: '#eab308', fontSize: 10.5, fontWeight: 700,
              letterSpacing: '0.16em', textTransform: 'uppercase',
            }}>
              Borrador
            </span>
          </div>

          {/* Title */}
          <h2 className="_dr3" style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(24px, 3.8vw, 36px)',
            fontWeight: 700,
            color: '#ede8df',
            lineHeight: 1.18,
            letterSpacing: '-0.022em',
            margin: '0 0 14px',
          }}>
            Esta pagina esta en construccion
          </h2>

          {/* Divider */}
          <div className="_dr3" style={{
            width: 48, height: 1,
            background: 'linear-gradient(90deg, transparent, rgba(99,102,241,.5), transparent)',
            marginBottom: 18,
          }} />

          {/* Description */}
          <p className="_dr4" style={{
            color: 'rgba(255,255,255,.32)',
            fontSize: 13.5,
            lineHeight: 1.78,
            margin: '0 0 36px',
            maxWidth: 320,
          }}>
            Aun no es visible para el publico. Abre el editor para agregar contenido y publicarla cuando este lista.
          </p>

          {/* CTA */}
          <button
            className="_dr5"
            onClick={onOpenEditor}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 9,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff', border: 'none',
              borderRadius: 12, padding: '12px 26px',
              fontSize: 13.5, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(99,102,241,.38), 0 1px 4px rgba(0,0,0,.35)',
              transition: 'transform 160ms ease, box-shadow 160ms ease',
              letterSpacing: '0.01em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,.5), 0 1px 4px rgba(0,0,0,.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,.38), 0 1px 4px rgba(0,0,0,.35)'
            }}
          >
            <svg viewBox="0 0 16 16" fill="none" style={{ width: 15, height: 15 }}>
              <path d="M11.5 2h-7A1.5 1.5 0 0 0 3 3.5v9A1.5 1.5 0 0 0 4.5 14h7A1.5 1.5 0 0 0 13 12.5v-9A1.5 1.5 0 0 0 11.5 2z"
                stroke="currentColor" strokeWidth="1.4"/>
              <path d="M5.5 5.5h5M5.5 8h5M5.5 10.5h3"
                stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            Abrir editor
          </button>
        </div>
      </div>
    </>
  )
}

// ── Empty state for editors when no page is published on this route ───────────

function EditorEmptyRoute({ routePath, onCreatePage, isCreating }) {
  const isRoot = routePath === '/'
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50 mx-auto">
          <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7 text-indigo-400">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-mono text-indigo-400 bg-indigo-50 px-3 py-1 rounded-full inline-block">
            {routePath}
          </p>
          <h2 className="text-xl font-bold text-gray-900 mt-2">
            {isRoot ? 'Sin pagina de inicio publicada' : 'Esta ruta no tiene contenido'}
          </h2>
          <p className="text-gray-500 text-sm">
            {isRoot
              ? 'Crea y publica la pagina principal para que los visitantes la vean.'
              : 'No existe una pagina publicada en esta ruta.'}
          </p>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onCreatePage}
            disabled={isCreating}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white transition-all hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            {isCreating ? 'Creando...' : `Crear pagina "${isRoot ? 'Inicio' : routePath}"`}
          </button>
          <a
            href="/app/m/atlas.website/pages"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors underline"
          >
            Ver todas las paginas
          </a>
        </div>
      </div>
    </div>
  )
}

// ── Main entry ─────────────────────────────────────────────────────────────────

export function PublicWebsiteEntry() {
  const location      = useLocation()
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { session }   = useAuth()
  const token         = session?.access_token
  const [searchParams, setSearchParams] = useSearchParams()

  // If URL has ?edit=1, start in edit mode and remove the param from URL
  const startInEdit = searchParams.get('edit') === '1'
  const [editMode,  setEditMode]  = useState(startInEdit)
  const [barPinned, setBarPinned] = useState(() => localStorage.getItem('atlas-editor-bar-pinned') === 'true')

  useEffect(() => {
    if (startInEdit) {
      // Remove ?edit=1 from URL without navigation
      const next = new URLSearchParams(searchParams)
      next.delete('edit')
      setSearchParams(next, { replace: true })
      setEditMode(true)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Allow public website to scroll and expand beyond app-shell constraints
  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow             = 'auto'
    const root = document.getElementById('root')
    if (root) root.style.height = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow             = ''
      if (root) root.style.height = ''
    }
  }, [])

  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn:  () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })

  const editorCheckQuery = useQuery({
    queryKey: ['editor-check', token],
    queryFn:  () => fetchEditorCheck(token),
    enabled:  Boolean(token),
    staleTime: 60_000,
    retry: 0,
  })

  const resolveData = resolveQuery.data
  const site        = editorCheckQuery.data?.data ?? null
  const isEditor    = Boolean(token) && Boolean(site)
  const siteId      = site?.id ?? null

  // All pages list (for the bar combobox)
  const pagesQuery = useQuery({
    queryKey: ['website-pages-bar', siteId],
    queryFn:  () => apiFetch(`/website/pages?siteId=${siteId}&pageSize=50`, token),
    enabled:  isEditor && Boolean(siteId),
    staleTime: 60_000,
  })

  // Editor-only: fetch current route page regardless of publish status (includes drafts)
  const editorPageQuery = useQuery({
    queryKey: ['website-page-by-path', siteId, location.pathname],
    queryFn:  () => apiFetch(
      `/website/pages/by-path?siteId=${siteId}&routePath=${encodeURIComponent(location.pathname)}`,
      token,
    ),
    enabled:  isEditor && Boolean(siteId),
    staleTime: 30_000,
  })

  // activePage: the page at this route (published for visitors, any status for editors)
  const publishedPage = resolveData?.page ?? null
  const editorPage    = editorPageQuery.data?.data ?? null
  const activePage    = publishedPage ?? (isEditor ? editorPage : null)

  const publishMutation = useMutation({
    mutationFn: () => apiFetch(`/website/pages/${activePage?.id}/publish`, token, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-website-resolve', location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      queryClient.invalidateQueries({ queryKey: ['website-page-by-path', siteId, location.pathname] })
      toast.success('Pagina publicada')
    },
    onError: (err) => toast.error(err.message),
  })

  const unpublishMutation = useMutation({
    mutationFn: () => apiFetch(`/website/pages/${activePage?.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'draft' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-website-resolve', location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      queryClient.invalidateQueries({ queryKey: ['website-page-by-path', siteId, location.pathname] })
      toast.success('Pagina marcada como borrador')
    },
    onError: (err) => toast.error(err.message),
  })

  const createPageMutation = useMutation({
    mutationFn: async ({ title, routePath }) => {
      const slug = titleToSlug(title)
      return apiFetch('/website/pages', token, {
        method: 'POST',
        body: JSON.stringify({ siteId, title, slug, routePath, pageType: 'page', visibility: 'public' }),
      })
    },
    onSuccess: (data) => {
      const created = data?.data ?? data
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      queryClient.invalidateQueries({ queryKey: ['website-page-by-path', siteId, location.pathname] })
      toast.success('Pagina creada. Puedes editarla y publicarla desde el editor.')
      if (created?.routePath) navigate(`${created.routePath}?edit=1`)
    },
    onError: (err) => toast.error(err.message),
  })

  async function handleCreatePageFromBar(title) {
    const slug      = titleToSlug(title)
    const routePath = `/${slug}`
    try {
      await apiFetch('/website/pages', token, {
        method: 'POST',
        body: JSON.stringify({ siteId, title, slug, routePath, pageType: 'page', visibility: 'public' }),
      })
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      navigate(routePath + '?edit=1')
      toast.success(`Pagina "${title}" creada`)
    } catch (err) {
      toast.error(err.message)
    }
  }

  useEffect(() => {
    if (resolveData?.site) {
      storePublicSiteHint({
        siteName: resolveData.site.name ?? null,
        primaryColor: resolveData.theme?.tokens?.primary ?? null,
        backgroundColor: resolveData.theme?.tokens?.background ?? null,
      })
    }
  }, [resolveData])

  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  if (resolveQuery.isPending) return <PublicPageLoader />
  if (resolveQuery.isError)   return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null

  const sourceType = resolveData?.site?.sourceType ?? 'builder'

  // source_type = 'none': no public site — redirect to the admin panel
  if (sourceType === 'none') {
    window.location.replace('/app')
    return <PublicPageLoader />
  }

  // source_type = 'dist': in dev, redirect to the API which serves the dist files
  if (sourceType === 'dist') {
    const apiUrl = getApiUrl()
    const target = `${apiUrl}/public/site${location.pathname}${window.location.search}`
    window.location.replace(target)
    return <PublicPageLoader />
  }

  // ── Shared values ─────────────────────────────────────────────────────────
  const pages        = pagesQuery.data?.data ?? []
  const topOffset    = isEditor && barPinned ? BAR_H_PX : 0
  const isPublishing = publishMutation.isPending || unpublishMutation.isPending

  // ── No page on this route at all ──────────────────────────────────────────
  if (!activePage) {
    if (isEditor) {
      // Still loading the editor page query
      if (editorPageQuery.isPending && siteId) return <PublicPageLoader />

      // No page exists on this route → empty state with create CTA
      const bar = (
        <EditorContextBar
          site={site}
          page={null}
          pages={pages}
          editMode={false}
          onToggleEdit={() => {}}
          onNavigate={(rp) => navigate(rp)}
          onPublishPage={() => {}}
          onUnpublishPage={() => {}}
          onCreatePage={handleCreatePageFromBar}
          onPinChange={setBarPinned}
          isPublishing={false}
        />
      )
      return (
        <>
          {bar}
          <div style={{ paddingTop: topOffset }}>
            <EditorEmptyRoute
              routePath={location.pathname}
              onCreatePage={() => {
                const rp = location.pathname
                const title = rp === '/' ? 'Inicio' : rp.replace(/^\//, '').replace(/-/g, ' ')
                createPageMutation.mutate({ title, routePath: rp })
              }}
              isCreating={createPageMutation.isPending}
            />
          </div>
        </>
      )
    }

    // Anonymous visitor: coming soon
    if (!resolveData?.site) return <ComingSoonScreen siteName={null} />
    return <ComingSoonScreen siteName={resolveData.site?.name} />
  }

  // ── Page exists (published or draft for editors) ───────────────────────────
  const bar = isEditor ? (
    <EditorContextBar
      site={site}
      page={activePage}
      pages={pages}
      editMode={editMode}
      onToggleEdit={() => setEditMode((v) => !v)}
      onNavigate={(rp) => navigate(rp)}
      onPublishPage={() => publishMutation.mutate()}
      onUnpublishPage={() => unpublishMutation.mutate()}
      onCreatePage={handleCreatePageFromBar}
      onPinChange={setBarPinned}
      isPublishing={isPublishing}
    />
  ) : null

  // Edit mode
  if (editMode && activePage?.id) {
    return (
      <>
        {bar}
        <WebsitePageEditorScreen pageId={activePage.id} topOffset={topOffset} />
      </>
    )
  }

  // View mode — only show renderer if page is published (drafts show an editor-only preview msg)
  return (
    <>
      {bar}
      <div style={{ paddingTop: topOffset }}>
        {publishedPage ? (
          <WebsitePageRenderer page={publishedPage} theme={resolveData.theme} />
        ) : (
          <DraftViewScreen onOpenEditor={() => setEditMode(true)} topOffset={topOffset} />
        )}
      </div>
    </>
  )
}
