# atlas.projects V2.1 — Enhanced Task Model Design

## Goal

Extend atlas.projects with multi-assignee tasks, subtask visibility across all views, inline comments, file attachments per task, and bulk actions in the list view. This phase is the prerequisite for V2.2 (collaboration/notifications) because it establishes the assignee join table that notifications will target.

## Architecture

Same pattern as the existing module: Prisma schema → `tasks-service.js` / `projects-service.js` → `projects-routes.js` → `useProjectsData.js` hooks → React views. No new route files. New schema models are added via a forward migration (never editing existing migrations).

**Tech Stack:** Prisma 7, Hono, TanStack Query, React, @atlas/ui components (`AttachmentsPanel`, `ComboboxField`, `ConfirmDialog`, `Checkbox`).

---

## Section 1 — Data Model

### New tables

```prisma
model ProjectTaskAssignee {
  id         String      @id @default(dbgenerated("uuidv7()"))
  taskId     String      @map("task_id")
  userId     String      @map("user_id")
  assignedAt DateTime    @default(now()) @map("assigned_at")

  task       Task        @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user       UserProfile @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId])
  @@map("project_task_assignee")
}

model TaskComment {
  id        String      @id @default(dbgenerated("uuidv7()"))
  taskId    String      @map("task_id")
  authorId  String      @map("author_id")
  body      String      @db.VarChar(5000)
  createdAt DateTime    @default(now()) @map("created_at")
  editedAt  DateTime?   @map("edited_at")

  task      Task        @relation(fields: [taskId], references: [id], onDelete: Cascade)
  author    UserProfile @relation(fields: [authorId], references: [id])

  @@map("task_comment")
}
```

### Changes to existing `Task` model

Add relation back-references only (no new columns on Task):
```prisma
// inside existing Task model
assignees  ProjectTaskAssignee[]
comments   TaskComment[]
```

`Task.assigneeId` is kept as-is (nullable). It holds the primary assignee for backwards compat with calendar bridge and existing views. It is always kept in sync: set to the first `ProjectTaskAssignee.userId` on add, updated to next or null on remove.

### File attachments

No new table. Use existing `FileAsset` with `entityId = taskId` and `entityType = 'task'`. The files service already supports this pattern.

---

## Section 2 — API

All changes are inside existing files:
- `apps/api/src/routes/projects/tasks-service.js`
- `apps/api/src/routes/projects/projects-routes.js`

### New endpoints

```
# Assignees
POST   /tasks/:taskId/assignees              { userId }
DELETE /tasks/:taskId/assignees/:userId
GET    /tasks/:taskId/assignees

# Comments
POST   /tasks/:taskId/comments               { body }
GET    /tasks/:taskId/comments               ?cursor=&limit=50
PATCH  /tasks/:taskId/comments/:commentId   { body }   author-only
DELETE /tasks/:taskId/comments/:commentId              author or project admin

# Attachments
POST   /tasks/:taskId/attachments            multipart — delegates to files service
GET    /tasks/:taskId/attachments

# Bulk
PATCH  /projects/:id/tasks/bulk             { taskIds[], patch: { statusId?, assigneeId?, priority? } }
DELETE /projects/:id/tasks/bulk             { taskIds[] }
```

### Changes to existing endpoints

**`listTasks`** — add `?includeSubtasks=true` query param. When `true`, removes the `parentTaskId: null` filter so subtasks appear in the flat list. Response adds `assignees[]` (with user profile) and `parentTask: { id, title }` on each task.

**`getTask`** — response adds:
- `assignees[]` — full `ProjectTaskAssignee` rows with user profile
- `comments[]` — last 20, ordered by `createdAt` asc
- `attachments[]` — `FileAsset` rows for this task

### Service rules

- `addAssignee(taskId, userId)` — creates `ProjectTaskAssignee` row; if first assignee, sets `Task.assigneeId = userId`
- `removeAssignee(taskId, userId)` — deletes row; if removed was primary, sets `Task.assigneeId` to next remaining `userId` or `null`
- `createComment(taskId, authorId, body)` — validates body non-empty, max 5000 chars
- `updateComment(commentId, authorId, body)` — validates author owns comment, sets `editedAt = now()`
- `deleteComment(commentId, requesterId, projectId)` — author or project admin (ADMIN role) may delete
- Bulk patch — each task validated to belong to the project before patching
- Bulk delete — cascades subtasks (Prisma `onDelete: Cascade` on `Task.parentTaskId`)

---

## Section 3 — Subtask visibility in views

### Toggle

All three views (Kanban, List, Timeline) get a **"Subtareas"** toggle button in their toolbar area. Default: **off** (preserves current behavior). State lives in the parent `ProjectsScreen` and is passed down as `showSubtasks` prop.

When `showSubtasks = true`, the hook call changes from `useTasks(projectId, { parentTaskId: 'null' })` to `useTasks(projectId, {})` (no parentTaskId filter).

### Visual marker (shared across all views)

A subtask is identified by `task.parentTaskId !== null`. Visual treatment applied consistently:

- Left border: `border-l-2 border-indigo-400/60`
- `↳` prefix icon (Lucide `CornerDownRight` size 10) before the title
- Parent task name displayed as `xs text-muted-foreground` label
- Card/row background: no change (keeps status-column color context)

### KanbanView

Subtask cards rendered in their own status column (independent `statusId`). Card shows:
```
↳  [subtask title]
   [parent task name — xs muted]
   [assignee chips]  [priority]  [date range]
```
Left border accent applied to the card container.

### ListView

Subtask rows have `pl-4` indent. The Tarea column shows `↳` icon + title + parent name label stacked. All other columns (assignee, priority, dates, status) show the subtask's own values.

### TimelineView

