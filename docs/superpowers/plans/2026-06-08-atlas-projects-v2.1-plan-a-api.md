# atlas.projects V2.1 — Plan A: API & Schema

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `ProjectTaskAssignee` and `TaskComment` Prisma models, enrich `listTasks`/`getTask` responses, add multi-assignee CRUD, comment CRUD, task attachment endpoints, and bulk update/delete — all within existing files.

**Architecture:** New Prisma models → `tasks-service.js` service functions → new routes in `projects-routes.js` → SDK methods in `packages/sdk/src/index.js`. No new files (except test file). Files-service gets `'Task'` added to its entity type allowlist so the standard `/files` upload endpoint accepts task attachments.

**Tech Stack:** Prisma 7, Hono, Node.js `node:test`, no TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-08-atlas-projects-v2.1-design.md`

---

## File Map

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `ProjectTaskAssignee`, `TaskComment`; add back-refs to `Task` and `UserProfile` |
| `apps/api/src/services/files-service.js` | Add `'Task'` to `ALLOWED_FILE_ENTITY_TYPES` |
| `apps/api/src/routes/projects/tasks-service.js` | `addAssignee`, `removeAssignee`, `createComment`, `updateComment`, `deleteComment`, `bulkUpdateTasks`, `bulkDeleteTasks`; update `listTasks`, `getTask` |
| `apps/api/src/routes/projects/projects-routes.js` | Mount assignees, comments, attachments, bulk endpoints |
| `packages/sdk/src/index.js` | Add 11 SDK methods for assignees, comments, attachments, bulk |
| `apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js` | Tests for all new service functions |

---

### Task 1: Prisma schema — ProjectTaskAssignee + TaskComment

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add new models and back-references**

Open `prisma/schema.prisma`. Make four edits:

**Edit 1** — Add `ProjectTaskAssignee` and `TaskComment` models at the end of the file (after the `Task` model block, around line 1677):

```prisma
model ProjectTaskAssignee {
  id         String      @id @default(uuid(7)) @db.Uuid
  taskId     String      @db.Uuid @map("task_id")
  userId     String      @db.Uuid @map("user_id")
  assignedAt DateTime    @default(now()) @map("assigned_at")

  task       Task        @relation("TaskAssignees", fields: [taskId], references: [id], onDelete: Cascade)
  user       UserProfile @relation("TaskAssigneeUser", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([taskId, userId])
  @@map("project_task_assignee")
}

model TaskComment {
  id        String      @id @default(uuid(7)) @db.Uuid
  taskId    String      @db.Uuid @map("task_id")
  authorId  String      @db.Uuid @map("author_id")
  body      String      @db.VarChar(5000)
  createdAt DateTime    @default(now()) @map("created_at")
  editedAt  DateTime?   @map("edited_at")

  task      Task        @relation("TaskComments", fields: [taskId], references: [id], onDelete: Cascade)
  author    UserProfile @relation("TaskCommentAuthor", fields: [authorId], references: [id])

  @@map("task_comment")
}
```

**Edit 2** — Inside the `Task` model (after the existing `parent   Task?   @relation` line), add:

```prisma
  assignees  ProjectTaskAssignee[] @relation("TaskAssignees")
  comments   TaskComment[]         @relation("TaskComments")
```

**Edit 3** — Inside `UserProfile` (after `tasksCreated Task[] @relation("TaskCreator")`), add:

```prisma
  projectTaskAssignees ProjectTaskAssignee[] @relation("TaskAssigneeUser")
  taskComments         TaskComment[]         @relation("TaskCommentAuthor")
```

- [ ] **Step 2: Validate schema syntax**

```bash
pnpm exec prisma validate
```

Expected: no errors. Fix any reported issues before continuing.

- [ ] **Step 3: Generate and apply migration**

```bash
pnpm exec prisma migrate dev --name add_project_task_assignee_comment
```

Expected output: `Your database is now in sync with your schema.` and a new file under `prisma/migrations/`.

- [ ] **Step 4: Regenerate Prisma client**

```bash
pnpm db:generate
```

Expected: no errors. `prisma.projectTaskAssignee` and `prisma.taskComment` are now available.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(projects): add ProjectTaskAssignee and TaskComment schema models"
```

---

### Task 2: Allow 'Task' entity type in files service

**Files:**
- Modify: `apps/api/src/services/files-service.js:10-20`

- [ ] **Step 1: Write the failing test**

Open `apps/api/src/services/__tests__/files-service.test.js` (if it exists). If it does not exist, skip — the test is an integration concern and the change is trivial.

- [ ] **Step 2: Edit ALLOWED_FILE_ENTITY_TYPES**

In `apps/api/src/services/files-service.js`, find lines 10-20:

```js
const ALLOWED_FILE_ENTITY_TYPES = [
  "AtlasFile",
  "BrandingConfig",
  "Company",
  "HrEmployee",
  "Contact",
  "FleetVehicle",
  "FleetDriver",
  "FleetMaintenance",
  "FleetReport",
];
```

Add `"Task"` to the array:

```js
const ALLOWED_FILE_ENTITY_TYPES = [
  "AtlasFile",
  "BrandingConfig",
  "Company",
  "HrEmployee",
  "Contact",
  "FleetVehicle",
  "FleetDriver",
  "FleetMaintenance",
  "FleetReport",
  "Task",
];
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/services/files-service.js
```

Expected: exits 0 with no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/services/files-service.js
git commit -m "feat(files): allow Task entity type for task attachments"
```

---

### Task 3: Enrich listTasks and getTask — assignees array

**Files:**
- Modify: `apps/api/src/routes/projects/tasks-service.js`
- Test: `apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTasksService } from '../tasks-service.js'

