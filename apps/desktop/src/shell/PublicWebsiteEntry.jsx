import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../auth/AuthProvider.jsx'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { AppLoader } from '../components/AppLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'
import { EditorContextBar } from '../website/EditorContextBar.jsx'

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

  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn:  () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })

  // Only runs when authenticated — checks if the user has editor access (website.site.read)
  const editorCheckQuery = useQuery({
    queryKey: ['editor-check', token],
    queryFn:  () => fetchEditorCheck(token),
    enabled:  Boolean(token),
    staleTime: 60_000,
    retry: 0,
  })

  const resolveData = resolveQuery.data
  const isEditor = Boolean(token) && Boolean(editorCheckQuery.data?.data)

  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
  if (resolveQuery.isError) return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null
  if (!resolveData?.page) return <PublicWebsite404 />

  return (
    <>
      {isEditor && (
        <EditorContextBar
          site={editorCheckQuery.data?.data}
          page={resolveData.page}
          onPinChange={setBarPinned}
        />
      )}
      <div style={{ paddingTop: isEditor && barPinned ? 40 : 0 }}>
        <WebsitePageRenderer
          page={resolveData.page}
          theme={resolveData.theme}
        />
      </div>
    </>
  )
}
