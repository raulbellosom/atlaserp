import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@atlas/ui'

const SHORTCUTS = [
  { keys: 'Ctrl+Z', label: 'Deshacer' },
  { keys: 'Ctrl+Y', label: 'Rehacer' },
  { keys: 'Ctrl+B', label: 'Negrita' },
  { keys: 'Ctrl+I', label: 'Cursiva' },
  { keys: 'Ctrl+U', label: 'Subrayado' },
  { keys: '/', label: 'Abrir menu de comandos (al inicio de una linea vacia)' },
]

export function KeyboardShortcutsDialog({ open, onOpenChange }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
        </DialogHeader>
        <div className="divide-y divide-border">
          {SHORTCUTS.map(s => (
            <div key={s.keys} className="flex items-center justify-between py-2 text-sm">
              <span className="text-foreground">{s.label}</span>
              <kbd className="px-2 py-1 rounded-md bg-muted text-muted-foreground text-xs font-mono">
                {s.keys}
              </kbd>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
