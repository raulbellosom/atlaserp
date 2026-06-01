import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  PasswordField,
  Skeleton,
  TextareaField,
  TextField,
} from '@atlas/ui'
import { CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPatch(path, token, body) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

export default function WebsitePaymentsScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [publishableKey, setPublishableKey] = useState('')
  const [secretKey, setSecretKey] = useState('')
  const [successMessage, setSuccessMessage] = useState('')

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const site = siteQuery.data?.data ?? null
  const siteId = site?.id ?? null

  useEffect(() => {
    if (!site) return
    setPublishableKey(site.stripePublishableKey ?? '')
    setSecretKey('')
    setSuccessMessage(site.stripeSuccessMessage ?? '')
  }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (payload) => apiPatch(`/website/site/${siteId}`, token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-site', token] })
      toast.success('Configuracion de pagos guardada')
    },
    onError: (err) => toast.error(err.message ?? 'Error al guardar'),
  })

  function handleSave(e) {
    e.preventDefault()
    if (!siteId) return
    const payload = {
      stripePublishableKey: publishableKey || null,
      stripeSuccessMessage: successMessage || null,
    }
    if (secretKey.trim()) payload.stripeSecretKey = secretKey.trim()
    saveMutation.mutate(payload)
  }

  const keysConfigured = Boolean(site?.stripePublishableKey && site?.stripeSecretKeySet)

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Website"
          title="Pagos"
          description="Conecta tu cuenta de Stripe para aceptar pagos en el sitio web."
        />

        {siteQuery.isPending ? (
          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="p-4 space-y-4">
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
              <Skeleton className="h-11 w-full rounded-lg" />
            </div>
          </Card>
        ) : !site ? (
          <EmptyState
            icon={CreditCard}
            title="Sin sitio web"
            description="Crea un sitio web antes de configurar los pagos."
          />
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            {site.siteType !== 'ecommerce' && (
              <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/50 text-sm px-4 py-3 text-[hsl(var(--muted-foreground))]">
                Este sitio es de tipo <strong>{site.siteType}</strong>. El checkout de Stripe solo aplica a sitios de tipo <strong>ecommerce</strong>.
              </div>
            )}

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center justify-between">
                <p className="text-sm font-semibold">Credenciales de Stripe</p>
                {keysConfigured && (
                  <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                    Conectado
                  </span>
                )}
              </div>
              <div className="p-4 space-y-4">
                <TextField
                  label="Clave publicable (Publishable Key)"
                  icon={CreditCard}
                  placeholder="pk_live_... o pk_test_..."
                  value={publishableKey}
                  onChange={(e) => setPublishableKey(e.target.value)}
                />
                <PasswordField
                  label={site.stripeSecretKeySet ? 'Clave secreta (dejar en blanco para mantener)' : 'Clave secreta (Secret Key)'}
                  placeholder={site.stripeSecretKeySet ? '••••••••••••••••' : 'sk_live_... o sk_test_...'}
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value)}
                />
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  La clave secreta se almacena cifrada con AES-256-GCM y nunca se expone en respuestas de la API.
                </p>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <p className="text-sm font-semibold">Configuracion del checkout</p>
              </div>
              <div className="p-4 space-y-4">
                <TextareaField
                  label="Mensaje de exito (opcional)"
                  placeholder="Gracias por tu compra. Te enviaremos un correo con los detalles."
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  rows={3}
                />
              </div>
            </Card>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={saveMutation.isPending || !siteId}>
                {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
