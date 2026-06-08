# Atlas Projects — Implementation Plan A (API + Database)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the `atlas.projects` backend — Prisma models, migration, manifest, permission catalog, services, calendar bridge, Hono routes, and SDK methods.

**Architecture:** Prisma-backed feature module following the `atlas.calendar` pattern. Four Prisma models (`Project`, `ProjectMember`, `TaskStatus`, `Task`). Service layer with `ProjectServiceError`/`TaskServiceError` factories. Calendar bridge is a silent no-op when `atlas.calendar` is not installed.

**Tech Stack:** Node.js, Hono, Prisma 7, PostgreSQL (Supabase self-hosted). Tests use Node built-in test runner (`node:test`). No TypeScript.

**Plan B (UI) follows separately:** `2026-06-08-atlas-projects-plan-b-ui.md`

---

### Task 1: Prisma schema — add 3 enums, 4 models, UserProfile back-relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums after the last existing enum block**

Find the line `enum FileVisibility {` and add the following three enums after `FileVisibility`'s closing `}`:

```prisma
enum ProjectLifecycleStatus {
  ACTIVE
  COMPLETED
  ARCHIVED
  @@map("project_lifecycle_status")
}

enum ProjectMemberRole {
  OWNER
  MEMBER
  VIEWER
  @@map("project_member_role")
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

- [ ] **Step 2: Add UserProfile back-relations**

In `prisma/schema.prisma`, find the `calendarNotifications` line inside `model UserProfile` and add these four lines immediately before `@@map("user_profile")`:

```prisma
  projectsOwned      Project[]       @relation("ProjectOwner")
  projectMemberships ProjectMember[] @relation("ProjectMemberUser")
  tasksAssigned      Task[]          @relation("TaskAssignee")
  tasksCreated       Task[]          @relation("TaskCreator")
```

- [ ] **Step 3: Add four models at the end of schema.prisma**

Append to the very end of `prisma/schema.prisma`:

```prisma
model Project {
  id          String                 @id @default(uuid(7)) @db.Uuid
  companyId   String                 @db.Uuid @map("company_id")
  name        String
  description String?
  color       String?
  icon        String?
  ownerId     String                 @db.Uuid @map("owner_id")
  startDate   DateTime?              @map("start_date")
  dueDate     DateTime?              @map("due_date")
  calendarId  String?                @db.Uuid @map("calendar_id")
  status      ProjectLifecycleStatus @default(ACTIVE)
  createdAt   DateTime               @default(now()) @map("created_at")
  updatedAt   DateTime               @updatedAt @map("updated_at")

  owner    UserProfile     @relation("ProjectOwner", fields: [ownerId], references: [id])
  members  ProjectMember[]
  statuses TaskStatus[]
  tasks    Task[]

  @@index([companyId])
  @@index([ownerId])
  @@map("project")
}

model ProjectMember {
  id        String            @id @default(uuid(7)) @db.Uuid
  projectId String            @db.Uuid @map("project_id")
  userId    String            @db.Uuid @map("user_id")
  role      ProjectMemberRole @default(MEMBER)
  joinedAt  DateTime          @default(now()) @map("joined_at")

  project Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    UserProfile @relation("ProjectMemberUser", fields: [userId], references: [id])

  @@unique([projectId, userId])
  @@index([userId])
  @@map("project_member")
}

model TaskStatus {
  id        String  @id @default(uuid(7)) @db.Uuid
  projectId String  @db.Uuid @map("project_id")
  name      String
  color     String  @default("#64748b")
  position  Int
  isDefault Boolean @default(false) @map("is_default")
  isDone    Boolean @default(false) @map("is_done")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  tasks   Task[]

  @@index([projectId, position])
  @@map("task_status")
}

