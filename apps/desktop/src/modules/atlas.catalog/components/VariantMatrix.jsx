// apps/desktop/src/modules/atlas.catalog/components/VariantMatrix.jsx
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Input, cn } from '@atlas/ui'
import { Plus, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { atlas } from '../../../lib/atlas.js'

export default function VariantMatrix({ token, productId, variants = [] }) {
  const queryClient  = useQueryClient()
  const [edits, setEdits] = useState({})

  const updateMutation = useMutation({
    mutationFn: ({ variantId, data }) => atlas.catalog.updateVariant(productId, variantId, data, token),
    onSuccess: (_, { variantId }) => {
      setEdits(prev => { const n = { ...prev }; delete n[variantId]; return n })
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
      toast.success('Variante guardada')
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const createMutation = useMutation({
    mutationFn: (data) => atlas.catalog.createVariant(productId, data, token),
    onSuccess: () => {
      toast.success('Variante creada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  const deleteMutation = useMutation({
    mutationFn: (variantId) => atlas.catalog.deleteVariant(productId, variantId, token),
    onSuccess: () => {
      toast.success('Variante eliminada')
      queryClient.invalidateQueries({ queryKey: ['catalog-product', productId] })
    },
    onError: err => toast.error(err?.message ?? 'Error'),
  })

  function edit(variantId, field, value) {
    setEdits(prev => ({ ...prev, [variantId]: { ...(prev[variantId] ?? {}), [field]: value } }))
  }

  function getLabel(optionValues) {
    if (!optionValues || typeof optionValues !== 'object') return 'Default'
    return Object.values(optionValues).filter(Boolean).join(' / ') || 'Default'
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
        Variantes ({variants.length})
      </p>

      {variants.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Define las opciones arriba y agrega variantes aqui.
        </p>
      ) : (
        <div className="rounded-2xl border border-[hsl(var(--border))] overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Variante</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">SKU</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Cod. barras</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Precio</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-[hsl(var(--muted-foreground))]">Stock</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]">
              {variants.map(v => {
                const e       = edits[v.id] ?? {}
                const isDirty = Boolean(edits[v.id])
                return (
                  <tr key={v.id} className={cn('transition-colors', isDirty && 'bg-blue-50/30 dark:bg-blue-900/10')}>
                    <td className="px-4 py-2 font-medium text-sm">{getLabel(v.option_values)}</td>
                    <td className="px-4 py-2">
                      <Input value={e.sku ?? v.sku ?? ''} onChange={ev => edit(v.id, 'sku', ev.target.value)} className="h-7 w-28 text-xs" placeholder="SKU" />
                    </td>
                    <td className="px-4 py-2">
                      <Input value={e.barcode ?? v.barcode ?? ''} onChange={ev => edit(v.id, 'barcode', ev.target.value)} className="h-7 w-32 text-xs" placeholder="EAN/UPC" />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min="0" step="0.01" value={e.price ?? v.price ?? 0} onChange={ev => edit(v.id, 'price', Number(ev.target.value))} className="h-7 w-24 text-xs" />
                    </td>
                    <td className="px-4 py-2">
                      <Input type="number" min="0" value={e.stock ?? v.stock ?? 0} onChange={ev => edit(v.id, 'stock', Number(ev.target.value))} className="h-7 w-20 text-xs" />
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        {isDirty && (
                          <button
                            type="button"
                            onClick={() => updateMutation.mutate({ variantId: v.id, data: edits[v.id] })}
                            disabled={updateMutation.isPending}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-emerald-100 hover:text-emerald-700 transition-colors"
                          >
                            <Save className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { if (window.confirm('Eliminar esta variante?')) deleteMutation.mutate(v.id) }}
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <Button variant="outline" size="sm" onClick={() => createMutation.mutate({ option_values: {}, price: 0, stock: 0 })} disabled={createMutation.isPending}>
        <Plus className="h-4 w-4 mr-1" /> Agregar variante
      </Button>
    </div>
  )
}
