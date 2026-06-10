# atlas.projects Performance — Plan B: Mobile Kanban + Background Refetch

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix kanban drag on mobile (touch events, empty column drops, visible drag handle) and stop background refetches from firing on window focus.

**Architecture:** All changes are confined to `KanbanView.jsx` and `useProjectsData.js`. The column-droppable fix uses `useDroppable` from `@dnd-kit/core` (already installed). TouchSensor import is also from `@dnd-kit/core`. No new dependencies.

**Tech Stack:** @dnd-kit/core (already in package.json), @dnd-kit/sortable (already in package.json), TanStack Query v5, React, Tailwind

**Spec:** `docs/superpowers/specs/2026-06-10-atlas-projects-perf-mobile-design.md`

**Depends on Plan A:** Plan B is independent — it can run before, after, or in parallel with Plan A.

---

## File Structure

```
apps/desktop/src/modules/atlas.projects/
  components/KanbanView.jsx           MODIFY — TouchSensor, column droppable, handle visibility
  hooks/useProjectsData.js            MODIFY — refetchOnWindowFocus: false on task queries
```

---

### Task 1: Add TouchSensor for mobile drag activation

**Problem:** Only `PointerSensor` is registered. On iOS Safari / Android Chrome, touch events use `TouchEvent` not `PointerEvent` reliably. `PointerSensor` with `{ distance: 8 }` activation works on desktop but on mobile the 8px movement needed to activate often triggers a scroll gesture first, preventing drag.

**Fix:** Add `TouchSensor` with `{ delay: 250, tolerance: 5 }` — the user holds the card for 250 ms before drag activates, giving scroll a chance to start if that's the user's intent.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx:1-15` (imports)
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx:172-175` (sensors)

- [ ] **Step 1: Add TouchSensor to the dnd-kit import**

Find the existing import at lines 1-10:
```js
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay,
} from '@dnd-kit/core'
```

Replace with:
```js
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragOverlay, useDroppable,
} from '@dnd-kit/core'
```

(Note: `useDroppable` is added here too — it is needed for Task 2.)

- [ ] **Step 2: Add TouchSensor to the sensors array**

Find the `useSensors` call (lines ~172-175):
```js
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
```

Replace with:
```js
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
```

- [ ] **Step 3: Verify no compile errors**

```bash
pnpm dev:frontend
```

Expected: app loads without errors. Open the kanban on a mobile device (or Chrome DevTools with a touch device emulated) and verify a 250 ms hold activates drag.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "fix(projects): add TouchSensor for mobile kanban drag activation"
```

---

### Task 2: Fix cross-column drop — register columns as droppable zones

**Problem:** When a user drags a card over an empty column, there are no sortable items for the `SortableContext` to register a drop target. `@dnd-kit` sets `over = null` and `handleDragEnd` returns early without calling `moveTask`. The card snaps back silently.

**Fix:** Extract each column body into a `DroppableColumn` component that calls `useDroppable({ id: statusId })`. When a card hovers over an empty column, `over.id` equals the column's `statusId` and the existing `handleDragEnd` logic (`targetStatusId = overTask ? overTask.statusId : over.id`) correctly resolves to that column.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx`

- [ ] **Step 1: Add DroppableColumn component**

After the `QuickCreateInput` component definition (line ~159) and before the `KanbanView` default export, insert:

```js
function DroppableColumn({ id, children }) {
  const { setNodeRef } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className="flex-1 bg-muted/50 rounded-lg p-2 space-y-2 min-h-[120px] overflow-y-auto">
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Replace the column inner div with DroppableColumn**

In the `KanbanView` return JSX, find the column inner div (line ~240):
```jsx
              <div className="flex-1 bg-muted/50 rounded-lg p-2 space-y-2 min-h-[120px] overflow-y-auto">
                <SortableContext
                  items={colTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      statusColor={status.color}
                      onClick={onTaskClick}
                      isDragging={task.id === activeId}
                    />
                  ))}
                </SortableContext>
                {quickCreate === status.id ? (
                  <QuickCreateInput
                    statusId={status.id}
                    projectId={projectId}
                    onDone={() => setQuickCreate(null)}
                  />
                ) : (
                  <button
                    onClick={() => setQuickCreate(status.id)}
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Agregar tarea
                  </button>
                )}
              </div>
```

Replace with:
```jsx
              <DroppableColumn id={status.id}>
                <SortableContext
                  items={colTasks.map((t) => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {colTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      statusColor={status.color}
                      onClick={onTaskClick}
                      isDragging={task.id === activeId}
                    />
                  ))}
                </SortableContext>
                {quickCreate === status.id ? (
                  <QuickCreateInput
                    statusId={status.id}
                    projectId={projectId}
                    onDone={() => setQuickCreate(null)}
                  />
                ) : (
                  <button
                    onClick={() => setQuickCreate(status.id)}
                    className="w-full text-left text-xs text-muted-foreground hover:text-foreground py-1 px-1 rounded transition-colors flex items-center gap-1"
                  >
                    <Plus size={12} />
                    Agregar tarea
                  </button>
                )}
              </DroppableColumn>
