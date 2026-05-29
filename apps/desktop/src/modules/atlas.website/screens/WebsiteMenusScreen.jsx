import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'
import MenuItemTree from './MenuItemTree.jsx'

const LOCATION_LABELS = {
  header:  'Encabezado',
  footer:  'Pie de pagina',
  sidebar: 'Barra lateral',
}

async function apiGet(path, token) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export default function WebsiteMenusScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()

  const [selectedMenuId, setSelectedMenuId] = useState(null)
  const [newMenuOpen, setNewMenuOpen] = useState(false)
  const [newMenuForm, setNewMenuForm] = useState({ name: '', location: 'header' })

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn: () => apiGet('/website/site', token),
    enabled: Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const menusQuery = useQuery({
    queryKey: ['website-menus', siteId, token],
    queryFn: () => apiGet(`/website/menus?siteId=${siteId}`, token),
    enabled: Boolean(token) && Boolean(siteId),
    staleTime: 15_000,
  })

  const menus = menusQuery.data?.data ?? []
  const activeId = selectedMenuId ?? menus[0]?.id ?? null
  const selectedMenu = menus.find((m) => m.id === activeId) ?? null

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }

  const createMenuMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/menus`, {
        method: 'POST', headers, body: JSON.stringify({ ...data, siteId }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`)
      return res.json()
    },
    onSuccess: (menu) => {
      toast.success('Menu creado')
      queryClient.invalidateQueries({ queryKey: ['website-menus', siteId] })
      setSelectedMenuId(menu.id)
      setNewMenuOpen(false)
      setNewMenuForm({ name: '', location: 'header' })
    },
    onError: (err) => toast.error(err.message || 'Error al crear menu'),
  })

  const deleteMenuMutation = useMutation({
    mutationFn: async (menuId) => {
      const res = await fetch(`${getApiUrl()}/website/menus/${menuId}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al eliminar')
    },
    onSuccess: () => {
      toast.success('Menu eliminado')
      setSelectedMenuId(null)
      queryClient.invalidateQueries({ queryKey: ['website-menus', siteId] })
    },
    onError: () => toast.error('Error al eliminar el menu'),
  })

  function handleDeleteMenu(menu) {
    if (!window.confirm(`Eliminar el menu "${menu.name}"?`)) return
    deleteMenuMutation.mutate(menu.id)
  }

  function handleReorder(reorderedItems) {
    queryClient.setQueryData(['website-menus', siteId, token], (prev) => {
      if (!prev?.data) return prev
      return {
        ...prev,
        data: prev.data.map((m) =>
          m.id === activeId ? { ...m, items: reorderedItems } : m
        ),
      }
    })
  }

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
          <h1 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Menus</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Configura la navegacion del sitio publico.
          </p>
        </div>
        <Button onClick={() => setNewMenuOpen(true)}>Nuevo menu</Button>
      </div>

      {menusQuery.isPending ? (
        <div className="text-sm text-[hsl(var(--muted-foreground))]">Cargando menus...</div>
      ) : menus.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-10 text-center space-y-4">
          <p className="text-[hsl(var(--muted-foreground))] text-sm">No hay menus creados.</p>
          <Button variant="outline" size="sm" onClick={() => setNewMenuOpen(true)}>
            Crear primer menu
          </Button>
        </div>
      ) : (
        <div className="flex gap-6">
          <div className="w-48 shrink-0 space-y-1">
            {menus.map((menu) => (
              <button
                key={menu.id}
                onClick={() => setSelectedMenuId(menu.id)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  activeId === menu.id
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium'
                    : 'text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]'
                }`}
              >
                <div className="font-medium truncate">{menu.name}</div>
                <div className={`text-xs mt-0.5 ${activeId === menu.id ? 'opacity-70' : 'text-[hsl(var(--muted-foreground))]'}`}>
                  {LOCATION_LABELS[menu.location] ?? menu.location}
                </div>
              </button>
            ))}
          </div>

          <div className="flex-1 space-y-4">
            {selectedMenu ? (
              <>
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-medium text-[hsl(var(--foreground))]">
                    {selectedMenu.name}
                    <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))] font-normal">
                      ({LOCATION_LABELS[selectedMenu.location] ?? selectedMenu.location})
                    </span>
                  </h2>
                  <button
                    onClick={() => handleDeleteMenu(selectedMenu)}
                    className="text-xs text-[hsl(var(--destructive))] hover:underline"
                  >
                    Eliminar menu
                  </button>
                </div>
                <MenuItemTree
                  menuId={selectedMenu.id}
                  items={selectedMenu.items ?? []}
                  onReorder={handleReorder}
                  onRefresh={() => queryClient.invalidateQueries({ queryKey: ['website-menus', siteId] })}
                />
              </>
            ) : null}
          </div>
        </div>
      )}

      <Dialog open={newMenuOpen} onOpenChange={setNewMenuOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nuevo menu</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); createMenuMutation.mutate(newMenuForm) }}
            className="space-y-4 py-2"
          >
            <div className="space-y-1">
              <Label htmlFor="menu-name">Nombre</Label>
              <Input
                id="menu-name"
                value={newMenuForm.name}
                onChange={(e) => setNewMenuForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Principal"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="menu-location">Ubicacion</Label>
              <select
                id="menu-location"
                value={newMenuForm.location}
                onChange={(e) => setNewMenuForm((f) => ({ ...f, location: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                <option value="header">Encabezado</option>
                <option value="footer">Pie de pagina</option>
                <option value="sidebar">Barra lateral</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewMenuOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMenuMutation.isPending || !newMenuForm.name.trim()}>
                {createMenuMutation.isPending ? 'Creando...' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
