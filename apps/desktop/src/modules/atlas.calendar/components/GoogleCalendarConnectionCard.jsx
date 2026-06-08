import { AlertCircle, CheckCircle2, ExternalLink, Link2 } from 'lucide-react'
import { Badge, Button, Card, CardContent, EmptyState, ErrorState, Skeleton } from '@atlas/ui'
import { toast } from 'sonner'
import {
  useGoogleCalendarStatus,
  useStartGoogleCalendarConnect,
} from '../hooks/useGoogleCalendarData'

function ConnectionBadge({ connected }) {
  if (connected) {
    return <Badge variant="success">Conectado</Badge>
  }

  return <Badge variant="secondary">Sin conectar</Badge>
}

export default function GoogleCalendarConnectionCard({ onSelectCalendars }) {
  const { data, isLoading, isError, error, refetch } = useGoogleCalendarStatus()
  const startConnect = useStartGoogleCalendarConnect()

  async function handleConnect() {
    try {
      const result = await startConnect.mutateAsync()
      if (result?.authUrl) {
        window.location.assign(result.authUrl)
        return
      }
      toast.error('Google no devolvió una URL de conexión válida.')
    } catch (connectError) {
      toast.error(connectError?.message || 'No se pudo iniciar la conexión con Google.')
    }
  }

  if (isLoading) {
    return (
      <Card className="border-[hsl(var(--border))]">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-32 rounded-md" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <Skeleton className="h-3 w-full rounded-md" />
          <Skeleton className="h-3 w-4/5 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-lg" />
        </CardContent>
      </Card>
    )
  }

  if (isError) {
    return (
      <ErrorState
        title="No se pudo consultar Google Calendar"
        description={error?.message || 'Reintenta en unos segundos.'}
        onRetry={() => refetch()}
        className="px-4 py-6"
      />
    )
  }

  if (!data?.configured) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Google Calendar no configurado"
        description="Faltan variables de entorno en esta instancia."
        variant="compact"
      />
    )
  }

  const connection = data.connection
  const isConnected = Boolean(connection?.googleEmail)
  const connectedAtLabel = connection?.connectedAt
    ? new Date(connection.connectedAt).toLocaleString('es-MX', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    : null

  return (
    <Card className="border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-none">
      <CardContent className="space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-[hsl(var(--muted-foreground))]" />
              <p className="text-xs font-semibold text-[hsl(var(--foreground))]">
                Google Calendar
              </p>
            </div>
            <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
              {isConnected
                ? `Conectado como ${connection.googleEmail}`
                : 'Conecta tu cuenta para descubrir calendarios de Google.'}
            </p>
          </div>
          <ConnectionBadge connected={isConnected} />
        </div>

        {isConnected && (
          <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-2.5 py-2">
            <div className="flex items-center gap-2 text-xs text-[hsl(var(--foreground))]">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="truncate">{connection.googleEmail}</span>
            </div>
            {connectedAtLabel && (
              <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                Vinculado el {connectedAtLabel}
              </p>
            )}
          </div>
        )}

        {!isConnected ? (
          <Button
            size="sm"
            className="w-full"
            onClick={handleConnect}
            loading={startConnect.isPending}
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Conectar Google
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="w-full" onClick={onSelectCalendars}>
            Elegir calendarios
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
