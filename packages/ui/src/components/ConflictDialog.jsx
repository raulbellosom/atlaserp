import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './Dialog.jsx'
import { Button } from './Button.jsx'

const SKIP_FIELDS = new Set(['id', 'companyId', 'userId', 'createdAt', 'updatedAt', 'enabled'])

function formatVal(val) {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function getDisplayKeys(local, server) {
  const all = [...new Set([...Object.keys(local ?? {}), ...Object.keys(server ?? {})])]
    .filter((k) => !SKIP_FIELDS.has(k))
  const diff = all.filter((k) => formatVal((local ?? {})[k]) !== formatVal((server ?? {})[k]))
  return diff.length > 0 ? diff : all
}

export function ConflictDialog({ conflict, open, onResolveLocal, onResolveServer, onClose }) {
  if (!conflict) return null

  const local = conflict.localData ?? {}
  const server = conflict.serverData ?? {}
  const keys = getDisplayKeys(local, server)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conflicto de sincronización</DialogTitle>
          <DialogDescription>
            Este registro fue modificado en el servidor mientras estaba sin conexión.
            Selecciona qué versión conservar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-2">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Tu versión
            </p>
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              {keys.map((k) => (
                <div key={k}>
                  <span className="font-medium">{k}: </span>
                  <span className={formatVal(local[k]) !== formatVal(server[k]) ? 'text-destructive' : ''}>
                    {formatVal(local[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Versión del servidor
            </p>
            <div className="space-y-2 rounded-md border border-border p-3 text-sm">
              {keys.map((k) => (
                <div key={k}>
                  <span className="font-medium">{k}: </span>
                  <span className={formatVal(local[k]) !== formatVal(server[k]) ? 'text-primary' : ''}>
                    {formatVal(server[k])}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={() => onResolveServer?.(conflict)}>
            Usar versión del servidor
          </Button>
          <Button onClick={() => onResolveLocal?.(conflict)}>
            Usar mi versión
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
