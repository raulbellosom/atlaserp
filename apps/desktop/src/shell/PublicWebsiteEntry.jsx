import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { AppLoader } from '../components/AppLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
import { EditorContextBar } from '../website/EditorContextBar.jsx'
import WebsitePageEditorScreen from '../modules/atlas.website/screens/WebsitePageEditorScreen.jsx'
import { toast } from 'sonner'

const STORAGE_KEY = 'atlas-editor-bar-pinned'
const BAR_H = 46

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

export function PublicWebsiteEntry() {
  const location    = useLocation()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
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

  // Public resolve — no auth
  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn:  () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })

  // Editor permission check — runs only when authenticated
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

  // Pages list for the bar selector
  const pagesQuery = useQuery({
    queryKey: ['website-pages-bar', siteId],
    queryFn:  () => apiFetch(`/website/pages?siteId=${siteId}&pageSize=50`, token),
    enabled:  isEditor && Boolean(siteId),
    staleTime: 60_000,
  })

  // Publish current page (uses existing draftBuilderData)
  const publishMutation = useMutation({
    mutationFn: () => apiFetch(`/website/pages/${resolveData?.page?.id}/publish`, token, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-website-resolve', location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      toast.success('Pagina publicada')
    },
    onError: (err) => toast.error(err.message),
  })

  // Set page back to draft
  const unpublishMutation = useMutation({
    mutationFn: () => apiFetch(`/website/pages/${resolveData?.page?.id}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'draft' }),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-website-resolve', location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['website-pages-bar', siteId] })
      toast.success('Pagina marcada como borrador')
    },
    onError: (err) => toast.error(err.message),
  })

  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
  if (resolveQuery.isError)   return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null
  if (!resolveData?.page) return <PublicWebsite404 />

  const pages         = pagesQuery.data?.data ?? []
  const isPublishing  = publishMutation.isPending || unpublishMutation.isPending
  const topPad        = isEditor && barPinned ? BAR_H : 0

  const editorBar = isEditor ? (
    <EditorContextBar
      site={site}
      page={resolveData.page}
      pages={pages}
      editMode={editMode}
      onPinChange={setBarPinned}
      onToggleEdit={() => setEditMode((v) => !v)}
      onNavigate={(routePath) => navigate(routePath)}
      onPublishPage={() => publishMutation.mutate()}
      onUnpublishPage={() => unpublishMutation.mutate()}
      isPublishing={isPublishing}
    />
  ) : null

  // ── Edit mode — editor renders full-screen, bar stays on top ──────────────
  if (editMode && resolveData.page?.id) {
    return (
      <>
        {editorBar}
        <div style={{ paddingTop: topPad }}>
          <WebsitePageEditorScreen pageId={resolveData.page.id} />
        </div>
      </>
    )
  }

  // ── View mode ─────────────────────────────────────────────────────────────
  return (
    <>
      {editorBar}
      <div style={{ paddingTop: topPad }}>
        <WebsitePageRenderer
          page={resolveData.page}
          theme={resolveData.theme}
        />
      </div>
    </>
  )
}