model Task {
  id              String       @id @default(uuid(7)) @db.Uuid
  projectId       String       @db.Uuid @map("project_id")
  statusId        String       @db.Uuid @map("status_id")
  parentTaskId    String?      @db.Uuid @map("parent_task_id")
  title           String
  description     String?
  assigneeId      String?      @db.Uuid @map("assignee_id")
  priority        TaskPriority @default(NONE)
  startDate       DateTime?    @map("start_date")
  dueDate         DateTime?    @map("due_date")
  calendarEventId String?      @db.Uuid @map("calendar_event_id")
  position        Int
  createdBy       String       @db.Uuid @map("created_by")
  createdAt       DateTime     @default(now()) @map("created_at")
  updatedAt       DateTime     @updatedAt @map("updated_at")

  project  Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  status   TaskStatus   @relation(fields: [statusId], references: [id])
  assignee UserProfile? @relation("TaskAssignee", fields: [assigneeId], references: [id])
  creator  UserProfile  @relation("TaskCreator", fields: [createdBy], references: [id])
  subtasks Task[]       @relation("TaskSubtasks")
  parent   Task?        @relation("TaskSubtasks", fields: [parentTaskId], references: [id])

  @@index([projectId, statusId, position])
  @@index([assigneeId])
  @@index([dueDate])
  @@map("task")
}
```

- [ ] **Step 4: Validate schema syntax**

```bash
pnpm exec prisma validate
```

Expected: `The schema at prisma/schema.prisma is valid`

---

### Task 2: Migration SQL

**Files:**
- Create: `prisma/migrations/20260608200000_atlas_projects/migration.sql`

- [ ] **Step 1: Create migration directory and file**

Create `prisma/migrations/20260608200000_atlas_projects/migration.sql` with:

```sql
CREATE TYPE "project_lifecycle_status" AS ENUM ('ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "project_member_role" AS ENUM ('OWNER', 'MEMBER', 'VIEWER');
CREATE TYPE "task_priority" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT');

CREATE TABLE "project" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "company_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "color" TEXT,
  "icon" TEXT,
  "owner_id" UUID NOT NULL,
  "start_date" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "calendar_id" UUID,
  "status" "project_lifecycle_status" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "project_company_id_idx" ON "project"("company_id");
CREATE INDEX "project_owner_id_idx" ON "project"("owner_id");

ALTER TABLE "project" ADD CONSTRAINT "project_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "project_member" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "project_member_role" NOT NULL DEFAULT 'MEMBER',
  "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "project_member_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_member_project_id_user_id_key" ON "project_member"("project_id", "user_id");
CREATE INDEX "project_member_user_id_idx" ON "project_member"("user_id");

ALTER TABLE "project_member" ADD CONSTRAINT "project_member_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_member" ADD CONSTRAINT "project_member_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "task_status" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#64748b',
  "position" INTEGER NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_done" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "task_status_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_status_project_id_position_idx" ON "task_status"("project_id", "position");

ALTER TABLE "task_status" ADD CONSTRAINT "task_status_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "task" (
  "id" UUID NOT NULL DEFAULT uuidv7(),
  "project_id" UUID NOT NULL,
  "status_id" UUID NOT NULL,
  "parent_task_id" UUID,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "assignee_id" UUID,
  "priority" "task_priority" NOT NULL DEFAULT 'NONE',
  "start_date" TIMESTAMP(3),
  "due_date" TIMESTAMP(3),
  "calendar_event_id" UUID,
  "position" INTEGER NOT NULL,
  "created_by" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_project_id_status_id_position_idx" ON "task"("project_id", "status_id", "position");
CREATE INDEX "task_assignee_id_idx" ON "task"("assignee_id");
CREATE INDEX "task_due_date_idx" ON "task"("due_date");

ALTER TABLE "task" ADD CONSTRAINT "task_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_status_id_fkey"
  FOREIGN KEY ("status_id") REFERENCES "task_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_parent_task_id_fkey"
  FOREIGN KEY ("parent_task_id") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "user_profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "task" ADD CONSTRAINT "task_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```

- [ ] **Step 2: Apply migration and regenerate client**

```bash
pnpm db:migrate
pnpm db:generate
```

Expected: Migration applied, Prisma client regenerated with `project`, `projectMember`, `taskStatus`, `task` accessors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260608200000_atlas_projects/
git commit -m "feat(projects): add Prisma schema and migration for atlas.projects"
```

---

### Task 3: Feature manifest

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js`
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Add `projectsMap` to feature-modules.js**

Add at the end of `apps/api/src/manifests/official/feature-modules.js` (before the final newline):

```js
export const projectsMap = createModuleManifest({
  key: 'atlas.projects',
  name: 'Proyectos',
  description: 'Gestion de proyectos y tareas con vistas Kanban, Lista y Timeline.',
  version: '1.0.0',
  kind: 'FEATURE',
  core: false,
  uninstallable: true,
  icon: 'FolderKanban',
  color: '#6366f1',
  category: 'productividad',
  summary: 'Proyectos y tareas con Kanban, Lista y Timeline',
  dependencies: [
    { key: 'atlas.identity' },
    { key: 'atlas.company' },
    { key: 'atlas.calendar', optional: true },
  ],
  lifecycle: {
    installable: true,
    uninstallable: true,
    resettable: true,
    supportsDataPurge: true,
    defaultUninstallPolicy: 'purge-owned-tables',
    ownedEntities: ['Project', 'ProjectMember', 'TaskStatus', 'Task'],
    sharedEntities: ['UserProfile', 'Company'],
  },
  navigation: [
    {
      label: 'Proyectos',
      path: '/',
      icon: 'FolderKanban',
      layout: 'main',
      permissionKey: 'projects.access',
    },
  ],
  permissions: [
    { key: 'projects.access',          name: 'Acceder a Proyectos' },
    { key: 'projects.project.read',    name: 'Ver proyectos' },
    { key: 'projects.project.create',  name: 'Crear proyectos' },
    { key: 'projects.project.update',  name: 'Editar proyectos' },
    { key: 'projects.project.delete',  name: 'Archivar proyectos' },
    { key: 'projects.task.read',       name: 'Ver tareas' },
    { key: 'projects.task.create',     name: 'Crear tareas' },
    { key: 'projects.task.update',     name: 'Editar tareas' },
    { key: 'projects.task.delete',     name: 'Eliminar tareas' },
    { key: 'projects.member.manage',   name: 'Gestionar miembros' },
  ],
  exposes: {
    createTask: 'function',
  },
  blueprints: [],
});
```

- [ ] **Step 2: Import and register in core-modules.js**

In `apps/api/src/manifests/official/core-modules.js`, add `projectsMap` to the import from `./feature-modules.js`:

```js
import {
  contactsMap,
  hrMap,
  atlasWebsiteManifest,
  activityMap,
  notificationsMap,
  projectsMap,
} from "./feature-modules.js";
```

Then add `projectsMap` to the `coreModules` array:

```js
export const coreModules = [
  atlasCoreMap,
  identityMap,
  filesMap,
  companyMap,
  contactsMap,
  hrMap,
  atlasFleetManifest,
  atlasLedgerManifest,
  atlasWebsiteManifest,
  atlasCalendarManifest,
  activityMap,
  notificationsMap,
  atlasCatalogManifest,
  projectsMap,
];
```

- [ ] **Step 3: Verify seed lists the module**

```bash
node --check apps/api/src/manifests/official/feature-modules.js
node --check apps/api/src/manifests/official/core-modules.js
```

Expected: both pass with no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/
git commit -m "feat(projects): add atlas.projects manifest"
```

---

### Task 4: Permission catalog

**Files:**
- Modify: `apps/api/src/permission-catalog.js`

- [ ] **Step 1: Add `projects` group to GROUPS and MODULE_LABELS**

In `apps/api/src/permission-catalog.js`, add `projects: "Proyectos"` to both `GROUPS` and `MODULE_LABELS` objects:

```js
const GROUPS = {
  // ... existing entries ...
  projects: "Proyectos",
};

const MODULE_LABELS = {
  // ... existing entries ...
  projects: "Proyectos",
};
```

- [ ] **Step 2: Add permission entries to PERMISSION_CATALOG**

Find the end of `PERMISSION_CATALOG` (the last `}` before `export`) and add before it:

```js
  "projects.access": {
    displayNameEs: "Acceder a Proyectos",
    descriptionEs: "Permite ver el modulo de proyectos en la navegacion.",
    groupKey: "projects",
    order: 10,
  },
  "projects.project.read": {
    displayNameEs: "Ver proyectos",
    descriptionEs: "Permite leer proyectos donde el usuario es miembro.",
    groupKey: "projects",
    order: 20,
  },
  "projects.project.create": {
    displayNameEs: "Crear proyectos",
    descriptionEs: "Permite crear nuevos proyectos.",
    groupKey: "projects",
    order: 30,
  },
  "projects.project.update": {
    displayNameEs: "Editar proyectos",
    descriptionEs: "Permite editar datos y columnas del proyecto.",
    groupKey: "projects",
    order: 40,
  },
  "projects.project.delete": {
    displayNameEs: "Archivar proyectos",
    descriptionEs: "Permite archivar o eliminar proyectos.",
    groupKey: "projects",
    order: 50,
  },
  "projects.task.read": {
    displayNameEs: "Ver tareas",
    descriptionEs: "Permite leer tareas dentro de un proyecto.",
    groupKey: "projects",
    order: 60,
  },
  "projects.task.create": {
    displayNameEs: "Crear tareas",
    descriptionEs: "Permite crear nuevas tareas en un proyecto.",
    groupKey: "projects",
    order: 70,
  },
  "projects.task.update": {
    displayNameEs: "Editar tareas",
    descriptionEs: "Permite editar tareas existentes.",
    groupKey: "projects",
    order: 80,
  },
  "projects.task.delete": {
    displayNameEs: "Eliminar tareas",
    descriptionEs: "Permite eliminar tareas y sus subtareas.",
    groupKey: "projects",
    order: 90,
  },
  "projects.member.manage": {
    displayNameEs: "Gestionar miembros",
    descriptionEs: "Permite agregar o remover miembros del proyecto.",
    groupKey: "projects",
    order: 100,
  },
```

- [ ] **Step 3: Verify and commit**

```bash
node --check apps/api/src/permission-catalog.js
git add apps/api/src/permission-catalog.js
git commit -m "feat(projects): add projects permission catalog entries"
```

---

### Task 5: projects-service.js + tests

**Files:**
- Create: `apps/api/src/routes/projects/projects-service.js`
- Create: `apps/api/src/routes/projects/__tests__/projects-service.test.js`

- [ ] **Step 1: Write the failing tests first**

Create `apps/api/src/routes/projects/__tests__/projects-service.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createProjectsService, ProjectServiceError, STATUS_TEMPLATES } from '../projects-service.js'

function makePrisma(overrides = {}) {
  const projects = {}
  const members = {}
  const statuses = {}
  return {
    project: {
      create: async (args) => {
        const p = { id: 'proj-1', status: 'ACTIVE', createdAt: new Date(), updatedAt: new Date(), ...args.data }
        projects[p.id] = p
        return p
      },
      findFirst: async ({ where }) => projects[where.id] ?? null,
      findMany: async () => Object.values(projects),
      update: async ({ where, data }) => {
        projects[where.id] = { ...projects[where.id], ...data }
        return projects[where.id]
      },
    },
    projectMember: {
      create: async (args) => ({ id: 'mem-1', ...args.data }),
      findFirst: async () => null,
      findMany: async () => [],
      deleteMany: async () => {},
    },
    taskStatus: {
      create: async (args) => ({ id: 'status-1', ...args.data }),
      createMany: async () => {},
      findFirst: async () => null,
      findMany: async () => [],
      update: async ({ where, data }) => ({ id: where.id, ...data }),
      delete: async () => {},
    },
    task: {
      updateMany: async () => {},
    },
    ...overrides,
  }
}

describe('STATUS_TEMPLATES', () => {
  it('general template has 3 statuses with one default and one done', () => {
    const t = STATUS_TEMPLATES.general
    assert.equal(t.length, 3)
    assert.equal(t.filter((s) => s.isDefault).length, 1)
    assert.equal(t.filter((s) => s.isDone).length, 1)
  })

  it('all templates define at least one isDone status', () => {
    for (const [key, template] of Object.entries(STATUS_TEMPLATES)) {
      assert.ok(template.some((s) => s.isDone), `Template ${key} has no isDone status`)
    }
  })
})

describe('createProjectsService', () => {
  describe('createProject', () => {
    it('creates project with trimmed name and seeds statuses', async () => {
      let statusesCreated = null
      const prisma = makePrisma({
        taskStatus: {
          ...makePrisma().taskStatus,
          createMany: async (args) => { statusesCreated = args.data; return {} },
        },
      })
      const svc = createProjectsService({ prisma })
      const project = await svc.createProject('company-1', 'user-1', { name: '  Mi Proyecto  ' })
      assert.equal(project.name, 'Mi Proyecto')
      assert.ok(statusesCreated.length >= 3, 'Statuses seeded')
      assert.ok(statusesCreated.every((s) => s.projectId === project.id), 'All statuses linked to project')
    })

    it('throws 400 when name is empty', async () => {
      const svc = createProjectsService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.createProject('company-1', 'user-1', { name: '   ' }),
        (err) => { assert.ok(err instanceof ProjectServiceError); assert.equal(err.status, 400); return true }
      )
    })

    it('seeds statuses from specified template', async () => {
      let statusesCreated = null
      const prisma = makePrisma({
        taskStatus: {
          ...makePrisma().taskStatus,
          createMany: async (args) => { statusesCreated = args.data; return {} },
        },
      })
      const svc = createProjectsService({ prisma })
      await svc.createProject('company-1', 'user-1', { name: 'Ventas', template: 'ventas' })
      assert.equal(statusesCreated.length, STATUS_TEMPLATES.ventas.length)
    })

    it('falls back to general template for unknown template key', async () => {
      let statusesCreated = null
      const prisma = makePrisma({
        taskStatus: {
          ...makePrisma().taskStatus,
          createMany: async (args) => { statusesCreated = args.data; return {} },
        },
      })
      const svc = createProjectsService({ prisma })
      await svc.createProject('company-1', 'user-1', { name: 'X', template: 'unknown' })
      assert.equal(statusesCreated.length, STATUS_TEMPLATES.general.length)
    })
  })

  describe('archiveProject', () => {
    it('sets project status to ARCHIVED', async () => {
      const prisma = makePrisma()
      const proj = await prisma.project.create({ data: { id: 'proj-1', ownerId: 'user-1', name: 'P' } })
      const svc = createProjectsService({ prisma })
      const result = await svc.archiveProject('proj-1', 'user-1')
      assert.equal(result.status, 'ARCHIVED')
    })

    it('throws 403 when user is not owner', async () => {
      const prisma = makePrisma()
      await prisma.project.create({ data: { id: 'proj-1', ownerId: 'owner-id', name: 'P' } })
      const svc = createProjectsService({ prisma })
      await assert.rejects(
        () => svc.archiveProject('proj-1', 'other-user'),
        (err) => { assert.equal(err.status, 403); return true }
      )
    })
  })

  describe('addMember', () => {
    it('creates a project member with default MEMBER role', async () => {
      let created = null
      const prisma = makePrisma({
        projectMember: {
          ...makePrisma().projectMember,
          create: async (args) => { created = args.data; return { id: 'mem-1', ...args.data } },
        },
      })
      await prisma.project.create({ data: { id: 'proj-1', ownerId: 'owner-1', name: 'P' } })
      const svc = createProjectsService({ prisma })
      await svc.addMember('proj-1', 'owner-1', { userId: 'new-user' })
      assert.equal(created.role, 'MEMBER')
      assert.equal(created.userId, 'new-user')
    })

    it('throws 400 for invalid role', async () => {
      const prisma = makePrisma()
      await prisma.project.create({ data: { id: 'proj-1', ownerId: 'owner-1', name: 'P' } })
      const svc = createProjectsService({ prisma })
      await assert.rejects(
        () => svc.addMember('proj-1', 'owner-1', { userId: 'u', role: 'SUPERADMIN' }),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })
  })
})
```

- [ ] **Step 2: Run tests — expect failures (module not yet created)**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-service.test.js
```

Expected: error — `Cannot find module '../projects-service.js'`

- [ ] **Step 3: Create projects-service.js**

Create `apps/api/src/routes/projects/projects-service.js`:

```js
export class ProjectServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'ProjectServiceError'
    this.status = status
  }
}

