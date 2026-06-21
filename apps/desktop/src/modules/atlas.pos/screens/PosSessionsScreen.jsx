import { useState } from 'react'
import {
  PageHeader, Card, CardContent, CardHeader, CardTitle,
  Badge, Button, EmptyState,
} from '@atlas/ui'
import { usePosSessions } from '../hooks/usePosSession'
import SessionOpenDialog from '../components/SessionOpenDialog'
import SessionCloseDialog from '../components/SessionCloseDialog'
import CashMovementDialog from '../components/CashMovementDialog'

const STATUS_LABELS = { OPEN: 'Abierta', CLOSED: 'Cerrada', CANCELLED: 'Cancelada' }
const STATUS_VARIANTS = { OPEN: 'default', CLOSED: 'secondary', CANCELLED: 'destructive' }

export default function PosSessionsScreen() {
  const { data: sessions = [], isLoading } = usePosSessions({ limit: 20 })
  const [openDialog, setOpenDialog] = useState(false)
  const [closeTarget, setCloseTarget] = useState(null)
  const [movementTarget, setMovementTarget] = useState(null)

  const activeSessions = sessions.filter((s) => s.status === 'OPEN')
  const historySessions = sessions.filter((s) => s.status !== 'OPEN')

  return (
    <div className="min-h-full bg-[hsl(var(--background))] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <PageHeader
          title="Cajas"
          description="Apertura, movimientos de efectivo, cierre y diferencias de caja."
          actions={
            <Button onClick={() => setOpenDialog(true)}>Abrir caja</Button>
          }
        />

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando sesiones...</p>
        ) : activeSessions.length === 0 && historySessions.length === 0 ? (
          <EmptyState
            title="Sin sesiones"
            description="Abre una caja para iniciar las operaciones del día."
          />
        ) : null}

        {activeSessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Cajas activas</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {activeSessions.map((s) => (
                  <li key={s.id} className="py-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{s.terminal?.name ?? 'Terminal'}</p>
                        <p className="text-xs text-muted-foreground">
                          Apertura: ${parseFloat(s.opening_cash_amount ?? 0).toFixed(2)} ·{' '}
                          {new Date(s.opened_at).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setMovementTarget(s)}>
                          Movimiento
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => setCloseTarget(s)}>
                          Cerrar caja
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {historySessions.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Historial de cajas</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y divide-border">
                {historySessions.map((s) => (
                  <li key={s.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-medium">{s.terminal?.name ?? 'Terminal'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(s.opened_at).toLocaleDateString('es-MX')}
                        {s.closed_at ? ` — ${new Date(s.closed_at).toLocaleTimeString('es-MX', { timeStyle: 'short' })}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {s.difference_amount != null && (
                        <span className={`text-sm font-medium ${parseFloat(s.difference_amount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(s.difference_amount) >= 0 ? '+' : ''}{parseFloat(s.difference_amount).toFixed(2)}
                        </span>
                      )}
                      <Badge variant={STATUS_VARIANTS[s.status]}>{STATUS_LABELS[s.status]}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      <SessionOpenDialog open={openDialog} onOpenChange={setOpenDialog} />
      {closeTarget && (
        <SessionCloseDialog
          open={Boolean(closeTarget)}
          onOpenChange={(v) => !v && setCloseTarget(null)}
          session={closeTarget}
          onSuccess={() => setCloseTarget(null)}
        />
      )}
      {movementTarget && (
        <CashMovementDialog
          open={Boolean(movementTarget)}
          onOpenChange={(v) => !v && setMovementTarget(null)}
          sessionId={movementTarget.id}
        />
      )}
    </div>
  )
}
