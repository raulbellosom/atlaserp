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

export function WebsiteInlineEditor({ pageId, token, onDataChange, editorActionsRef }) {
  // token is passed through to WebsiteGrapesEditor for atlas.files integration
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const pageQuery = useQuery({
    queryKey: ['inline-editor-page', pageId, token],
    queryFn: () => apiFetch(`/website/pages/${pageId}`, { headers }),
    enabled: Boolean(token) && Boolean(pageId),
    staleTime: 0,
  })

  if (!pageId) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <p className="text-gray-400 text-sm">No hay una pagina para este URL todavia.</p>
      </div>
    )
  }

  if (pageQuery.isPending) {
    return (
      <div className="flex items-center justify-center" style={{ height: '100vh' }}>
        <p className="text-gray-400 text-sm">Cargando editor...</p>
      </div>
    )
  }

  // Wrap in overflow:hidden — same structure as the admin editor's parent (flex-1 overflow-hidden),
  // which is what makes GrapesJS panels render correctly.
  // Use 100vh so the editor fills the full viewport; the atlas bar floats over it.
  return (
    <div style={{ height: '100vh', overflow: 'hidden' }}>
      <WebsiteGrapesEditor
        initialData={pageQuery.data?.draftBuilderData ?? null}
        onDataChange={onDataChange}
        height="100%"
        token={token}
        actionsRef={editorActionsRef}
      />
    </div>
  )
}
