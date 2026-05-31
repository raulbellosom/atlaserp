// apps/desktop/src/modules/atlas.catalog/components/StockMovementModal.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, Input, Label } from '@atlas/ui'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

export default function StockMovementModal({ open, onClose, token, productId, variantId = null, variantLabel = null }) {
  const queryClient = useQueryClient()
  const [delta, setDelta]   = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote]     = useState('')

  const mutation = useMutation({
    mutationFn: () => atlas.catalog.recordStockMovement(productId, {
      variant_id:     variantId ?? undefined,
      quantity_delta: Number(delta),
      reason:         reason || undefined,
      note:           note   || undefined,
    }, token),
    onSuccess: () => {
      toast.success('Ajuste registrado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stock-movements', productId] })
      setDelta(''); setReason(''); setNote('')
      onClose()
    },
    onError: (err) => toast.error(err?.message ?? 'Error al registrar ajuste'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    if (!delta || Number(delta) === 0) return toast.error('El delta no puede ser cero')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Registrar ajuste de stock</DialogTitle>
        </DialogHeader>
        {variantLabel && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Variante: <strong className="text-[hsl(var(--foreground))]">{variantLabel}</strong>
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sm-delta">Cantidad (+ entrada / - salida)</Label>
            <Input id="sm-delta" type="number" placeholder="ej. 10 o -3" value={delta} onChange={e => setDelta(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-reason">Razon</Label>
            <select
              id="sm-reason"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-2 text-sm text-[hsl(var(--foreground))]"
              value={reason}
              onChange={e => setReason(e.target.value)}
            >
              <option value="">Sin razon especifica</option>
              <option value="Ajuste manual">Ajuste manual</option>
              <option value="Compra">Compra</option>
              <option value="Venta">Venta</option>
              <option value="Devolucion">Devolucion</option>
              <option value="Merma">Merma</option>
              <option value="Inventario fisico">Inventario fisico</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sm-note">Nota (opcional)</Label>
            <Input id="sm-note" value={note} onChange={e => setNote(e.target.value)} placeholder="Detalle adicional..." />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Guardando...' : 'Registrar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
