# Atlas Projects — Design Spec

**Date:** 2026-06-08
**Module:** `atlas.projects`
**Status:** Approved

---

## 1. Context

Atlas ERP needs a project and task management module comparable to Asana, Plane, or Odoo's project module. No such module exists today. Tasks related to ongoing work (client deliverables, HR campaigns, fleet maintenance plans) have no centralized place to be tracked, assigned, and visualized.

`atlas.projects` is a Prisma-backed feature module following the same architectural pattern as `atlas.calendar` and `atlas.hr` — dedicated Prisma models, dedicated Hono routes, and custom React views. It integrates with `atlas.calendar` to give each project its own calendar and automatically synchronize task due dates as calendar events.

---

## 2. Scope

### Included in V1

- Projects as the primary organizing unit; tasks always belong to a project
- A default "General" project created per company as inbox for unstructured tasks
- Custom Kanban statuses per project with position ordering and color
- Status templates (General, Desarrollo, Ventas, Marketing) to bootstrap new projects quickly
- Three views per project: Kanban, Lista (table), Timeline (Gantt horizontal)
- One level of subtasks (subtasks cannot have their own subtasks)
- Task fields: title, description (plain text in V1), assignee (single workspace member), priority (NONE/LOW/MEDIUM/HIGH/URGENT), start_date, due_date, position within status column (ordering)
- Project membership with roles: OWNER, MEMBER, VIEWER
- Calendar integration: each project gets its own `CalendarCalendar`; tasks with due_date auto-create a read-only `CalendarEvent`; project members automatically get calendar visibility
- 9 granular RBAC permissions
- Manifest snapshot in `apps/api/src/manifests/official/feature-modules.js`

### Excluded from V1

- Comments on tasks (V2 via `atlas.activity`)
- File attachments on tasks (V2 via `atlas.files`)
- Assignment notifications (V2 via `atlas.notifications`)
- Multiple assignees per task
- Labels/tags on tasks
- Task dependencies (task A blocks task B)
- Cross-project "My tasks" view
- External contacts as assignees
- Team/group assignment
- Automated task creation from other modules via `exposes` contract (documented as Plan C below)

---

## 3. Architecture

### Module identity

```js
{
  key: 'atlas.projects',
  name: 'Proyectos',
  version: '1.0.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  dependencies: [
    { key: 'atlas.identity' },
    { key: 'atlas.company' },
    { key: 'atlas.calendar', optional: true },
  ],
}
```

### File structure

```
apps/api/src/routes/projects/
  projects-routes.js              — Hono router, thin
  projects-service.js             — project CRUD, membership, status management
  tasks-service.js                — task CRUD, subtasks, assignees, reordering
  projects-calendar-bridge.js     — creates/syncs CalendarCalendar and CalendarEvent

apps/desktop/src/modules/atlas.projects/
  screens/
    ProjectsScreen.jsx            — project hub with left sidebar
    ProjectDetailScreen.jsx       — routes to active view within a project
  components/
    KanbanView.jsx                — drag-and-drop column board
    ListView.jsx                  — filterable table view
    TimelineView.jsx              — horizontal Gantt bars
    TaskFormModal.jsx             — create/edit task
    TaskDetailPanel.jsx           — slide-over panel with full task detail + subtasks
    ProjectFormModal.jsx          — create/edit project + status template picker
    StatusEditor.jsx              — manage project columns (add, rename, reorder, color)

packages/sdk/src/index.js         — atlas.projects.{ listProjects, createProject, listTasks, createTask, ... }
```

---

## 4. Data Model (Prisma)

