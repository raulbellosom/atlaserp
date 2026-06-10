# atlas.projects — Mobile DnD, TaskFormModal Reset & Mentions Fix

**Status:** Approved  
**Date:** 2026-06-10  
**Scope:** Three surgical frontend fixes for the projects module  
**Depends on:** Previous perf/mobile spec (2026-06-10-atlas-projects-perf-mobile-design.md) — TouchSensor already in place

---

## Problem 1 — Mobile kanban drag requires hitting the tiny grip icon

### Root cause

`{...listeners}` from dnd-kit (the drag activation event handlers) are attached to the `<span>` containing `<GripVertical size={12} />` (12×12 px), NOT to the whole task card. On mobile, users must long-press precisely on that 12px icon to drag. Any touch on the rest of the card fires `onClick` and opens the detail panel.

The `TouchSensor` with `delay: 250, tolerance: 5` is already correctly configured in the previous sprint. The sensor correctly distinguishes quick tap (→ click, < 250ms) from long-press (→ drag, ≥ 250ms). The only problem is that the listeners are scoped too narrowly.

### Fix

Move `{...listeners}` from the grip `<span>` to the whole card `<div>`. The grip icon becomes a pure visual affordance (add `pointer-events-none`). Remove the `onClick={(e) => e.stopPropagation()}` from the span — it's no longer needed.

With this change:
- Desktop: move mouse 8px → drag activates (PointerSensor, distance: 8)
- Mobile: hold 250ms anywhere on card → drag activates (TouchSensor, delay: 250)
- Mobile/Desktop: quick tap anywhere on card → `onClick` fires → opens detail panel

**Files:** `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx`

---

## Problem 2 — TaskFormModal doesn't reset statusId on re-open

### Root cause

`TaskFormModal.jsx` has two `useEffect` hooks:

```js
// Resets form on open — but MISSES statusId
useEffect(() => {
  if (open) {
    setTitle('')
    setPriority('NONE')
    setAssigneeId('__none__')
    setDueDate(null)
    // ← statusId never reset here
  }
}, [open])

// Sets default statusId when statuses load (only if statusId is empty)
useEffect(() => {
  if (statuses.length && !statusId) {
    setStatusId(...)
  }
}, [statuses.length, defaultStatusId])
```

When the modal closes with status "En progreso" selected and reopens, the second `useEffect` guard `!statusId` is truthy so `statusId` stays at "En progreso" instead of resetting to the default.

### Fix

Add `setStatusId(defaultStatusId ?? statuses.find(s => s.isDefault)?.id ?? statuses[0]?.id ?? '')` to the first `useEffect` (the one that fires on `open`).

### Note on dual-creation pattern

The dual pattern is intentional and correct:
- **QuickCreateInput** (inline in column): title only, column-specific, keyboard-first workflow
- **TaskFormModal** (header button): full fields (status, priority, assignee, due date), not column-specific

No unification needed. Just fix the reset bug.

**Files:** `apps/desktop/src/modules/atlas.projects/components/TaskFormModal.jsx`

---

## Problem 3 — Mentions don't work on mobile

### Root cause

`MentionTextarea.jsx` uses `onMouseDown` in two places:

1. **Outside-click listener** (lines 161-165): uses `document.addEventListener('mousedown', handleClick)` to close the dropdown when clicking outside. On mobile, `mousedown` doesn't fire (only `pointerdown` / `touchstart`). So the dropdown doesn't close on outside tap.

2. **Suggestion buttons** (line 194): `onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}`. The `e.preventDefault()` is intentional — it prevents the textarea from losing focus before the text is inserted. On mobile `mousedown` doesn't fire, so tapping a suggestion does nothing. The dropdown may briefly appear and then close without inserting anything.

### Fix

Replace `mousedown` with `pointerdown` throughout:

1. Outside-click listener:
```js
// Before
document.addEventListener('mousedown', handleClick)
return () => document.removeEventListener('mousedown', handleClick)

// After
document.addEventListener('pointerdown', handleClick)
return () => document.removeEventListener('pointerdown', handleClick)
```

2. Suggestion buttons:
```jsx
// Before
onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}

// After
onPointerDown={(e) => { e.preventDefault(); insertMention(m) }}
```

`PointerEvent` is the modern cross-platform event that fires for both mouse and touch on all major browsers (Chrome, Safari, Firefox). `e.preventDefault()` on `pointerdown` still prevents the textarea from losing focus.

**Files:** `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx`

---

## Requirements

- R1: On mobile, a 250ms long-press anywhere on a kanban task card activates drag without opening the detail modal
- R2: Quick tap (< 250ms) on a task card opens the detail panel as before
- R3: `TaskFormModal` always resets to the default status each time it opens
- R4: Typing `@` in the comment box shows the mention dropdown on both desktop and mobile
- R5: Tapping a mention suggestion on mobile inserts the mention token and keeps focus in the textarea
- R6: Tapping outside the mention dropdown on mobile closes it

## Files touched

| File | Change |
|------|--------|
| `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx` | Move drag listeners from grip span to card div |
| `apps/desktop/src/modules/atlas.projects/components/TaskFormModal.jsx` | Reset statusId in open useEffect |
| `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx` | mousedown → pointerdown |
