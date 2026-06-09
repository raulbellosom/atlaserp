# atlas.projects V2.1 — Plan B: UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the V2.1 API (Plan A) into the React UI: multi-assignee manager in TaskDetailPanel, inline comments, file attachments, subtask toggle across all views, subtask visual markers, stacked assignee chips, and bulk actions in ListView.

**Architecture:** New TanStack Query hooks in `useProjectsData.js` → component-level mutations in `TaskDetailPanel`, `KanbanView`, `ListView`, `TimelineView`. Subtask toggle state lives in `ProjectsScreen` and is passed as a `showSubtasks` prop. No new route files.

**Tech Stack:** React, TanStack Query, `@atlas/ui` (`ComboboxField`, `AttachmentsPanel`, `ConfirmDialog`, `Button`, `Checkbox`), Tailwind, Lucide.

**Depends on:** Plan A must be applied first (schema migration and new API endpoints must exist).

**Spec:** `docs/superpowers/specs/2026-06-08-atlas-projects-v2.1-design.md`

---

## File Map

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js` | Add hooks: `useAddAssignee`, `useRemoveAssignee`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useBulkUpdateTasks`, `useBulkDeleteTasks` |
| `apps/desktop/src/modules/atlas.projects/components/SubtaskRow.jsx` | Extract from TaskDetailPanel; add single assignee picker |
| `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` | Multi-assignee manager; attachments (AttachmentsPanel); comments section |
| `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx` | `showSubtasks` state + toggle button; pass to all views |
| `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx` | `showSubtasks` prop; subtask visual marker on cards; stacked chips |
| `apps/desktop/src/modules/atlas.projects/components/ListView.jsx` | `showSubtasks` prop; checkbox column; bulk action bar; subtask marker; stacked chips |
| `apps/desktop/src/modules/atlas.projects/components/TimelineView.jsx` | `showSubtasks` prop; subtask visual marker |

---

### Task 1: useProjectsData.js — add V2.1 hooks

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js`

- [ ] **Step 1: Add assignee mutation hooks**

At the end of `useProjectsData.js` (after `useWorkspaceUsers`), append:

```js
// ── Task Assignees ────────────────────────────────────────────────────────────

export function useAddAssignee(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId }) => atlas.projects.addTaskAssignee(projectId, taskId, { userId }, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}

export function useRemoveAssignee(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId }) => atlas.projects.removeTaskAssignee(projectId, taskId, userId, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}
```

- [ ] **Step 2: Add comment mutation hooks**

```js
// ── Task Comments ─────────────────────────────────────────────────────────────

export function useCreateComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ body }) => atlas.projects.createTaskComment(projectId, taskId, { body }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] }),
  })
}

export function useUpdateComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId, body }) => atlas.projects.updateTaskComment(projectId, taskId, commentId, { body }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] }),
  })
}

export function useDeleteComment(projectId, taskId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ commentId }) => atlas.projects.deleteTaskComment(projectId, taskId, commentId, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] }),
  })
}
```

- [ ] **Step 3: Add bulk mutation hooks**

```js
// ── Bulk ──────────────────────────────────────────────────────────────────────

export function useBulkUpdateTasks(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskIds, patch }) => atlas.projects.bulkUpdateTasks(projectId, { taskIds, patch }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  })
}

export function useBulkDeleteTasks(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskIds }) => atlas.projects.bulkDeleteTasks(projectId, { taskIds }, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] }),
  })
}
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git commit -m "feat(projects): add V2.1 TanStack Query hooks — assignees, comments, bulk"
```

---

### Task 2: SubtaskRow.jsx — extract + single assignee picker

**Files:**
- Create: `apps/desktop/src/modules/atlas.projects/components/SubtaskRow.jsx`
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` (remove inline definition)

- [ ] **Step 1: Create SubtaskRow.jsx**

```jsx
import { useState } from 'react'
import { Checkbox, ComboboxField } from '@atlas/ui'
import { X, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { useUpdateTask, useAddAssignee, useRemoveAssignee, useProjectMembers } from '../hooks/useProjectsData'
import { AssigneeAvatar } from '../lib/AssigneeChip.jsx'

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

  const memberOptions = members.map((m) => {
    const u = m.user ?? m
    return { value: m.userId ?? u.id, label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id }
  })

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
        <div className="w-40 shrink-0">
          <ComboboxField
            options={memberOptions}
            value={primaryAssignee?.id ?? ''}
            onChange={handleAssigneeChange}
            placeholder="Asignar..."
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
```

