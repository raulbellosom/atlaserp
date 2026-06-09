# atlas.projects V2.3 — Advanced Scheduling & Structure

**Status:** Approved  
**Depends on:** V2.1 (task model), V2.2 (notifications infrastructure)  
**Scope:** Task dependencies, recurring tasks, custom fields per project, CSV export  
**Excluded from this phase:** Workload view (stretch, deferred), PDF export (deferred)

---

## 1. Task Dependencies

### Schema

```prisma
model TaskDependency {
  id        String @id @default(uuid(7)) @db.Uuid
  blockerId String @db.Uuid @map("blocker_id")
  blockedId String @db.Uuid @map("blocked_id")
  createdAt DateTime @default(now()) @map("created_at")
  blocker   Task @relation("TaskBlocker", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked   Task @relation("TaskBlocked", fields: [blockedId], references: [id], onDelete: Cascade)
  @@unique([blockerId, blockedId])
  @@index([blockerId])
  @@index([blockedId])
  @@map("task_dependency")
}
```

Task model additions:
```prisma
blockedBy TaskDependency[] @relation("TaskBlocked")   // tasks that block this one
blocking  TaskDependency[] @relation("TaskBlocker")   // tasks this one blocks
```

### API

- `GET /projects/:id/tasks/:tid/dependencies` — list blockers and blocked
- `POST /projects/:id/tasks/:tid/dependencies` — body: `{ blockerId }` (this task is blocked by blockerId)
- `DELETE /projects/:id/tasks/:tid/dependencies/:depId` — remove a dependency

Validation: prevent self-dependency and cycles (A blocks B blocks A). Return 409 for duplicates and cycles.

### UI

- "Dependencias" section in `TaskDetailPanel` — shows blockers (tasks blocking this) + blocking (tasks this blocks). Add via combobox picker over project tasks, remove via X button.
- Lock icon (`Lock` from lucide) on KanbanView card and ListViewCard when `task.blockedBy.length > 0` and any blocker is incomplete (`isDone: false`).

---

## 2. Recurring Tasks

### Schema

Two new nullable columns on `Task`:
- `rrule String?` — RRULE string (e.g. `FREQ=WEEKLY;BYDAY=MO`)
- `rrule_next_at DateTime?` — next scheduled occurrence date (set by worker)

Simple supported presets (stored as canonical RRULE strings):
| Label | RRULE |
|---|---|
| Diario | `FREQ=DAILY` |
| Semanal | `FREQ=WEEKLY` |
| Quincenal | `FREQ=WEEKLY;INTERVAL=2` |
| Mensual | `FREQ=MONTHLY` |

No external RRULE parsing library needed — only these 4 presets are supported in V2.3.

### Worker logic

Every hour (reuse existing worker interval), query tasks where:
- `rrule IS NOT NULL`
- `isDone = true`
- `rrule_next_at <= NOW()`

For each: create a new task copying `title`, `description`, `projectId`, `statusId` (first non-done status), `priority`, `rrule`; set `rrule_next_at` to next occurrence from now based on preset. Clear `isDone=false` on the new task (it's a fresh copy, not a clone of the done task).

`rrule_next_at` is set when `rrule` is saved: calculated as next occurrence from now.

### API

- `PATCH /projects/:id/tasks/:tid` already handles arbitrary fields — extend to accept `rrule` (string | null).
- New service helper: `computeRruleNextAt(rrule)` — returns next Date from now for the 4 supported presets.

### UI

- "Repetir" `SelectField` in `TaskDetailPanel` with options: Sin repeticion, Diario, Semanal, Quincenal, Mensual.
- When a recurring task is displayed, show a `RefreshCw` chip next to the task number badge.

---

## 3. Custom Fields per Project

### Schema

```prisma
model ProjectField {
  id        String   @id @default(uuid(7)) @db.Uuid
  projectId String   @db.Uuid @map("project_id")
  name      String
  kind      String   -- TEXT | NUMBER | DATE | SELECT
  options   Json?    -- [{ value, label }] for SELECT kind
  position  Int      @default(0)
  createdAt DateTime @default(now()) @map("created_at")
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  values    TaskFieldValue[]
  @@index([projectId])
  @@map("project_field")
}

model TaskFieldValue {
  id      String       @id @default(uuid(7)) @db.Uuid
  taskId  String       @db.Uuid @map("task_id")
  fieldId String       @db.Uuid @map("field_id")
  value   String
  task    Task         @relation(fields: [taskId], references: [id], onDelete: Cascade)
  field   ProjectField @relation(fields: [fieldId], references: [id], onDelete: Cascade)
  @@unique([taskId, fieldId])
  @@index([taskId])
  @@map("task_field_value")
}
```

Task model addition: `fieldValues TaskFieldValue[]`  
Project model addition: `fields ProjectField[]`

### API

Project fields CRUD:
- `GET /projects/:id/fields`
- `POST /projects/:id/fields` — `{ name, kind, options?, position? }`
- `PATCH /projects/:id/fields/:fid` — `{ name?, options?, position? }`
- `DELETE /projects/:id/fields/:fid`

Task field values:
- `GET /projects/:id/tasks/:tid/field-values` — returns `[{ field, value }]`
- `PUT /projects/:id/tasks/:tid/field-values` — body: `[{ fieldId, value }]` (upsert all at once)

`GET /projects/:id/tasks/:tid` response already includes field values when eager-loaded.

### UI

- "Campos" section in `TaskDetailPanel` — renders each `ProjectField` with its current `TaskFieldValue`. Edit inline; debounced PUT on change.
- Field kinds render as: TEXT → text input, NUMBER → number input, DATE → date input, SELECT → `SelectField`.
- "Gestionar campos" sheet accessible from the project settings panel (gear icon). Lists fields with drag-to-reorder (simple up/down buttons), add, edit name/options, delete with confirm.

---

## 4. CSV Export

### API

`GET /projects/:id/export?format=csv`

Columns: `#` (taskNumber), Titulo, Estado, Prioridad, Asignados, Fecha inicio, Fecha vencimiento, Descripcion, + one column per custom field.

Returns `Content-Type: text/csv; charset=utf-8` with `Content-Disposition: attachment; filename="project-{slug}-tasks.csv"`.

### UI

Export button in the project header dropdown (3-dot menu or dedicated button). Triggers a direct download via `window.open(url)` with bearer token passed as query param `?token=<access_token>&format=csv`.

---

## Permissions

Reuse existing `projects.*` permission set. No new permission keys needed for V2.3 features.

---

## Migration

Single migration file: `20260608250000_atlas_projects_v2_3`

Contents:
1. `task_dependency` table
2. `rrule` and `rrule_next_at` columns on `task`
3. `project_field` table
4. `task_field_value` table
