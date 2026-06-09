import { useState } from 'react'
import { Checkbox } from '@atlas/ui'
import { X, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateTask, useAddAssignee, useRemoveAssignee, useProjectMembers } from '../hooks/useProjectsData'
import { AssigneeAvatar } from '../lib/AssigneeChip.jsx'
import { UserPickerDropdown } from '../lib/UserPickerDropdown.jsx'

export function SubtaskRow({ task, projectId, onDelete }) {
  const updateSubtask = useUpdateTask(projectId)
  const addAssignee = useAddAssignee(projectId, task.id)
  const removeAssignee = useRemoveAssignee(projectId, task.id)
  const { data: membersData } = useProjectMembers(projectId)
  const members = membersData?.data ?? membersData ?? []

  const [title, setTitle] = useState(task.title)
  const [editing, setEditing] = useState(false)
  const [showAssignPicker, setShowAssignPicker] = useState(false)

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

  const primaryAssignee = task.assignees?.[0]?.user ?? task.assignee ?? null

  const memberUsers = members.map((m) => ({ ...(m.user ?? m), id: m.userId ?? m.user?.id ?? m.id }))

  function handleAssigneeChange(userId) {
    if (!userId) return
    setShowAssignPicker(false)
    if (primaryAssignee?.id === userId) {
      removeAssignee.mutate({ userId }, { onError: () => toast.error('No se pudo quitar asignado') })
    } else {
      addAssignee.mutate({ userId }, { onError: () => toast.error('No se pudo asignar') })
    }
  }

  return (
    <div className="flex items-center gap-2 py-1.5 group">
      <Checkbox
        checked={task.isDone ?? false}
        onCheckedChange={toggleDone}
      />
      <CornerDownRight size={10} className="text-indigo-400/70 shrink-0" />
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
      {showAssignPicker ? (
        <div className="w-52 shrink-0">
          <UserPickerDropdown
            users={memberUsers}
            value={primaryAssignee?.id ?? ''}
            onChange={handleAssigneeChange}
            placeholder="Asignar..."
            emptyMessage="Sin miembros"
            compact
            autoFocus
            onBlur={() => setShowAssignPicker(false)}
          />
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setShowAssignPicker(true) }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          tabIndex={-1}
          title="Asignar miembro"
        >
          {primaryAssignee
            ? <AssigneeAvatar user={primaryAssignee} size="sm" />
            : <span className="w-5 h-5 rounded-full border border-dashed border-muted-foreground/40 flex items-center justify-center text-[9px] text-muted-foreground">+</span>
          }
        </button>
      )}
      <button
        onClick={() => onDelete(task.id)}
        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 shrink-0"
        tabIndex={-1}
      >
        <X size={12} />
      </button>
    </div>
  )
}