- [ ] **Step 2: Remove inline SubtaskRow from TaskDetailPanel**

In `TaskDetailPanel.jsx`, delete lines 21-79 (the inline `SubtaskRow` function). Replace with an import:

```js
import { SubtaskRow } from './SubtaskRow.jsx'
```

Also update the import list at the top to remove `Checkbox` if it's no longer used elsewhere in the file (it was only used by SubtaskRow). Keep it if it's still used.

- [ ] **Step 3: Syntax check both files**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/SubtaskRow.jsx
node --check apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/SubtaskRow.jsx \
        apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "feat(projects): extract SubtaskRow with single assignee picker"
```

---

### Task 3: TaskDetailPanel — multi-assignee manager

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`

- [ ] **Step 1: Update imports**

Replace the existing import block at the top of `TaskDetailPanel.jsx` with:

```js
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
```

- [ ] **Step 2: Update the component body — get auth, assignee hooks**

Inside `TaskDetailPanel` component, after the existing hooks, add:

```js
const { session } = useAuth()
const token = session?.access_token
const addAssignee = useAddAssignee(projectId, taskId)
const removeAssignee = useRemoveAssignee(projectId, taskId)
```

- [ ] **Step 3: Replace single-assignee SelectField with multi-assignee manager**

Find and remove these lines (the `SelectField "Asignado a"` section, around lines 201-212 in the original file):

```jsx
<SelectField
  label="Asignado a"
  value={task.assigneeId ?? '__none__'}
  onValueChange={(v) => saveField('assigneeId', v === '__none__' ? null : v)}
  options={memberOptions}
/>
```

Replace with the multi-assignee manager:

```jsx
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
          <AssigneeAvatar user={u} size="sm" />
          <span className="max-w-[90px] truncate">{name}</span>
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
    projectId={projectId}
    currentAssigneeIds={(task.assignees ?? []).map((r) => r.userId ?? r.user?.id)}
    onAdd={(userId) => addAssignee.mutate({ userId }, { onError: () => toast.error('No se pudo asignar') })}
    members={members}
  />
</div>
```

- [ ] **Step 4: Add AssigneeAdder helper component**

Add this before the `TaskDetailPanel` function definition (after the `PRIORITY_OPTIONS` constant):

```js
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
```

- [ ] **Step 5: Also remove memberOptions variable** (it was used only by the old SelectField). Delete these lines:

```js
const memberOptions = [
  { value: '__none__', label: 'Sin asignar' },
  ...members.map((m) => {
    const u = m.user ?? m
    const label = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email || u.id
    return { value: m.userId ?? u.id, label }
  }),
]
```

- [ ] **Step 6: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "feat(projects): multi-assignee manager in TaskDetailPanel"
```

---

### Task 4: TaskDetailPanel — attachments section

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`

- [ ] **Step 1: Add AttachmentsPanel section**

Inside the scrollable body `<div className="flex flex-col gap-4 p-6">`, add after the `MarkdownField "Descripcion"` section (before the Subtareas section):

```jsx
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
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "feat(projects): task attachments section in TaskDetailPanel"
```

---

