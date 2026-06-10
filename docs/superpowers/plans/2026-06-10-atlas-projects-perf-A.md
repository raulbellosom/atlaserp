# atlas.projects Performance — Plan A: API Fix + Optimistic Updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix file attachment bug so uploads actually link to tasks, add optimistic updates for move/create/update task mutations, and make the dependency picker lazy so it doesn't fire 7 queries on task panel open.

**Architecture:** Minimal surgical edits to 3 files. The attachment fix is a 3-line change to `projects-routes.js`. Optimistic updates follow the standard TanStack Query `onMutate → snapshot → setQueriesData → onError rollback → onSettled invalidate` pattern. The lazy picker adds one state bool and one dedicated hook.

**Tech Stack:** TanStack Query v5 (`useQueryClient`, `cancelQueries`, `getQueriesData`, `setQueryData`, `setQueriesData`), Hono API (Prisma), Node.js test runner

**Spec:** `docs/superpowers/specs/2026-06-10-atlas-projects-perf-mobile-design.md`

---

## File Structure

```
apps/api/src/routes/projects/projects-routes.js     MODIFY lines 393-399 (attachment handler)
apps/desktop/src/modules/atlas.projects/
  hooks/useProjectsData.js                          MODIFY useMoveTask, useCreateTask, useUpdateTask
  components/TaskDetailPanel.jsx                    MODIFY remove eager useTasks, add depsExpanded state
```

---

### Task 1: Fix file attachment link bug in API

**Root cause:** `POST /projects/:id/tasks/:tid/attachments` finds the FileAsset but never updates `entityId` to the taskId. The upload sets `entityId = companyId` (files-service hardcoded), so the attachment list query (`WHERE entityId = taskId`) always returns empty.

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js:393-399`

- [ ] **Step 1: Read the current handler to verify line numbers**

Open `apps/api/src/routes/projects/projects-routes.js` and confirm the POST attachment handler at line ~393 reads:
```js
app.post('/projects/:id/tasks/:tid/attachments', requirePermission('projects.task.update'), async (c) => {
  try {
    const { file_asset_id } = await c.req.json()
    const asset = await prisma.fileAsset.findFirst({ where: { id: file_asset_id } })
    if (!asset) return c.json({ error: 'Archivo no encontrado.' }, 404)
    return c.json(asset, 201)          // ← never sets entityId
  } catch (err) { return handleError(c, err, 'Error al adjuntar archivo.') }
})
```

- [ ] **Step 2: Apply the fix — update entityId after finding the asset**

Replace the handler body with:
```js
app.post('/projects/:id/tasks/:tid/attachments', requirePermission('projects.task.update'), async (c) => {
  try {
    const taskId = c.req.param('tid')
    const { file_asset_id } = await c.req.json()
    const asset = await prisma.fileAsset.findFirst({ where: { id: file_asset_id } })
    if (!asset) return c.json({ error: 'Archivo no encontrado.' }, 404)
    const updated = await prisma.fileAsset.update({
      where: { id: file_asset_id },
      data: { entityId: taskId, entityType: 'Task' },
    })
    return c.json(updated, 201)
  } catch (err) { return handleError(c, err, 'Error al adjuntar archivo.') }
})
```

- [ ] **Step 3: Verify the API starts without errors**

```bash
pnpm dev:api
```

Watch for startup errors. Expected: API boots cleanly on port 4010. No Prisma compile errors (the update uses existing `entityId` / `entityType` columns on `FileAsset`).

- [ ] **Step 4: Manual smoke test — upload a file to a task**

1. Open the app at http://localhost:5173
2. Open any project → click a task
3. In the task detail panel, upload a file via "Archivos"
4. After upload completes, the file should appear in the attachments list
5. Close and reopen the task — file must still be listed
6. Reload the page — attachment count badge on the kanban card should show ≥ 1

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "fix(projects): link uploaded file to task by updating entityId on attach"
```

---

### Task 2: Optimistic update for useMoveTask (kanban drag)

