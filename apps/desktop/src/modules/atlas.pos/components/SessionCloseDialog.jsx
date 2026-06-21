import { useState } from 'react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  Button, Input,
} from '@atlas/ui'
import { useClosePosSession } from '../hooks/usePosSession'

export default function SessionCloseDialog({ open, onOpenChange, session, onSuccess }) {
  const close = useClosePosSession()
  const [counted, setCounted] = useState('')
  const [notes, setNotes] = useState('')

  const expected = parseFloat(session?.expected_cash_amount ?? 0)
  const countedNum = parseFloat(counted) || 0
  const diff = countedNum - expected

  function handleClose() {
    close.mutate(
      { id: session.id, counted_cash_amount: countedNum, notes: notes || undefined },
      { onSuccess: (data) => { onSuccess?.(data); onOpenChange(false) } },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Cerrar caja</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Efectivo esperado</span>
              <span className="font-medium">${expected.toFixed(2)}</span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Efectivo contado</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={counted}
              onChange={(e) => setCounted(e.target.value)}
              placeholder="0.00"
            />
          </div>
          {counted !== '' && (
            <div className={`text-sm font-medium ${diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              Diferencia: {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
            </div>
          )}
          <div>
            <label className="text-sm font-medium mb-1 block">Notas (opcional)</label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observaciones del cierre" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleClose}
            disabled={counted === '' || close.isPending}
            variant="destructive"
          >
            Cerrar caja
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
