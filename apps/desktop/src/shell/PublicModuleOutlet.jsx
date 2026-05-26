import { useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { EmptyState, ErrorState, Skeleton } from '@atlas/ui'
import { Package } from 'lucide-react'
import { componentRegistry } from '../lib/moduleComponentRegistry'

const API_BASE_URL = import.meta.env.VITE_ATLAS_API_URL || 'http://localhost:4010'

function normalizePath(value) {
  const text = String(value ?? '').trim()
  if (!text) return ''
  if (text === '/') return '/'
  const withSlash = text.startsWith('/') ? text : `/${text}`
  return withSlash.replace(/\/+$/, '')
}

export function PublicModuleOutlet() {
  const location = useLocation()
  const navigate = useNavigate()

  const blueprintsQuery = useQuery({
    queryKey: ['public-blueprints'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/public/blueprints`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })

  const rows = useMemo(
    () => (Array.isArray(blueprintsQuery.data?.data) ? blueprintsQuery.data.data : []),
    [blueprintsQuery.data]
  )

  useEffect(() => {
    if (!rows.length) return
    const moduleKeys = [...new Set(rows.map((r) => r.moduleKey).filter(Boolean))]
    componentRegistry.setActiveModules(moduleKeys)
  }, [rows])

  const matchedBlueprint = useMemo(() => {
    const normalizedPathname = normalizePath(location.pathname)
    return rows.find((row) => normalizePath(row?.schema?.path) === normalizedPathname) ?? null
  }, [rows, location.pathname])

  if (blueprintsQuery.isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-4 w-64" />
      </div>
    )
  }

  if (blueprintsQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title="No se pudo cargar la vista"
          description="Verifica tu conexion e intenta de nuevo."
          onRetry={() => blueprintsQuery.refetch()}
        />
      </div>
    )
  }

  if (!matchedBlueprint) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Vista publica no encontrada"
          description="Esta ruta no tiene una vista publica configurada."
        />
      </div>
    )
  }

  const componentKey = matchedBlueprint.schema?.component
  const CustomComponent = componentKey ? componentRegistry.resolve(componentKey) : null

  if (!CustomComponent) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="Componente no disponible"
          description={`El componente "${componentKey ?? 'desconocido'}" no esta en el bundle actual.`}
        />
      </div>
    )
  }

  return (
    <CustomComponent
      navigate={navigate}
      moduleKey={matchedBlueprint.moduleKey}
    />
  )
}