**Goal:** Card moves to the new column instantly on drag-drop without waiting for the API response. On network error the card rolls back.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js:234-246`

- [ ] **Step 1: Replace useMoveTask with optimistic version**

Find the current `useMoveTask` function (lines ~234-246) and replace it entirely:

```js
export function useMoveTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, statusId, position }) =>
      atlas.projects.moveTask(projectId, taskId, { statusId, position }, token),
    onMutate: async ({ taskId, statusId }) => {
      // Cancel any in-flight task fetches to avoid overwriting our optimistic state
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      // Snapshot ALL matching task queries (kanban uses { parentTaskId: 'null' }, list uses other filters)
      const snapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      // Apply optimistic update: change statusId on the dragged task
      for (const [queryKey] of snapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          const updated = tasks.map((t) => (t.id === taskId ? { ...t, statusId } : t))
          return Array.isArray(old) ? updated : { ...old, data: updated }
        })
      }
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      // Restore snapshots on failure
      for (const [queryKey, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      toast.error('No se pudo mover la tarea')
    },
    onSettled: () => {
      // Always sync with server truth after settle
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}
```

Note: the `...loadingMutation('Moviendo tarea...')` spread is intentionally removed — the optimistic update makes the loading toast unnecessary and the dismiss logic would conflict with the new `onMutate`.

- [ ] **Step 2: Verify the app compiles and drag works**

```bash
pnpm dev:frontend
```

Open kanban. Drag a task to another column — it should move immediately without snapping back. Check the browser console for React Query errors (none expected).

- [ ] **Step 3: Verify rollback on error (optional manual test)**

Temporarily add `throw new Error('test')` at the start of `atlas.projects.moveTask` in `packages/sdk/src/index.js`, drag a card, confirm it snaps back. Remove the throw.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git commit -m "feat(projects): optimistic update for kanban drag — instant column move"
```

---

### Task 3: Optimistic update for useCreateTask (quick-create)

**Goal:** When user submits a quick-create task title, a placeholder card appears immediately in the target column before the API responds.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js:207-218`

- [ ] **Step 1: Replace useCreateTask with optimistic version**

Find the current `useCreateTask` function (lines ~207-218) and replace it entirely:

```js
export function useCreateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data) => atlas.projects.createTask(projectId, data, token),
    onMutate: async ({ title, statusId, parentTaskId }) => {
      // Only optimistically add root-level tasks; subtasks are too complex to fake
      if (parentTaskId) return undefined
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      const tempTask = {
        id: `temp-${Date.now()}`,
        title,
        statusId,
        priority: 'NONE',
        position: 9999,
        assignees: [],
        assignee: null,
        _count: { subtasks: 0, comments: 0, attachments: 0 },
        dueDate: null,
        startDate: null,
        taskNumber: null,
        parentTaskId: null,
        blockedBy: [],
        blocking: [],
        rrule: null,
        status: null,
        createdAt: new Date().toISOString(),
      }
      const snapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      for (const [queryKey] of snapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          // Only inject into queries that would show this task
          // (skip queries filtered to a different statusId)
          const filters = queryKey[3] ?? {}
          if (filters.statusId && filters.statusId !== statusId) return old
          return Array.isArray(old) ? [...tasks, tempTask] : { ...old, data: [...tasks, tempTask] }
        })
      }
      return { snapshots }
    },
    onError: (_, __, ctx) => {
      for (const [queryKey, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      toast.error('No se pudo crear la tarea')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
    },
  })
}
```

- [ ] **Step 2: Verify quick-create shows placeholder immediately**

Open kanban → click "+ Agregar tarea" in any column → type a title → press Enter. A card with the title should appear in the column before the loading spinner finishes. After the API responds the server-assigned `taskNumber` (T-N) appears.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git commit -m "feat(projects): optimistic quick-create — task card appears instantly"
```

---

### Task 4: Optimistic update for useUpdateTask (task editing)

