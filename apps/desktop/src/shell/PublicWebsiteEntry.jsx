import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { AppLoader } from '../components/AppLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
import { WebsiteEditBar } from '../website/WebsiteEditBar.jsx'
import { WebsiteInlineEditor } from '../website/WebsiteInlineEditor.jsx'
import { useAuth } from '../auth/AuthProvider.jsx'
import { toast } from 'sonner'

async function fetchWebsiteResolve(pathname) {
  const url = `${getApiUrl()}/public/website/resolve?path=${encodeURIComponent(pathname)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function PublicWebsiteEntry() {
  const location  = useLocation()
  const navigate  = useNavigate()
  const { session } = useAuth()
  const queryClient = useQueryClient()

  const token     = session?.access_token ?? null
  const isLoggedIn = Boolean(token)

  const [isEditing, setIsEditing]   = useState(false)
  const [isSaving, setIsSaving]     = useState(false)
  const [isPublishing, setPublishing] = useState(false)
  const [barVisible, setBarVisible] = useState(false)
  const grapesDataRef = useRef(null)
  const hideBarTimer = useRef(null)

  // Reset edit mode on navigation
  useEffect(() => { setIsEditing(false) }, [location.pathname])

  // Reveal the edit bar when the cursor approaches the top of the page.
  // Hide it after the cursor moves away (with a delay) unless actively editing.
  useEffect(() => {
    if (!isLoggedIn) return
    function handleMouseMove(e) {
      if (e.clientY < 72 && e.clientX < 100) {
        // Top-left corner trigger zone — reveal bar
        clearTimeout(hideBarTimer.current)
        setBarVisible(true)
      } else if (e.clientY < 48) {
        // Cursor is on the bar itself — keep it open
        clearTimeout(hideBarTimer.current)
      } else if (e.clientY > 80) {
        // Cursor moved into content area — schedule hide
        clearTimeout(hideBarTimer.current)
        hideBarTimer.current = setTimeout(() => setBarVisible(false), 400)
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      clearTimeout(hideBarTimer.current)
    }
  }, [isLoggedIn])

  // --- Public resolve (no auth needed) ---
  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn: () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })
  const resolveData = resolveQuery.data

  // --- Auth'd site query (only when logged in, to get siteId for page lookup) ---
  const siteQuery = useQuery({
    queryKey: ['website-site-inline', token],
    queryFn: () => apiFetch('/website/site', token),
    enabled: isLoggedIn && Boolean(resolveData?.initialized),
    staleTime: 120_000,
  })
  const site = resolveData?.site ?? siteQuery.data?.data ?? null

  // --- Find editable page for current URL (includes drafts, auth'd) ---
  const editablePageQuery = useQuery({
    queryKey: ['website-page-by-path', site?.id, location.pathname, token],
    queryFn: () =>
      apiFetch(`/website/pages/by-path?siteId=${site.id}&routePath=${encodeURIComponent(location.pathname)}`, token),
    enabled: isLoggedIn && Boolean(site?.id),
    staleTime: 30_000,
  })
  const editablePage = editablePageQuery.data?.data ?? null

  // The page shown in the edit bar: prefer editable (draft+published), fall back to resolve data
  const activePage = editablePage ?? resolveData?.page ?? null

  // --- Redirect to setup ---
  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  const handleDataChange = useCallback((data) => {
    grapesDataRef.current = data
  }, [])

  async function handleSave() {
    if (!activePage?.id || !grapesDataRef.current) return
    setIsSaving(true)
    try {
      await apiFetch(`/website/pages/${activePage.id}/save-draft`, token, {
        method: 'POST',
        body: JSON.stringify({ builderData: grapesDataRef.current }),
      })
      toast.success('Borrador guardado')
      queryClient.invalidateQueries({ queryKey: ['website-page-by-path', site?.id, location.pathname] })
    } catch (err) {
      toast.error(err.message || 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish() {
    if (!activePage?.id) return
    // Save first, then publish
    if (grapesDataRef.current) {
      setIsSaving(true)
      try {
        await apiFetch(`/website/pages/${activePage.id}/save-draft`, token, {
          method: 'POST',
          body: JSON.stringify({ builderData: grapesDataRef.current }),
        })
      } catch { /* ignore, best effort */ }
      setIsSaving(false)
    }
    setPublishing(true)
    try {
      await apiFetch(`/website/pages/${activePage.id}/publish`, token, { method: 'POST' })
      toast.success('Pagina publicada')
      queryClient.invalidateQueries({ queryKey: ['public-website-resolve', location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['website-page-by-path', site?.id, location.pathname] })
      queryClient.invalidateQueries({ queryKey: ['edit-bar-pages', site?.id] })
    } catch (err) {
      toast.error(err.message || 'Error al publicar')
    } finally {
      setPublishing(false)
    }
  }

  // --- Loading / error states ---
  if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
  if (resolveQuery.isError)   return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null

  // --- Not logged in: pure public view ---
  if (!isLoggedIn) {
    if (!resolveData?.page) return <PublicWebsite404 />
    return (
      <WebsitePageRenderer
        page={resolveData.page}
        theme={resolveData.theme}
        menus={resolveData.menus}
      />
    )
  }

  // --- Logged in: editor shell ---
  return (
    <>
      <WebsiteEditBar
        site={site}
        currentPage={activePage}
        isEditing={isEditing}
        onToggleEdit={() => setIsEditing((e) => !e)}
        onSave={handleSave}
        onPublish={handlePublish}
        token={token}
        isSaving={isSaving}
        isPublishing={isPublishing}
        visible={barVisible}
      />

      <div>
        {isEditing ? (
          <WebsiteInlineEditor
            pageId={activePage?.id ?? null}
            token={token}
            onDataChange={handleDataChange}
          />
        ) : resolveData?.page ? (
          <WebsitePageRenderer
            page={resolveData.page}
            theme={resolveData.theme}
            menus={resolveData.menus}
          />
        ) : (
          <div
            className="flex items-center justify-center bg-gray-50"
            style={{ minHeight: 'calc(100vh - 48px)' }}
          >
            <div className="text-center space-y-4 max-w-md px-6">
              {activePage ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mx-auto">
                    <span className="text-indigo-600 text-xl">✎</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">Pagina en borrador</h2>
                  <p className="text-gray-500 text-sm">
                    Esta pagina existe pero aun no ha sido publicada. Edita su contenido y publícala para que sea visible al publico.
                  </p>
                  <button
                    onClick={() => setIsEditing(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Editar esta pagina
                  </button>
                </>
              ) : site ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
                    <span className="text-gray-400 text-xl">📄</span>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900">No hay pagina aqui</h2>
                  <p className="text-gray-500 text-sm">
                    No existe una pagina publicada en esta URL. Crea una desde la barra superior.
                  </p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-gray-900">Sitio web no configurado</h2>
                  <p className="text-gray-500 text-sm">
                    Configura tu sitio web desde el panel de Atlas ERP.
                  </p>
                  <a
                    href="/app/m/atlas.website"
                    className="inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
                  >
                    Ir al panel
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
