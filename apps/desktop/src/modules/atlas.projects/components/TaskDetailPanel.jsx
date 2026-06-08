import { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Button, MarkdownField, ConfirmDialog, DatePickerField, SelectField, Checkbox,
} from '@atlas/ui'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTask, useUpdateTask, useDeleteTask, useCreateTask,
  useStatuses, useProjectMembers,
} from '../hooks/useProjectsData'

const PRIORITY_OPTIONS = [
  { value: 'NONE',   label: 'Normal' },
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

function SubtaskRow({ task, projectId, onDelete }) {
  const updateSubtask = useUpdateTask(projectId)
  const [title, setTitle] = useState(task.title)
  const [editing, setEditing] = useState(false)

  function handleBlur() {
    setEditing(false)
    const trimmed = title.trim()
    if (!trimmed) { setTitle(task.title); return }
    if (trimmed !== task.title) {
      updateSubtask.mutate({ taskId: task.id, title: trimmed }, {
        onError: () => { setTitle(task.title); toast.error('No se pudo guardar') },
      })
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') e.target.blur()
    if (e.key === 'Escape') { setTitle(task.title); setEditing(false) }
  }

  function toggleDone(v) {
    updateSubtask.mutate({ taskId: task.id, isDone: Boolean(v) }, {
      onError: () => toast.error('No se pudo actualizar'),
    })
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <Checkbox
        checked={task.isDone ?? false}
        onCheckedChange={toggleDone}
      />
      {editing ? (
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="flex-1 text-sm bg-transparent border-b border-border outline-none focus:border-primary"
        />
      ) : (
        <span
          onClick={() => setEditing(true)}
          className={`flex-1 text-sm cursor-text select-none ${task.isDone ? 'line-through text-muted-foreground' : ''}`}
        >
          {title}
        </span>
      )}
      <button
        onClick={() => onDelete(task.id)}
        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
        tabIndex={-1}
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function TaskDetailPanel({ projectId, taskId, onClose }) {
  const { data: task, isLoading } = useTask(projectId, taskId)
  const { data: statuses = [] } = useStatuses(projectId)
  const { data: membersData } = useProjectMembers(projectId)
  const members = membersData?.data ?? membersData ?? []

  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const createSubtask = useCreateTask(projectId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')

  useEffect(() => {
    if (task) {
      setTitle(task.title ?? '')
      setDescription(task.description ?? '')
    }
  }, [task?.id])

  function saveField(field, value) {
    if (!task) return
    updateTask.mutate({ taskId: task.id, [field]: value }, {
      onError: () => toast.error('No se pudo guardar el cambio'),
    })
  }

  function handleTitleBlur() {
    const trimmed = title.trim()
    if (trimmed && trimmed !== task?.title) saveField('title', trimmed)
  }

  function handleDescriptionBlur() {
    if (description !== task?.description) saveField('description', description || null)
  }

  function handleAddSubtask(e) {
    e.preventDefault()
    const t = newSubtask.trim()
    if (!t || !task) return
    createSubtask.mutate(
      { title: t, statusId: task.statusId, parentTaskId: task.id },
      {
        onSuccess: () => setNewSubtask(''),
        onError: () => toast.error('No se pudo crear la subtarea'),
      },
    )
  }

  function handleDeleteSubtask(subtaskId) {
    deleteTask.mutate(subtaskId, {
      onError: () => toast.error('No se pudo eliminar la subtarea'),
    })
  }

  function handleDelete() {
    deleteTask.mutate(task.id, {
      onSuccess: () => { toast.success('Tarea eliminada'); onClose() },
      onError: () => toast.error('No se pudo eliminar la tarea'),
    })
  }

  const statusOptions = (statuses?.data ?? statuses ?? []).map((s) => ({ value: s.id, label: s.name }))
  const memberOptions = [
    { value: '__none__', label: 'Sin asignar' },
    ...members.map((m) => {
      const u = m.user ?? m
      const label = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id
      return { value: m.userId ?? u.id, label }
    }),
  ]
  const subtasks = task?.subtasks ?? []
  const isPending = updateTask.isPending || createSubtask.isPending || deleteTask.isPending

  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent
          className="w-full flex flex-col gap-0 p-0"
          style={{ maxWidth: '860px' }}
        >
          {/* Loading bar */}
          <div
            className={`h-0.5 shrink-0 transition-opacity duration-200 bg-primary ${isPending ? 'opacity-100 animate-pulse' : 'opacity-0'}`}
          />

          <SheetHeader className="pl-6 pr-20 py-4 border-b border-border shrink-0">
            <SheetTitle className="sr-only">Detalles de tarea</SheetTitle>
            <div className="flex items-center gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="flex-1 text-base font-semibold bg-transparent border-none outline-none focus:ring-0"
                placeholder="Nombre de la tarea"
              />
              <button
                onClick={() => setDeleteOpen(true)}
                className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                title="Eliminar tarea"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-6">Cargando...</p>
            ) : task ? (
              <div className="flex flex-col gap-4 p-6">
                <SelectField
                  label="Estado"
                  value={task.statusId}
                  onValueChange={(v) => saveField('statusId', v)}
                  options={statusOptions}
                />
                <SelectField
                  label="Prioridad"
                  value={task.priority}
                  onValueChange={(v) => saveField('priority', v)}
                  options={PRIORITY_OPTIONS}
                />
                <SelectField
                  label="Asignado a"
                  value={task.assigneeId ?? '__none__'}
                  onValueChange={(v) => saveField('assigneeId', v === '__none__' ? null : v)}
                  options={memberOptions}
                />
                <DatePickerField
                  label="Fecha inicio"
                  value={task.startDate ?? null}
                  onChange={(d) => saveField('startDate', d ?? null)}
                />
                <DatePickerField
                  label="Fecha vencimiento"
                  value={task.dueDate ?? null}
                  onChange={(d) => saveField('dueDate', d ?? null)}
                />
                <MarkdownField
                  label="Descripcion"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={handleDescriptionBlur}
                  placeholder="Agrega una descripcion..."
                />
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Subtareas ({subtasks.length})
                  </label>
                  <div className="space-y-0.5">
                    {subtasks.map((sub) => (
                      <SubtaskRow
                        key={sub.id}
                        task={sub}
                        projectId={projectId}
                        onDelete={handleDeleteSubtask}
                      />
                    ))}
                  </div>
                  <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                    <input
                      value={newSubtask}
                      onChange={(e) => setNewSubtask(e.target.value)}
                      placeholder="Nueva subtarea..."
                      className="flex-1 text-sm bg-muted border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <Button size="sm" type="submit" disabled={!newSubtask.trim()}>
                      <Plus size={14} />
                    </Button>
                  </form>
                </div>
              </div>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar tarea"
        description="Se eliminara la tarea y todas sus subtareas. Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
      />
    </>
  )
}
