import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  PageHeader,
  LoadingState,
  ErrorState,
  ConfirmDialog,
  MarkdownViewer,
  AttachmentsPanel,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@atlas/ui'
import { Pencil, Trash2, AlertTriangle, MoreHorizontal, Maximize2 } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import { useInventoryItem, useDeleteInventoryItem } from '../hooks/useInventoryItems.js'
import { InventoryStatusBadge } from '../components/InventoryStatusBadge.jsx'
import { ITEM_TYPES } from '../lib/inventory-constants.js'
import { InventoryAssignmentPanel } from '../components/InventoryAssignmentPanel.jsx'
import { InventoryCommentThread } from '../components/InventoryCommentThread.jsx'

// ── Helpers ───────────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  if (!value) return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[hsl(var(--muted-foreground))]">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

function formatDate(dateStr) {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleDateString('es-PE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function formatCurrency(amount) {
  if (amount == null) return null
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
}

function isWarrantyExpiringSoon(expiryDateStr) {
  if (!expiryDateStr) return false
  const expiry = new Date(expiryDateStr)
  const now = new Date()
  const diffMs = expiry - now
  const diffDays = diffMs / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= 30
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function InventoryItemDetail() {
  const { "*": wildcard } = useParams()
  const id = useMemo(() => (wildcard ?? '').split('/')[1] ?? null, [wildcard])
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { session } = useAuth()
  const token = session?.access_token

  const { data, isLoading } = useInventoryItem(id)
  const deleteItem = useDeleteInventoryItem()

  // Parallel files query — starts at the same time as the entity query so
  // AttachmentsPanel receives prefetched data without an extra round-trip.
  const { data: filesData } = useQuery({
    queryKey: ['inventory-item-files', id],
    queryFn: async () => {
      const res = await fetch(`${getApiUrl()}/inventory/items/${id}/files`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to fetch files')
      return res.json()
    },
    enabled: Boolean(id && token),
    staleTime: 30_000,
  })

  const attachmentsConfig = useMemo(() => ({
    label: 'Archivos',
    listPath: '/inventory/items/:id/files',
    addPath: '/inventory/items/:id/files',
    removePath: '/inventory/items/:id/files/:docId',
    upload: { endpoint: '/files/upload', moduleKey: 'atlas.inventory', entityType: 'InvItem' },
    fields: { fileAssetId: 'fileAssetId' },
    signedUrl: { endpointTemplate: '/files/:fileId/signed-url' },
  }), [])

  if (isLoading) {
    return (
      <div className="p-6">
        <LoadingState />
      </div>
    )
  }

  const item = data?.data ?? data

  if (!item) {
    return (
      <div className="p-6">
        <ErrorState title="Item no encontrado" />
      </div>
    )
  }

  const handleDelete = async () => {
    await deleteItem.mutateAsync(id)
    toast.success('Activo eliminado correctamente')
    navigate('/app/m/atlas.inventory/inventory')
  }

  const customEntries = item.customValues
    ? Object.entries(item.customValues).filter(([, v]) => v != null && v !== '')
    : []

  const warrantySoon = isWarrantyExpiringSoon(item.warrantyExpiry)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <PageHeader
        eyebrow={item.assetTag}
        title={item.name}
        actions={
          <div className="flex items-center gap-2">
            <InventoryStatusBadge status={item.status} size="sm" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/app/m/atlas.inventory/inventory/${id}/edit`)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    const el = document.documentElement
                    if (!document.fullscreenElement) {
                      el.requestFullscreen?.()
                    } else {
                      document.exitFullscreen?.()
                    }
                  }}
                >
                  <Maximize2 className="mr-2 h-4 w-4" />
                  Pantalla completa
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => setDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar activo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        }
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {/* Left panel — item info (2/3) */}
        <div className="md:col-span-2 space-y-4">

          {/* Section 1 — Core info */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Informacion general</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-[hsl(var(--muted-foreground))]">Tag de activo</span>
                <code className="text-sm font-mono">{item.assetTag}</code>
              </div>
              <DetailRow label="Nombre" value={item.name} />
              <DetailRow label="Tipo" value={ITEM_TYPES.find(t => t.value === item.itemType)?.label ?? item.itemType} />
              <DetailRow label="Categoria" value={item.category?.name} />
              <DetailRow label="Marca" value={item.brand?.name} />
              <DetailRow label="Modelo" value={item.model} />
              <DetailRow label="Numero de serie" value={item.serialNumber} />
            </div>
          </Card>

          {/* Section 2 — Location & Purchase */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Ubicacion y compra</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DetailRow label="Ubicacion" value={item.location?.name} />
              <DetailRow label="Fecha de compra" value={formatDate(item.purchaseDate)} />
              <DetailRow label="Precio de compra" value={formatCurrency(item.purchasePrice)} />
              <DetailRow label="Proveedor" value={item.vendorName} />
              <DetailRow label="Numero de factura" value={item.invoiceNumber} />
            </div>
          </Card>

          {/* Section 3 — Warranty */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Garantia</h3>
              {warrantySoon && (
                <span className="flex items-center gap-1 text-xs text-amber-600">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Vence pronto
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DetailRow label="Vencimiento de garantia" value={formatDate(item.warrantyExpiry)} />
              {item.warrantyNotes && (
                <div className="col-span-2 flex flex-col gap-1">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Notas de garantia</span>
                  <MarkdownViewer value={item.warrantyNotes} />
                </div>
              )}
            </div>
          </Card>

          {/* Section 4 — Notes */}
          {item.notes && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Notas</h3>
              <MarkdownViewer value={item.notes} />
            </Card>
          )}

          {/* Section 5 — Custom fields */}
          {customEntries.length > 0 && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Campos personalizados</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {customEntries.map(([key, value]) => (
                  <DetailRow key={key} label={key} value={String(value)} />
                ))}
              </div>
            </Card>
          )}

          {/* Section 6 — Files (read-only, grid/list toggle) */}
          <Card className="p-4">
            <AttachmentsPanel
              apiBaseUrl={getApiUrl()}
              token={token}
              recordId={item.id}
              config={attachmentsConfig}
              context="detail"
              readOnly
              showHeading
              showViewToggle
              defaultViewMode="grid"
              prefetchedData={filesData?.data}
            />
          </Card>
        </div>

        {/* Right panel — assignment + comments (1/3) */}
        <div className="space-y-4">
          <InventoryAssignmentPanel item={item} />
          <InventoryCommentThread itemId={item.id} />
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar activo"
        description={`Esta accion eliminara permanentemente "${item.name}" (${item.assetTag}). No se puede deshacer.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </div>
  )
}
