import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'
import FormFieldBuilder from './FormFieldBuilder.jsx'
import FormSubmissionsPanel from './FormSubmissionsPanel.jsx'

const TABS = ['Campos', 'Envios']

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
  const [activeTab, setActiveTab] = useState('Campos')
  const [newFormOpen, setNewFormOpen] = useState(false)
  const [newFormData, setNewFormData] = useState({ name: '', description: '', submitLabel: 'Enviar', successMessage: '', notifyEmail: '' })

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
      queryClient.invalidateQueries({ queryKey: ['website-forms', siteId] })
    },
    onError: () => toast.error('Error al eliminar el formulario'),
  })

  if (siteQuery.isPending) {
    return <div className="p-8 text-[hsl(var(--muted-foreground))] text-sm">Cargando...</div>
  }

  if (!siteId) {
    return (
      <div className="p-8">
        <div className="rounded-xl border border-[hsl(var(--border))] p-10 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">
            Configura tu sitio web primero desde la seccion &quot;Sitio web&quot;.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Formularios</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Crea formularios de contacto y captura envios desde el sitio publico.
          </p>
        </div>
        <Button onClick={() => setNewFormOpen(true)}>Nuevo formulario</Button>
      </div>

      {formsQuery.isPending ? (
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando formularios...</div>
      ) : forms.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-10 text-center space-y-4">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay formularios creados.</p>
          <Button size="sm" onClick={() => setNewFormOpen(true)}>Crear primer formulario</Button>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="w-52 shrink-0 space-y-1">
            {forms.map((form) => (
              <button
                key={form.id}
                onClick={() => { setSelectedFormId(form.id); setActiveTab('Campos') }}
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
                    onClick={() => { if (window.confirm(`Eliminar "${selectedForm.name}"?`)) deleteFormMutation.mutate(selectedForm.id) }}
                    className="text-xs text-[hsl(var(--destructive))] hover:underline"
                  >
                    Eliminar formulario
                  </button>
                </div>

                <div className="flex gap-1 border border-[hsl(var(--border))] rounded-lg p-0.5 w-fit">
                  {TABS.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        activeTab === tab
                          ? 'bg-[hsl(var(--background))] shadow-sm font-medium'
                          : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
                      }`}
                    >
                      {tab}
                      {tab === 'Envios' && (selectedForm._count?.submissions ?? 0) > 0 && (
                        <span className="ml-1 text-xs bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] rounded-full px-1.5 py-0.5">
                          {selectedForm._count.submissions}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {activeTab === 'Campos' ? (
                  formDetailQuery.isPending ? (
                    <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando campos...</div>
                  ) : (
                    <FormFieldBuilder
                      formId={selectedForm.id}
                      fields={formDetail?.fields ?? []}
                      onRefresh={() => queryClient.invalidateQueries({ queryKey: ['website-form-detail', selectedForm.id] })}
                    />
                  )
                ) : (
                  <FormSubmissionsPanel formId={selectedForm.id} />
                )}
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
            <div className="space-y-1">
              <Label htmlFor="form-name">Nombre</Label>
              <Input id="form-name" value={newFormData.name} onChange={(e) => setNewFormData((f) => ({ ...f, name: e.target.value }))} placeholder="Contacto" required autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-desc">Descripcion (opcional)</Label>
              <Input id="form-desc" value={newFormData.description} onChange={(e) => setNewFormData((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="form-btn">Texto del boton</Label>
                <Input id="form-btn" value={newFormData.submitLabel} onChange={(e) => setNewFormData((f) => ({ ...f, submitLabel: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="form-notify">Notificar por email (opcional)</Label>
                <Input id="form-notify" type="email" value={newFormData.notifyEmail} onChange={(e) => setNewFormData((f) => ({ ...f, notifyEmail: e.target.value }))} placeholder="tu@empresa.com" />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="form-success">Mensaje de exito (opcional)</Label>
              <Input id="form-success" value={newFormData.successMessage} onChange={(e) => setNewFormData((f) => ({ ...f, successMessage: e.target.value }))} placeholder="Gracias, nos pondremos en contacto pronto." />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewFormOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={createFormMutation.isPending || !newFormData.name.trim()}>
                {createFormMutation.isPending ? 'Creando...' : 'Crear formulario'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
