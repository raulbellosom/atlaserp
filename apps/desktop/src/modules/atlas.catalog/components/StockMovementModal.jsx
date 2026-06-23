// apps/desktop/src/modules/atlas.catalog/components/StockMovementModal.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Button, Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
  NumberField, SelectField, TextField, cn,
} from '@atlas/ui'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

const REASON_NONE = '__none__'

const REASON_OPTIONS = [
  { value: REASON_NONE,         label: 'Sin razón específica' },
  { value: 'Ajuste manual',     label: 'Ajuste manual' },
  { value: 'Compra',            label: 'Compra' },
  { value: 'Venta',             label: 'Venta' },
  { value: 'Devolución',        label: 'Devolución' },
  { value: 'Merma',             label: 'Merma' },
  { value: 'Inventario físico', label: 'Inventario físico' },
]

export default function StockMovementModal({ open, onClose, token, productId, variantId = null, variantLabel = null }) {
  const queryClient = useQueryClient()
  const [direction, setDirection] = useState('entrada')
  const [qty,       setQty]       = useState('')
  const [reason,    setReason]    = useState(REASON_NONE)
  const [note,      setNote]      = useState('')

  const isEntrada = direction === 'entrada'
  const delta     = qty ? (isEntrada ? Number(qty) : -Number(qty)) : 0

  const mutation = useMutation({
    mutationFn: () => atlas.catalog.recordStockMovement(productId, {
      variant_id:     variantId ?? undefined,
      quantity_delta: delta,
      reason:         reason === REASON_NONE ? undefined : reason,
      note:           note   || undefined,
    }, token),
    onSuccess: () => {
      toast.success('Ajuste registrado')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      queryClient.invalidateQueries({ queryKey: ['catalog-stock-movements', productId] })
      setDirection('entrada'); setQty(''); setReason(REASON_NONE); setNote('')
      onClose()
    },
    onError: (err) => toast.error(err?.message ?? 'Error al registrar ajuste'),
  })

  function handleSubmit(e) {
    e.preventDefault()
    const n = Number(qty)
    if (!qty || isNaN(n) || n <= 0) return toast.error('La cantidad debe ser mayor a cero')
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Registrar ajuste de stock</DialogTitle>
        </DialogHeader>

        {variantLabel && (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Variante: <strong className="text-[hsl(var(--foreground))]">{variantLabel}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Direction + quantity row */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Movimiento</p>

            {/* Segmented control */}
            <div className="flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-1 gap-1">
              <button
                type="button"
                onClick={() => setDirection('entrada')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
                  isEntrada
                    ? 'bg-emerald-500 text-white shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                <ArrowUp className="h-4 w-4" />
                Entrada
              </button>
              <button
                type="button"
                onClick={() => setDirection('salida')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-150',
                  !isEntrada
                    ? 'bg-red-500 text-white shadow-sm'
                    : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
                )}
              >
                <ArrowDown className="h-4 w-4" />
                Salida
              </button>
            </div>

            {/* Quantity input */}
            <NumberField
              label="Cantidad"
              value={qty}
              onChange={e => setQty(e.target.value)}
              min={1}
              step={1}
              placeholder="Ej. 10"
              required
              description={
                qty && Number(qty) > 0
                  ? `Resultado: ${isEntrada ? '+' : '-'}${Number(qty)} unidades`
                  : 'Ingresa un número entero positivo'
              }
            />
          </div>

          <SelectField
            label="Razón"
            options={REASON_OPTIONS}
            value={reason}
            onValueChange={v => setReason(v)}
            placeholder="Sin razón específica"
          />

          <TextField
            label="Nota (opcional)"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Detalle adicional del ajuste..."
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button
              type="submit"
              disabled={mutation.isPending}
              className={cn(!isEntrada && 'bg-red-500 hover:bg-red-600')}
            >
              {mutation.isPending
                ? 'Guardando...'
                : isEntrada ? 'Registrar entrada' : 'Registrar salida'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
