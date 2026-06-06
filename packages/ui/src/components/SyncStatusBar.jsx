import { RefreshCw, CheckCircle, WifiOff } from 'lucide-react'

function formatRelativeTime(isoString) {
  if (!isoString) return null
  const diffMs = Date.now() - new Date(isoString).getTime()
  if (diffMs < 60_000) return 'hace un momento'
  if (diffMs < 3_600_000) return `hace ${Math.floor(diffMs / 60_000)} min`
  return `hace ${Math.floor(diffMs / 3_600_000)} h`
}

export function SyncStatusBar({ isOnline = true, isSyncing = false, lastSyncAt = null, onSyncNow }) {
  const relTime = formatRelativeTime(lastSyncAt)

  if (!lastSyncAt && !isSyncing) return null

  return (
    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--muted-foreground))]">
      {isSyncing && (
        <RefreshCw
          size={11}
          className="shrink-0 animate-spin text-[hsl(var(--primary))]"
          aria-label="Sincronizando"
        />
      )}
      {!isSyncing && isOnline && (
        <CheckCircle
          size={11}
          className="shrink-0 text-green-500 dark:text-green-400"
          aria-label="Sincronizado"
        />
      )}
      {!isSyncing && !isOnline && (
        <WifiOff
          size={11}
          className="shrink-0 text-amber-500 dark:text-amber-400"
          aria-label="Sin conexion"
        />
      )}
      <span className="hidden md:inline">
        {isSyncing
          ? 'Sincronizando...'
          : relTime
            ? `Sincronizado ${relTime}`
            : 'Sin sincronizar'}
      </span>
      {onSyncNow && isOnline && !isSyncing && (
        <button
          onClick={onSyncNow}
          className="hidden md:inline underline decoration-dotted hover:text-[hsl(var(--foreground))] transition-colors"
          type="button"
        >
          Actualizar
        </button>
      )}
    </div>
  )
}
