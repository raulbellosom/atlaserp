import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input,
} from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { useAddPosPayment } from '../hooks/usePosOrder'

function usePosPaymentMethods() {
  const { session } = useAuth()
  const token = session?.access_token
  return useQuery({
    queryKey: ['pos', 'payment-methods'],
    queryFn: async () => {
      const base = import.meta.env.VITE_ATLAS_API_URL ?? ''
      const res = await fetch(`${base}/pos/payment-methods`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Error al cargar métodos de pago')
      return res.json()
    },
    enabled: Boolean(token),
    staleTime: 10 * 60 * 1000,
  })
}

export default function PaymentDialog({ open, onOpenChange, order, onSuccess }) {
  const { data: methods = [] } = usePosPaymentMethods()
  const addPayment = useAddPosPayment()
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')

  const totalDue = parseFloat(order?.total_amount ?? 0) - parseFloat(order?.paid_amount ?? 0)
  const amountNum = parseFloat(amount) || 0

  const enabledMethods = Array.isArray(methods) ? methods.filter((m) => m.enabled) : []

  function handlePay() {
    if (!selectedMethod) return
    const payAmount = amount === '' ? totalDue : amountNum
    addPayment.mutate(
      { orderId: order.id, payment_method_id: selectedMethod, amount: payAmount },
      {
        onSuccess: (data) => {
          setAmount('')
          setSelectedMethod(null)
          onSuccess?.(data)
          onOpenChange(false)
        },
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cobro — ${totalDue.toFixed(2)}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="grid grid-cols-2 gap-2">
            {enabledMethods.length === 0 ? (
              <p className="col-span-2 text-sm text-muted-foreground text-center">
                Sin métodos de pago configurados
              </p>
            ) : (
              enabledMethods.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMethod(m.id)}
                  className={`rounded-lg border p-3 text-sm font-medium transition-colors ${
                    selectedMethod === m.id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  {m.name}
                </button>
              ))
            )}
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Monto recibido (vacío = exacto)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={totalDue.toFixed(2)}
            />
            {amount !== '' && amountNum > totalDue && (
              <p className="text-xs text-green-600 mt-1">
                Cambio: ${(amountNum - totalDue).toFixed(2)}
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handlePay}
            disabled={!selectedMethod || (amount !== '' && amountNum < totalDue) || addPayment.isPending}
          >
            Confirmar cobro
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
