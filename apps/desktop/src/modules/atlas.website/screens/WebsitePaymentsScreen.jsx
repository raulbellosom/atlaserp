import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button } from '@atlas/ui'
import { CreditCard, Save, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function apiPatch(path, token, body) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    method:  'PATCH',
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}

const CURRENCIES = ['usd', 'eur', 'mxn', 'cop', 'pen', 'ars', 'clp', 'brl']

export default function WebsitePaymentsScreen() {
  const { session } = useAuth()
  const token       = session?.access_token
  const queryClient = useQueryClient()

  const [showSecret, setShowSecret]         = useState(false)
  const [publishableKey, setPublishableKey] = useState('')
  const [secretKey, setSecretKey]           = useState('')
  const [currency, setCurrency]             = useState('usd')
  const [successMessage, setSuccessMessage] = useState('')
  const [saved, setSaved]                   = useState(false)

  const siteQuery = useQuery({
    queryKey:  ['website-site', token],
    queryFn:   () => apiGet('/website/site', token),
    enabled:   Boolean(token),
    staleTime: 60_000,
  })

  const site   = siteQuery.data?.data ?? null
  const siteId = site?.id ?? null

  // Populate form when site data loads
  useEffect(() => {
    if (!site) return
    setPublishableKey(site.stripePublishableKey ?? '')
    // Never pre-fill the secret key — only show whether one is set
    setSecretKey('')
    setCurrency(site.stripeCurrency ?? 'usd')
    setSuccessMessage(site.stripeSuccessMessage ?? '')
  }, [siteId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveMutation = useMutation({
    mutationFn: (payload) => apiPatch(`/website/site/${siteId}`, token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['website-site', token] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  function handleSave(e) {
    e.preventDefault()
    if (!siteId) return
    const payload = {
      stripePublishableKey: publishableKey || null,
      stripeCurrency:       currency,
      stripeSuccessMessage: successMessage || null,
    }
    // Only send the secret key if the user typed a new one
    if (secretKey.trim()) {
      payload.stripeSecretKey = secretKey.trim()
    }
    saveMutation.mutate(payload)
  }

  if (siteQuery.isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Cargando configuracion...</p>
      </div>
    )
  }

  if (!site) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
        <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
        <p className="text-amber-800 font-medium">No hay un sitio web configurado</p>
        <p className="text-amber-700 text-sm mt-1">Crea un sitio web antes de configurar los pagos.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <CreditCard className="w-7 h-7 text-gray-600" />
        <div>
          <h1 className="text-3xl font-bold">Pagos con Stripe</h1>
          <p className="text-gray-600 mt-1">Conecta tu cuenta de Stripe para aceptar pagos en tu tienda</p>
        </div>
      </div>

      {site.siteType !== 'ecommerce' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-800 font-medium text-sm">Este sitio no es de tipo tienda</p>
            <p className="text-amber-700 text-sm">
              El tipo de sitio actual es <strong>{site.siteType}</strong>. Cambia el tipo a{' '}
              <strong>ecommerce</strong> en la configuracion del sitio para habilitar el checkout.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-5 bg-white border rounded-xl p-6 shadow-sm">
        <h2 className="font-semibold text-gray-800 text-lg border-b pb-3">Credenciales de Stripe</h2>

        {/* Publishable Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clave publicable (Publishable Key)
          </label>
          <input
            type="text"
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder="pk_live_... o pk_test_..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            Esta clave es publica y se puede compartir de forma segura.
          </p>
        </div>

        {/* Secret Key */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Clave secreta (Secret Key)
          </label>
          <div className="relative">
            <input
              type={showSecret ? 'text' : 'password'}
              value={secretKey}
              onChange={(e) => setSecretKey(e.target.value)}
              placeholder={site.stripeSecretKeySet ? '••••••••••••••••••••••••• (ya configurada)' : 'sk_live_... o sk_test_...'}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {site.stripeSecretKeySet && !secretKey && (
            <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3" />
              Clave secreta guardada. Deja en blanco para mantener la actual.
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Se almacena cifrada con AES-256-GCM. Nunca se expone en respuestas de la API.
          </p>
        </div>

        <h2 className="font-semibold text-gray-800 text-lg border-b pb-3 pt-2">Configuracion del checkout</h2>

        {/* Currency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Moneda
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c.toUpperCase()}</option>
            ))}
          </select>
        </div>

        {/* Success Message */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mensaje de exito (opcional)
          </label>
          <textarea
            value={successMessage}
            onChange={(e) => setSuccessMessage(e.target.value)}
            rows={3}
            placeholder="Gracias por tu compra. Te enviaremos un correo con los detalles."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        {saveMutation.isError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
            {saveMutation.error?.message ?? 'Error al guardar'}
          </div>
        )}

        {saved && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700 flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Configuracion guardada correctamente
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={saveMutation.isPending || !siteId}
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
          </Button>
        </div>
      </form>
    </div>
  )
}