```prisma
model Project {
  id          String   @id @default(uuid(7)) @db.Uuid
  company_id  String   @db.Uuid
  name        String
  description String?
  color       String?
  icon        String?
  owner_id    String   @db.Uuid
  start_date  DateTime?
  due_date    DateTime?
  calendar_id String?  @db.Uuid   // FK to CalendarCalendar — null if atlas.calendar not installed
  status      ProjectStatus @default(ACTIVE)
  created_at  DateTime @default(now())
  updated_at  DateTime @updatedAt

  members     ProjectMember[]
  statuses    TaskStatus[]
  tasks       Task[]
  @@map("project")
}

enum ProjectStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  @@map("project_status_enum")
}

model ProjectMember {
  id         String   @id @default(uuid(7)) @db.Uuid
  project_id String   @db.Uuid
  user_id    String   @db.Uuid
  role       ProjectMemberRole @default(MEMBER)
  joined_at  DateTime @default(now())

  project    Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)
  @@unique([project_id, user_id])
  @@map("project_member")
}

enum ProjectMemberRole {
  OWNER
  MEMBER
  VIEWER
  @@map("project_member_role")
}

model TaskStatus {
  id         String   @id @default(uuid(7)) @db.Uuid
  project_id String   @db.Uuid
  name       String
  color      String   @default("#64748b")
  position   Int
  is_default Boolean  @default(false)
  is_done    Boolean  @default(false)

  project    Project  @relation(fields: [project_id], references: [id], onDelete: Cascade)
  tasks      Task[]
  @@map("task_status")
}

model Task {
  id               String   @id @default(uuid(7)) @db.Uuid
  project_id       String   @db.Uuid
  status_id        String   @db.Uuid
  parent_task_id   String?  @db.Uuid   // one level of subtasks only
  title            String
  description      String?
  assignee_id      String?  @db.Uuid
  priority         TaskPriority @default(NONE)
  start_date       DateTime?
  due_date         DateTime?
  calendar_event_id String? @db.Uuid   // FK to CalendarEvent — null if no due_date or atlas.calendar not installed
  position         Int
  created_by       String   @db.Uuid
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt

  project          Project    @relation(fields: [project_id], references: [id], onDelete: Cascade)
  status           TaskStatus @relation(fields: [status_id], references: [id])
  subtasks         Task[]     @relation("TaskSubtasks")
  parent           Task?      @relation("TaskSubtasks", fields: [parent_task_id], references: [id])
  @@map("task")
}

enum TaskPriority {
  NONE
  LOW
  MEDIUM
  HIGH
  URGENT
  @@map("task_priority")
}
```

### Status templates (constants in code, not a DB table)

```js
const STATUS_TEMPLATES = {
  general:     [{ name: 'Por hacer', color: '#64748b', is_default: true }, { name: 'En progreso', color: '#3b82f6' }, { name: 'Listo', color: '#22c55e', is_done: true }],
  desarrollo:  [{ name: 'Backlog' }, { name: 'En desarrollo', color: '#3b82f6', is_default: true }, { name: 'En revision', color: '#f59e0b' }, { name: 'QA', color: '#a855f7' }, { name: 'Deploy', color: '#f97316' }, { name: 'Listo', color: '#22c55e', is_done: true }],
  ventas:      [{ name: 'Lead', is_default: true }, { name: 'Propuesta', color: '#3b82f6' }, { name: 'Negociacion', color: '#f59e0b' }, { name: 'Ganado', color: '#22c55e', is_done: true }, { name: 'Perdido', color: '#ef4444', is_done: true }],
  marketing:   [{ name: 'Ideas', is_default: true }, { name: 'Planificado', color: '#3b82f6' }, { name: 'En produccion', color: '#f59e0b' }, { name: 'Publicado', color: '#22c55e', is_done: true }],
}
```

---

## 5. API Routes

All routes mounted at `/projects`, protected by `requireAuth` + `requirePermission`.

