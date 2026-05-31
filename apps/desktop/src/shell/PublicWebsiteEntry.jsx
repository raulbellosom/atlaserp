import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getApiUrl } from '../lib/runtimeConfig.js'
import { AppLoader } from '../components/AppLoader.jsx'
import { PublicWebsite404 } from './PublicWebsite404.jsx'
import { WebsitePageRenderer } from '../website/WebsitePageRenderer.jsx'

async function fetchWebsiteResolve(pathname) {
  const url = `${getApiUrl()}/public/website/resolve?path=${encodeURIComponent(pathname)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function PublicWebsiteEntry() {
  const location = useLocation()
  const navigate = useNavigate()

  // The global app CSS sets overflow:hidden on html/body for the ERP shell.
  // Override it here so the public website can scroll normally.
  useEffect(() => {
    document.documentElement.style.overflow = 'auto'
    document.body.style.overflow = 'auto'
    return () => {
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
    }
  }, [])

  // --- Public resolve (no auth needed) ---
  const resolveQuery = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn: () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })
  const resolveData = resolveQuery.data

  // --- Redirect to setup ---
  useEffect(() => {
    if (resolveData && resolveData.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [resolveData, navigate])

  // --- Loading / error states ---
  if (resolveQuery.isPending) return <AppLoader message="Cargando..." />
  if (resolveQuery.isError) return <PublicWebsite404 />
  if (resolveData?.initialized === false) return null

  if (!resolveData?.page) return <PublicWebsite404 />

  return (
    <WebsitePageRenderer
      page={resolveData.page}
      theme={resolveData.theme}
    />
  )
}