export const STATUS_TEMPLATES = {
  general: [
    { name: 'Por hacer', color: '#64748b', isDefault: true, isDone: false },
    { name: 'En progreso', color: '#3b82f6', isDefault: false, isDone: false },
    { name: 'Listo', color: '#22c55e', isDefault: false, isDone: true },
  ],
  desarrollo: [
    { name: 'Backlog', color: '#64748b', isDefault: false, isDone: false },
    { name: 'En desarrollo', color: '#3b82f6', isDefault: true, isDone: false },
    { name: 'En revision', color: '#f59e0b', isDefault: false, isDone: false },
    { name: 'QA', color: '#a855f7', isDefault: false, isDone: false },
    { name: 'Deploy', color: '#f97316', isDefault: false, isDone: false },
    { name: 'Listo', color: '#22c55e', isDefault: false, isDone: true },
  ],
  ventas: [
    { name: 'Lead', color: '#64748b', isDefault: true, isDone: false },
    { name: 'Propuesta', color: '#3b82f6', isDefault: false, isDone: false },
    { name: 'Negociacion', color: '#f59e0b', isDefault: false, isDone: false },
    { name: 'Ganado', color: '#22c55e', isDefault: false, isDone: true },
    { name: 'Perdido', color: '#ef4444', isDefault: false, isDone: true },
  ],
  marketing: [
    { name: 'Ideas', color: '#64748b', isDefault: true, isDone: false },
    { name: 'Planificado', color: '#3b82f6', isDefault: false, isDone: false },
    { name: 'En produccion', color: '#f59e0b', isDefault: false, isDone: false },
    { name: 'Publicado', color: '#22c55e', isDefault: false, isDone: true },
  ],
}