```
GET    /projects                         projects.project.read   — list company projects (with member count, task progress)
POST   /projects                         projects.project.create — create project + seed statuses from template + create CalendarCalendar
GET    /projects/:id                     projects.project.read   — project detail + members + statuses
PATCH  /projects/:id                     projects.project.update — edit name, color, dates, etc.
DELETE /projects/:id                     projects.project.delete — archive (soft: status = ARCHIVED)

GET    /projects/:id/members             projects.project.read   — list project members
POST   /projects/:id/members             projects.member.manage  — add member + share CalendarCalendar
PATCH  /projects/:id/members/:uid        projects.member.manage  — change member role
DELETE /projects/:id/members/:uid        projects.member.manage  — remove member + revoke calendar share

GET    /projects/:id/statuses            projects.task.read      — list statuses ordered by position
POST   /projects/:id/statuses            projects.project.update — create status column
PATCH  /projects/:id/statuses/:sid       projects.project.update — rename, recolor, reorder
DELETE /projects/:id/statuses/:sid       projects.project.update — delete column (tasks move to default status)

GET    /projects/:id/tasks               projects.task.read      — list tasks (filters: status_id, assignee_id, priority, due_date range, parent_task_id=null for top-level)
POST   /projects/:id/tasks               projects.task.create    — create task + trigger calendar bridge
GET    /projects/:id/tasks/:tid          projects.task.read      — task detail + subtasks
PATCH  /projects/:id/tasks/:tid          projects.task.update    — edit task + trigger calendar bridge on due_date change
DELETE /projects/:id/tasks/:tid          projects.task.delete    — delete task + subtasks + cancel calendar event
PATCH  /projects/:id/tasks/:tid/move     projects.task.update    — move to different status + reorder position (Kanban drag)
```

---

## 6. Calendar Bridge

File: `apps/api/src/routes/projects/projects-calendar-bridge.js`

The bridge checks whether `atlas.calendar` is installed and enabled before any operation. If not installed, all bridge functions are no-ops.

**On project create:**
- Calls `calendar-service.createCalendar({ name: project.name, color: project.color, company_id, owner_id: project.owner_id })`
- Stores returned `calendar.id` in `project.calendar_id`

**On project rename/recolor:**
- Updates the linked `CalendarCalendar` name and color via `calendar-service.updateCalendar`

**On member add:**
- Inserts a `CalendarShare` row for the new member with role `VIEWER` on the project calendar
- Member now sees the project calendar in their `atlas.calendar` sidebar

**On member remove:**
- Deletes the `CalendarShare` row for that user

**On task create/update with `due_date` set:**
- If `task.calendar_event_id` is null: creates a `CalendarEvent` with `source_module='atlas.projects'`, `source_entity_id=task.id`, `calendar_id=project.calendar_id`
- If `task.calendar_event_id` exists: updates the event title and dates
- Stores returned `event.id` in `task.calendar_event_id`

**On task `due_date` cleared:**
- Cancels (soft-deletes) the linked `CalendarEvent`
- Sets `task.calendar_event_id = null`

**On task delete:**
- Deletes the linked `CalendarEvent` if present

**Calendar event read-only enforcement:**
- `CalendarEvent` rows where `source_module` is set are treated as read-only by the calendar UI (no `editable` field needed — the presence of `source_module` is the signal)
- The calendar UI shows a "Ver tarea" link (`source_entity_id` routes to `/app/projects?task=<id>`) instead of an edit form when `source_module='atlas.projects'`

---

## 7. UI Structure

### Navigation

Route `/app/projects` is added to the module's `navigation` manifest entry. `AppShell` renders it in the sidebar when the module is enabled and the user has `projects.access`.

### ProjectsScreen

Left sidebar lists all projects the user is a member of. Clicking a project loads `ProjectDetailScreen` in the main area. A "Nuevo proyecto" button at the bottom of the sidebar opens `ProjectFormModal`.

### ProjectDetailScreen

Header shows project name, member avatars, and the view switcher (Kanban | Lista | Timeline). The active view is stored in component state (not URL) so switching views is instant.

### KanbanView

- Columns rendered from `ProjectStatus` ordered by `position`
- Drag-and-drop within and between columns updates `task.position` and `task.status_id` via `PATCH /tasks/:id/move`
- Each card shows: title, assignee avatar, priority badge, due_date chip (red if overdue)
- Clicking a card opens `TaskDetailPanel` as a slide-over
- "+" button at bottom of each column opens inline quick-create for that status

