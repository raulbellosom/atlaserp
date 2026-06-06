import { RefreshCw, Trash2 } from 'lucide-react'
import { Badge } from './Badge.jsx'
import { Button } from './Button.jsx'
import { EmptyState } from './EmptyState.jsx'

const STATUS_LABEL = {
  PENDING: 'Pendiente',
  SYNCING: 'Sincronizando',
  CONFLICT: 'Conflicto',
  FAILED: 'Error',
}

const STATUS_VARIANT = {
  PENDING: 'secondary',
  SYNCING: 'outline',
  CONFLICT: 'destructive',
  FAILED: 'destructive',
}

const OP_LABEL = {
  CREATE: 'Crear',
  UPDATE: 'Actualizar',
  DELETE: 'Eliminar',
}

export function PendingMutationsPanel({ mutations = [], onRetry, onDiscard }) {
  if (mutations.length === 0) {
    return (
      <EmptyState
        title="Sin cambios pendientes"
        description="Todos los cambios están sincronizados."
      />
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {mutations.map((m) => (
        <div
          key={m.id}
          className="flex items-center justify-between rounded-md border border-[hsl(var(--border))] px-3 py-2 text-sm"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Badge variant={STATUS_VARIANT[m.status] ?? 'secondary'}>
              {STATUS_LABEL[m.status] ?? m.status}
            </Badge>
            <span className="font-medium truncate text-[hsl(var(--foreground))]">
              {OP_LABEL[m.operation] ?? m.operation} {m.entityType}
            </span>
            {m.lastError && (
              <span
                className="hidden md:inline text-xs text-[hsl(var(--muted-foreground))] max-w-45 truncate"
                title={m.lastError}
              >
                {m.lastError}
              </span>
            )}
          </div>
          {(m.status === 'FAILED' || m.status === 'CONFLICT') && (
            <div className="flex shrink-0 items-center gap-1 ml-2">
              {onRetry && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onRetry(m.id)}
                  title="Reintentar"
                  aria-label="Reintentar"
                >
                  <RefreshCw size={13} />
                </Button>
              )}
              {onDiscard && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-[hsl(var(--destructive))]"
                  onClick={() => onDiscard(m.id)}
                  title="Descartar"
                  aria-label="Descartar"
                >
                  <Trash2 size={13} />
                </Button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
