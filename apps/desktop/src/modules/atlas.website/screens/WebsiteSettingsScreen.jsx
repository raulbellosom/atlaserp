import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Button,
  Card,
  NumberField,
  PageHeader,
  PasswordField,
  Skeleton,
  SwitchField,
  TextField,
} from '@atlas/ui'
import { Mail, Server, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const EMPTY = { host: '', port: 587, user: '', pass: '', from_name: '', from_email: '', tls: false }

export default function WebsiteSettingsScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const [form, setForm] = useState(EMPTY)
  const [passChanged, setPassChanged] = useState(false)

  const configQuery = useQuery({
    queryKey: ['website-smtp-settings'],
    queryFn: () => apiFetch('/website/settings/smtp', token),
    enabled: Boolean(token),
  })

  useEffect(() => {
    const data = configQuery.data?.data
    if (!data) return
    setForm({
      host:       data.host,
      port:       data.port,
      user:       data.user,
      pass:       '',
      from_name:  data.from_name,
      from_email: data.from_email,
      tls:        data.tls,
    })
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/website/settings/smtp', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Configuracion SMTP del website guardada')
      setPassChanged(false)
      configQuery.refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: () => apiFetch('/website/settings/smtp/test', token, { method: 'POST' }),
    onSuccess: (res) => {
      const label = res.source === 'website' ? 'SMTP propio del website' : 'SMTP de plataforma (fallback)'
      toast.success(`Email de prueba enviado via ${label}`)
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      host:       form.host,
      port:       Number(form.port),
      user:       form.user,
      from_name:  form.from_name  || undefined,
      from_email: form.from_email || undefined,
      tls:        form.tls,
    }
    if (passChanged && form.pass) payload.pass = form.pass
    saveMutation.mutate(payload)
  }

  const configured = configQuery.data?.data?.configured ?? false

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Website"
          title="Configuracion"
          description="Ajusta las integraciones y credenciales de tu sitio web."
        />

        <Card className="p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Correo electronico (SMTP)</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                Credenciales propias del sitio. Si no se configuran, se usa el SMTP de la plataforma como respaldo.
              </p>
            </div>
            {configured && (
              <span className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Configurado
              </span>
            )}
          </div>

          <div className="p-4 space-y-4">
            {configQuery.isPending ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Skeleton className="h-11 rounded-lg" />
                  <Skeleton className="h-11 rounded-lg" />
                </div>
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
                <Skeleton className="h-11 w-full rounded-lg" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <TextField
                    label="Servidor (host)"
                    icon={Server}
                    placeholder="smtp.gmail.com"
                    value={form.host}
                    onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                    required
                  />
                  <NumberField
                    label="Puerto"
                    value={form.port}
                    onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                    required
                  />
                </div>

                <TextField
                  label="Usuario"
                  icon={User}
                  placeholder="reservas@minegocio.com"
                  value={form.user}
                  onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))}
                  required
                />

                <PasswordField
                  label={configured && !passChanged ? 'Contrasena (dejar en blanco para mantener)' : 'Contrasena'}
                  placeholder={configured ? '••••••••' : ''}
                  value={form.pass}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, pass: e.target.value }))
                    setPassChanged(true)
                  }}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <TextField
                    label="Nombre del remitente"
                    icon={Mail}
                    placeholder="Mi Restaurante"
                    value={form.from_name}
                    onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))}
                  />
                  <TextField
                    label="Email del remitente"
                    icon={Mail}
                    placeholder="reservas@minegocio.com"
                    value={form.from_email}
                    onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))}
                  />
                </div>

                <SwitchField
                  id="ws-smtp-tls"
                  label="Usar TLS / SSL"
                  checked={form.tls}
                  onChange={(checked) => setForm((f) => ({ ...f, tls: checked }))}
                />

                <div className="flex gap-2 pt-2 border-t border-[hsl(var(--border))]">
                  <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
                    {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                  >
                    {testMutation.isPending ? 'Enviando...' : 'Enviar prueba'}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Card>
      </div>
    </div>
  )
}