### ListView

- Filterable table: search by title, filter by assignee, priority, status, due_date range
- Columns: title (with subtask count indicator), assignee, priority, due_date, status
- Row click opens `TaskDetailPanel`
- Bulk status change via row checkboxes

### TimelineView

- Left column: task names (only tasks with `start_date` or `due_date`)
- Right: horizontal scrollable Gantt chart grouped by week
- Bar width = duration between `start_date` and `due_date`; if only `due_date`, renders as a milestone diamond
- Bars are not draggable in V1 (date editing via `TaskDetailPanel`)
- Tasks without any date are listed below the chart as "Sin fecha"

### TaskDetailPanel

Slide-over panel (right side) showing full task detail: title (editable inline), description (plain text textarea), assignee picker, priority selector, date pickers, status selector, subtask list. Subtasks render as a checklist inside the panel with their own quick-create input.

---

## 8. Permissions

Registered in `apps/api/src/permission-catalog.js`:

```js
{ key: 'projects.access',         name: 'Acceder a Proyectos',          description: 'Ver el modulo en navegacion' },
{ key: 'projects.project.read',   name: 'Ver proyectos',                 description: 'Leer proyectos donde es miembro' },
{ key: 'projects.project.create', name: 'Crear proyectos',               description: 'Crear proyectos nuevos' },
{ key: 'projects.project.update', name: 'Editar proyectos',              description: 'Editar datos y columnas del proyecto' },
{ key: 'projects.project.delete', name: 'Archivar proyectos',            description: 'Archivar o eliminar proyectos' },
{ key: 'projects.task.read',      name: 'Ver tareas',                    description: 'Leer tareas del proyecto' },
{ key: 'projects.task.create',    name: 'Crear tareas',                  description: 'Crear nuevas tareas' },
{ key: 'projects.task.update',    name: 'Editar tareas',                 description: 'Editar tareas existentes' },
{ key: 'projects.task.delete',    name: 'Eliminar tareas',               description: 'Eliminar tareas y subtareas' },
{ key: 'projects.member.manage',  name: 'Gestionar miembros',            description: 'Agregar o remover miembros del proyecto' },
```

---

## 9. Plan C — Cross-module task creation (future)

This is documented for future implementation. No code is written for this in V1.

**Goal:** Allow other Atlas modules (atlas.hr, atlas.fleet, atlas.contacts) to create tasks automatically in a designated project via a service contract.

**Proposed contract:**

```js
// Exposed by atlas.projects, consumed by other modules
await projectsService.createTaskFromModule({
  company_id,
  project_id,          // caller specifies which project, or a company-level default
  title,
  due_date,
  assignee_id,
  source_module,       // e.g. 'atlas.hr'
  source_entity_id,    // e.g. employee.id
  source_label,        // e.g. 'Juan Perez — Renovacion contrato'
})
```

**When to implement:** Once at least one other module has a concrete need for automated task creation (e.g., HR contract renewal reminders, fleet maintenance scheduling).

---

## 10. Out of scope (V1) — future backlog

| Feature | Notes |
|---|---|
| Task comments | V2 via `atlas.activity` publish contract |
| File attachments on tasks | V2 via `atlas.files` `AttachmentsPanel` |
| Assignment notifications | V2 via `atlas.notifications` |
| Multiple assignees per task | Expand `TaskAssignee` table |
| Labels/tags | New `TaskLabel` + `TaskLabelAssignment` tables |
| Task dependencies | New `TaskDependency` table with `BLOCKS`/`BLOCKED_BY` types |
| Cross-project "My tasks" view | New screen consuming `GET /tasks?assignee_id=me` across projects |
| Automated task creation from modules | Plan C above |
| Bidirectional calendar sync | Edit task from calendar event click-through |
