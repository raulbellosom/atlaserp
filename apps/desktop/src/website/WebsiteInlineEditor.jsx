import { useQuery } from '@tanstack/react-query'
import { WebsiteGrapesEditor } from './WebsiteGrapesEditor.jsx'
import { getApiUrl } from '../lib/runtimeConfig.js'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export function WebsiteInlineEditor({ pageId, token, onDataChange }) {
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const pageQuery = useQuery({
    queryKey: ['inline-editor-page', pageId, token],
    queryFn: () => apiFetch(`/website/pages/${pageId}`, { headers }),
    enabled: Boolean(token) && Boolean(pageId),
    staleTime: 0,
  })

  if (!pageId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <p className="text-gray-400 text-sm">No hay una pagina para este URL todavia.</p>
      </div>
    )
  }

  if (pageQuery.isPending) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <p className="text-gray-400 text-sm">Cargando editor...</p>
      </div>
    )
  }

  return (
    <WebsiteGrapesEditor
      initialData={pageQuery.data?.draftBuilderData ?? null}
      onDataChange={onDataChange}
    />
  )
}
