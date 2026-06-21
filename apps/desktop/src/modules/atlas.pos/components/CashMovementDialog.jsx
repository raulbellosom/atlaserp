import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, SelectField,
} from '@atlas/ui'
import { useAddCashMovement } from '../hooks/usePosSession'

const KIND_OPTIONS = [
  { value: 'IN', label: 'Entrada de efectivo' },
  { value: 'OUT', label: 'Salida de efectivo' },
]

export default function CashMovementDialog({ open, onOpenChange, sessionId }) {
  const addMovement = useAddCashMovement()
  const [kind, setKind] = useState('IN')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')

  function handleSave() {
    addMovement.mutate(
      { sessionId, kind, amount: parseFloat(amount), reason },
      { onSuccess: () => { onOpenChange(false); setAmount(''); setReason(''); setKind('IN') } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Movimiento de efectivo</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <SelectField value={kind} onChange={setKind} options={KIND_OPTIONS} />
          <div>
            <label className="text-sm font-medium mb-1 block">Monto</label>
            <Input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Motivo</label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej. Cambio de turno" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!amount || !reason || addMovement.isPending}>
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
