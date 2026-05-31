import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AtlasWebBuilderEditor, baseBlocks,
  serializePage, parsePage,
  defaultTheme, defineTheme,
} from '@raulbellosom/atlas-web-builder'
import '@raulbellosom/atlas-web-builder/styles'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { toast } from 'sonner'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

function createAssetSource(token) {
  const apiUrl = getApiUrl()
  return {
    async list() {
      try {
        const data = await apiFetch('/files?pageSize=100', token)
        const files = (data.data ?? []).filter((f) => f.mimeType?.startsWith('image/'))
        if (!files.length) return []
        const urlRes = await apiFetch('/files/batch-signed-urls', token, {
          method: 'POST',
          body: JSON.stringify({ fileIds: files.map((f) => f.id) }),
        })
        const urlMap = urlRes.data ?? {}
        return files
          .filter((f) => urlMap[f.id])
          .map((f) => ({ id: f.id, name: f.originalName ?? f.id, kind: 'image', url: urlMap[f.id] }))
      } catch { return [] }
    },
    async upload(file) {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${apiUrl}/files/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      const f = data.data
      return { id: f.id, name: f.originalName ?? f.id, kind: 'image', url: f.url ?? '' }
    },
    async remove(id) {
      await apiFetch(`/files/${id}`, token, { method: 'DELETE' })
    },
  }
}

export default function WebsitePageEditorScreen() {
  const { '*': wildcard } = useParams()
  const pageId = wildcard?.match(/^pages\/([^/]+)\/editor$/)?.[1] ?? null
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const pageQuery = useQuery({
    queryKey: ['website-page', pageId, token],
    queryFn: () => apiFetch(`/website/pages/${pageId}`, token),
    enabled: Boolean(token) && Boolean(pageId),
  })

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiFetch('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const themeQuery = useQuery({
    queryKey: ['website-theme', token],
    queryFn: () => apiFetch('/website/theme', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const saveDraftMutation = useMutation({
    mutationFn: (page) =>
      apiFetch(`/website/pages/${pageId}/draft`, token, {
        method: 'POST',
        body: JSON.stringify({ draft_builder_data: serializePage(page) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-page', pageId] })
      toast.success('Borrador guardado')
    },
    onError: (err) => toast.error(err.message),
  })

  const publishMutation = useMutation({
    mutationFn: (page) =>
      apiFetch(`/website/pages/${pageId}/publish`, token, {
        method: 'POST',
        body: JSON.stringify({ draft_builder_data: serializePage(page) }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-page', pageId] })
      toast.success('Pagina publicada')
    },
    onError: (err) => toast.error(err.message),
  })

  const pageData  = pageQuery.data?.data ?? null
  const themeData = themeQuery.data?.data ?? null

  const resolvedTheme = themeData?.tokens
    ? defineTheme({
        ...defaultTheme,
        id: 'atlas-site',
        name: 'Site Theme',
        tokens: { ...defaultTheme.tokens, ...themeData.tokens },
      })
    : defaultTheme

  let initialPage = null
  if (pageData?.draft_builder_data) {
    try {
      initialPage =
        typeof pageData.draft_builder_data === 'string'
          ? parsePage(pageData.draft_builder_data)
          : parsePage(JSON.stringify(pageData.draft_builder_data))
    } catch { initialPage = null }
  }

  if (!initialPage && pageData) {
    initialPage = {
      schemaVersion: 1,
      id:         `page_${pageData.id}`,
      slug:       pageData.slug ?? '/',
      title:      pageData.title ?? 'Nueva pagina',
      visibility: 'public',
      regions:    { main: { id: 'region_main', children: [] } },
      blocks:     {},
      seo:        { title: pageData.title ?? '', description: '', canonical: null, ogImageAssetId: null },
      updatedAt:  new Date().toISOString(),
    }
  }

  if (pageQuery.isPending || !initialPage) {
    return (
      <div className="flex items-center justify-center h-screen text-sm text-gray-400">
        Cargando editor...
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0 }}>
      <AtlasWebBuilderEditor
        blocks={baseBlocks}
        initialPage={initialPage}
        theme={resolvedTheme}
        assets={createAssetSource(token)}
        brandName="Atlas ERP"
        onSaveDraft={(page) => saveDraftMutation.mutate(page)}
        onPublish={(page) => publishMutation.mutate(page)}
      />
    </div>
  )
}
