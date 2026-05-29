import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@atlas/ui'
import { Button, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'

const PAGE_TYPES = [
  { value: 'page',    label: 'Pagina estandar' },
  { value: 'landing', label: 'Landing page' },
  { value: 'system',  label: 'Sistema' },
]

const VISIBILITY_OPTIONS = [
  { value: 'public',        label: 'Publica' },
  { value: 'authenticated', label: 'Solo usuarios autenticados' },
  { value: 'private',       label: 'Privada' },
]

function toSlug(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function WebsiteNewPageDialog({ siteId, open, onOpenChange, onCreated }) {
  const { session } = useAuth()
  const token = session?.access_token

  const [form, setForm] = useState({
    title: '',
    slug: '',
    routePath: '/',
    pageType: 'page',
    visibility: 'public',
  })
  const [slugTouched, setSlugTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      setForm({ title: '', slug: '', routePath: '/', pageType: 'page', visibility: 'public' })
      setSlugTouched(false)
    }
  }, [open])

  useEffect(() => {
    if (!slugTouched && form.title) {
      const slug = toSlug(form.title)
      setForm((f) => ({ ...f, slug, routePath: slug ? `/${slug}` : '/' }))
    }
  }, [form.title, slugTouched])

  function handleSlugChange(e) {
    setSlugTouched(true)
    const slug = e.target.value
    setForm((f) => ({ ...f, slug, routePath: slug ? `/${slug}` : '/' }))
  }

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`${getApiUrl()}/website/pages`, {
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
    onSuccess: (page) => {
      toast.success('Pagina creada')
      onCreated(page)
      onOpenChange(false)
    },
    onError: (err) => toast.error(err.message || 'Error al crear la pagina'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.title.trim() || !form.slug.trim()) return
    createMutation.mutate({
      siteId,
      title:      form.title.trim(),
      slug:       form.slug.trim(),
      routePath:  form.routePath || `/${form.slug.trim()}`,
      pageType:   form.pageType,
      visibility: form.visibility,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nueva pagina</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="page-title">Titulo</Label>
            <Input
              id="page-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Mi pagina"
              required
              autoFocus
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="page-slug">Slug (URL)</Label>
            <Input
              id="page-slug"
              value={form.slug}
              onChange={handleSlugChange}
              placeholder="mi-pagina"
              required
            />
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              Ruta: <span className="font-mono">{form.routePath || '/'}</span>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="page-type">Tipo</Label>
              <select
                id="page-type"
                value={form.pageType}
                onChange={(e) => setForm((f) => ({ ...f, pageType: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                {PAGE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="page-visibility">Visibilidad</Label>
              <select
                id="page-visibility"
                value={form.visibility}
                onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-[hsl(var(--ring))]"
              >
                {VISIBILITY_OPTIONS.map((v) => (
                  <option key={v.value} value={v.value}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || !form.title.trim() || !form.slug.trim()}
            >
              {createMutation.isPending ? 'Creando...' : 'Crear pagina'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
