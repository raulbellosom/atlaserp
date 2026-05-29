import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'

export default function WebsiteOverviewScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [configOpen, setConfigOpen] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '' })

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/website/site`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    enabled: Boolean(token),
    staleTime: 60_000,
  })

  const site = siteQuery.data?.data ?? null

  function openDialog() {
    setForm({ name: site?.name ?? '', domain: site?.domain ?? '' })
    setConfigOpen(true)
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/site`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sitio web configurado')
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      setConfigOpen(false)
    },
    onError: (err) => toast.error(err.message || 'Error al configurar el sitio'),
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`${getApiUrl()}/website/site/${id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },
    onSuccess: () => {
      toast.success('Sitio web actualizado')
      queryClient.invalidateQueries({ queryKey: ['website-site'] })
      setConfigOpen(false)
    },
    onError: (err) => toast.error(err.message || 'Error al actualizar el sitio'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const payload = { name: form.name.trim(), domain: form.domain.trim() || undefined }
    if (site) {
      updateMutation.mutate({ id: site.id, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Sitio web</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Administra tu sitio publico desde este panel.
          </p>
        </div>
        {site && (
          <Button variant="outline" size="sm" onClick={openDialog}>
            Editar configuracion
          </Button>
        )}
      </div>

      {siteQuery.isLoading ? (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">Cargando...</p>
        </div>
      ) : site ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Estado</p>
            <p className="text-lg font-medium capitalize">{site.status}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Dominio</p>
            <p className="text-lg font-medium">{site.domain || '—'}</p>
          </div>
          <div className="rounded-xl border border-[hsl(var(--border))] p-5 space-y-1">
            <p className="text-xs text-[hsl(var(--muted-foreground))] uppercase tracking-wide">Nombre</p>
            <p className="text-lg font-medium">{site.name}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[hsl(var(--border))] p-8 text-center space-y-4">
          <p className="text-[hsl(var(--muted-foreground))]">No hay un sitio web configurado aun.</p>
          <Button onClick={openDialog}>Configurar sitio web</Button>
        </div>
      )}

      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{site ? 'Editar sitio web' : 'Configurar sitio web'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="site-name">Nombre del sitio</Label>
              <Input
                id="site-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Mi empresa"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="site-domain">Dominio (opcional)</Label>
              <Input
                id="site-domain"
                value={form.domain}
                onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                placeholder="ejemplo.com"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setConfigOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving || !form.name.trim()}>
                {site ? 'Guardar cambios' : 'Crear sitio'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
