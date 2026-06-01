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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  TextField,
} from '@atlas/ui'
import { Globe, Mail, Server, User } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { WebsiteSourceSelector } from '../components/WebsiteSourceSelector.jsx'
import { DistUploadPanel } from '../components/DistUploadPanel.jsx'

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

async function apiFetchForm(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

const SMTP_EMPTY = { host: '', port: 587, user: '', pass: '', from_name: '', from_email: '', tls: false }

export default function WebsiteSettingsScreen() {
  const { session } = useAuth()
  const token = session?.access_token

  const [smtpForm, setSmtpForm] = useState(SMTP_EMPTY)
  const [passChanged, setPassChanged] = useState(false)

  // --- Site query (same pattern as WebsiteOverviewScreen) ---
  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiFetch('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id

  // --- Source query ---
  const sourceQuery = useQuery({
    queryKey: ['website-site-source', siteId],
    queryFn: () => apiFetch(`/website/sites/${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
  })

  // --- SMTP config query ---
  const configQuery = useQuery({
    queryKey: ['website-smtp-settings'],
    queryFn: () => apiFetch('/website/settings/smtp', token),
    enabled: Boolean(token),
  })

  useEffect(() => {
    const data = configQuery.data?.data
    if (!data) return
    setSmtpForm({
      host:       data.host,
      port:       data.port,
      user:       data.user,
      pass:       '',
      from_name:  data.from_name,
      from_email: data.from_email,
      tls:        data.tls,
    })
  }, [configQuery.data])

  const smtpSaveMutation = useMutation({
    mutationFn: (data) =>
      apiFetch('/website/settings/smtp', token, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => {
      toast.success('Configuracion SMTP del website guardada')
      setPassChanged(false)
      configQuery.refetch()
    },
    onError: (err) => toast.error(err.message),
  })

  const smtpTestMutation = useMutation({
    mutationFn: () => apiFetch('/website/settings/smtp/test', token, { method: 'POST' }),
    onSuccess: (res) => {
      const label = res.source === 'website' ? 'SMTP propio del website' : 'SMTP de plataforma (fallback)'
      toast.success(`Email de prueba enviado via ${label}`)
    },
    onError: (err) => toast.error(`Error: ${err.message}`),
  })

  const sourceChangeMutation = useMutation({
    mutationFn: (newSource) =>
      apiFetch(`/website/sites/${siteId}`, token, {
        method: 'PATCH',
        body: JSON.stringify({ sourceType: newSource }),
      }),
    onSuccess: () => {
      toast.success('Fuente del sitio actualizada')
      sourceQuery.refetch()
    },
    onError: (err) => toast.error(err.message ?? 'Error al cambiar la fuente'),
  })

  const uploadDistMutation = useMutation({
    mutationFn: (file) => {
      const formData = new FormData()
      formData.append('file', file)
      return apiFetchForm(`/website/sites/${siteId}/dist/upload`, token, {
        method: 'POST',
        body: formData,
      })
    },
    onSuccess: (res) => {
      toast.success(`Build subido: ${res.data.fileCount} archivos`)
      sourceQuery.refetch()
    },
    onError: (err) => toast.error(err.message ?? 'Error al subir el build'),
  })

  const deleteDistMutation = useMutation({
    mutationFn: () =>
      apiFetchForm(`/website/sites/${siteId}/dist`, token, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Build eliminado. El sitio volvera al constructor de paginas.')
      sourceQuery.refetch()
    },
    onError: (err) => toast.error(err.message ?? 'Error al eliminar el build'),
  })

  function handleSmtpSubmit(e) {
    e.preventDefault()
    const payload = {
      host:       smtpForm.host,
      port:       Number(smtpForm.port),
      user:       smtpForm.user,
      from_name:  smtpForm.from_name  || undefined,
      from_email: smtpForm.from_email || undefined,
      tls:        smtpForm.tls,
    }
    if (passChanged && smtpForm.pass) payload.pass = smtpForm.pass
    smtpSaveMutation.mutate(payload)
  }

  const smtpConfigured = configQuery.data?.data?.configured ?? false

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6 max-w-3xl mx-auto w-full">
        <PageHeader
          eyebrow="Atlas Website"
          title="Configuracion"
          description="Ajusta las integraciones y credenciales de tu sitio web."
        />

        <Tabs defaultValue="source">
          <TabsList>
            <TabsTrigger value="source">
              <Globe className="w-4 h-4 mr-1.5" />
              Fuente del sitio
            </TabsTrigger>
            <TabsTrigger value="smtp">
              <Mail className="w-4 h-4 mr-1.5" />
              Correo electronico
            </TabsTrigger>
          </TabsList>

          {/* Tab: Fuente del sitio */}
          <TabsContent value="source" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <p className="text-sm font-semibold">Fuente del sitio</p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                  Elige que se sirve en la ruta raiz de tu dominio.
                </p>
              </div>
              <div className="p-4 space-y-4">
                {sourceQuery.isPending || siteQuery.isPending ? (
                  <div className="space-y-2">
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                    <Skeleton className="h-16 rounded-lg" />
                  </div>
                ) : (
                  <>
                    <WebsiteSourceSelector
                      currentSource={sourceQuery.data?.data?.sourceType ?? 'builder'}
                      onSelect={(value) => sourceChangeMutation.mutate(value)}
                      isLoading={sourceChangeMutation.isPending}
                    />
                    {sourceQuery.data?.data?.sourceType === 'dist' && (
                      <div className="pt-2 border-t border-[hsl(var(--border))]">
                        <p className="text-sm font-medium mb-3">Archivos del build</p>
                        <DistUploadPanel
                          site={sourceQuery.data?.data}
                          onUpload={(file) => uploadDistMutation.mutate(file)}
                          onDelete={() => deleteDistMutation.mutate()}
                          isUploading={uploadDistMutation.isPending || deleteDistMutation.isPending}
                          uploadError={uploadDistMutation.isError ? uploadDistMutation.error?.message : null}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>
          </TabsContent>

          {/* Tab: Correo electronico (SMTP) */}
          <TabsContent value="smtp" className="mt-4">
            <Card className="p-0 overflow-hidden">
              <div className="px-4 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Correo electronico (SMTP)</p>
                  <p className="text-xs text-[hsl(var(--muted-foreground))] mt-0.5">
                    Credenciales propias del sitio. Si no se configuran, se usa el SMTP de la plataforma como respaldo.
                  </p>
                </div>
                {smtpConfigured && (
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
                  <form onSubmit={handleSmtpSubmit} className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                      <TextField
                        label="Servidor (host)"
                        icon={Server}
                        placeholder="smtp.gmail.com"
                        value={smtpForm.host}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, host: e.target.value }))}
                        required
                      />
                      <NumberField
                        label="Puerto"
                        value={smtpForm.port}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, port: Number(e.target.value) }))}
                        required
                      />
                    </div>

                    <TextField
                      label="Usuario"
                      icon={User}
                      placeholder="reservas@minegocio.com"
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm((f) => ({ ...f, user: e.target.value }))}
                      required
                    />

                    <PasswordField
                      label={smtpConfigured && !passChanged ? 'Contrasena (dejar en blanco para mantener)' : 'Contrasena'}
                      placeholder={smtpConfigured ? '••••••••' : ''}
                      value={smtpForm.pass}
                      onChange={(e) => {
                        setSmtpForm((f) => ({ ...f, pass: e.target.value }))
                        setPassChanged(true)
                      }}
                    />

                    <div className="grid md:grid-cols-2 gap-4">
                      <TextField
                        label="Nombre del remitente"
                        icon={Mail}
                        placeholder="Mi Restaurante"
                        value={smtpForm.from_name}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, from_name: e.target.value }))}
                      />
                      <TextField
                        label="Email del remitente"
                        icon={Mail}
                        placeholder="reservas@minegocio.com"
                        value={smtpForm.from_email}
                        onChange={(e) => setSmtpForm((f) => ({ ...f, from_email: e.target.value }))}
                      />
                    </div>

                    <SwitchField
                      id="ws-smtp-tls"
                      label="Usar TLS / SSL"
                      checked={smtpForm.tls}
                      onChange={(checked) => setSmtpForm((f) => ({ ...f, tls: checked }))}
                    />

                    <div className="flex gap-2 pt-2 border-t border-[hsl(var(--border))]">
                      <Button type="submit" disabled={smtpSaveMutation.isPending} className="flex-1">
                        {smtpSaveMutation.isPending ? 'Guardando...' : 'Guardar configuracion'}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => smtpTestMutation.mutate()}
                        disabled={smtpTestMutation.isPending}
                      >
                        {smtpTestMutation.isPending ? 'Enviando...' : 'Enviar prueba'}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
