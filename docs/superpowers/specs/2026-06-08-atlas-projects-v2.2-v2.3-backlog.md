# atlas.projects V2.2 & V2.3 — Feature Backlog

These features are deferred from V2.1. Each phase will get its own full spec → Plan A (API) + Plan B (UI) → implementation cycle when V2.1 ships.

---

## Phase V2.2 — Collaboration & Notifications

**Depends on:** V2.1 (`ProjectTaskAssignee` table must exist for notification targeting)

### @Mentions in comments

When a user types `@` in a `TaskComment` body, a dropdown autocompletes project members. Stored as `@[userId]` tokens in the comment body. Resolved to display names on render.

**Schema addition:**
```prisma
model TaskMention {
  id        String      @id @default(dbgenerated("uuidv7()"))
  commentId String
  userId    String
  comment   TaskComment @relation(...)
  user      UserProfile @relation(...)
  @@unique([commentId, userId])
}
```

### Notification system

In-app notification bell (topbar) + optional email digest.

**Trigger events:**
- Task assigned to you (new `ProjectTaskAssignee` row with your userId)
- Task unassigned from you
- Comment posted on a task you are assigned to
- @mention in a comment
- Task due date within 24h (worker cron)
- Task status changed on a task assigned to you

**Schema addition:**
```prisma
model Notification {
  id          String   @id @default(dbgenerated("uuidv7()"))
  userId      String                    -- recipient
  kind        String                    -- ASSIGNED | UNASSIGNED | COMMENT | MENTION | DUE_SOON | STATUS_CHANGED
  entityType  String                    -- 'task' | 'project'
  entityId    String
  actorId     String?                   -- who triggered it
  body        String                    -- pre-rendered text
  readAt      DateTime?
  createdAt   DateTime @default(now())
}
```

**Delivery:** API emits notifications synchronously on each trigger action. Worker handles due-date cron. Email via existing email service (if configured).

**UI:**
- Bell icon in AppShell topbar with unread count badge
- Dropdown panel showing last 20 notifications
- Clicking navigates to the task; marks notification read
- "Marcar todo como leído" action

### Activity feed per task

Below comments in `TaskDetailPanel`, an **Actividad** timeline showing system-generated events:
- Status changes: `Martin cambió estado de Backlog → En desarrollo`
- Assignee changes: `Raul asignó a Carlos`
- Due date changes: `Fecha de vencimiento actualizada a 25 jun`

Events stored in existing `AuditLog` table (`entityType='task'`, `entityId=taskId`). Rendered read-only, no pagination needed (max ~50 events per task in practice).

---

## Phase V2.3 — Advanced Scheduling & Structure

**Depends on:** V2.1 (task model stable)

### Task dependencies

A task can block or be blocked by other tasks. Visual indicator on card/row when a dependency is unresolved.

**Schema addition:**
```prisma
model TaskDependency {
  id          String @id @default(dbgenerated("uuidv7()"))
  blockerId   String              -- the blocking task
  blockedId   String              -- the task being blocked
  blocker     Task   @relation("blocker", ...)
  blocked     Task   @relation("blocked", ...)
  @@unique([blockerId, blockedId])
}
```

**UI:** "Dependencias" section in `TaskDetailPanel`. A task with unresolved blockers shows a `🔒` icon on its card. `TimelineView` renders dependency arrows between bars.

### Recurring tasks

A task can have a recurrence rule (daily / weekly / monthly / custom RRULE string). When a recurring task is completed, the worker creates the next occurrence automatically.

**Schema addition:** `Task.rrule String?` + `Task.rruleNextAt DateTime?`

**UI:** "Repetir" field in `TaskFormModal` and `TaskDetailPanel`. Worker cron checks `rruleNextAt` daily.

### Custom fields per project

Project admins can define additional fields on tasks (text, number, date, select). Stored as EAV (entity-attribute-value) to avoid schema changes per field.

**Schema addition:**
```prisma
model ProjectField {
  id        String  @id @default(dbgenerated("uuidv7()"))
  projectId String
  name      String
  kind      String  -- TEXT | NUMBER | DATE | SELECT
  options   Json?   -- for SELECT kind: [{ value, label }]
  position  Int
}

model TaskFieldValue {
  id       String       @id @default(dbgenerated("uuidv7()"))
  taskId   String
  fieldId  String
  value    String       -- always stored as string, cast on read
  task     Task         @relation(...)
  field    ProjectField @relation(...)
  @@unique([taskId, fieldId])
}
```

**UI:** Custom fields rendered after built-in fields in `TaskDetailPanel`. A "Gestionar campos" option in the project settings (StatusEditor-style sheet).

### Export

**CSV:** All tasks in a project exported as CSV. Columns: title, status, priority, assignees, startDate, dueDate, description, custom fields.

**PDF:** Printable task list view using `@react-pdf/renderer` or server-side HTML→PDF.

**Endpoint:** `GET /projects/:id/export?format=csv|pdf`

**UI:** Export button in the project header dropdown menu.

### Workload view (stretch)

A new view tab showing a matrix of team members × weeks, with task load per cell. Useful for capacity planning. Depends on multi-assignee (V2.1) being complete.

---

## Implementation order recommendation

```
V2.1  →  V2.2 (notifications need assignee table)
               →  V2.3 (independent, can start after V2.1)
```

V2.2 and V2.3 can be developed in parallel once V2.1 is merged.

---

## Known deferred decisions

| Decision | Deferred to |
|---|---|
| Email provider for notifications | V2.2 spec |
| RRULE parsing library choice | V2.3 spec |
| PDF generation approach (client vs server) | V2.3 spec |
| Whether workload view is in-scope | V2.3 spec kickoff |
| Multi-project task linking (cross-project dependencies) | Post-V2.3 |
