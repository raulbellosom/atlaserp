import { useState } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Button, ConfirmDialog,
} from '@atlas/ui'
import { Trash2, Plus, GripVertical } from 'lucide-react'
import { toast } from 'sonner'
import {
  useStatuses, useCreateStatus, useUpdateStatus, useDeleteStatus,
} from '../hooks/useProjectsData'

function StatusRow({ status, projectId, onDelete }) {
  const updateStatus = useUpdateStatus(projectId)
  const [name, setName] = useState(status.name)
  const [color, setColor] = useState(status.color)

  function saveField(field, value) {
    updateStatus.mutate(
      { statusId: status.id, [field]: value },
      { onError: () => toast.error('No se pudo guardar el cambio') },
    )
  }

  return (
    <div className="flex items-center gap-3 py-2 group">
      <GripVertical size={14} className="text-muted-foreground flex-shrink-0 opacity-50" />
      <div className="relative flex-shrink-0">
        <div
          className="w-5 h-5 rounded-full border-2 border-transparent hover:border-foreground/30 transition-all"
          style={{ background: color }}
          title="Cambiar color"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          onBlur={() => { if (color !== status.color) saveField('color', color) }}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => {
          const t = name.trim()
          if (t && t !== status.name) saveField('name', t)
        }}
        className="flex-1 text-sm bg-transparent border-b border-transparent hover:border-border focus:border-accent outline-none py-0.5"
      />
      {status.is_done && (
        <span className="text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
          Completado
        </span>
      )}
      <button
        onClick={() => !status.is_default && onDelete(status)}
        className={[
          'transition-colors opacity-0 group-hover:opacity-100',
          status.is_default ? 'cursor-not-allowed text-muted-foreground/30' : 'text-muted-foreground hover:text-destructive',
        ].join(' ')}
        title={status.is_default ? 'No se puede eliminar la columna por defecto' : 'Eliminar columna'}
      >
        <Trash2 size={14} />
      </button>
    </div>
  )
}

export default function StatusEditor({ open, onOpenChange, projectId }) {
  const { data: statusesData } = useStatuses(projectId)
  const statuses = statusesData?.data ?? statusesData ?? []
  const createStatus = useCreateStatus(projectId)
  const deleteStatus = useDeleteStatus(projectId)

  const [newName, setNewName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)

  function handleAddStatus(e) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    createStatus.mutate(
      { name, color: '#64748b' },
      {
        onSuccess: () => { setNewName(''); toast.success('Columna creada') },
        onError: () => toast.error('No se pudo crear la columna'),
      },
    )
  }

  function handleDelete() {
    if (!deleteTarget) return
    deleteStatus.mutate(deleteTarget.id, {
      onSuccess: () => { toast.success('Columna eliminada'); setDeleteTarget(null) },
      onError: () => toast.error('No se pudo eliminar la columna'),
    })
  }

  const sorted = [...statuses].sort((a, b) => a.position - b.position)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-[380px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Gestionar columnas</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-1 divide-y divide-border">
            {sorted.map((status) => (
              <StatusRow
                key={status.id}
                status={status}
                projectId={projectId}
                onDelete={setDeleteTarget}
              />
            ))}
          </div>
          <form onSubmit={handleAddStatus} className="mt-4 flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva columna..."
              className="flex-1 text-sm bg-muted border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <Button size="sm" type="submit" disabled={!newName.trim() || createStatus.isPending}>
              <Plus size={14} />
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(v) => { if (!v) setDeleteTarget(null) }}
        title="Eliminar columna"
        description={`Las tareas en "${deleteTarget?.name ?? ''}" se moveran a la columna por defecto.`}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}