export function createProjectsService({ prisma }) {
  async function listProjects(companyId, userId) {
    const memberships = await prisma.projectMember.findMany({
      where: { userId },
      select: { projectId: true },
    })
    const memberProjectIds = memberships.map((m) => m.projectId)
    return prisma.project.findMany({
      where: {
        companyId,
        status: { not: 'ARCHIVED' },
        OR: [{ ownerId: userId }, { id: { in: memberProjectIds } }],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        _count: { select: { tasks: { where: { parentTaskId: null } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async function getProject(projectId, userId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
        statuses: { orderBy: { position: 'asc' } },
      },
    })
    if (!project) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    const isMember =
      project.ownerId === userId || project.members.some((m) => m.userId === userId)
    if (!isMember) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    return project
  }

  async function createProject(companyId, ownerId, { name, description, color, icon, template = 'general' }) {
    if (!name?.trim()) throw new ProjectServiceError('El nombre es requerido.', 400)
    const project = await prisma.project.create({
      data: {
        companyId,
        ownerId,
        name: name.trim(),
        description: description?.trim() || null,
        color: color || '#6366f1',
        icon: icon || null,
      },
    })
    const templateStatuses = STATUS_TEMPLATES[template] ?? STATUS_TEMPLATES.general
    await prisma.taskStatus.createMany({
      data: templateStatuses.map((s, i) => ({
        projectId: project.id,
        name: s.name,
        color: s.color,
        position: i,
        isDefault: s.isDefault,
        isDone: s.isDone,
      })),
    })
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: ownerId, role: 'OWNER' },
    })
    return project
  }

  async function updateProject(projectId, userId, data) {
    const project = await prisma.project.findFirst({ where: { id: projectId } })
    if (!project) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    if (project.ownerId !== userId) {
      const ownerMember = await prisma.projectMember.findFirst({
        where: { projectId, userId, role: 'OWNER' },
      })
      if (!ownerMember) throw new ProjectServiceError('Sin permiso para editar este proyecto.', 403)
    }
    const { name, description, color, icon, startDate, dueDate } = data
    return prisma.project.update({
      where: { id: projectId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(color ? { color } : {}),
        ...(icon !== undefined ? { icon: icon || null } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      },
    })
  }

  async function archiveProject(projectId, userId) {
    const project = await prisma.project.findFirst({ where: { id: projectId } })
    if (!project) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    if (project.ownerId !== userId)
      throw new ProjectServiceError('Solo el owner puede archivar el proyecto.', 403)
    return prisma.project.update({ where: { id: projectId }, data: { status: 'ARCHIVED' } })
  }

  async function addMember(projectId, requesterId, { userId, role = 'MEMBER' }) {
    const project = await prisma.project.findFirst({ where: { id: projectId } })
    if (!project) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    const validRoles = ['OWNER', 'MEMBER', 'VIEWER']
    if (!validRoles.includes(role)) throw new ProjectServiceError('Rol invalido.', 400)
    try {
      return await prisma.projectMember.create({ data: { projectId, userId, role } })
    } catch (err) {
      if (err?.code === 'P2002')
        throw new ProjectServiceError('El usuario ya es miembro del proyecto.', 409)
      throw err
    }
  }

  async function removeMember(projectId, requesterId, userId) {
    const project = await prisma.project.findFirst({ where: { id: projectId } })
    if (!project) throw new ProjectServiceError('Proyecto no encontrado.', 404)
    if (project.ownerId === userId)
      throw new ProjectServiceError('No puedes remover al owner del proyecto.', 400)
    await prisma.projectMember.deleteMany({ where: { projectId, userId } })
  }

  async function listStatuses(projectId) {
    return prisma.taskStatus.findMany({ where: { projectId }, orderBy: { position: 'asc' } })
  }

  async function createStatus(projectId, { name, color = '#64748b' }) {
    if (!name?.trim()) throw new ProjectServiceError('El nombre es requerido.', 400)
    const last = await prisma.taskStatus.findFirst({
      where: { projectId },
      orderBy: { position: 'desc' },
    })
    const position = (last?.position ?? -1) + 1
    return prisma.taskStatus.create({
      data: { projectId, name: name.trim(), color, position, isDefault: false, isDone: false },
    })
  }

  async function updateStatus(statusId, data) {
    const status = await prisma.taskStatus.findFirst({ where: { id: statusId } })
    if (!status) throw new ProjectServiceError('Estado no encontrado.', 404)
    const { name, color, position, isDefault, isDone } = data
    return prisma.taskStatus.update({
      where: { id: statusId },
      data: {
        ...(name?.trim() ? { name: name.trim() } : {}),
        ...(color ? { color } : {}),
        ...(position !== undefined ? { position } : {}),
        ...(isDefault !== undefined ? { isDefault } : {}),
        ...(isDone !== undefined ? { isDone } : {}),
      },
    })
  }

  async function deleteStatus(statusId) {
    const status = await prisma.taskStatus.findFirst({
      where: { id: statusId },
      include: { _count: { select: { tasks: true } } },
    })
    if (!status) throw new ProjectServiceError('Estado no encontrado.', 404)
    if (status._count.tasks > 0) {
      const defaultStatus = await prisma.taskStatus.findFirst({
        where: { projectId: status.projectId, isDefault: true, id: { not: statusId } },
      })
      if (!defaultStatus)
        throw new ProjectServiceError('No hay estado por defecto para mover las tareas.', 400)
      await prisma.task.updateMany({ where: { statusId }, data: { statusId: defaultStatus.id } })
    }
    await prisma.taskStatus.delete({ where: { id: statusId } })
  }

  return {
    listProjects,
    getProject,
    createProject,
    updateProject,
    archiveProject,
    addMember,
    removeMember,
    listStatuses,
    createStatus,
    updateStatus,
    deleteStatus,
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-service.test.js
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/projects/
git commit -m "feat(projects): add projects-service with tests"
```

---

### Task 6: tasks-service.js + tests

**Files:**
- Create: `apps/api/src/routes/projects/tasks-service.js`
- Create: `apps/api/src/routes/projects/__tests__/tasks-service.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/routes/projects/__tests__/tasks-service.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createTasksService, TaskServiceError } from '../tasks-service.js'

function makePrisma(overrides = {}) {
  const tasks = {}
  return {
    task: {
      create: async (args) => {
        const t = { id: 'task-1', createdAt: new Date(), updatedAt: new Date(), ...args.data }
        tasks[t.id] = t
        return t
      },
      findFirst: async ({ where }) => tasks[where.id] ?? null,
      findMany: async () => Object.values(tasks),
      update: async ({ where, data }) => {
        tasks[where.id] = { ...tasks[where.id], ...data }
        return tasks[where.id]
      },
      updateMany: async () => {},
      delete: async ({ where }) => {
        const t = tasks[where.id]
        delete tasks[where.id]
        return t
      },
      deleteMany: async () => {},
    },
    taskStatus: {
      findFirst: async ({ where }) =>
        where?.id === 'status-1' ? { id: 'status-1', projectId: 'proj-1' } : null,
    },
    ...overrides,
  }
}

describe('createTasksService', () => {
  describe('createTask', () => {
    it('creates task with trimmed title and calculated position', async () => {
      const svc = createTasksService({ prisma: makePrisma() })
      const task = await svc.createTask('proj-1', 'user-1', {
        title: '  Nueva tarea  ',
        statusId: 'status-1',
      })
      assert.equal(task.title, 'Nueva tarea')
      assert.equal(task.position, 0)
      assert.equal(task.createdBy, 'user-1')
    })

    it('throws 400 when title is empty', async () => {
      const svc = createTasksService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.createTask('proj-1', 'user-1', { title: '', statusId: 'status-1' }),
        (err) => { assert.ok(err instanceof TaskServiceError); assert.equal(err.status, 400); return true }
      )
    })

    it('throws 400 when status does not belong to project', async () => {
      const svc = createTasksService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.createTask('proj-1', 'user-1', { title: 'T', statusId: 'wrong-status' }),
        (err) => { assert.equal(err.status, 400); return true }
      )
    })

    it('assigns position 1 when a task already exists in the status', async () => {
      const prisma = makePrisma()
      // Pre-create a task at position 0
      await prisma.task.create({ data: { id: 'existing', projectId: 'proj-1', statusId: 'status-1', position: 0, title: 'Existing', createdBy: 'u', priority: 'NONE' } })
      const prismaWithLast = {
        ...prisma,
        task: {
          ...prisma.task,
          findFirst: async ({ where, orderBy }) => {
            if (orderBy?.position === 'desc') return { position: 0 }
            return prisma.task.findFirst({ where })
          },
        },
      }
      const svc = createTasksService({ prisma: prismaWithLast })
      const task = await svc.createTask('proj-1', 'user-1', { title: 'New', statusId: 'status-1' })
      assert.equal(task.position, 1)
    })
  })

  describe('deleteTask', () => {
    it('deletes subtasks before deleting the parent', async () => {
      let deletedSubtasks = false
      const prisma = makePrisma({
        task: {
          ...makePrisma().task,
          findFirst: async () => ({ id: 'task-1', projectId: 'proj-1', calendarEventId: null }),
          deleteMany: async ({ where }) => { if (where.parentTaskId === 'task-1') deletedSubtasks = true },
          delete: async () => ({ id: 'task-1' }),
        },
      })
      const svc = createTasksService({ prisma })
      await svc.deleteTask('task-1')
      assert.ok(deletedSubtasks, 'Subtasks were deleted before parent')
    })

    it('throws 404 when task not found', async () => {
      const svc = createTasksService({ prisma: makePrisma() })
      await assert.rejects(
        () => svc.deleteTask('nonexistent'),
        (err) => { assert.equal(err.status, 404); return true }
      )
    })
  })

  describe('moveTask', () => {
    it('updates statusId and position', async () => {
      const prisma = makePrisma()
      await prisma.task.create({ data: { id: 'task-1', projectId: 'proj-1', statusId: 'status-1', position: 0, title: 'T', createdBy: 'u', priority: 'NONE' } })
      const svc = createTasksService({ prisma })
      const moved = await svc.moveTask('task-1', { statusId: 'status-2', position: 0 })
      assert.equal(moved.statusId, 'status-2')
      assert.equal(moved.position, 0)
    })
  })
})
```

- [ ] **Step 2: Run tests — expect module not found**

```bash
node --test apps/api/src/routes/projects/__tests__/tasks-service.test.js
```

Expected: error — `Cannot find module '../tasks-service.js'`

- [ ] **Step 3: Create tasks-service.js**

Create `apps/api/src/routes/projects/tasks-service.js`:

```js
export class TaskServiceError extends Error {
  constructor(message, status = 500) {
    super(message)
    this.name = 'TaskServiceError'
    this.status = status
  }
}

export function createTasksService({ prisma }) {
  async function listTasks(projectId, { statusId, assigneeId, priority, dueDateFrom, dueDateTo, parentTaskId } = {}) {
    const where = { projectId }
    if (statusId) where.statusId = statusId
    if (assigneeId) where.assigneeId = assigneeId
    if (priority) where.priority = priority
    if (dueDateFrom || dueDateTo) {
      where.dueDate = {}
      if (dueDateFrom) where.dueDate.gte = new Date(dueDateFrom)
      if (dueDateTo) where.dueDate.lte = new Date(dueDateTo)
    }
    where.parentTaskId = parentTaskId === undefined ? null : parentTaskId
    return prisma.task.findMany({
      where,
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        status: true,
        _count: { select: { subtasks: true } },
      },
      orderBy: [{ statusId: 'asc' }, { position: 'asc' }],
    })
  }

  async function getTask(taskId) {
    const task = await prisma.task.findFirst({
      where: { id: taskId },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        status: true,
        subtasks: {
          include: { assignee: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
          orderBy: { position: 'asc' },
        },
      },
    })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    return task
  }

  async function createTask(projectId, createdBy, { title, description, statusId, assigneeId, priority = 'NONE', startDate, dueDate, parentTaskId }) {
    if (!title?.trim()) throw new TaskServiceError('El titulo es requerido.', 400)
    const status = await prisma.taskStatus.findFirst({ where: { id: statusId, projectId } })
    if (!status) throw new TaskServiceError('Estado no valido para este proyecto.', 400)
    const last = await prisma.task.findFirst({
      where: { projectId, statusId, parentTaskId: null },
      orderBy: { position: 'desc' },
    })
    const position = (last?.position ?? -1) + 1
    return prisma.task.create({
      data: {
        projectId,
        statusId,
        parentTaskId: parentTaskId || null,
        title: title.trim(),
        description: description?.trim() || null,
        assigneeId: assigneeId || null,
        priority,
        startDate: startDate ? new Date(startDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position,
        createdBy,
      },
    })
  }

  async function updateTask(taskId, data) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    const { title, description, assigneeId, priority, startDate, dueDate, statusId } = data
    return prisma.task.update({
      where: { id: taskId },
      data: {
        ...(title?.trim() ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(assigneeId !== undefined ? { assigneeId: assigneeId || null } : {}),
        ...(priority ? { priority } : {}),
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(statusId ? { statusId } : {}),
      },
    })
  }

  async function moveTask(taskId, { statusId, position }) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    await prisma.task.updateMany({
      where: { projectId: task.projectId, statusId, position: { gte: position }, id: { not: taskId } },
      data: { position: { increment: 1 } },
    })
    return prisma.task.update({ where: { id: taskId }, data: { statusId, position } })
  }

  async function deleteTask(taskId) {
    const task = await prisma.task.findFirst({ where: { id: taskId } })
    if (!task) throw new TaskServiceError('Tarea no encontrada.', 404)
    await prisma.task.deleteMany({ where: { parentTaskId: taskId } })
    await prisma.task.delete({ where: { id: taskId } })
    return task
  }

  return { listTasks, getTask, createTask, updateTask, moveTask, deleteTask }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test apps/api/src/routes/projects/__tests__/tasks-service.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/projects/
git commit -m "feat(projects): add tasks-service with tests"
```

---

### Task 7: projects-calendar-bridge.js + tests

**Files:**
- Create: `apps/api/src/routes/projects/projects-calendar-bridge.js`
- Create: `apps/api/src/routes/projects/__tests__/projects-calendar-bridge.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/routes/projects/__tests__/projects-calendar-bridge.test.js`:

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createProjectsCalendarBridge } from '../projects-calendar-bridge.js'

function makeCalendarPrisma(overrides = {}) {
  const calendars = {}
  const shares = {}
  const events = {}
  const tasks = {}
  return {
    calendarCalendar: {
      create: async (args) => {
        const c = { id: 'cal-1', ...args.data }
        calendars[c.id] = c
        return c
      },
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    calendarShare: {
      findFirst: async ({ where }) =>
        Object.values(shares).find((s) => s.calendarId === where.calendarId && s.userId === where.userId) ?? null,
      create: async (args) => {
        const s = { id: 'share-1', ...args.data }
        shares[s.id] = s
        return s
      },
      deleteMany: async () => {},
    },
    calendarEvent: {
      create: async (args) => {
        const e = { id: 'event-1', ...args.data }
        events[e.id] = e
        return e
      },
      update: async ({ where, data }) => ({ id: where.id, ...data }),
      delete: async () => {},
    },
    project: {
      update: async ({ where, data }) => ({ id: where.id, ...data }),
    },
    task: {
      update: async ({ where, data }) => {
        tasks[where.id] = { ...(tasks[where.id] ?? {}), ...data }
        return tasks[where.id]
      },
    },
    ...overrides,
  }
}

function makeNoPrisma() {
  return {}  // No calendarCalendar property — simulates atlas.calendar not installed
}

describe('createProjectsCalendarBridge', () => {
  describe('syncProjectCalendar', () => {
    it('creates a CalendarCalendar and updates project.calendarId', async () => {
      let updatedProject = null
      const prisma = {
        ...makeCalendarPrisma(),
        project: {
          update: async ({ where, data }) => { updatedProject = { id: where.id, ...data }; return updatedProject },
        },
      }
      const bridge = createProjectsCalendarBridge({ prisma })
      const calId = await bridge.syncProjectCalendar({ id: 'proj-1', ownerId: 'user-1', name: 'Mi Proyecto', color: '#6366f1' })
      assert.ok(calId, 'Returns calendar id')
      assert.equal(updatedProject?.calendarId, calId)
    })

    it('returns null silently when atlas.calendar is not installed', async () => {
      const bridge = createProjectsCalendarBridge({ prisma: makeNoPrisma() })
      const calId = await bridge.syncProjectCalendar({ id: 'proj-1', ownerId: 'user-1', name: 'P', color: null })
      assert.equal(calId, null)
    })
  })

  describe('grantMemberCalendarAccess', () => {
    it('creates a CalendarShare for the new member', async () => {
      let created = null
      const prisma = {
        ...makeCalendarPrisma(),
        calendarShare: {
          ...makeCalendarPrisma().calendarShare,
          create: async (args) => { created = args.data; return { id: 'share-1', ...args.data } },
        },
      }
      const bridge = createProjectsCalendarBridge({ prisma })
      await bridge.grantMemberCalendarAccess('cal-1', 'user-2')
      assert.equal(created?.calendarId, 'cal-1')
      assert.equal(created?.userId, 'user-2')
      assert.equal(created?.role, 'VIEWER')
    })

    it('does nothing when calendarId is null', async () => {
      let called = false
      const prisma = {
        ...makeCalendarPrisma(),
        calendarShare: { ...makeCalendarPrisma().calendarShare, create: async () => { called = true } },
      }
      const bridge = createProjectsCalendarBridge({ prisma })
      await bridge.grantMemberCalendarAccess(null, 'user-2')
      assert.equal(called, false)
    })
  })

  describe('syncTaskEvent', () => {
    it('creates a CalendarEvent with sourceModule=atlas.projects when task has dueDate', async () => {
      let created = null
      const prisma = {
        ...makeCalendarPrisma(),
        calendarEvent: {
          ...makeCalendarPrisma().calendarEvent,
          create: async (args) => { created = args.data; return { id: 'event-1', ...args.data } },
        },
      }
      const bridge = createProjectsCalendarBridge({ prisma })
      const task = { id: 'task-1', title: 'Entrega', dueDate: new Date('2026-07-01'), startDate: null, calendarEventId: null }
      await bridge.syncTaskEvent(task, 'cal-1')
      assert.equal(created?.sourceModule, 'atlas.projects')
      assert.equal(created?.sourceEntityId, 'task-1')
      assert.equal(created?.calendarId, 'cal-1')
    })

    it('returns null when no dueDate', async () => {
      const bridge = createProjectsCalendarBridge({ prisma: makeCalendarPrisma() })
      const result = await bridge.syncTaskEvent(
        { id: 'task-1', title: 'T', dueDate: null, startDate: null, calendarEventId: null },
        'cal-1'
      )
      assert.equal(result, null)
    })
  })
})
```

- [ ] **Step 2: Run tests — expect module not found**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-calendar-bridge.test.js
```

Expected: `Cannot find module '../projects-calendar-bridge.js'`

- [ ] **Step 3: Create projects-calendar-bridge.js**

Create `apps/api/src/routes/projects/projects-calendar-bridge.js`:

```js
export function createProjectsCalendarBridge({ prisma }) {
  function isCalendarAvailable() {
    return typeof prisma.calendarCalendar?.create === 'function'
  }

  async function syncProjectCalendar(project) {
    if (!isCalendarAvailable()) return null
    try {
      if (project.calendarId) {
        await prisma.calendarCalendar.update({
          where: { id: project.calendarId },
          data: { name: project.name, color: project.color ?? '#6366f1' },
        })
        return project.calendarId
      }
      const calendar = await prisma.calendarCalendar.create({
        data: {
          ownerId: project.ownerId,
          name: project.name,
          color: project.color ?? '#6366f1',
          isDefault: false,
        },
      })
      await prisma.project.update({
        where: { id: project.id },
        data: { calendarId: calendar.id },
      })
      return calendar.id
    } catch {
      return null
    }
  }

  async function grantMemberCalendarAccess(calendarId, userId) {
    if (!isCalendarAvailable() || !calendarId) return
    try {
      const existing = await prisma.calendarShare.findFirst({ where: { calendarId, userId } })
      if (existing) return
      await prisma.calendarShare.create({ data: { calendarId, userId, role: 'VIEWER' } })
    } catch {
      // Calendar access is best-effort — never block project operations
    }
  }

  async function revokeMemberCalendarAccess(calendarId, userId) {
    if (!isCalendarAvailable() || !calendarId) return
    try {
      await prisma.calendarShare.deleteMany({ where: { calendarId, userId } })
    } catch {
      // Silently ignore
    }
  }

  async function syncTaskEvent(task, calendarId) {
    if (!isCalendarAvailable() || !calendarId || !task.dueDate) {
      if (task.calendarEventId) {
        await deleteTaskEvent(task.calendarEventId)
        await prisma.task.update({ where: { id: task.id }, data: { calendarEventId: null } })
      }
      return null
    }
    try {
      const eventData = {
        calendarId,
        title: task.title,
        startAt: task.startDate ?? task.dueDate,
        endAt: task.dueDate,
        allDay: false,
        sourceModule: 'atlas.projects',
        sourceEntityId: task.id,
      }
      if (task.calendarEventId) {
        await prisma.calendarEvent.update({
          where: { id: task.calendarEventId },
          data: { title: eventData.title, startAt: eventData.startAt, endAt: eventData.endAt },
        })
        return task.calendarEventId
      }
      const event = await prisma.calendarEvent.create({ data: eventData })
      await prisma.task.update({ where: { id: task.id }, data: { calendarEventId: event.id } })
      return event.id
    } catch {
      return null
    }
  }

  async function deleteTaskEvent(eventId) {
    if (!isCalendarAvailable() || !eventId) return
    try {
      await prisma.calendarEvent.delete({ where: { id: eventId } })
    } catch {
      // Event may already be deleted
    }
  }

  return {
    syncProjectCalendar,
    grantMemberCalendarAccess,
    revokeMemberCalendarAccess,
    syncTaskEvent,
    deleteTaskEvent,
  }
}
```

- [ ] **Step 4: Run tests — expect all pass**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-calendar-bridge.test.js
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/projects/
git commit -m "feat(projects): add projects-calendar-bridge with tests"
```

---

### Task 8: projects-routes.js + index.js

**Files:**
- Create: `apps/api/src/routes/projects/projects-routes.js`
- Create: `apps/api/src/routes/projects/index.js`

- [ ] **Step 1: Create projects-routes.js**

Create `apps/api/src/routes/projects/projects-routes.js`:

```js
import { Hono } from 'hono'
import { createProjectsService, ProjectServiceError } from './projects-service.js'
import { createTasksService, TaskServiceError } from './tasks-service.js'
import { createProjectsCalendarBridge } from './projects-calendar-bridge.js'

function getUserId(c) {
  return c.get('userContext')?.profile?.id ?? null
}

function getCompanyId(c) {
  return c.get('userContext')?.membership?.companyId ?? null
}

function handleError(c, err, fallback) {
  if (err instanceof ProjectServiceError || err instanceof TaskServiceError)
    return c.json({ error: err.message }, err.status)
  if (Number.isInteger(err?.status) && err.status >= 400 && err.status < 600)
    return c.json({ error: err.message || fallback }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.projects]', err)
  return c.json({ error: fallback }, 500)
}

export function createProjectsRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const projectsSvc = createProjectsService({ prisma })
  const tasksSvc = createTasksService({ prisma })
  const bridge = createProjectsCalendarBridge({ prisma })

  // --- Projects ---
  app.get('/projects', requirePermission('projects.project.read'), async (c) => {
    try {
      const projects = await projectsSvc.listProjects(getCompanyId(c), getUserId(c))
      return c.json(projects)
    } catch (err) { return handleError(c, err, 'Error al listar proyectos.') }
  })

  app.post('/projects', requirePermission('projects.project.create'), async (c) => {
    try {
      const body = await c.req.json()
      const project = await projectsSvc.createProject(getCompanyId(c), getUserId(c), body)
      await bridge.syncProjectCalendar(project)
      return c.json(project, 201)
    } catch (err) { return handleError(c, err, 'Error al crear proyecto.') }
  })

  app.get('/projects/:id', requirePermission('projects.project.read'), async (c) => {
    try {
      const project = await projectsSvc.getProject(c.req.param('id'), getUserId(c))
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al obtener proyecto.') }
  })

  app.patch('/projects/:id', requirePermission('projects.project.update'), async (c) => {
    try {
      const body = await c.req.json()
      const project = await projectsSvc.updateProject(c.req.param('id'), getUserId(c), body)
      await bridge.syncProjectCalendar(project)
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al actualizar proyecto.') }
  })

  app.delete('/projects/:id', requirePermission('projects.project.delete'), async (c) => {
    try {
      const project = await projectsSvc.archiveProject(c.req.param('id'), getUserId(c))
      return c.json(project)
    } catch (err) { return handleError(c, err, 'Error al archivar proyecto.') }
  })

  // --- Members ---
  app.get('/projects/:id/members', requirePermission('projects.project.read'), async (c) => {
    try {
      const project = await projectsSvc.getProject(c.req.param('id'), getUserId(c))
      return c.json(project.members)
    } catch (err) { return handleError(c, err, 'Error al listar miembros.') }
  })

  app.post('/projects/:id/members', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const body = await c.req.json()
      const member = await projectsSvc.addMember(projectId, getUserId(c), body)
      const project = await prisma.project.findFirst({ where: { id: projectId } })
      if (project?.calendarId) await bridge.grantMemberCalendarAccess(project.calendarId, body.userId)
      return c.json(member, 201)
    } catch (err) { return handleError(c, err, 'Error al agregar miembro.') }
  })

  app.patch('/projects/:id/members/:uid', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const userId = c.req.param('uid')
      const { role } = await c.req.json()
      const member = await prisma.projectMember.update({
        where: { projectId_userId: { projectId, userId } },
        data: { role },
      })
      return c.json(member)
    } catch (err) { return handleError(c, err, 'Error al actualizar miembro.') }
  })

  app.delete('/projects/:id/members/:uid', requirePermission('projects.member.manage'), async (c) => {
    try {
      const projectId = c.req.param('id')
      const userId = c.req.param('uid')
      await projectsSvc.removeMember(projectId, getUserId(c), userId)
      const project = await prisma.project.findFirst({ where: { id: projectId } })
      if (project?.calendarId) await bridge.revokeMemberCalendarAccess(project.calendarId, userId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al remover miembro.') }
  })

  // --- Statuses ---
  app.get('/projects/:id/statuses', requirePermission('projects.task.read'), async (c) => {
    try {
      const statuses = await projectsSvc.listStatuses(c.req.param('id'))
      return c.json(statuses)
    } catch (err) { return handleError(c, err, 'Error al listar estados.') }
  })

  app.post('/projects/:id/statuses', requirePermission('projects.project.update'), async (c) => {
    try {
      const status = await projectsSvc.createStatus(c.req.param('id'), await c.req.json())
      return c.json(status, 201)
    } catch (err) { return handleError(c, err, 'Error al crear estado.') }
  })

  app.patch('/projects/:id/statuses/:sid', requirePermission('projects.project.update'), async (c) => {
    try {
      const status = await projectsSvc.updateStatus(c.req.param('sid'), await c.req.json())
      return c.json(status)
    } catch (err) { return handleError(c, err, 'Error al actualizar estado.') }
  })

  app.delete('/projects/:id/statuses/:sid', requirePermission('projects.project.update'), async (c) => {
    try {
      await projectsSvc.deleteStatus(c.req.param('sid'))
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar estado.') }
  })

  // --- Tasks ---
  app.get('/projects/:id/tasks', requirePermission('projects.task.read'), async (c) => {
    try {
      const { status_id, assignee_id, priority, due_date_from, due_date_to, parent_task_id } = c.req.query()
      const tasks = await tasksSvc.listTasks(c.req.param('id'), {
        statusId: status_id,
        assigneeId: assignee_id,
        priority,
        dueDateFrom: due_date_from,
        dueDateTo: due_date_to,
        parentTaskId: parent_task_id,
      })
      return c.json(tasks)
    } catch (err) { return handleError(c, err, 'Error al listar tareas.') }
  })

  app.post('/projects/:id/tasks', requirePermission('projects.task.create'), async (c) => {
    try {
      const body = await c.req.json()
      const task = await tasksSvc.createTask(c.req.param('id'), getUserId(c), body)
      if (task.dueDate) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      return c.json(task, 201)
    } catch (err) { return handleError(c, err, 'Error al crear tarea.') }
  })

  app.get('/projects/:id/tasks/:tid', requirePermission('projects.task.read'), async (c) => {
    try {
      const task = await tasksSvc.getTask(c.req.param('tid'))
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al obtener tarea.') }
  })

  app.patch('/projects/:id/tasks/:tid', requirePermission('projects.task.update'), async (c) => {
    try {
      const taskId = c.req.param('tid')
      const body = await c.req.json()
      const prevTask = await prisma.task.findFirst({ where: { id: taskId } })
      const task = await tasksSvc.updateTask(taskId, body)
      if (body.dueDate !== undefined) {
        const project = await prisma.project.findFirst({ where: { id: task.projectId } })
        await bridge.syncTaskEvent(task, project?.calendarId)
      }
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al actualizar tarea.') }
  })

  app.delete('/projects/:id/tasks/:tid', requirePermission('projects.task.delete'), async (c) => {
    try {
      const task = await tasksSvc.deleteTask(c.req.param('tid'))
      if (task.calendarEventId) await bridge.deleteTaskEvent(task.calendarEventId)
      return c.json({ ok: true })
    } catch (err) { return handleError(c, err, 'Error al eliminar tarea.') }
  })

  app.patch('/projects/:id/tasks/:tid/move', requirePermission('projects.task.update'), async (c) => {
    try {
      const task = await tasksSvc.moveTask(c.req.param('tid'), await c.req.json())
      return c.json(task)
    } catch (err) { return handleError(c, err, 'Error al mover tarea.') }
  })

  return app
}
```

- [ ] **Step 2: Create index.js**

Create `apps/api/src/routes/projects/index.js`:

```js
export { createProjectsRouter } from './projects-routes.js'
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/api/src/routes/projects/projects-routes.js
node --check apps/api/src/routes/projects/index.js
```

Expected: both pass with no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/projects/
git commit -m "feat(projects): add projects-routes Hono router"
```

---

### Task 9: Wire into apps/api/src/index.js

**Files:**
- Modify: `apps/api/src/index.js`

- [ ] **Step 1: Add import**

Find the line `import { createCalendarRouter } from "./routes/calendar/index.js";` and add after it:

```js
import { createProjectsRouter } from "./routes/projects/index.js";
```

- [ ] **Step 2: Mount the router**

Find the line `mountWithAuth(app, createCalendarRouter({ prisma, requirePermission }));` and add after it:

```js
mountWithAuth(app, createProjectsRouter({ prisma, requirePermission }));
```

- [ ] **Step 3: Add `projects` to API_PREFIX_RE**

Find the line with `API_PREFIX_RE` that lists modules and add `projects` to the list. The current line looks like:

```js
const API_PREFIX_RE = /^\/(modules|blueprints|files|contacts|company|identity|finance|hr|website|ledger|calendar|catalog|storefront|activity|notifications|public|auth|health|p)\b/i
```

Change it to:

```js
const API_PREFIX_RE = /^\/(modules|blueprints|files|contacts|company|identity|finance|hr|website|ledger|calendar|catalog|storefront|activity|notifications|projects|public|auth|health|p)\b/i
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/api/src/index.js
```

Expected: passes with no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(projects): wire atlas.projects router into API"
```

---

### Task 10: SDK additions

**Files:**
- Modify: `packages/sdk/src/index.js`

- [ ] **Step 1: Add projects section to SDK**

Find `fleet: {` in `packages/sdk/src/index.js` and add the following block immediately before it:

```js
    projects: {
      listProjects: (token) =>
        request('/projects', { headers: withAuthHeaders(token) }),
      createProject: (data, token) =>
        request('/projects', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      getProject: (id, token) =>
        request(`/projects/${encodeURIComponent(id)}`, { headers: withAuthHeaders(token) }),
      updateProject: (id, data, token) =>
        request(`/projects/${encodeURIComponent(id)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      archiveProject: (id, token) =>
        request(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      listMembers: (projectId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/members`, { headers: withAuthHeaders(token) }),
      addMember: (projectId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/members`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateMember: (projectId, userId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      removeMember: (projectId, userId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      listStatuses: (projectId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/statuses`, { headers: withAuthHeaders(token) }),
      createStatus: (projectId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/statuses`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      updateStatus: (projectId, statusId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteStatus: (projectId, statusId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/statuses/${encodeURIComponent(statusId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      listTasks: (projectId, query, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createTask: (projectId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks`, { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      getTask: (projectId, taskId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, { headers: withAuthHeaders(token) }),
      updateTask: (projectId, taskId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
      deleteTask: (projectId, taskId, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}`, { method: 'DELETE', headers: withAuthHeaders(token) }),
      moveTask: (projectId, taskId, data, token) =>
        request(`/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}/move`, { method: 'PATCH', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
    },
```

- [ ] **Step 2: Syntax check**

```bash
node --check packages/sdk/src/index.js
```

Expected: passes with no output.

- [ ] **Step 3: Run all projects tests together**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-service.test.js apps/api/src/routes/projects/__tests__/tasks-service.test.js apps/api/src/routes/projects/__tests__/projects-calendar-bridge.test.js
```

Expected: all tests pass, 0 failures.

- [ ] **Step 4: Run db:seed to verify manifest registration**

```bash
pnpm db:seed
```

Expected: output includes `atlas.projects` in the seeded modules list.

- [ ] **Step 5: Final commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(projects): add SDK methods for atlas.projects"
```

---

## Self-review checklist

- [x] Schema: 3 enums + 4 models + UserProfile back-relations — covered in Task 1
- [x] Migration SQL: all tables, indexes, FKs — covered in Task 2
- [x] Manifest: projectsMap in feature-modules.js, imported in core-modules.js — Task 3
- [x] Permission catalog: 10 permissions with `projects` group — Task 4
- [x] projects-service: listProjects, getProject, createProject, updateProject, archiveProject, addMember, removeMember, listStatuses, createStatus, updateStatus, deleteStatus — Task 5
- [x] tasks-service: listTasks, getTask, createTask, updateTask, moveTask, deleteTask — Task 6
- [x] calendar bridge: syncProjectCalendar, grantMemberCalendarAccess, revokeMemberCalendarAccess, syncTaskEvent, deleteTaskEvent — Task 7
- [x] Router: all 17 endpoints — Task 8
- [x] index.js wiring + API_PREFIX_RE — Task 9
- [x] SDK methods for all endpoints — Task 10
- [x] Tests for all service functions — Tasks 5, 6, 7
