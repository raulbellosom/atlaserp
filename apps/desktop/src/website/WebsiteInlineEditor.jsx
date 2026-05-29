import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Puck } from '@measured/puck'
import '@measured/puck/puck.css'
import { atlasWebsiteConfig } from './atlasWebsiteConfig.js'
import { getApiUrl } from '../lib/runtimeConfig.js'

async function apiFetch(path, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, options)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const EMPTY_DATA = { content: [], root: {} }

export function WebsiteInlineEditor({ pageId, token, onDataChange, onSave, onPublish }) {
  const [puckData, setPuckData] = useState(null)
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const pageQuery = useQuery({
    queryKey: ['inline-editor-page', pageId, token],
    queryFn: () => apiFetch(`/website/pages/${pageId}`, { headers }),
    enabled: Boolean(token) && Boolean(pageId),
    staleTime: 0,
  })

  useEffect(() => {
    if (pageQuery.data && puckData === null) {
      const draft = pageQuery.data.draftBuilderData
      const initial = draft && Object.keys(draft).length > 0 ? draft : EMPTY_DATA
      setPuckData(initial)
      onDataChange?.(initial)
    }
  }, [pageQuery.data, puckData])

  const handleChange = useCallback((data) => {
    setPuckData(data)
    onDataChange?.(data)
  }, [onDataChange])

  if (!pageId) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 48px)' }}>
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-gray-400 text-sm">No hay una pagina para este URL todavia.</p>
          <p className="text-gray-300 text-xs">Crea una pagina desde el boton &quot;+ Pagina&quot; en la barra superior.</p>
        </div>
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

  const initialData = puckData ?? EMPTY_DATA

  return (
    <div style={{ height: 'calc(100vh - 48px)' }}>
      <Puck
        config={atlasWebsiteConfig}
        data={initialData}
        onChange={handleChange}
      />
    </div>
  )
}
