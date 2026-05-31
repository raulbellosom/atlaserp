import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { AppLoader } from '../components/AppLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
import { EditorContextBar } from '../website/EditorContextBar.jsx'
import WebsitePageEditorScreen from '../modules/atlas.website/screens/WebsitePageEditorScreen.jsx'

const STORAGE_KEY = 'atlas-editor-bar-pinned'

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

export function PublicWebsiteEntry() {
  const location = useLocation()
  const navigate = useNavigate()
  const { session } = useAuth()
  const token = session?.access_token

  const [barPinned, setBarPinned] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true')
  const [editMode, setEditMode]   = useState(false)

  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // Restore scroll when exiting edit mode
  useEffect(() => {
    if (!editMode) {
      document.documentElement.style.overflow = 'auto'
      document.body.style.overflow = 'auto'
    }
  }, [editMode])

  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn:  () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })

  // Only runs when authenticated — verifies the user has website.site.read (editor access)
  const editorCheckQuery = useQuery({
    queryKey: ['editor-check', token],
    queryFn:  () => fetchEditorCheck(token),
    enabled:  Boolean(token),
    staleTime: 60_000,
    retry: 0,
  })

  const resolveData = resolveQuery.data
  const isEditor    = Boolean(token) && Boolean(editorCheckQuery.data?.data)

  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
  if (resolveQuery.isError)   return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null
  if (!resolveData?.page) return <PublicWebsite404 />

  // ── Inline edit mode ────────────────────────────────────────────────────────
  if (editMode && resolveData.page?.id) {
    return (
      <>
        <WebsitePageEditorScreen pageId={resolveData.page.id} />
        {/* Floating close button — sits above the editor's own UI */}
        <button
          onClick={() => setEditMode(false)}
          style={{
            position: 'fixed',
            top: 12,
            left: 12,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: '#e5e7eb',
            background: 'rgba(22,18,58,0.92)',
            border: '1px solid rgba(99,102,241,0.4)',
            borderRadius: 7,
            padding: '6px 14px',
            cursor: 'pointer',
            backdropFilter: 'blur(8px)',
            boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
            transition: 'opacity 150ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.8' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          ← Volver al sitio
        </button>
      </>
    )
  }

  // ── Normal public view ───────────────────────────────────────────────────────
  return (
    <>
      {isEditor && (
        <EditorContextBar
          site={editorCheckQuery.data?.data}
          page={resolveData.page}
          onPinChange={setBarPinned}
          onEditPage={() => setEditMode(true)}
        />
      )}
      <div style={{ paddingTop: isEditor && barPinned ? 44 : 0 }}>
        <WebsitePageRenderer
          page={resolveData.page}
          theme={resolveData.theme}
        />
      </div>
    </>
  )
}
