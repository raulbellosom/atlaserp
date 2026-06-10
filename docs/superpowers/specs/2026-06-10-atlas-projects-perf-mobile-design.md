# atlas.projects — Performance, File Attachments & Mobile Kanban

**Status:** Approved  
**Date:** 2026-06-10  
**Scope:** Fix file attachment upload bug, add optimistic updates for snappy UX, fix cross-column drag on mobile  
**Excluded:** Real-time WebSocket subscriptions (deferred), server-side pagination for tasks (deferred)

---

## Problem Statement

Three independent problem areas have been reported:

1. **General sluggishness** — every mutation (move task, create task, update task) waits for the API round-trip before the UI reflects the change. On a VPS-hosted API with ~100-150 ms latency this means drag-and-drop feels laggy, quick-create cards appear slowly, and editing a task title takes a noticeable pause.
2. **File uploads don't link to tasks** — files upload successfully to Supabase Storage, but never appear in the task's attachment list. Root cause: `files-service.js:233` always sets `entityId = companyId` regardless of the `entityId` supplied in the FormData, and the `POST /projects/:id/tasks/:tid/attachments` handler finds the asset but never updates its `entityId` to the taskId.
3. **Mobile kanban is broken** — (a) only `PointerSensor` is registered; `TouchSensor` is absent so drag never activates on iOS/Android; (b) empty columns have no droppable zone registered, so releasing a card over an empty column sets `over = null` and the move is silently cancelled; (c) the `GripVertical` drag handle uses `opacity-0 group-hover:opacity-100` which makes it invisible on touch devices.

---

## Root Cause Analysis

### File attachment bug

```
Frontend → POST /files/upload  { entityType: "Task", entityId: taskId, ... }
files-service.js:233            const entityId = context.companyId  ← BUG: ignores FormData
                                const sourceEntityId = String(fields.entityId ?? "")  ← saved only in metadata
FileAsset saved with entityId = companyId
```

```
Frontend → POST /projects/:id/tasks/:tid/attachments  { file_asset_id: "..." }
projects-routes.js:393-399  finds asset, returns it, NEVER updates entityId  ← BUG
```

```
listTasks → prisma.fileAsset.groupBy WHERE entityId IN [taskIds]  → 0 results (entityId is companyId)
getTask   → prisma.fileAsset.findMany WHERE entityId = taskId     → 0 results
```

**Fix:** In `POST .../attachments`, after finding the asset, update:
```js
await prisma.fileAsset.update({ where: { id: file_asset_id }, data: { entityId: taskId, entityType: 'Task' } })
```
No change needed in `files-service.js` — the `sourceEntityId` is already stored in metadata for the storage object key path; fixing the attach endpoint is sufficient.

### Optimistic updates

All mutations in `useProjectsData.js` use the `loadingMutation` helper which only dismisses a loading toast on settle. None implement `onMutate` cache pre-writes. The pattern needed is standard TanStack Query optimistic:

```
onMutate → cancel in-flight, snapshot all matching queries, setQueriesData optimistically
onError  → restore snapshot
onSettled → invalidate to sync with server truth
```

For `useMoveTask` the optimistic update should change `statusId` on the matching task in the cache. For `useCreateTask` it should append a temp task object. For `useUpdateTask` it should merge the patch into both the list and detail caches.

### Mobile kanban

`@dnd-kit/core` ships three sensors: `PointerSensor`, `MouseSensor`, and `TouchSensor`. `PointerSensor` handles mouse + stylus well; on touch devices the Pointer Events API is present but scroll-prevention requires `{ delay, tolerance }` activation constraints rather than `{ distance }`. Without `TouchSensor` registered, a simple tap-and-hold doesn't reliably activate drag on iOS Safari.

`SortableContext` makes items sortable within a container but does NOT register the container itself as a droppable zone. Cross-container drops work when `over` lands on another sortable item. When the target column is empty, `over` is null — the drag is cancelled. The fix is to wrap each column's inner content div with `useDroppable({ id: status.id })` so the column itself is a valid drop target.

---

## Requirements

### R1 — File attachments

- R1.1: Files uploaded via `AttachmentsPanel` in `TaskDetailPanel` must appear in the task's attachment list after upload completes.
- R1.2: The attachment count badge on `KanbanView` cards and `ListView` rows must reflect the correct count after attachment.
- R1.3: File delete (soft-delete via `enabled: false`) must continue to work.

### R2 — Optimistic updates

- R2.1: Dragging a task to another column must update the card's column position instantly in the UI (no visual snap-back while awaiting API).
- R2.2: Quick-creating a task via the column's "+ Agregar tarea" input must show a placeholder card instantly.
- R2.3: Editing a task field in `TaskDetailPanel` must reflect the new value instantly in both the detail panel and the kanban card.
- R2.4: On network error, the UI must roll back to the pre-mutation state and display an error toast.

### R3 — Lazy dependency picker

- R3.1: Opening `TaskDetailPanel` must NOT trigger a `GET /projects/:id/tasks?` fetch for the dependency picker on mount.
- R3.2: The all-tasks fetch for the dependency picker must only fire when the dependencies section is first expanded.

### R4 — Mobile kanban

- R4.1: Touch drag-and-drop must activate on mobile (iOS Safari, Android Chrome) without conflicting with page scroll.
- R4.2: Dragging a task to an empty column must work (card drops into the column, not snap back).
- R4.3: The drag handle icon must be visible on touch devices (not hidden behind hover opacity).

### R5 — Reduce background re-fetches

- R5.1: Switching browser tabs / focusing the app window must not trigger background re-fetches for task queries.

---

## Files touched

| File | Change |
|------|--------|
| `apps/api/src/routes/projects/projects-routes.js` | Fix POST attachment handler (R1) |
| `apps/desktop/src/modules/atlas.projects/hooks/useProjectsData.js` | Optimistic mutations (R2, R3, R5) |
| `apps/desktop/src/modules/atlas.projects/components/TaskDetailPanel.jsx` | Lazy dependency picker (R3) |
| `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx` | TouchSensor + column droppable + handle visibility (R4) |

---

## Non-goals

- No changes to `files-service.js` — the upload entityId fix is intentionally minimal (only the attach endpoint).
- No real-time subscriptions.
- No server-side pagination.
- No changes to ListView or TimelineView for mobile.
