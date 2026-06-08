import { CalendarDays, Star } from 'lucide-react'
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  EmptyState,
  ErrorState,
  Skeleton,
} from '@atlas/ui'
import { useGoogleCalendarList } from '../hooks/useGoogleCalendarData'

function CalendarRow({ item }) {
  return (
    <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.backgroundColor || '#1a73e8' }}
            />
            <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
              {item.summary || 'Sin nombre'}
            </p>
          </div>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            {item.timeZone || 'Sin zona horaria'}
          </p>
          <p className="mt-1 break-all text-[11px] text-[hsl(var(--muted-foreground))]">
            {item.id}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.primary ? (
            <Badge variant="glass">
              <Star className="h-3 w-3" />
              Principal
            </Badge>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default function GoogleCalendarCalendarPickerDialog({ open, onClose }) {
  const { data, isLoading, isError, error, refetch } = useGoogleCalendarList(open)
  const items = data?.items ?? []

  function handleClose(nextOpen) {
    if (!nextOpen) onClose()
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Calendarios de Google</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Esta vista sólo muestra los calendarios descubiertos. La persistencia final se
            implementará en una siguiente fase.
          </p>

          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
              <Skeleton className="h-20 w-full rounded-xl" />
            </div>
          ) : null}

          {isError ? (
            <ErrorState
              title="No se pudieron obtener los calendarios"
              description={error?.message || 'Reconecta la cuenta o intenta más tarde.'}
              onRetry={() => refetch()}
              className="px-4 py-6"
            />
          ) : null}

          {!isLoading && !isError && items.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No hay calendarios disponibles"
              description="Google no devolvió calendarios para esta cuenta."
              className="px-4 py-8"
            />
          ) : null}

          {!isLoading && !isError && items.length > 0 ? (
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {items.map((item) => (
                <CalendarRow key={item.id} item={item} />
              ))}
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
