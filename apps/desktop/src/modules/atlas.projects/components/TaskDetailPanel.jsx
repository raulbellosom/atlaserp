import { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Button, MarkdownField, ConfirmDialog, DatePickerField, SelectField, Checkbox,
} from '@atlas/ui'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import {
  useTask, useUpdateTask, useDeleteTask, useCreateTask,
  useStatuses, useWorkspaceUsers,
} from '../hooks/useProjectsData'

const PRIORITY_OPTIONS = [
  { value: 'NONE',   label: 'Normal' },
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

function SubtaskRow({ task, projectId, onDelete }) {
  const [checked, setChecked] = useState(false)
  return (
    <div className="flex items-center gap-2 py-1">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => setChecked(Boolean(v))}
      />
      <span className={`flex-1 text-sm ${checked ? 'line-through text-muted-foreground' : ''}`}>
        {task.title}
      </span>
      <button
        onClick={() => onDelete(task.id)}
        className="text-muted-foreground hover:text-destructive transition-colors"
      >
        <X size={12} />
      </button>
    </div>
  )
}

export default function TaskDetailPanel({ projectId, taskId, onClose }) {
  const { data: task, isLoading } = useTask(projectId, taskId)
  const { data: statuses = [] } = useStatuses(projectId)
  const { data: usersData } = useWorkspaceUsers()
  const users = usersData?.users ?? usersData?.data ?? usersData ?? []

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
  const userOptions = [
    { value: '', label: 'Sin asignar' },
    ...users.map((u) => ({ value: u.id, label: (u.displayName ?? [u.firstName, u.lastName].filter(Boolean).join(' ')) || u.email || u.id })),
  ]
  const subtasks = task?.subtasks ?? []

  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open) onClose() }}>
        <SheetContent className="w-[420px] sm:w-[480px] overflow-y-auto flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b border-border">
            <SheetTitle className="sr-only">Detalles de tarea</SheetTitle>
            <div className="flex items-start gap-2">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                className="flex-1 text-base font-semibold bg-transparent border-none outline-none focus:ring-0"
                placeholder="Nombre de la tarea"
              />
              <button
                onClick={() => setDeleteOpen(true)}
                className="text-muted-foreground hover:text-destructive transition-colors mt-0.5 flex-shrink-0"
                title="Eliminar tarea"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </SheetHeader>

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
                value={task.assigneeId ?? ''}
                onValueChange={(v) => saveField('assigneeId', v || null)}
                options={userOptions}
              />
              <DatePickerField
                label="Fecha inicio"
                value={task.startDate ? new Date(task.startDate) : null}
                onChange={(d) => saveField('startDate', d ? d.toISOString() : null)}
              />
              <DatePickerField
                label="Fecha vencimiento"
                value={task.dueDate ? new Date(task.dueDate) : null}
                onChange={(d) => saveField('dueDate', d ? d.toISOString() : null)}
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
