import { useState } from 'react'
import { CreditCard, Banknote, Smartphone, Check, Receipt, SplitSquareHorizontal } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
  Button, Label, Separator,
  TextField,
} from '@atlas/ui'
import { usePosPaymentMethods } from '../hooks/usePosSettings'
import { useAddPosPayment } from '../hooks/usePosOrder'
import SplitBillDialog from './SplitBillDialog'

const METHOD_ICONS = { CASH: Banknote, cash: Banknote, CARD: CreditCard, card: CreditCard, TRANSFER: Smartphone, transfer: Smartphone }

export default function PaymentDialog({ open, onOpenChange, order, onSuccess, sessionId = null }) {
  const { data: methods = [] } = usePosPaymentMethods()
  const addPayment = useAddPosPayment()
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [mode, setMode] = useState('full') // 'full' | 'split'

  const totalDue = parseFloat(order?.totalAmount ?? 0) - parseFloat(order?.paidAmount ?? 0)
  const amountNum = parseFloat(amount) || 0
  const change = amount !== '' && amountNum > totalDue ? amountNum - totalDue : 0

  const enabledMethods = Array.isArray(methods) ? methods.filter((m) => m.enabled) : []

  function handlePay() {
    if (!selectedMethod) return
    const payAmount = amount === '' ? totalDue : amountNum
    addPayment.mutate(
      {
        orderId: order.id,
        paymentMethodId: selectedMethod,
        amount: payAmount,
        ...(sessionId ? { sessionId } : {}),
      },
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

  function handleClose() {
    setAmount('')
    setSelectedMethod(null)
    setMode('full')
    onOpenChange(false)
  }

  if (mode === 'split') {
    return (
      <SplitBillDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setMode('full')
          onOpenChange(next)
        }}
        order={order}
        paymentMethodId={selectedMethod}
        sessionId={sessionId}
        onFullyPaid={() => onSuccess?.()}
      />
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Cobrar orden #{order?.orderNumber}</DialogTitle>
          <DialogDescription>
            Total a cobrar:{' '}
            <span className="font-semibold text-foreground">${totalDue.toFixed(2)}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex rounded-md border border-border overflow-hidden self-start">
          <Button
            variant="ghost" size="sm"
            className={`rounded-none px-3 gap-1.5 ${mode === 'full' ? 'bg-muted' : ''}`}
            onClick={() => setMode('full')}
          >
            <Receipt size={14} />
            <span className="text-xs">Mesa completa</span>
          </Button>
          <Button
            variant="ghost" size="sm"
            className={`rounded-none px-3 gap-1.5 border-l border-border ${mode === 'split' ? 'bg-muted' : ''}`}
            onClick={() => setMode('split')}
          >
            <SplitSquareHorizontal size={14} />
            <span className="text-xs">Dividir cuenta</span>
          </Button>
        </div>

        <div className="flex flex-col gap-5 py-1">
          {/* Payment method selection */}
          <div className="flex flex-col gap-2">
            <Label>Método de pago</Label>
            {enabledMethods.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4 border border-dashed border-border rounded-lg">
                Sin métodos de pago configurados
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {enabledMethods.map((m) => {
                  const Icon = METHOD_ICONS[m.kind] ?? METHOD_ICONS[m.type] ?? CreditCard
                  const isSelected = selectedMethod === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSelectedMethod(m.id)}
                      className={[
                        'relative flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm font-medium transition-all duration-150 cursor-pointer text-left',
                        isSelected
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-border hover:border-primary/40 hover:bg-muted/50 text-foreground',
                      ].join(' ')}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="truncate">{m.name}</span>
                      {isSelected && (
                        <Check size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-primary" />
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <Separator />

          {/* Amount */}
          <div className="flex flex-col gap-2">
            <TextField
              label="Monto recibido"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={totalDue.toFixed(2)}
              hint="Deja vacío para cobrar el monto exacto"
            />
            {change > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-green-50 border border-green-200 px-3 py-2">
                <span className="text-sm font-medium text-green-700">Cambio</span>
                <span className="text-sm font-bold text-green-700 tabular-nums">${change.toFixed(2)}</span>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancelar</Button>
          <Button
            onClick={handlePay}
            disabled={!selectedMethod || (amount !== '' && amountNum < totalDue) || addPayment.isPending}
          >
            {addPayment.isPending ? 'Procesando...' : 'Confirmar cobro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