function makePrisma(overrides = {}) {
  const tasks = {
    't-1': { id: 't-1', projectId: 'p-1', statusId: 's-1', position: 0, title: 'Task 1', createdBy: 'u-1', priority: 'NONE', parentTaskId: null },
  }
  const assignees = {}
  const comments = {}

  return {
    task: {
      create: async (args) => {
        const t = { id: 'new-task', createdAt: new Date(), updatedAt: new Date(), ...args.data }
        tasks[t.id] = t
        return t
      },
      findFirst: async ({ where }) => tasks[where.id] ?? null,
      findMany: async ({ include } = {}) => Object.values(tasks).map((t) => ({
        ...t,
        ...(include?.assignees ? { assignees: [] } : {}),
        ...(include?.status ? { status: null } : {}),
        _count: { subtasks: 0 },
      })),
      update: async ({ where, data }) => { tasks[where.id] = { ...tasks[where.id], ...data }; return tasks[where.id] },
      updateMany: async () => {},
      delete: async ({ where }) => { const t = tasks[where.id]; delete tasks[where.id]; return t },
      deleteMany: async () => {},
    },
    taskStatus: {
      findFirst: async ({ where }) =>
        where?.id === 's-1' ? { id: 's-1', projectId: 'p-1' } : null,
    },
    projectTaskAssignee: {
      create: async (args) => {
        const a = { id: 'a-1', assignedAt: new Date(), ...args.data }
        assignees[`${a.taskId}-${a.userId}`] = a
        return a
      },
      findFirst: async ({ where }) =>
        assignees[`${where.taskId}-${where.userId}`] ?? null,
      findMany: async ({ where }) =>
        Object.values(assignees).filter((a) => a.taskId === where.taskId),
      delete: async ({ where }) => {
        const key = Object.keys(assignees).find(
          (k) => assignees[k].taskId === where.taskId_userId?.taskId && assignees[k].userId === where.taskId_userId?.userId,
        )
        if (!key) return null
        const a = assignees[key]
        delete assignees[key]
        return a
      },
    },
    taskComment: {
      create: async (args) => {
        const c = { id: 'c-1', createdAt: new Date(), editedAt: null, ...args.data }
        comments[c.id] = c
        return c
      },
      findFirst: async ({ where }) => comments[where.id] ?? null,
      findMany: async ({ where }) =>
        Object.values(comments).filter((c) => c.taskId === where.taskId),
      update: async ({ where, data }) => {
        comments[where.id] = { ...comments[where.id], ...data }
        return comments[where.id]
      },
      delete: async ({ where }) => {
        const c = comments[where.id]
        delete comments[where.id]
        return c
      },
    },
    fileAsset: {
      findMany: async ({ where }) => [],
      findFirst: async ({ where }) => null,
    },
    ...overrides,
  }
}

