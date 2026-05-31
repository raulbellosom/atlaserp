import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../auth/AuthProvider.jsx'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  Button, Badge, PageHeader,
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
  ActionMenu, ConfirmDialog, Switch, Skeleton,
  EmptyState,
} from '@atlas/ui'
import { Globe, FileText, Pencil, Plus, LayoutTemplate } from 'lucide-react'
import { toast } from 'sonner'
import WebsiteNewPageDialog from './WebsiteNewPageDialog.jsx'
import { TemplatePickerModal } from '../../../website/TemplatePickerModal.jsx'

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

const STATUS_BADGE = {
  draft:     { label: 'Borrador',  variant: 'secondary' },
  published: { label: 'Publicado', variant: 'success'   },
  archived:  { label: 'Archivado', variant: 'outline'   },
}

export default function WebsitePagesScreen() {
  const { session } = useAuth()
  const token = session?.access_token
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [newPageOpen,      setNewPageOpen]      = useState(false)
  const [templateOpen,     setTemplateOpen]     = useState(false)
  const [confirmDelete,    setConfirmDelete]    = useState(null) // page object | null

  const siteQuery = useQuery({
    queryKey: ['website-site', token],
    queryFn:  () => apiFetch('/website/site', token),
    enabled:  Boolean(token),
    staleTime: 60_000,
  })
  const siteId = siteQuery.data?.data?.id ?? null

  const pagesQuery = useQuery({
    queryKey: ['website-pages', siteId, token],
    queryFn:  () => apiFetch(`/website/pages?siteId=${siteId}&pageSize=100`, token),
    enabled:  Boolean(token) && Boolean(siteId),
    staleTime: 30_000,
  })

  const publishMutation = useMutation({
    mutationFn: (pageId) => apiFetch(`/website/pages/${pageId}/publish`, token, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Pagina publicada')
      queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })
    },
    onError: (err) => toast.error(err.message || 'Error al publicar'),
  })

  const unpublishMutation = useMutation({
    mutationFn: (pageId) => apiFetch(`/website/pages/${pageId}`, token, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'draft' }),
    }),
    onSuccess: () => {
      toast.success('Pagina marcada como borrador')
      queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })
    },
    onError: (err) => toast.error(err.message || 'Error al despublicar'),
  })

  const deleteMutation = useMutation({
    mutationFn: (pageId) => apiFetch(`/website/pages/${pageId}`, token, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Pagina eliminada')
      setConfirmDelete(null)
      queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })
    },
    onError: (err) => toast.error(err.message || 'Error al eliminar'),
  })

  function handleEdit(page) {
    // Navigate to public website at the page route with ?edit=1 so EditorContextBar
    // renders in the correct context (no AppShell navbar overlap)
    navigate(`${page.routePath}?edit=1`)
  }

  function handlePublishToggle(page) {
    if (page.status === 'published') {
      unpublishMutation.mutate(page.id)
    } else {
      publishMutation.mutate(page.id)
    }
  }

  function getRowActionItems(page) {
    const isPublished = page.status === 'published'
    const isBusy = publishMutation.isPending || unpublishMutation.isPending
    return [
      {
        label:   'Editar',
        icon:    Pencil,
        onClick: () => handleEdit(page),
      },
      {
        label:    isPublished ? 'Despublicar' : 'Publicar',
        icon:     Globe,
        disabled: isBusy,
        onClick:  () => handlePublishToggle(page),
      },
      {
        label:    'Eliminar',
        variant:  'destructive',
        disabled: deleteMutation.isPending,
        onClick:  () => setConfirmDelete(page),
      },
    ]
  }

  if (siteQuery.isPending) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  const pages = pagesQuery.data?.data ?? []

  return (
    <div className="flex flex-col min-h-full">
      <div className="p-6 space-y-6">
        <PageHeader
          eyebrow="Sitio web"
          title="Paginas"
          description="Gestiona las paginas del sitio publico."
          actions={
            siteId && (
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setTemplateOpen(true)}>
                  <LayoutTemplate className="h-4 w-4 mr-1.5" />
                  Desde plantilla
                </Button>
                <Button size="sm" onClick={() => setNewPageOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Nueva pagina
                </Button>
              </div>
            )
          }
        />

        {!siteId ? (
          <EmptyState
            icon={Globe}
            title="Sin sitio web configurado"
            description='Configura tu sitio web primero desde la seccion "Sitio web".'
          />
        ) : pagesQuery.isPending ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
          </div>
        ) : pages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin paginas"
            description="Crea tu primera pagina desde una plantilla o desde cero."
            actions={
              <div className="flex items-center gap-3 justify-center">
                <Button onClick={() => setTemplateOpen(true)}>
                  <LayoutTemplate className="h-4 w-4 mr-1.5" />
                  Empezar desde plantilla
                </Button>
                <Button variant="outline" onClick={() => setNewPageOpen(true)}>
                  Pagina en blanco
                </Button>
              </div>
            }
          />
        ) : (
          <div className="rounded-xl border border-[hsl(var(--border))] overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titulo</TableHead>
                  <TableHead>Ruta</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-20 text-center">Publicar</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((page) => {
                  const badgeMeta  = STATUS_BADGE[page.status] ?? { label: page.status, variant: 'outline' }
                  const isPublished = page.status === 'published'
                  const isBusy     = publishMutation.isPending || unpublishMutation.isPending

                  return (
                    <TableRow key={page.id} className="cursor-default">
                      <TableCell className="font-medium">
                        <button
                          onClick={() => handleEdit(page)}
                          className="hover:text-[hsl(var(--primary))] hover:underline transition-colors text-left"
                        >
                          {page.title}
                        </button>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-[hsl(var(--muted-foreground))]">
                        {page.routePath}
                      </TableCell>
                      <TableCell>
                        <Badge variant={badgeMeta.variant}>{badgeMeta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={isPublished}
                          disabled={isBusy}
                          onCheckedChange={() => handlePublishToggle(page)}
                          aria-label={isPublished ? 'Despublicar pagina' : 'Publicar pagina'}
                        />
                      </TableCell>
                      <TableCell>
                        <ActionMenu items={getRowActionItems(page)} />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <WebsiteNewPageDialog
        siteId={siteId}
        open={newPageOpen}
        onOpenChange={setNewPageOpen}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })}
      />

      <TemplatePickerModal
        isOpen={templateOpen}
        onClose={() => setTemplateOpen(false)}
        token={token}
        siteId={siteId}
        onHomePageApplied={() => {
          setTemplateOpen(false)
          queryClient.invalidateQueries({ queryKey: ['website-pages', siteId] })
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmDelete)}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}
        title="Eliminar pagina"
        description={`Se eliminara permanentemente la pagina "${confirmDelete?.title}". Esta accion no se puede deshacer.`}
        confirmLabel="Eliminar"
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(confirmDelete?.id)}
      />
    </div>
  )
}
