import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'

export default function MenuItemDialog({ menuId, item, open, onOpenChange, onSaved, rootItems = [] }) {
  const { session } = useAuth()
  const token = session?.access_token

  const [form, setForm] = useState({
    label: '', url: '', target: '_self', icon: '', parentId: '',
  })

  useEffect(() => {
    if (open) {
      setForm({
        label:    item?.label    ?? '',
        url:      item?.url      ?? '',
        target:   item?.target   ?? '_self',
        icon:     item?.icon     ?? '',
        parentId: item?.parent_id ?? '',
      })
    }
  }, [open, item])

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/menus/${menuId}/items`, {
        method: 'POST', headers, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => { toast.success('Elemento agregado'); onSaved(); onOpenChange(false) },
    onError: (err) => toast.error(err.message || 'Error al agregar elemento'),
  })

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/menu-items/${item.id}`, {
        method: 'PATCH', headers, body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: () => { toast.success('Elemento actualizado'); onSaved(); onOpenChange(false) },
    onError: (err) => toast.error(err.message || 'Error al actualizar elemento'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const payload = {
      label:    form.label.trim(),
      url:      form.url.trim() || null,
      target:   form.target,
      icon:     form.icon.trim() || null,
      parentId: form.parentId || null,
    }
    if (item) {
      updateMutation.mutate(payload)
    } else {
      createMutation.mutate(payload)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending
  const parentOptions = rootItems.filter((r) => !item || r.id !== item.id)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar elemento' : 'Agregar elemento'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="item-label">Etiqueta</Label>
            <Input
              id="item-label"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="Inicio"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="item-url">URL (opcional)</Label>
            <Input
              id="item-url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://... o /ruta"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="item-target">Abrir en</Label>
              <select
                id="item-target"
                value={form.target}
                onChange={(e) => setForm((f) => ({ ...f, target: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option value="_self">Misma ventana</option>
                <option value="_blank">Nueva ventana</option>
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="item-icon">Icono (opcional)</Label>
              <Input
                id="item-icon"
                value={form.icon}
                onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                placeholder="Home"
              />
            </div>
          </div>

          {parentOptions.length > 0 && (
            <div className="space-y-1">
              <Label htmlFor="item-parent">Subelemento de (opcional)</Label>
              <select
                id="item-parent"
                value={form.parentId}
                onChange={(e) => setForm((f) => ({ ...f, parentId: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option value="">— Elemento raiz —</option>
                {parentOptions.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isSaving || !form.label.trim()}>
              {isSaving ? 'Guardando...' : item ? 'Guardar' : 'Agregar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