describe('V2.1 service functions', () => {
  describe('addAssignee', () => {
    it('creates ProjectTaskAssignee row', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const result = await svc.addAssignee('t-1', 'u-2')
      assert.equal(result.taskId, 't-1')
      assert.equal(result.userId, 'u-2')
    })

    it('throws 409 when assignee already exists', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await svc.addAssignee('t-1', 'u-2')
      await assert.rejects(
        () => svc.addAssignee('t-1', 'u-2'),
        (err) => { assert.equal(err.status, 409); return true },
      )
    })

    it('sets Task.assigneeId when first assignee is added', async () => {
      let updatedAssigneeId = null
      const prisma = makePrisma({
        task: {
          ...makePrisma().task,
          findFirst: async ({ where }) =>
            where?.id === 't-1' ? { id: 't-1', projectId: 'p-1', assigneeId: null } : null,
          update: async ({ where, data }) => {
            if (data.assigneeId !== undefined) updatedAssigneeId = data.assigneeId
            return { id: where.id, ...data }
          },
        },
      })
      const svc = createTasksService({ prisma })
      await svc.addAssignee('t-1', 'u-2')
      assert.equal(updatedAssigneeId, 'u-2')
    })
  })

  describe('removeAssignee', () => {
    it('throws 404 when assignee not found', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.removeAssignee('t-1', 'u-nonexistent'),
        (err) => { assert.equal(err.status, 404); return true },
      )
    })
  })

  describe('createComment', () => {
    it('creates comment', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      const c = await svc.createComment('t-1', 'u-1', 'Hello world')
      assert.equal(c.body, 'Hello world')
      assert.equal(c.authorId, 'u-1')
    })

    it('throws 400 when body is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.createComment('t-1', 'u-1', '   '),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })

    it('throws 400 when body exceeds 5000 chars', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.createComment('t-1', 'u-1', 'x'.repeat(5001)),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })
  })

  describe('updateComment', () => {
    it('throws 403 when requester is not the author', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      // Create a comment by u-1
      await svc.createComment('t-1', 'u-1', 'body')
      await assert.rejects(
        () => svc.updateComment('c-1', 'u-DIFFERENT', 'new body'),
        (err) => { assert.equal(err.status, 403); return true },
      )
    })
  })

  describe('bulkUpdateTasks', () => {
    it('throws 400 when taskIds is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.bulkUpdateTasks('p-1', [], { statusId: 's-1' }),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })
  })

  describe('bulkDeleteTasks', () => {
    it('throws 400 when taskIds is empty', async () => {
      const prisma = makePrisma()
      const svc = createTasksService({ prisma })
      await assert.rejects(
        () => svc.bulkDeleteTasks('p-1', []),
        (err) => { assert.equal(err.status, 400); return true },
      )
    })
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL (functions not implemented yet)**

```bash
node --test apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js
```

Expected: failures about `addAssignee is not a function`, etc.

- [ ] **Step 3: Update listTasks to include assignees and optional subtasks**

In `apps/api/src/routes/projects/tasks-service.js`, replace the `listTasks` function:

```js
async function listTasks(projectId, { statusId, assigneeId, priority, dueDateFrom, dueDateTo, parentTaskId, includeSubtasks } = {}) {
  const where = { projectId }
  if (statusId) where.statusId = statusId
  if (assigneeId) where.assigneeId = assigneeId
  if (priority) where.priority = priority
  if (dueDateFrom || dueDateTo) {
    where.dueDate = {}
    if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom)
    if (dueDateTo) where.dueDate.lte = new Date(dueDateTo)
  }
  if (!includeSubtasks) {
    where.parentTaskId = parentTaskId === undefined ? null : parentTaskId
  }
  return prisma.task.findMany({
    where,
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
      assignees: {
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
        orderBy: { assignedAt: 'asc' },
      },
      status: true,
      parent: { select: { id: true, title: true } },
      _count: { select: { subtasks: true } },
    },
    orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
  })
}
```

- [ ] **Step 4: Update getTask to include assignees, comments, attachments**

Replace the `getTask` function:

```js
async function getTask(taskId) {
  const task = await prisma.task.findFirst({
    where: { id: taskId },
    include: {
      assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
      assignees: {
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
        orderBy: { assignedAt: 'asc' },
      },
      status: true,
      subtasks: {
        include: {
          assignee: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
          assignees: {
            include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
          },
        },
        orderBy: { position: 'asc' },
      },
      comments: {
        include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
        orderBy: { createdAt: 'asc' },
        take: 20,
      },
      parent: { select: { id: true, title: true } },
    },
  })
  if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)

  const attachments = await prisma.fileAsset.findMany({
    where: { entityType: 'Task', entityId: taskId },
    orderBy: { createdAt: 'asc' },
  })

  return { ...task, attachments }
}
```

- [ ] **Step 5: Add new service functions — addAssignee, removeAssignee**

After the `deleteTask` function (before the closing `return` statement), add:

```js
async function addAssignee(taskId, userId) {
  const task = await prisma.task.findFirst({ where: { id: taskId } })
  if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
  const existing = await prisma.projectTaskAssignee.findFirst({ where: { taskId, userId } })
  if (existing) throw new TaskServiceError('El usuario ya esta asignado a esta tarea.', 409)
  const row = await prisma.projectTaskAssignee.create({
    data: { taskId, userId },
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
  })
  if (!task.assigneeId) {
    await prisma.task.update({ where: { id: taskId }, data: { assigneeId: userId } })
  }
  return row
}

async function removeAssignee(taskId, userId) {
  const task = await prisma.task.findFirst({ where: { id: taskId } })
  if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
  const existing = await prisma.projectTaskAssignee.findFirst({ where: { taskId, userId } })
  if (!existing) throw new TaskServiceError('El usuario no esta asignado a esta tarea.', 404)
  await prisma.projectTaskAssignee.delete({ where: { taskId_userId: { taskId, userId } } })
  if (task.assigneeId === userId) {
    const next = await prisma.projectTaskAssignee.findFirst({
      where: { taskId },
      orderBy: { assignedAt: 'asc' },
    })
    await prisma.task.update({ where: { id: taskId }, data: { assigneeId: next?.userId ?? null } })
  }
}

async function listAssignees(taskId) {
  return prisma.projectTaskAssignee.findMany({
    where: { taskId },
    include: { user: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
    orderBy: { assignedAt: 'asc' },
  })
}
```

- [ ] **Step 6: Add comment service functions**

After `listAssignees`, add:

```js
async function createComment(taskId, authorId, body) {
  if (!body?.trim()) throw new TaskServiceError('El comentario no puede estar vacio.', 400)
  if (body.trim().length > 5000) throw new TaskServiceError('El comentario no puede tener mas de 5000 caracteres.', 400)
  return prisma.taskComment.create({
    data: { taskId, authorId, body: body.trim() },
    include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
  })
}

async function listComments(taskId, { limit = 50, cursor } = {}) {
  return prisma.taskComment.findMany({
    where: { taskId, ...(cursor ? { id: { lt: cursor } } : {}) },
    include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

async function updateComment(commentId, requesterId, body) {
  if (!body?.trim()) throw new TaskServiceError('El comentario no puede estar vacio.', 400)
  if (body.trim().length > 5000) throw new TaskServiceError('El comentario no puede tener mas de 5000 caracteres.', 400)
  const comment = await prisma.taskComment.findFirst({ where: { id: commentId } })
  if (!comment) throw new TaskServiceError('Comentario no encontrado.', 404)
  if (comment.authorId !== requesterId) throw new TaskServiceError('Solo el autor puede editar este comentario.', 403)
  return prisma.taskComment.update({
    where: { id: commentId },
    data: { body: body.trim(), editedAt: new Date() },
    include: { author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } } },
  })
}

async function deleteComment(commentId, requesterId, projectId) {
  const comment = await prisma.taskComment.findFirst({
    where: { id: commentId },
    include: { task: { include: { project: { include: { members: { where: { userId: requesterId } } } } } } },
  })
  if (!comment) throw new TaskServiceError('Comentario no encontrado.', 404)
  const isAuthor = comment.authorId === requesterId
  const isAdmin = comment.task?.project?.members?.some((m) => m.role === 'ADMIN')
  if (!isAuthor && !isAdmin) throw new TaskServiceError('No tienes permiso para eliminar este comentario.', 403)
  await prisma.taskComment.delete({ where: { id: commentId } })
}
```

- [ ] **Step 7: Add bulk service functions**

After `deleteComment`, add:

```js
async function bulkUpdateTasks(projectId, taskIds, patch) {
  if (!taskIds?.length) throw new TaskServiceError('Se requiere al menos una tarea.', 400)
  const { statusId, assigneeId, priority } = patch
  if (!statusId && assigneeId === undefined && !priority)
    throw new TaskServiceError('Se requiere al menos un campo para actualizar.', 400)
  await prisma.task.updateMany({
    where: { id: { in: taskIds }, projectId },
    data: {
      ...(statusId ? { statusId } : {}),
      ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
      ...(priority ? { priority } : {}),
    },
  })
  return { updated: taskIds.length }
}

async function bulkDeleteTasks(projectId, taskIds) {
  if (!taskIds?.length) throw new TaskServiceError('Se requiere al menos una tarea.', 400)
  await prisma.task.deleteMany({ where: { parentTaskId: { in: taskIds }, projectId } })
  const result = await prisma.task.deleteMany({ where: { id: { in: taskIds }, projectId } })
  return { deleted: result.count }
}
```

- [ ] **Step 8: Expose new functions in the return object**

Replace the closing return statement:

```js
return {
  listTasks, getTask, createTask, updateTask, moveTask, deleteTask,
  addAssignee, removeAssignee, listAssignees,
  createComment, listComments, updateComment, deleteComment,
  bulkUpdateTasks, bulkDeleteTasks,
}
```

- [ ] **Step 9: Syntax check**

```bash
node --check apps/api/src/routes/projects/tasks-service.js
```

Expected: exits 0.

- [ ] **Step 10: Run tests**

```bash
node --test apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/api/src/routes/projects/tasks-service.js \
        apps/api/src/routes/projects/__tests__/tasks-service-v2.test.js
git commit -m "feat(projects): add V2.1 service functions — assignees, comments, bulk"
```

---

### Task 4: New routes — assignees, comments, attachments, bulk

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js`

- [ ] **Step 1: Update listTasks route to pass includeSubtasks**

In `projects-routes.js`, find the `GET /projects/:id/tasks` handler (around line 142-155). Replace the query destructuring line:

```js
// Before:
const { status_id, assignee_id, priority, due_date_from, due_date_to, parent_task_id } = c.req.query()
const tasks = await tasksSvc.listTasks(c.req.param('id'), {
  statusId: status_id,
  assigneeId: assignee_id,
  priority,
  dueDateFrom: due_date_from,
  dueDateTo: due_date_to,
  parentTaskId: parent_task_id,
})

// After:
const { status_id, assignee_id, priority, due_date_from, due_date_to, parent_task_id, include_subtasks } = c.req.query()
const tasks = await tasksSvc.listTasks(c.req.param('id'), {
  statusId: status_id,
  assigneeId: assignee_id,
  priority,
  dueDateFrom: due_date_from,
  dueDateTo: due_date_to,
  parentTaskId: parent_task_id,
  includeSubtasks: include_subtasks === 'true',
})
```

- [ ] **Step 2: Add assignee routes**

After the existing `app.patch('/projects/:id/tasks/:tid/move', ...)` handler (before `return app`), add:

```js
// --- Task Assignees ---
app.get('/projects/:id/tasks/:tid/assignees', requirePermission('projects.task.read'), async (c) => {
  try {
    const assignees = await tasksSvc.listAssignees(c.req.param('tid'))
    return c.json(assignees)
  } catch (err) { return handleError(c, err, 'Error al listar asignados.') }
})

app.post('/projects/:id/tasks/:tid/assignees', requirePermission('projects.task.update'), async (c) => {
  try {
    const { userId } = await c.req.json()
    const row = await tasksSvc.addAssignee(c.req.param('tid'), userId)
    return c.json(row, 201)
  } catch (err) { return handleError(c, err, 'Error al asignar usuario.') }
})

app.delete('/projects/:id/tasks/:tid/assignees/:uid', requirePermission('projects.task.update'), async (c) => {
  try {
    await tasksSvc.removeAssignee(c.req.param('tid'), c.req.param('uid'))
    return c.json({ ok: true })
  } catch (err) { return handleError(c, err, 'Error al quitar asignado.') }
})
```

- [ ] **Step 3: Add comment routes**

After the assignee routes, add:

```js
// --- Task Comments ---
app.get('/projects/:id/tasks/:tid/comments', requirePermission('projects.task.read'), async (c) => {
  try {
    const { cursor, limit } = c.req.query()
    const comments = await tasksSvc.listComments(c.req.param('tid'), {
      cursor,
      limit: limit ? Number(limit) : 50,
    })
    return c.json(comments)
  } catch (err) { return handleError(c, err, 'Error al listar comentarios.') }
})

app.post('/projects/:id/tasks/:tid/comments', requirePermission('projects.task.update'), async (c) => {
  try {
    const { body } = await c.req.json()
    const comment = await tasksSvc.createComment(c.req.param('tid'), getUserId(c), body)
    return c.json(comment, 201)
  } catch (err) { return handleError(c, err, 'Error al crear comentario.') }
})

app.patch('/projects/:id/tasks/:tid/comments/:cid', requirePermission('projects.task.update'), async (c) => {
  try {
    const { body } = await c.req.json()
    const comment = await tasksSvc.updateComment(c.req.param('cid'), getUserId(c), body)
    return c.json(comment)
  } catch (err) { return handleError(c, err, 'Error al editar comentario.') }
})

app.delete('/projects/:id/tasks/:tid/comments/:cid', requirePermission('projects.task.update'), async (c) => {
  try {
    await tasksSvc.deleteComment(c.req.param('cid'), getUserId(c), c.req.param('id'))
    return c.json({ ok: true })
  } catch (err) { return handleError(c, err, 'Error al eliminar comentario.') }
})
```

- [ ] **Step 4: Add attachment routes**

After the comment routes, add:

```js
// --- Task Attachments ---
app.get('/projects/:id/tasks/:tid/attachments', requirePermission('projects.task.read'), async (c) => {
  try {
    const taskId = c.req.param('tid')
    const attachments = await prisma.fileAsset.findMany({
      where: { entityType: 'Task', entityId: taskId },
      orderBy: { createdAt: 'asc' },
    })
    return c.json(attachments)
  } catch (err) { return handleError(c, err, 'Error al listar archivos.') }
})

app.post('/projects/:id/tasks/:tid/attachments', requirePermission('projects.task.update'), async (c) => {
  try {
    const { file_asset_id } = await c.req.json()
    const asset = await prisma.fileAsset.findFirst({ where: { id: file_asset_id } })
    if (!asset) return c.json({ error: 'Archivo no encontrado.' }, 404)
    return c.json(asset, 201)
  } catch (err) { return handleError(c, err, 'Error al adjuntar archivo.') }
})

app.delete('/projects/:id/tasks/:tid/attachments/:fid', requirePermission('projects.task.update'), async (c) => {
  try {
    const asset = await prisma.fileAsset.findFirst({ where: { id: c.req.param('fid') } })
    if (!asset) return c.json({ error: 'Archivo no encontrado.' }, 404)
    await prisma.fileAsset.update({ where: { id: c.req.param('fid') }, data: { enabled: false } })
    return c.json({ ok: true })
  } catch (err) { return handleError(c, err, 'Error al eliminar archivo.') }
})
```

- [ ] **Step 5: Add bulk routes**

After the attachment routes, add:

```js
// --- Bulk ---
app.patch('/projects/:id/tasks/bulk', requirePermission('projects.task.update'), async (c) => {
  try {
    const { taskIds, patch } = await c.req.json()
    const result = await tasksSvc.bulkUpdateTasks(c.req.param('id'), taskIds, patch ?? {})
    return c.json(result)
  } catch (err) { return handleError(c, err, 'Error al actualizar tareas en masa.') }
})

app.delete('/projects/:id/tasks/bulk', requirePermission('projects.task.delete'), async (c) => {
  try {
    const { taskIds } = await c.req.json()
    const result = await tasksSvc.bulkDeleteTasks(c.req.param('id'), taskIds)
    return c.json(result)
  } catch (err) { return handleError(c, err, 'Error al eliminar tareas en masa.') }
})
```

- [ ] **Step 6: Syntax check**

```bash
node --check apps/api/src/routes/projects/projects-routes.js
```

Expected: exits 0.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(projects): add V2.1 routes — assignees, comments, attachments, bulk"
```

---

### Task 5: SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add SDK methods for all new endpoints**

In `packages/sdk/src/index.js`, find the `projects` object (around line 1170). After the existing `moveTask` method (around line 1208), add:

```js
      // Assignees
      listTaskAssignees: (projectId, taskId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/assignees`, { headers: withAuthHeaders(token) }),
      addTaskAssignee: (projectId, taskId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/assignees`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      removeTaskAssignee: (projectId, taskId, userId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/assignees/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      // Comments
      listTaskComments: (projectId, taskId, query, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createTaskComment: (projectId, taskId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateTaskComment: (projectId, taskId, commentId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteTaskComment: (projectId, taskId, commentId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      // Attachments
      listTaskAttachments: (projectId, taskId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/attachments`, { headers: withAuthHeaders(token) }),
      addTaskAttachment: (projectId, taskId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/attachments`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteTaskAttachment: (projectId, taskId, fileAssetId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/attachments/${encodeURIComponent(fileAssetId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      // Bulk
      bulkUpdateTasks: (projectId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/bulk`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      bulkDeleteTasks: (projectId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/bulk`, { method: 'DELETE', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
```

- [ ] **Step 2: Syntax check**

```bash
node --check packages/sdk/src/index.js
```

Expected: exits 0.

- [ ] **Step 3: Run SDK tests**

```bash
node --test packages/sdk/src/__tests__/
```

Expected: all existing tests pass (new SDK methods have no dedicated unit tests — they are thin wrappers exercised by integration).

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add V2.1 SDK methods — assignees, comments, attachments, bulk"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] `ProjectTaskAssignee` + `TaskComment` schema (Task 1)
- [x] `addAssignee` syncs `Task.assigneeId` (Task 3 Step 5)
- [x] `removeAssignee` syncs `Task.assigneeId` to next or null (Task 3 Step 5)
- [x] `createComment` validates empty + 5000 char limit (Task 3 Step 6)
- [x] `updateComment` validates author ownership (Task 3 Step 6)
- [x] `deleteComment` allows author or ADMIN (Task 3 Step 6)
- [x] `bulkUpdateTasks` + `bulkDeleteTasks` (Task 3 Step 7)
- [x] `listTasks` gains `includeSubtasks` param + `assignees` + `parent` (Task 3 Step 3)
- [x] `getTask` gains `assignees` + `comments` + `attachments` (Task 3 Step 4)
- [x] `'Task'` added to `ALLOWED_FILE_ENTITY_TYPES` (Task 2)
- [x] All routes mounted (Task 4)
- [x] SDK methods added (Task 5)

**No placeholders found.**

**Type consistency:** All function names used in routes match those returned by the service `return` statement.
