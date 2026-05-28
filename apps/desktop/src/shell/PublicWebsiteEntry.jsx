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

  const { data, isPending, isError } = useQuery({
    queryKey: ['public-website-resolve', location.pathname],
    queryFn: () => fetchWebsiteResolve(location.pathname),
    staleTime: 60_000,
    retry: 1,
  })

  useEffect(() => {
    if (data && data.initialized === false) {
      navigate('/setup', { replace: true })
    }
  }, [data, navigate])

  if (isPending) return <AppLoader message="Cargando..." />
  if (isError) return <PublicWebsite404 />
  if (data?.initialized === false) return null
  if (!data?.page) return <PublicWebsite404 />

  return (
    <WebsitePageRenderer
      page={data.page}
      theme={data.theme}
      menus={data.menus}
    />
  )
}
