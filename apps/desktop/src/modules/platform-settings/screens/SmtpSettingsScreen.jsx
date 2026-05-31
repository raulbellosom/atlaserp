import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { Button, Input, Label, Switch } from '@atlas/ui'
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

const EMPTY = { host: '', port: '587', user: '', pass: '', from_name: '', from_email: '', tls: false }

export default function SmtpSettingsScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const [form, setForm] = useState(EMPTY)
  const [passChanged, setPassChanged] = useState(false)

  const configQuery = useQuery({
    queryKey: ['smtp-settings', token],
    queryFn: () => apiFetch('/settings/smtp', token),
    enabled: Boolean(token),
  })

  useEffect(() => {
    const data = configQuery.data?.data
    if (!data) return
    setForm({
      host:       data.host,
      port:       String(data.port),
      user:       data.user,
      pass:       '',
      from_name:  data.from_name,
      from_email: data.from_email,
      tls:        data.tls,
    })
  }, [configQuery.data])

  const saveMutation = useMutation({
    mutationFn: (data) => apiFetch('/settings/smtp', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Configuracion SMTP guardada')
      setPassChanged(false)
      configQuery.refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const testMutation = useMutation({
    mutationFn: () => apiFetch('/settings/smtp/test', token, { method: 'POST' }),
    onSuccess: () => toast.success('Email de prueba enviado correctamente'),
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
    <div className="p-8 max-w-lg space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))]">Configuracion SMTP</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
          Credenciales para el envio de emails desde la plataforma (formularios, notificaciones, etc.)
        </p>
      </div>

      {configured && (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          SMTP configurado
        </div>
      )}

      {configQuery.isPending ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando...</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label htmlFor="smtp-host">Servidor (host)</Label>
              <Input id="smtp-host" placeholder="smtp.gmail.com" value={form.host} onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="smtp-port">Puerto</Label>
              <Input id="smtp-port" type="number" value={form.port} onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))} required />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="smtp-user">Usuario</Label>
            <Input id="smtp-user" type="email" placeholder="usuario@dominio.com" value={form.user} onChange={(e) => setForm((f) => ({ ...f, user: e.target.value }))} required />
          </div>

          <div className="space-y-1">
            <Label htmlFor="smtp-pass">
              Contrasena {configured && !passChanged && <span className="text-[hsl(var(--muted-foreground))] font-normal">(dejar en blanco para mantener)</span>}
            </Label>
            <Input
              id="smtp-pass"
              type="password"
              placeholder={configured ? '••••••••' : ''}
              value={form.pass}
              onChange={(e) => { setForm((f) => ({ ...f, pass: e.target.value })); setPassChanged(true) }}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="smtp-from-name">Nombre del remitente</Label>
            <Input id="smtp-from-name" placeholder="Atlas ERP" value={form.from_name} onChange={(e) => setForm((f) => ({ ...f, from_name: e.target.value }))} />
          </div>

          <div className="space-y-1">
            <Label htmlFor="smtp-from-email">Email del remitente</Label>
            <Input id="smtp-from-email" type="email" value={form.from_email} onChange={(e) => setForm((f) => ({ ...f, from_email: e.target.value }))} />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="smtp-tls" checked={form.tls} onCheckedChange={(v) => setForm((f) => ({ ...f, tls: v }))} />
            <Label htmlFor="smtp-tls">Usar TLS / SSL</Label>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
              {saveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
            </Button>
            {configured && (
              <Button
                type="button"
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
              >
                {testMutation.isPending ? 'Enviando...' : 'Enviar prueba'}
              </Button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