Subtask rows rendered immediately after their parent row in the left sidebar list (sort: parent first, then its children). Same `↳` + left-border visual. Subtasks without dates appear in the "Sin fecha" section.

---

## Section 4 — Multi-assignee UI

### TaskDetailPanel

Replace the single `SelectField "Asignado a"` with an inline assignee manager:

```
Asignado a
[M] Martin M.  ×    [R] Raul B.  ×
+ Agregar miembro...
```

- Each chip: `AssigneeAvatar` (existing component) + trimmed first name + `×` remove button
- `+ Agregar miembro` renders a `ComboboxField` filtered to project members not yet assigned to this task
- Adding: calls `POST /tasks/:taskId/assignees`
- Removing: calls `DELETE /tasks/:taskId/assignees/:userId`
- Optimistic update via TanStack Query `invalidateQueries(['tasks', projectId, taskId])`

### KanbanView cards

Up to 3 `AssigneeAvatar` chips stacked with `-space-x-1` overlap. If more than 3: `+N` badge.

### ListView

Same stacked chips in the Asignado column (max 3 + `+N`). Each avatar has a tooltip (existing `AssigneeChip` tooltip pattern).

### TaskFormModal (quick create)

Keeps single `SelectField` for one assignee to preserve fast creation UX. Extra assignees added post-creation in TaskDetailPanel.

### SubtaskRow (inside TaskDetailPanel)

Adds a single small avatar slot at the right. Clicking opens a compact member `ComboboxField`. One assignee per subtask.

---

## Section 5 — Bulk actions

### Location

ListView only. A checkbox column (`w-8`, no label) is added as the leftmost column. Controlled by a `selectedIds` Set in ListView local state.

### Selection

- Row checkbox: toggles individual task in `selectedIds`
- Header checkbox: selects / deselects all visible filtered rows
- Selecting any task reveals a floating action bar pinned to bottom of the ListView area

### Floating action bar

```
[N tareas seleccionadas]  [Cambiar estado ▾]  [Asignar ▾]  [Prioridad ▾]  [🗑 Eliminar]  [×]
```

- `×` clears selection
- **Cambiar estado** — `SelectField` with project statuses → `PATCH /projects/:id/tasks/bulk`
- **Asignar** — `ComboboxField` with project members → bulk patch `assigneeId`
- **Prioridad** — `SelectField` with priority options → bulk patch `priority`
- **Eliminar** — `ConfirmDialog` → `DELETE /projects/:id/tasks/bulk`; on success clears selection and invalidates task queries

---

## Section 6 — Comments

Inside `TaskDetailPanel`, a new **Actividad** section below the Archivos section.

### Display

Comments rendered chronologically oldest→newest. Each comment shows:
- `AssigneeAvatar` + author name + relative timestamp (`hace 2h`)
- `MarkdownField` rendered as read-only (use `dangerouslySetInnerHTML` with sanitized markdown output, or a read-only MarkdownField mode)
- Author sees edit (`Pen` icon) and delete (`Trash2` icon) on hover; project admins see delete only

### Compose

A `MarkdownField` at the bottom with a **Comentar** `Button`. Submits on button click or `Ctrl+Enter`. Clears field on success.

### Edit flow

Clicking edit replaces the comment body with an editable `MarkdownField` pre-filled with current body. **Guardar** / **Cancelar** buttons inline.

---

## Section 7 — File attachments

Inside `TaskDetailPanel`, an **Archivos** section between Description and Comments.

Uses the existing `AttachmentsPanel` component from `@atlas/ui` with:
- `entityId={taskId}`
- `entityType="task"`
- Upload calls `POST /tasks/:taskId/attachments`
- List calls `GET /tasks/:taskId/attachments`

No navigation to atlas.files. Inline upload only.

---

## Files created or modified

### Backend
| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `ProjectTaskAssignee`, `TaskComment` models; add relations to `Task` |
| `prisma/migrations/*/migration.sql` | New forward migration (auto-generated) |
| `apps/api/src/routes/projects/tasks-service.js` | `addAssignee`, `removeAssignee`, `createComment`, `updateComment`, `deleteComment`, `bulkUpdateTasks`, `bulkDeleteTasks`; update `listTasks`, `getTask` |
| `apps/api/src/routes/projects/projects-routes.js` | Mount new endpoints for assignees, comments, attachments, bulk |

### Frontend
| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js` | Add hooks: `useTaskAssignees`, `useAddAssignee`, `useRemoveAssignee`, `useTaskComments`, `useCreateComment`, `useUpdateComment`, `useDeleteComment`, `useTaskAttachments`, `useBulkUpdateTasks`, `useBulkDeleteTasks`; update `useTasks` to accept `showSubtasks` |
| `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` | Replace single assignee field with multi-assignee manager; add Comments section; add Attachments section |
| `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx` | Add subtask toggle; stacked assignee chips; subtask visual marker |
| `apps/desktop/src/modules/atlas.projects/components/ListView.jsx` | Add subtask toggle; checkbox column; bulk action bar; stacked assignee chips; subtask visual marker |
| `apps/desktop/src/modules/atlas.projects/components/TimelineView.jsx` | Add subtask toggle; subtask visual marker and ordering |
| `apps/desktop/src/modules/atlas.projects/components/SubtaskRow.jsx` | Extract from TaskDetailPanel into its own file; add single assignee picker |
| `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx` | Manage `showSubtasks` state, pass to all views |

---

## Out of scope for V2.1

- @mention resolution in comments (V2.2)
- Notifications (V2.2)
- Task dependencies / blocking (V2.3)
- Recurring tasks (V2.3)
- Custom fields (V2.3)
- Export (V2.3)
- Workload / capacity view (V2.3)