**Goal:** Changes made in `TaskDetailPanel` (title, priority, dates, status) reflect instantly in both the detail panel and the kanban card without a round-trip delay.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js:220-232`

- [ ] **Step 1: Replace useUpdateTask with optimistic version**

Find `useUpdateTask` (lines ~220-232) and replace entirely:

```js
export function useUpdateTask(projectId) {
  const token = useToken()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ taskId, ...data }) => atlas.projects.updateTask(projectId, taskId, data, token),
    onMutate: async ({ taskId, ...patch }) => {
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks'] })
      await qc.cancelQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
      // Snapshot task lists
      const listSnapshots = qc.getQueriesData({ queryKey: ['projects', projectId, 'tasks'], exact: false })
      // Snapshot task detail
      const detailSnapshot = qc.getQueryData(['projects', projectId, 'tasks', taskId])
      // Optimistically update all list queries
      for (const [queryKey] of listSnapshots) {
        qc.setQueryData(queryKey, (old) => {
          if (!old) return old
          const tasks = old?.data ?? old
          if (!Array.isArray(tasks)) return old
          const updated = tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t))
          return Array.isArray(old) ? updated : { ...old, data: updated }
        })
      }
      // Optimistically update task detail
      if (detailSnapshot) {
        qc.setQueryData(['projects', projectId, 'tasks', taskId], (old) =>
          old ? { ...old, ...patch } : old,
        )
      }
      return { listSnapshots, detailSnapshot }
    },
    onError: (_, { taskId }, ctx) => {
      for (const [queryKey, data] of ctx?.listSnapshots ?? []) {
        qc.setQueryData(queryKey, data)
      }
      if (ctx?.detailSnapshot !== undefined) {
        qc.setQueryData(['projects', projectId, 'tasks', taskId], ctx.detailSnapshot)
      }
    },
    onSettled: (_, __, { taskId }) => {
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks'] })
      qc.invalidateQueries({ queryKey: ['projects', projectId, 'tasks', taskId] })
    },
  })
}
```

Note: `loadingMutation('Guardando...')` is removed. If you want a loading indicator for long saves, add a `toast.loading` call inside `onMutate` and dismiss in `onSettled`.

- [ ] **Step 2: Verify task editing feels instant**

Open a task → change the title → press Enter (or blur the field). The new title should appear immediately in the panel header and on the kanban card behind it. No visible loading delay.

- [ ] **Step 3: Verify status change updates kanban column instantly**

In `TaskDetailPanel`, change the task status via the dropdown. The kanban card behind should jump columns immediately.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git commit -m "feat(projects): optimistic task update — edits reflect instantly in panel and kanban"
```

---

### Task 5: Lazy dependency picker — remove eager useTasks from TaskDetailPanel

**Goal:** Opening `TaskDetailPanel` must not fire a `GET /projects/:id/tasks` for all tasks. The query only fires when the user first expands the "Dependencias" section.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js` — add new hook
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx:126-134`

- [ ] **Step 1: Add useAllTasksForPicker hook to useProjectsData.js**

Append at the end of `useProjectsData.js` (before the closing of the file, after the last export):

```js
// Lazy hook for dependency picker — only fires when enabled = true
export function useAllTasksForPicker(projectId, enabled = false) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', '__picker__'],
    queryFn: () => atlas.projects.listTasks(projectId, {}, token),
    enabled: Boolean(token) && Boolean(projectId) && enabled,
    staleTime: 2 * 60 * 1000,
  })
}
```

- [ ] **Step 2: Update TaskDetailPanel to use the new lazy hook**

In `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx`:

a) Find the import line for `useTasks` (around line 39):
```js
  useTasks,
} from "../hooks/useProjectsData";
```
Replace with:
```js
  useAllTasksForPicker,
} from "../hooks/useProjectsData";
```

b) Find (around line 126):
```js
  const { data: allTasksData } = useTasks(projectId, {});
```
Replace with:
```js
  const [depsExpanded, setDepsExpanded] = useState(false);
  const { data: allTasksData } = useAllTasksForPicker(projectId, depsExpanded);
```

c) Find the "Dependencias" section heading in the JSX (search for `Dependencias` in the file). It will be a `<label>` or `<div>` element. Add a click handler to expand it and trigger the lazy load. The heading likely looks similar to:

```jsx
<label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
  Dependencias
</label>
```

Replace with:

```jsx
<button
  type="button"
  onClick={() => setDepsExpanded(true)}
  className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block w-full text-left"
>
  Dependencias
</button>
```

This ensures a single click on the label triggers the fetch; subsequent renders keep `depsExpanded = true` so the query stays active.

- [ ] **Step 3: Verify task panel opens faster**

Open the browser Network tab. Click any task. Confirm there is NO request to `GET /projects/:id/tasks?` on open. Verify the request fires only after clicking "Dependencias".

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git add apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx
git commit -m "perf(projects): lazy-load all-tasks for dependency picker — remove 7th query on panel open"
```

---

## Self-Review Checklist

- [x] R1 (attachment bug) — covered by Task 1
- [x] R2.1 (optimistic move) — covered by Task 2
- [x] R2.2 (optimistic create) — covered by Task 3
- [x] R2.3 (optimistic update) — covered by Task 4
- [x] R2.4 (rollback on error) — each task has `onError` snapshot restore
- [x] R3.1–R3.2 (lazy picker) — covered by Task 5
- [ ] R4 (mobile kanban) — Plan B
- [ ] R5 (refetchOnWindowFocus) — Plan B
