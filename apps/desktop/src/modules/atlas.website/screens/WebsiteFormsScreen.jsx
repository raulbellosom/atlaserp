import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, TextField,
  PageHeader, EmptyState, ConfirmDialog,
  Tabs, TabsList, TabsTrigger, TabsContent,
} from '@atlas/ui'
import { toast } from 'sonner'
import FormFieldBuilder from './FormFieldBuilder.jsx'
import FormSubmissionsPanel from './FormSubmissionsPanel.jsx'

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WebsiteFormsScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [selectedFormId, setSelectedFormId] = useState(null)
  const [activeTab, setActiveTab] = useState('campos')
  const [newFormOpen, setNewFormOpen] = useState(false)
  const [newFormData, setNewFormData] = useState({ name: '', description: '', submitLabel: 'Enviar', successMessage: '', notifyEmail: '' })
  const [deleteTarget, setDeleteTarget] = useState(null)

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const formsQuery = useQuery({
    queryKey: ['website-forms', siteId, token],
    queryFn: () => apiGet(`/website/forms?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })
  const forms = formsQuery.data?.data ?? []
  const activeFormId = selectedFormId ?? forms[0]?.id ?? null
  const selectedForm = forms.find((f) => f.id === activeFormId) ?? null

  const formDetailQuery = useQuery({
    queryKey: ['website-form-detail', activeFormId, token],
    queryFn: () => apiGet(`/website/forms/${activeFormId}`, token),
    enabled: Boolean(token) && Boolean(activeFormId),
    staleTime: 15_000,
  })
  const formDetail = formDetailQuery.data ?? null

  const createFormMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/forms`, {
        method: 'POST', headers, body: JSON.stringify({ ...data, siteId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (form) => {
      toast.success('Formulario creado')
      queryClient.invalidateQueries({ queryKey: ['website-forms', siteId] })
      setSelectedFormId(form.id)
      setNewFormOpen(false)
      setNewFormData({ name: '', description: '', submitLabel: 'Enviar', successMessage: '', notifyEmail: '' })
    },
    onError: (err) => toast.error(err.message || 'Error al crear formulario'),
  })

  const deleteFormMutation = useMutation({
    mutationFn: async (formId) => {
      const res = await fetch(`${getApiUrl()}/website/forms/${formId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al eliminar')
    },
    onSuccess: () => {
      toast.success('Formulario eliminado')
      setSelectedFormId(null)
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['website-forms', siteId] })
    },
    onError: () => {
      toast.error('Error al eliminar el formulario')
      setDeleteTarget(null)
    },
  })

  if (siteQuery.isPending) {
    return <div className="p-6 text-[hsl(var(--muted-foreground))] text-sm">Cargando...</div>
  }

  if (!siteId) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Website"
          title="Formularios"
          description="Crea formularios de contacto y captura envios desde el sitio publico."
        />
        <EmptyState
          title="Sitio web no configurado"
          description='Configura tu sitio web primero desde la seccion "Sitio web".'
        />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        eyebrow="Atlas Website"
        title="Formularios"
        description="Crea formularios de contacto y captura envios desde el sitio publico."
        actions={
          <Button onClick={() => setNewFormOpen(true)}>Nuevo formulario</Button>
        }
      />

      {formsQuery.isPending ? (
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando formularios...</div>
      ) : forms.length === 0 ? (
        <EmptyState
          title="Sin formularios"
          description="Crea tu primer formulario para capturar envios desde el sitio publico."
          action={{ label: 'Crear primer formulario', onClick: () => setNewFormOpen(true) }}
        />
      ) : (
        <div className="flex gap-6">
          <div className="w-52 shrink-0 space-y-1">
            {forms.map((form) => (
              <button
                key={form.id}
                onClick={() => { setSelectedFormId(form.id); setActiveTab('campos') }}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeFormId === form.id
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium'
                    : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                <div className="truncate font-medium">{form.name}</div>
                <div className={`text-xs mt-0.5 ${activeFormId === form.id ? 'opacity-70' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {form._count?.fields ?? 0} campo{form._count?.fields !== 1 ? 's' : ''}
                  {' · '}{form._count?.submissions ?? 0} envio{form._count?.submissions !== 1 ? 's' : ''}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4 min-w-0">
            {selectedForm ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-medium text-[hsl(var(--foreground))]">{selectedForm.name}</h2>
                  <button
                    onClick={() => setDeleteTarget(selectedForm)}
                    className="text-xs text-[hsl(var(--destructive))] hover:underline"
                  >
                    Eliminar formulario
                  </button>
                </div>

                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList>
                    <TabsTrigger value="campos">Campos</TabsTrigger>
                    <TabsTrigger value="envios">
                      Envios
                      {(selectedForm._count?.submissions ?? 0) > 0 && (
                        <span className="ml-1.5 text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-full px-1.5 py-0.5 leading-none">
                          {selectedForm._count.submissions}
                        </span>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="campos">
                    {formDetailQuery.isPending ? (
                      <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando campos...</div>
                    ) : (
                      <FormFieldBuilder
                        formId={selectedForm.id}
                        fields={formDetail?.fields ?? []}
                        onRefresh={() => queryClient.invalidateQueries({ queryKey: ['website-form-detail', selectedForm.id] })}
                      />
                    )}
                  </TabsContent>

                  <TabsContent value="envios">
                    <FormSubmissionsPanel formId={selectedForm.id} />
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="py-10 text-center">
                <p className="text-[hsl(var(--muted-foreground))] text-sm">Selecciona un formulario.</p>
              </div>
            )}
          </div>
        </div>
      )}

      <Dialog open={newFormOpen} onOpenChange={setNewFormOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo formulario</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createFormMutation.mutate(newFormData) }}
            className="space-y-4 py-2"
          >
            <TextField
              label="Nombre"
              value={newFormData.name}
              onChange={(e) => setNewFormData((f) => ({ ...f, name: e.target.value }))}
              placeholder="Contacto"
              required
              autoFocus
            />
            <TextField
              label="Descripcion (opcional)"
              value={newFormData.description}
              onChange={(e) => setNewFormData((f) => ({ ...f, description: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Texto del boton"
                value={newFormData.submitLabel}
                onChange={(e) => setNewFormData((f) => ({ ...f, submitLabel: e.target.value }))}
              />
              <TextField
                label="Notificar por email (opcional)"
                type="email"
                value={newFormData.notifyEmail}
                onChange={(e) => setNewFormData((f) => ({ ...f, notifyEmail: e.target.value }))}
                placeholder="tu@empresa.com"
              />
            </div>
            <TextField
              label="Mensaje de exito (opcional)"
              value={newFormData.successMessage}
              onChange={(e) => setNewFormData((f) => ({ ...f, successMessage: e.target.value }))}
              placeholder="Gracias, nos pondremos en contacto pronto."
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createFormMutation.isPending || !newFormData.name.trim()}>
                {createFormMutation.isPending ? 'Creando...' : 'Crear formulario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Eliminar formulario"
        description={`Se eliminara permanentemente el formulario "${deleteTarget?.name}" y todos sus campos y envios. Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteFormMutation.isPending}
        onConfirm={() => deleteFormMutation.mutate(deleteTarget?.id)}
      />
    </div>
  )
}
