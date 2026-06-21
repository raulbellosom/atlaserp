import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input, SelectField,
} from '@atlas/ui'
import { usePosTerminals } from '../hooks/usePosSettings'
import { useOpenPosSession } from '../hooks/usePosSession'

export default function SessionOpenDialog({ open, onOpenChange, onSuccess }) {
  const { data: terminals = [] } = usePosTerminals()
  const openSession = useOpenPosSession()
  const [terminalId, setTerminalId] = useState('')
  const [amount, setAmount] = useState('0')

  function handleOpen() {
    openSession.mutate(
      { terminal_id: terminalId, opening_cash_amount: parseFloat(amount) || 0 },
      { onSuccess: (data) => { onSuccess?.(data); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Abrir caja</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <SelectField
            value={terminalId}
            onChange={setTerminalId}
            options={terminals.map((t) => ({ value: t.id, label: t.name }))}
            placeholder="Selecciona terminal"
          />
          <div>
            <label className="text-sm font-medium mb-1 block">Efectivo inicial</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleOpen} disabled={!terminalId || openSession.isPending}>
            Abrir caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
