import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Badge } from '@atlas/ui'
import { CreditCard, Plus } from 'lucide-react'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WebsitePaymentsScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const paymentsQuery = useQuery({
    queryKey: ['website-payments', siteId, token],
    queryFn: () => apiGet(`/website/payments?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Pagos</h1>
          <p className="text-gray-600 mt-1">Configura los metodos de pago de tu sitio web</p>
        </div>
        <Button className="gap-2">
          <Plus className="w-4 h-4" />
          Agregar pago
        </Button>
      </div>

      {paymentsQuery.isLoading && (
        <div className="text-center py-12">
          <p className="text-gray-500">Cargando configuracion de pagos...</p>
        </div>
      )}

      {paymentsQuery.isError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error al cargar la configuracion de pagos</p>
        </div>
      )}

      {paymentsQuery.isSuccess && (!paymentsQuery.data?.data || paymentsQuery.data.data.length === 0) && (
        <div className="text-center py-12">
          <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500">No hay metodos de pago configurados</p>
        </div>
      )}

      {paymentsQuery.isSuccess && paymentsQuery.data?.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentsQuery.data.data.map((payment) => (
            <div key={payment.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow">
              <h3 className="font-medium text-lg mb-2">{payment.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{payment.description || 'Sin descripcion'}</p>
              <div className="flex items-center justify-between">
                <Badge variant={payment.enabled ? 'default' : 'secondary'}>
                  {payment.enabled ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