### Task 5: TaskDetailPanel — comments section

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`

- [ ] **Step 1: Add comment state and hooks**

Inside `TaskDetailPanel`, after the `newSubtask` state, add:

```js
const createComment = useCreateComment(projectId, taskId)
const updateComment = useUpdateComment(projectId, taskId)
const deleteComment = useDeleteComment(projectId, taskId)
const [commentBody, setCommentBody] = useState('')
const [editingCommentId, setEditingCommentId] = useState(null)
const [editingBody, setEditingBody] = useState('')
const [deleteCommentId, setDeleteCommentId] = useState(null)
const userId = session?.user?.id
```

- [ ] **Step 2: Add comment handlers**

After `handleDeleteSubtask`, add:

```js
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
```

- [ ] **Step 3: Add comments section to JSX**

Inside the scrollable body, after the Archivos section, add:

```jsx
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
              {(isAuthor) && (
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
```

- [ ] **Step 4: Also add ConfirmDialog for comment deletion at the end of the JSX (after the existing ConfirmDialog for task deletion)**

Inside the outermost fragment (`<>`), after the existing task delete `ConfirmDialog`, add:

```jsx
<ConfirmDialog
  open={Boolean(deleteCommentId)}
  onOpenChange={(open) => { if (!open) setDeleteCommentId(null) }}
  title="Eliminar comentario"
  description="Esta accion no se puede deshacer."
  confirmLabel="Eliminar"
  onConfirm={handleDeleteComment}
/>
```

- [ ] **Step 5: Update isPending to include comment mutations**

Find the `isPending` line and update it:

```js
const isPending = updateTask.isPending || createSubtask.isPending || deleteTask.isPending
  || addAssignee.isPending || removeAssignee.isPending
  || createComment.isPending || updateComment.isPending || deleteComment.isPending
```

- [ ] **Step 6: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "feat(projects): comments section in TaskDetailPanel"
```

---

### Task 6: ProjectsScreen — showSubtasks toggle

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx`

- [ ] **Step 1: Add showSubtasks state**

Inside `ProjectsScreen`, after the existing `sidebarOpen` state, add:

```js
const [showSubtasks, setShowSubtasks] = useState(false)
```

- [ ] **Step 2: Add toggle button to the project header**

In the project header area (inside the `<div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">`), after the view switcher `<div>` block, add:

```jsx
<button
  onClick={() => setShowSubtasks((v) => !v)}
  title={showSubtasks ? 'Ocultar subtareas' : 'Mostrar subtareas'}
  className={[
    'text-xs px-2 py-1 rounded border transition-colors',
    showSubtasks
      ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400'
      : 'border-border text-muted-foreground hover:text-foreground',
  ].join(' ')}
>
  Subtareas
</button>
```

- [ ] **Step 3: Pass showSubtasks to all views**

Replace the "Active view" render block:

```jsx
{activeView === 'kanban'   && <KanbanView   projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
{activeView === 'list'     && <ListView     projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
{activeView === 'timeline' && <TimelineView projectId={effectiveId} onTaskClick={openTask} showSubtasks={showSubtasks} />}
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx
git commit -m "feat(projects): showSubtasks toggle in ProjectsScreen"
```

---

### Task 7: KanbanView — showSubtasks + visual marker + stacked chips

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx`

- [ ] **Step 1: Accept showSubtasks prop and update data fetch**

Change the component signature:

```js
export default function KanbanView({ projectId, onTaskClick, showSubtasks = false }) {
```

Inside each column's data fetch, the `useTasks` call is done per status. Find where `useTasks` is called (inside `KanbanColumn`) and update the filter:

In the `KanbanColumn` component signature, add `showSubtasks` prop. Trace from `KanbanBoard` → `KanbanColumn`. Update the `useTasks` call in `KanbanColumn`:

```js
const { data: tasksData } = useTasks(projectId, {
  statusId,
  ...(showSubtasks ? { include_subtasks: 'true' } : { parentTaskId: 'null' }),
})
```

Pass `showSubtasks` down from `KanbanView` → `KanbanBoard` → `KanbanColumn` as a prop.

- [ ] **Step 2: Add subtask visual marker to TaskCard**

In the `TaskCard` component, after the drag handle `<span>`, update the title area and add the subtask marker:

```jsx
{task.parentTaskId && (
  <CornerDownRight size={10} className="text-indigo-400/70 mt-0.5 shrink-0" />
)}
<span className="flex-1 text-sm leading-snug">{task.title}</span>
```

Import `CornerDownRight` from `lucide-react`.

Apply the left border to the card when it's a subtask. Change the card container `className`:

```js
className={[
  'group bg-background border border-border rounded p-2.5 cursor-pointer hover:border-accent-foreground/20 transition-colors',
  task.parentTaskId ? 'border-l-2 border-l-indigo-400/60' : '',
].filter(Boolean).join(' ')}
```

- [ ] **Step 3: Replace single AssigneeAvatar with stacked chips**

In the `TaskCard` footer area, replace:

```jsx
{task.assignee && <AssigneeAvatar user={task.assignee} />}
```

With stacked assignee chips (using `task.assignees` if available, fallback to `task.assignee`):

```jsx
<StackedAssignees assignees={task.assignees} fallback={task.assignee} />
```

Add `StackedAssignees` helper above `TaskCard`:

```js
function StackedAssignees({ assignees, fallback }) {
  const list = assignees?.length
    ? assignees.map((r) => r.user).filter(Boolean)
    : fallback ? [fallback] : []
  if (!list.length) return null
  const shown = list.slice(0, 3)
  const extra = list.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((u, i) => (
        <span key={u.id ?? i} title={[u.firstName, u.lastName].filter(Boolean).join(' ')}>
          <AssigneeAvatar user={u} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] text-muted-foreground font-medium">
          +{extra}
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "feat(projects): KanbanView — showSubtasks, subtask marker, stacked chips"
```

---

### Task 8: ListView — showSubtasks + checkbox column + bulk bar + stacked chips + subtask marker

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/ListView.jsx`

- [ ] **Step 1: Accept showSubtasks prop and update data fetch**

Change component signature:

```js
export default function ListView({ projectId, onTaskClick, showSubtasks = false }) {
```

Update the `useTasks` call:

```js
const { data: tasksData, isLoading } = useTasks(projectId, {
  ...(showSubtasks ? { include_subtasks: 'true' } : { parentTaskId: 'null' }),
})
```

- [ ] **Step 2: Add imports for bulk hooks, ConfirmDialog, Checkbox**

Update the import block:

```js
import { useState, useMemo } from 'react'
import { SearchInput, EmptyState, SelectField, ConfirmDialog, Checkbox } from '@atlas/ui'
import { ChevronRight, CornerDownRight } from 'lucide-react'
import { toast } from 'sonner'
import { useStatuses, useTasks, useBulkUpdateTasks, useBulkDeleteTasks } from '../hooks/useProjectsData'
import { StackedAssignees } from './KanbanView.jsx'
```

Wait — `StackedAssignees` is defined inside KanbanView. To reuse it, either:
1. Export it from KanbanView (add `export` keyword)
2. Or duplicate the small helper in ListView

The better approach is to add `StackedAssignees` to `apps/desktop/src/modules/atlas.projects/lib/AssigneeChip.jsx` since it's a shared component. Instead, add it directly to `AssigneeChip.jsx`:

In `apps/desktop/src/modules/atlas.projects/lib/AssigneeChip.jsx`, add at the bottom:

```js
export function StackedAssignees({ assignees, fallback }) {
  const list = assignees?.length
    ? assignees.map((r) => r.user).filter(Boolean)
    : fallback ? [fallback] : []
  if (!list.length) return null
  const shown = list.slice(0, 3)
  const extra = list.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((u, i) => (
        <span key={u.id ?? i} title={[u.firstName, u.lastName].filter(Boolean).join(' ')}>
          <AssigneeAvatar user={u} size="sm" />
        </span>
      ))}
      {extra > 0 && (
        <span className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-[9px] text-muted-foreground font-medium">
          +{extra}
        </span>
      )}
    </div>
  )
}
```

Then import in both `KanbanView.jsx` and `ListView.jsx`:

```js
import { AssigneeAvatar, AssigneeChip, StackedAssignees } from '../lib/AssigneeChip.jsx'
```

(And remove the inline `StackedAssignees` from KanbanView — it's now imported.)

- [ ] **Step 3: Add selectedIds state and bulk hooks**

Inside `ListView`, after the existing filter state, add:

```js
const [selectedIds, setSelectedIds] = useState(new Set())
const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
const bulkUpdate = useBulkUpdateTasks(projectId)
const bulkDelete = useBulkDeleteTasks(projectId)
const { data: statusesData } = useStatuses(projectId)
const statuses = statusesData?.data ?? statusesData ?? []
```

- [ ] **Step 4: Add selection handlers**

After `filterPriority` state, add:

```js
function toggleRow(id) {
  setSelectedIds((prev) => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

function toggleAll() {
  if (selectedIds.size === filtered.length) {
    setSelectedIds(new Set())
  } else {
    setSelectedIds(new Set(filtered.map((t) => t.id)))
  }
}

function clearSelection() {
  setSelectedIds(new Set())
}

function handleBulkDelete() {
  bulkDelete.mutate({ taskIds: [...selectedIds] }, {
    onSuccess: () => { clearSelection(); setBulkDeleteOpen(false) },
    onError: () => toast.error('No se pudo eliminar las tareas'),
  })
}

function handleBulkStatus(statusId) {
  bulkUpdate.mutate({ taskIds: [...selectedIds], patch: { statusId } }, {
    onSuccess: clearSelection,
    onError: () => toast.error('No se pudo actualizar las tareas'),
  })
}
```

- [ ] **Step 5: Add checkbox header column and update table rows**

In the `<thead>`, add a checkbox cell as the FIRST `<th>`:

```jsx
<th className="px-3 py-2 w-8">
  <Checkbox
    checked={filtered.length > 0 && selectedIds.size === filtered.length}
    onCheckedChange={toggleAll}
  />
</th>
```

In each `<tr>` inside `<tbody>`, add a checkbox cell as the FIRST `<td>`:

```jsx
<td className="px-3 py-2.5 w-8" onClick={(e) => e.stopPropagation()}>
  <Checkbox
    checked={selectedIds.has(task.id)}
    onCheckedChange={() => toggleRow(task.id)}
  />
</td>
```

- [ ] **Step 6: Add subtask visual marker to task rows**

In the title `<td>`, replace the title display with:

```jsx
<td className="px-4 py-2.5">
  <div className={[
    'flex items-center gap-2',
    task.parentTaskId ? 'pl-3 border-l-2 border-indigo-400/50' : '',
  ].join(' ')}>
    {task.parentTaskId && <CornerDownRight size={10} className="text-indigo-400/70 shrink-0" />}
    <div className="min-w-0">
      <span className="truncate max-w-sm block">{task.title}</span>
      {task.parent && (
        <span className="text-[10px] text-muted-foreground truncate block">{task.parent.title}</span>
      )}
    </div>
    {task._count?.subtasks > 0 && (
      <span className="text-xs text-muted-foreground shrink-0">({task._count.subtasks})</span>
    )}
    <ChevronRight size={14} className="ml-auto text-muted-foreground shrink-0" />
  </div>
</td>
```

- [ ] **Step 7: Replace single AssigneeChip with StackedAssignees in table**

Find the Asignado `<td>`:

```jsx
// Before:
<td className="px-3 py-2.5">
  <AssigneeChip user={task.assignee} />
</td>

// After:
<td className="px-3 py-2.5">
  <StackedAssignees assignees={task.assignees} fallback={task.assignee} />
</td>
```

- [ ] **Step 8: Add floating bulk action bar**

Wrap the entire `<div className="flex flex-col h-full overflow-hidden">` contents with a `relative` container. Inside that, add the floating bar AFTER the scrollable table div:

```jsx
{selectedIds.size > 0 && (
  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 bg-background border border-border rounded-lg shadow-lg px-4 py-2.5 text-sm">
    <span className="text-muted-foreground mr-1 shrink-0">{selectedIds.size} tarea{selectedIds.size !== 1 ? 's' : ''}</span>
    <SelectField
      value=""
      onValueChange={handleBulkStatus}
      options={[
        { value: '', label: 'Cambiar estado' },
        ...statuses.map((s) => ({ value: s.id, label: s.name })),
      ]}
      className="w-36"
    />
    <button
      onClick={() => setBulkDeleteOpen(true)}
      className="flex items-center gap-1 text-destructive hover:text-destructive/80 transition-colors px-2 py-1 rounded hover:bg-destructive/10"
    >
      <Trash2 size={13} />
      Eliminar
    </button>
    <button
      onClick={clearSelection}
      className="text-muted-foreground hover:text-foreground transition-colors"
    >
      <X size={14} />
    </button>
  </div>
)}
```

Also add the `Trash2` and `X` imports from `lucide-react`.

- [ ] **Step 9: Add ConfirmDialog for bulk delete**

After the closing `</div>` of the component, in the return JSX, wrap with a fragment and add:

```jsx
<ConfirmDialog
  open={bulkDeleteOpen}
  onOpenChange={setBulkDeleteOpen}
  title={`Eliminar ${selectedIds.size} tarea${selectedIds.size !== 1 ? 's' : ''}`}
  description="Esta accion eliminara las tareas seleccionadas y sus subtareas. No se puede deshacer."
  confirmLabel="Eliminar"
  onConfirm={handleBulkDelete}
/>
```

- [ ] **Step 10: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/ListView.jsx
node --check apps/desktop/src/modules/atlas.projects/lib/AssigneeChip.jsx
```

Expected: both exit 0.

- [ ] **Step 11: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/ListView.jsx \
        apps/desktop/src/modules/atlas.projects/lib/AssigneeChip.jsx \
        apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "feat(projects): ListView — showSubtasks, bulk actions, stacked chips, subtask marker"
```

---

### Task 9: TimelineView — showSubtasks + subtask visual marker

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TimelineView.jsx`

- [ ] **Step 1: Accept showSubtasks prop and update data fetch**

Change component signature:

```js
export default function TimelineView({ projectId, onTaskClick, showSubtasks = false }) {
```

Update `useTasks` call:

```js
const { data: tasksData, isLoading } = useTasks(projectId, {
  ...(showSubtasks ? { include_subtasks: 'true' } : { parentTaskId: 'null' }),
})
```

- [ ] **Step 2: Add imports**

Add to the import line:

```js
import { CornerDownRight } from 'lucide-react'
```

- [ ] **Step 3: Sort subtasks after their parent in the sidebar list**

Replace the `useMemo` that computes `datedTasks` and `undatedTasks`. After computing `dated` and `undated`, add subtask ordering:

```js
// Sort: parents first, then immediate subtasks after their parent
function sortWithSubtasks(list) {
  const parents = list.filter((t) => !t.parentTaskId)
  const children = list.filter((t) => t.parentTaskId)
  const result = []
  for (const p of parents) {
    result.push(p)
    result.push(...children.filter((c) => c.parentTaskId === p.id))
  }
  // Orphaned subtasks (parent not in same view) appended at end
  const inResult = new Set(result.map((t) => t.id))
  result.push(...children.filter((c) => !inResult.has(c.id)))
  return result
}

const sortedDated = sortWithSubtasks(dated)
const sortedUndated = sortWithSubtasks(undated)
```

Use `sortedDated` and `sortedUndated` instead of `dated` and `undated` in the return object.

- [ ] **Step 4: Add subtask visual marker to sidebar rows**

In the left sidebar, update each dated task row:

```jsx
{sortedDated.map((task) => (
  <div
    key={task.id}
    onClick={() => onTaskClick(task.id)}
    style={{ height: ROW_HEIGHT }}
    className={[
      'flex items-center px-3 text-sm truncate border-b border-border hover:bg-muted/50 cursor-pointer',
      task.parentTaskId ? 'border-l-2 border-l-indigo-400/60 pl-2' : '',
    ].join(' ')}
  >
    {task.parentTaskId && <CornerDownRight size={10} className="text-indigo-400/70 mr-1 shrink-0" />}
    <span className="truncate">{task.title}</span>
  </div>
))}
```

Do the same for `sortedUndated` rows.

Update the Gantt chart rendering to use `sortedDated` instead of `datedTasks`.

- [ ] **Step 5: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/TimelineView.jsx
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TimelineView.jsx
git commit -m "feat(projects): TimelineView — showSubtasks, subtask marker and ordering"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `useAddAssignee` / `useRemoveAssignee` hooks (Task 1)
- [x] `useCreateComment` / `useUpdateComment` / `useDeleteComment` hooks (Task 1)
- [x] `useBulkUpdateTasks` / `useBulkDeleteTasks` hooks (Task 1)
- [x] `SubtaskRow.jsx` extracted with single assignee picker (Task 2)
- [x] Multi-assignee manager replaces single SelectField in TaskDetailPanel (Task 3)
- [x] `AssigneeAdder` component with ComboboxField (Task 3)
- [x] `AttachmentsPanel` wired with task-specific config paths (Task 4)
- [x] Comments section — list + compose + edit + delete (Task 5)
- [x] Author-only edit, author or admin delete enforced server-side; client shows edit only for author (Task 5)
- [x] `showSubtasks` toggle in ProjectsScreen header (Task 6)
- [x] KanbanView: `showSubtasks` prop, subtask visual marker (border-l + CornerDownRight), stacked chips (Task 7)
- [x] `StackedAssignees` extracted to `AssigneeChip.jsx` for reuse (Task 8 Step 2)
- [x] ListView: `showSubtasks`, checkbox column, floating bulk bar, subtask marker, parent name label, stacked chips (Task 8)
- [x] Bulk delete with ConfirmDialog (Task 8)
- [x] TimelineView: `showSubtasks`, subtask-after-parent ordering, visual marker (Task 9)

**No placeholders found.**

**Type consistency:** `StackedAssignees` receives `{ assignees, fallback }` and is defined once in `AssigneeChip.jsx`. Both `KanbanView` and `ListView` import it from there. The `SubtaskRow` is exported from `SubtaskRow.jsx` and imported in `TaskDetailPanel.jsx`.