```

- [ ] **Step 3: Verify empty-column drop works**

Open kanban. Find a column with tasks and one empty column. Drag a task to the empty column. The card must drop into the empty column (not snap back). After `onSettled` runs the server syncs and the card stays.

- [ ] **Step 4: Verify non-empty column cross-column drop still works**

Drag a task from column A (with tasks) to column B (also with tasks). It must still sort correctly by landing on an existing card.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "fix(projects): register columns as droppable zones — fix empty-column snap-back"
```

---

### Task 3: Show drag handle on mobile (touch devices)

**Problem:** The `GripVertical` handle uses `opacity-0 group-hover:opacity-100`. On touch devices, there is no hover state — the handle is permanently invisible. Users can still drag by tapping and holding anywhere on the card (with `TouchSensor`) but they have no visual affordance.

**Fix:** Show handle at 30% opacity on all screens; on desktop keep the `md:opacity-0 md:group-hover:opacity-100` behavior.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx:62-70`

- [ ] **Step 1: Update grip handle opacity class**

Find the `<span>` with the grip icon inside `TaskCard` (line ~64-70):
```jsx
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
```

Replace the `className` value only:
```jsx
        <span
          {...attributes}
          {...listeners}
          className="mt-0.5 opacity-30 md:opacity-0 md:group-hover:opacity-100 cursor-grab text-muted-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={12} />
        </span>
```

- [ ] **Step 2: Verify on desktop — handle only visible on hover**

Open kanban on desktop. The grip icon should be hidden on a card until you hover. This preserves the clean look for desktop users.

- [ ] **Step 3: Verify on mobile — handle always visible at low opacity**

Open kanban on a mobile screen (or Chrome DevTools responsive mode at < 768px). The grip icon should be faintly visible (30% opacity) on all cards, giving users a visual cue for where to grab.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "fix(projects): show drag handle at 30% opacity on mobile — hidden on md+ unless hovered"
```

---

### Task 4: Disable refetchOnWindowFocus for task queries

**Problem:** TanStack Query's default `refetchOnWindowFocus: true` fires a background refetch every time the user switches browser tabs or alt-tabs back to the app. For task-heavy projects this means the API is hit on every context switch, adding latency spikes.

**Fix:** Set `refetchOnWindowFocus: false` on the three most frequently-used query hooks: `useTasks`, `useTask`, and `useStatuses`.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js`

- [ ] **Step 1: Add refetchOnWindowFocus: false to useTasks**

Find `useTasks` (around line 187-195):
```js
export function useTasks(projectId, filters = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', filters],
    queryFn: () => atlas.projects.listTasks(projectId, filters, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 30 * 1000,
  })
}
```

Replace with:
```js
export function useTasks(projectId, filters = {}) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', filters],
    queryFn: () => atlas.projects.listTasks(projectId, filters, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 2: Add refetchOnWindowFocus: false to useTask**

Find `useTask` (around line 197-205):
```js
export function useTask(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId],
    queryFn: () => atlas.projects.getTask(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 30 * 1000,
  })
}
```

Replace with:
```js
export function useTask(projectId, taskId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'tasks', taskId],
    queryFn: () => atlas.projects.getTask(projectId, taskId, token),
    enabled: Boolean(token) && Boolean(projectId) && Boolean(taskId),
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 3: Add refetchOnWindowFocus: false to useStatuses**

Find `useStatuses` (around line 135-143):
```js
export function useStatuses(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => atlas.projects.listStatuses(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
  })
}
```

Replace with:
```js
export function useStatuses(projectId) {
  const token = useToken()
  return useQuery({
    queryKey: ['projects', projectId, 'statuses'],
    queryFn: () => atlas.projects.listStatuses(projectId, token),
    enabled: Boolean(token) && Boolean(projectId),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
```

- [ ] **Step 4: Verify no background refetches on focus**

1. Open the app at the kanban view
2. Open Chrome DevTools → Network tab
3. Switch to another tab and switch back
4. Confirm no `GET /projects/...` requests fire after the window regains focus

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js
git commit -m "perf(projects): disable refetchOnWindowFocus for task, statuses queries"
```

---

## Self-Review Checklist

- [x] R4.1 (touch drag activation) — Task 1: TouchSensor with delay: 250
- [x] R4.2 (empty column drop) — Task 2: DroppableColumn + useDroppable
- [x] R4.3 (drag handle visibility) — Task 3: opacity-30 on mobile
- [x] R5.1 (no focus refetch) — Task 4: refetchOnWindowFocus: false
- [ ] R1–R3 (attachments, optimistic updates, lazy picker) — Plan A
