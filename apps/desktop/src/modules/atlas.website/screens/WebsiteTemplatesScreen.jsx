import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Badge } from '@atlas/ui'
import { FileText, Plus } from 'lucide-react'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WebsiteTemplatesScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const templatesQuery = useQuery({
    queryKey: ['website-templates', siteId, token],
    queryFn: () => apiGet(`/website/templates?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Plantillas</h1>
          <p className="text-gray-600 mt-1">Gestiona las plantillas de tu sitio web</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Nueva plantilla
        </Button>
      </div>

      {templatesQuery.isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando plantillas...</p>
        </div>
      )}

      {templatesQuery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error al cargar las plantillas</p>
        </div>
      )}

      {templatesQuery.isSuccess && (!templatesQuery.data?.data || templatesQuery.data.data.length === 0) && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay plantillas aún</p>
        </div>
      )}

      {templatesQuery.isSuccess && templatesQuery.data?.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templatesQuery.data.data.map((template) => (
            <div key={template.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
              <h3 className="font-medium text-lg mb-2">{template.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{template.description || 'Sin descripción'}</p>
              <div className="flex items-center justify-between">
                <Badge variant="outline">{template.kind || 'Template'}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
