import { useState, useEffect } from 'react'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
  Button, MarkdownField, ConfirmDialog, DatePickerField, SelectField, ComboboxField,
  AttachmentsPanel,
} from '@atlas/ui'
import { Trash2, Plus, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig.js'
import {
  useTask, useUpdateTask, useDeleteTask, useCreateTask,
  useStatuses, useProjectMembers,
  useAddAssignee, useRemoveAssignee,
  useCreateComment, useUpdateComment, useDeleteComment,
} from '../hooks/useProjectsData'
import { SubtaskRow } from './SubtaskRow.jsx'
import { AssigneeAvatar } from '../lib/AssigneeChip.jsx'

const API_BASE_URL = getApiUrl()

const PRIORITY_OPTIONS = [
  { value: 'NONE',   label: 'Normal' },
  { value: 'LOW',    label: 'Baja' },
  { value: 'MEDIUM', label: 'Media' },
  { value: 'HIGH',   label: 'Alta' },
  { value: 'URGENT', label: 'Urgente' },
]

function AssigneeAdder({ currentAssigneeIds, onAdd, members }) {
  const [open, setOpen] = useState(false)

  const available = members.filter((m) => {
    const uid = m.userId ?? m.user?.id ?? m.id
    return !currentAssigneeIds.includes(uid)
  }).map((m) => {
    const u = m.user ?? m
    const uid = m.userId ?? u.id
    return { value: uid, label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || uid }
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
      >
        <Plus size={11} />
        Agregar miembro
      </button>
    )
  }

  return (
    <div className="w-52">
      <ComboboxField
        options={available}
        value=""
        onChange={(uid) => {
          if (uid) { onAdd(uid); setOpen(false) }
        }}
        placeholder="Buscar miembro..."
        autoFocus
        onBlur={() => setOpen(false)}
      />
    </div>
  )
}

export default function TaskDetailPanel({ projectId, taskId, onClose }) {
  const { session } = useAuth()
  const token = session?.access_token
  const userId = session?.user?.id

  const { data: task, isLoading } = useTask(projectId, taskId)
  const { data: statuses = [] } = useStatuses(projectId)
  const { data: membersData } = useProjectMembers(projectId)
  const members = membersData?.data ?? membersData ?? []

  const updateTask = useUpdateTask(projectId)
  const deleteTask = useDeleteTask(projectId)
  const createSubtask = useCreateTask(projectId)
  const addAssignee = useAddAssignee(projectId, taskId)
  const removeAssignee = useRemoveAssignee(projectId, taskId)
  const createComment = useCreateComment(projectId, taskId)
  const updateComment = useUpdateComment(projectId, taskId)
  const deleteComment = useDeleteComment(projectId, taskId)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [commentBody, setCommentBody] = useState('')
  const [editingCommentId, setEditingCommentId] = useState(null)
  const [editingBody, setEditingBody] = useState('')
  const [deleteCommentId, setDeleteCommentId] = useState(null)

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

  function handleSubmitComment(e) {
    e.preventDefault()
    const body = commentBody.trim()
    if (!body) return
    createComment.mutate({ body }, {
      onSuccess: () => setCommentBody(''),
      onError: () => toast.error('No se pudo enviar el comentario'),
    })
  }

  function handleEditComment(comment) {
    setEditingCommentId(comment.id)
    setEditingBody(comment.body)
  }

  function handleSaveEdit() {
    updateComment.mutate({ commentId: editingCommentId, body: editingBody }, {
      onSuccess: () => { setEditingCommentId(null); setEditingBody('') },
      onError: () => toast.error('No se pudo editar el comentario'),
    })
  }

  function handleDeleteComment() {
    deleteComment.mutate({ commentId: deleteCommentId }, {
      onSuccess: () => setDeleteCommentId(null),
      onError: () => toast.error('No se pudo eliminar el comentario'),
    })
  }

  const statusOptions = (statuses?.data ?? statuses ?? []).map((s) => ({ value: s.id, label: s.name }))
  const subtasks = task?.subtasks ?? []
  const isPending = updateTask.isPending || createSubtask.isPending || deleteTask.isPending
    || addAssignee.isPending || removeAssignee.isPending
    || createComment.isPending || updateComment.isPending || deleteComment.isPending

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

                {/* Multi-assignee manager */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Asignado a
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(task.assignees ?? []).map((row) => {
                      const u = row.user
                      const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ').trim() || u?.email || ''
                      return (
                        <span
                          key={row.userId ?? u?.id}
                          className="flex items-center gap-1 bg-muted border border-border rounded-full px-2 py-0.5 text-xs"
                        >
                          <AssigneeAvatar user={u ?? {}} size="sm" />
                          <span className="max-w-22.5 truncate">{name}</span>
                          <button
                            onClick={() => removeAssignee.mutate({ userId: row.userId ?? u?.id }, {
                              onError: () => toast.error('No se pudo quitar asignado'),
                            })}
                            className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            tabIndex={-1}
                          >
                            <X size={10} />
                          </button>
                        </span>
                      )
                    })}
                  </div>
                  <AssigneeAdder
                    currentAssigneeIds={(task.assignees ?? []).map((r) => r.userId ?? r.user?.id)}
                    onAdd={(uid) => addAssignee.mutate({ userId: uid }, { onError: () => toast.error('No se pudo asignar') })}
                    members={members}
                  />
                </div>

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

                {/* Subtareas */}
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

                {/* Archivos */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
                    Archivos
                  </label>
                  <AttachmentsPanel
                    apiBaseUrl={API_BASE_URL}
                    token={token}
                    recordId={task.id}
                    config={{
                      label: 'Archivos',
                      listPath: `/projects/${projectId}/tasks/:id/attachments`,
                      addPath: `/projects/${projectId}/tasks/:id/attachments`,
                      removePath: `/projects/${projectId}/tasks/:id/attachments/:docId`,
                      upload: {
                        endpoint: '/files',
                        moduleKey: 'atlas.projects',
                        entityType: 'Task',
                      },
                    }}
                    context="detail"
                    showHeading={false}
                  />
                </div>

                {/* Actividad / Comentarios */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 block">
                    Actividad
                  </label>
                  <div className="space-y-3 mb-3">
                    {(task.comments ?? []).map((comment) => {
                      const authorName = [comment.author?.firstName, comment.author?.lastName].filter(Boolean).join(' ') || comment.author?.email || 'Usuario'
                      const isAuthor = comment.authorId === userId
                      const isEditing = editingCommentId === comment.id
                      return (
                        <div key={comment.id} className="flex gap-2 group">
                          <AssigneeAvatar user={comment.author ?? {}} size="sm" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-medium">{authorName}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {comment.editedAt && <span className="text-[10px] text-muted-foreground">(editado)</span>}
                            </div>
                            {isEditing ? (
                              <div className="space-y-1.5">
                                <textarea
                                  value={editingBody}
                                  onChange={(e) => setEditingBody(e.target.value)}
                                  rows={2}
                                  className="w-full text-sm bg-muted border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                                />
                                <div className="flex gap-1.5">
                                  <Button size="sm" onClick={handleSaveEdit} disabled={!editingBody.trim()}>Guardar</Button>
                                  <Button size="sm" variant="ghost" onClick={() => setEditingCommentId(null)}>Cancelar</Button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-foreground whitespace-pre-wrap">{comment.body}</p>
                            )}
                          </div>
                          {!isEditing && (
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                              {isAuthor && (
                                <button
                                  onClick={() => handleEditComment(comment)}
                                  className="text-muted-foreground hover:text-foreground text-xs px-1"
                                  title="Editar"
                                >
                                  Editar
                                </button>
                              )}
                              {isAuthor && (
                                <button
                                  onClick={() => setDeleteCommentId(comment.id)}
                                  className="text-muted-foreground hover:text-destructive text-xs px-1"
                                  title="Eliminar"
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  <form onSubmit={handleSubmitComment} className="flex gap-2">
                    <textarea
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmitComment(e) }}
                      placeholder="Escribe un comentario... (Ctrl+Enter para enviar)"
                      rows={2}
                      className="flex-1 text-sm bg-muted border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-accent resize-none"
                    />
                    <Button size="sm" type="submit" disabled={!commentBody.trim() || createComment.isPending}>
                      Comentar
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
      <ConfirmDialog
        open={Boolean(deleteCommentId)}
        onOpenChange={(open) => { if (!open) setDeleteCommentId(null) }}
        title="Eliminar comentario"
        description="Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={handleDeleteComment}
      />
    </>
  )
}
