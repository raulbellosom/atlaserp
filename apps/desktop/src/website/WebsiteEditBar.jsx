import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  ChevronDown, Plus, Eye, Edit2, Check, ArrowLeft, Loader2,
} from 'lucide-react'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { toast } from 'sonner'
import WebsiteNewPageDialog from '../modules/atlas.website/screens/WebsiteNewPageDialog.jsx'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const STATUS_LABELS = { draft: 'Borrador', published: 'Publicado', archived: 'Archivado' }
const STATUS_DOT = {
  draft:     'bg-yellow-400',
  published: 'bg-green-400',
  archived:  'bg-gray-400',
}

export function WebsiteEditBar({
  site,
  currentPage,
  isEditing,
  onToggleEdit,
  onSave,
  onPublish,
  token,
  isSaving,
  isPublishing,
  visible = true,
}) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [pagesOpen, setPagesOpen] = useState(false)
  const [newPageOpen, setNewPageOpen] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setPagesOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const pagesQuery = useQuery({
    queryKey: ['edit-bar-pages', site?.id, token],
    queryFn: () => apiGet(`/website/pages?siteId=${site.id}`, token),
    enabled: Boolean(token) && Boolean(site?.id) && pagesOpen,
    staleTime: 30_000,
  })
  const pages = pagesQuery.data?.data ?? []

  function navigateToPage(page) {
    navigate(page.routePath || '/')
    setPagesOpen(false)
  }

  const pageStatus = currentPage?.status ?? null

  return (
    <>
      {/* CSS for animations */}
      <style>{`
        @keyframes atlas-pulse {
          0%, 100% { opacity: 1; transform: scaleX(1); }
          50%       { opacity: 0.5; transform: scaleX(0.85); }
        }
        .atlas-trigger-indicator { animation: atlas-pulse 2s ease-in-out infinite; }
      `}</style>

      {/* Pulsing red trigger indicator — visible when bar is hidden */}
      {!visible && (
        <div
          className="atlas-trigger-indicator"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            height: '3px',
            width: '140px',
            background: 'linear-gradient(90deg, #ef4444 0%, rgba(239,68,68,0.5) 70%, transparent 100%)',
            zIndex: 9998,
            borderRadius: '0 0 4px 0',
            pointerEvents: 'none',
            transformOrigin: 'left center',
          }}
        />
      )}

      {/* Main edit bar — slides in/out */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          height: 48,
          backgroundColor: '#312e81',
          transform: visible ? 'translateY(0)' : 'translateY(-100%)',
          transition: 'transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          paddingLeft: 12,
          paddingRight: 12,
        }}
      >
        {/* Back to ERP */}
        <a
          href="/app"
          className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-medium mr-2 transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Atlas ERP</span>
        </a>

        <div className="w-px h-5 bg-white/20 mx-1" />

        {/* Page selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setPagesOpen(!pagesOpen)}
            className="flex items-center gap-1.5 text-white text-sm font-medium px-2 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            {currentPage ? (
              <>
                {pageStatus && (
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[pageStatus] ?? 'bg-gray-400'}`} />
                )}
                <span className="max-w-50 truncate">{currentPage.title}</span>
              </>
            ) : (
              <span className="text-white/50">Sin pagina</span>
            )}
            <ChevronDown size={12} className="text-white/60 shrink-0" />
          </button>

          {pagesOpen && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden">
              {pagesQuery.isPending ? (
                <div className="px-4 py-3 text-xs text-gray-400">Cargando paginas...</div>
              ) : pages.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-400">No hay paginas creadas.</div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {pages.map((page) => (
                    <button
                      key={page.id}
                      onClick={() => navigateToPage(page)}
                      className={`w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                        page.id === currentPage?.id ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[page.status] ?? 'bg-gray-300'}`} />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{page.title}</p>
                        <p className="text-xs text-gray-400 font-mono truncate">{page.routePath}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              <div className="border-t border-gray-100">
                <button
                  onClick={() => { setPagesOpen(false); setNewPageOpen(true) }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-indigo-600 hover:bg-indigo-50 transition-colors font-medium"
                >
                  <Plus size={14} />
                  Nueva pagina
                </button>
              </div>
            </div>
          )}
        </div>

        {/* + New page shortcut */}
        <button
          onClick={() => setNewPageOpen(true)}
          className="flex items-center gap-1 text-white/60 hover:text-white text-xs px-1.5 py-1 rounded hover:bg-white/10 transition-colors"
          title="Nueva pagina"
        >
          <Plus size={14} />
        </button>

        <div className="flex-1" />

        {/* Status badge */}
        {pageStatus && !isEditing && (
          <span className="flex items-center gap-1 text-xs text-white/60 mr-2">
            <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[pageStatus]}`} />
            {STATUS_LABELS[pageStatus] ?? pageStatus}
          </span>
        )}

        {/* Edit / Preview toggle + action buttons */}
        {isEditing ? (
          <div className="flex items-center gap-2">
            <button
              onClick={onToggleEdit}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs px-2.5 py-1.5 rounded hover:bg-white/10 transition-colors"
            >
              <Eye size={13} />
              Vista previa
            </button>

            <button
              onClick={onSave}
              disabled={isSaving}
              className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded bg-white/15 hover:bg-white/25 transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={13} className="animate-spin" /> : null}
              Guardar borrador
            </button>

            <button
              onClick={onPublish}
              disabled={isPublishing}
              className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-50"
              style={{ backgroundColor: '#4f46e5' }}
            >
              {isPublishing ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <Check size={13} />
              )}
              Publicar
            </button>
          </div>
        ) : (
          <button
            onClick={onToggleEdit}
            disabled={!currentPage}
            className="flex items-center gap-1.5 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#4f46e5' }}
            title={!currentPage ? 'No hay pagina para este URL. Crea una desde + Pagina.' : undefined}
          >
            <Edit2 size={13} />
            Editar
          </button>
        )}
      </div>

      {site && (
        <WebsiteNewPageDialog
          siteId={site.id}
          open={newPageOpen}
          onOpenChange={setNewPageOpen}
          onCreated={(page) => {
            queryClient.invalidateQueries({ queryKey: ['edit-bar-pages', site.id] })
            navigate(page.routePath || '/')
          }}
        />
      )}
    </>
  )
}
