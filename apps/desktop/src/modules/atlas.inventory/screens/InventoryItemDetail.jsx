import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Button,
  Card,
  PageHeader,
  LoadingState,
  ErrorState,
  ConfirmDialog,
} from '@atlas/ui'
import { Pencil, Trash2, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { useInventoryItem, useDeleteInventoryItem } from '../hooks/useInventoryItems.js'
import { InventoryStatusBadge } from '../components/InventoryStatusBadge.jsx'

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
  const { id } = useParams()
  const navigate = useNavigate()
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data, isLoading } = useInventoryItem(id)
  const deleteItem = useDeleteInventoryItem()

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
            <Button
              variant="outline"
              size="sm"
              className="text-destructive hover:bg-destructive/10"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar
            </Button>
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
              <DetailRow label="Categoria" value={item.category} />
              <DetailRow label="Marca" value={item.brand} />
              <DetailRow label="Modelo" value={item.model} />
              <DetailRow label="Numero de serie" value={item.serialNumber} />
            </div>
          </Card>

          {/* Section 2 — Location & Purchase */}
          <Card className="p-4 space-y-3">
            <h3 className="text-sm font-medium">Ubicacion y compra</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <DetailRow label="Ubicacion" value={item.location} />
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
                <div className="col-span-2 flex flex-col gap-0.5">
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">Notas de garantia</span>
                  <p className="text-sm whitespace-pre-wrap">{item.warrantyNotes}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Section 4 — Notes */}
          {item.notes && (
            <Card className="p-4 space-y-3">
              <h3 className="text-sm font-medium">Notas</h3>
              <p className="text-sm whitespace-pre-wrap text-[hsl(var(--foreground))]">{item.notes}</p>
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
        </div>

        {/* Right panel — Phase 2A placeholders (1/3) */}
        <div className="space-y-4">
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Asignacion</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Panel de asignacion disponible en la siguiente fase.</p>
          </Card>
          <Card className="p-4">
            <h3 className="text-sm font-medium mb-3">Comentarios</h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Comentarios disponibles en la siguiente fase.</p>
          </Card>
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
