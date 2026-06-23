import { useState, useEffect } from 'react'
import { Minus, Plus, Trash2 } from 'lucide-react'
import {
  Button, Textarea, Label,
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Sheet, SheetContent, SheetTitle,
  ConfirmDialog,
} from '@atlas/ui'
import { useIsDesktop } from '../../../hooks/useIsDesktop'
import { useUpdatePosOrderLine, useDeletePosOrderLine } from '../hooks/usePosOrder'

function LineEditContent({ line, onSave, onDelete, onClose, saving, deleting, isSheet = false }) {
  const [qty, setQty] = useState(parseFloat(line.quantity) || 1)
  const [note, setNote] = useState(line.note ?? '')
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    setQty(parseFloat(line.quantity) || 1)
    setNote(line.note ?? '')
  }, [line.id, line.quantity, line.note])

  function decrement() { setQty((q) => Math.max(1, q - 1)) }
  function increment() { setQty((q) => q + 1) }

  function handleSave() {
    onSave({ qty, note: note.trim() || null })
  }

  const isDirty = qty !== parseFloat(line.quantity) || (note.trim() || null) !== (line.note ?? null)

  return (
    <div className="flex flex-col gap-6">
      {/* Price reference */}
      <p className="text-sm text-muted-foreground -mt-1">
        ${parseFloat(line.unitPrice ?? 0).toFixed(2)} c/u
      </p>

      {/* Quantity stepper — large touch targets for tablet */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">Cantidad</Label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={decrement}
            disabled={qty <= 1}
            className="h-14 w-14 rounded-2xl border-2 border-border bg-muted/50 flex items-center justify-center text-foreground hover:bg-muted active:scale-95 transition-all disabled:opacity-30 disabled:pointer-events-none touch-manipulation"
            aria-label="Reducir"
          >
            <Minus size={22} strokeWidth={2.5} />
          </button>

          <span className="flex-1 text-center text-4xl font-bold tabular-nums tracking-tight select-none">
            {qty}
          </span>

          <button
            type="button"
            onClick={increment}
            className="h-14 w-14 rounded-2xl border-2 border-primary bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 active:scale-95 transition-all touch-manipulation"
            aria-label="Aumentar"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* Note */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          Instrucciones especiales
          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(opcional)</span>
        </Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Ej: sin cebolla, extra salsa, término medio..."
          maxLength={500}
          rows={3}
          className="resize-none text-sm"
        />
        {note.length > 0 && (
          <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
        )}
      </div>

      {/* Actions */}
      {isSheet ? (
        <div className="flex flex-col gap-2 pt-1">
          <Button className="w-full h-12" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
          <Button
            variant="outline"
            className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
            onClick={() => setDeleteConfirm(true)}
            disabled={deleting}
          >
            <Trash2 size={15} />
            Eliminar producto
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" size="sm" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/8 gap-1.5 mr-auto"
            onClick={() => setDeleteConfirm(true)}
            disabled={deleting}
          >
            <Trash2 size={14} />
            Eliminar
          </Button>
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !isDirty}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={deleteConfirm}
        onOpenChange={setDeleteConfirm}
        title="Eliminar producto"
        description={`¿Eliminar "${line.productName}" de la orden?`}
        confirmLabel="Eliminar"
        variant="destructive"
        onConfirm={() => { setDeleteConfirm(false); onDelete() }}
      />
    </div>
  )
}

export default function LineEditSheet({ line, orderId, open, onOpenChange }) {
  const isDesktop = useIsDesktop()
  const updateLine = useUpdatePosOrderLine()
  const deleteLine = useDeletePosOrderLine()

  if (!line) return null

  function handleSave({ qty, note }) {
    updateLine.mutate(
      { orderId, lineId: line.id, quantity: qty, note },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  function handleDelete() {
    deleteLine.mutate(
      { orderId, lineId: line.id },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  const title = line.productName

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle className="text-base">{title}</DialogTitle>
          </DialogHeader>
          <LineEditContent
            line={line}
            onSave={handleSave}
            onDelete={handleDelete}
            onClose={() => onOpenChange(false)}
            saving={updateLine.isPending}
            deleting={deleteLine.isPending}
          />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" aria-describedby={undefined} className="pb-8 max-h-[85dvh] overflow-y-auto">
        <SheetTitle className="text-base mb-4">{title}</SheetTitle>
        <LineEditContent
          isSheet
          line={line}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => onOpenChange(false)}
          saving={updateLine.isPending}
          deleting={deleteLine.isPending}
        />
      </SheetContent>
    </Sheet>
  )
}
