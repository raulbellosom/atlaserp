# atlas.projects Mobile DnD + Mentions Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three independent bugs: (1) mobile kanban drag requires hitting the tiny grip icon instead of the whole card, (2) `TaskFormModal` doesn't reset the status field on re-open, (3) `@mention` dropdown suggestions can't be selected on mobile.

**Architecture:** Three surgical edits in three separate component files. No new hooks, no new components, no API changes.

**Tech Stack:** React, dnd-kit (`PointerSensor`, `TouchSensor`), PointerEvents API

**Spec:** `docs/superpowers/specs/2026-06-10-atlas-projects-mobile-mentions-design.md`

---

## File Structure

```
apps/desktop/src/modules/atlas.projects/
  components/KanbanView.jsx        MODIFY — move drag listeners to card div
  components/TaskFormModal.jsx     MODIFY — reset statusId on open
  components/MentionTextarea.jsx   MODIFY — mousedown → pointerdown
```

---

### Task 1: Move dnd-kit listeners to whole card — fix mobile drag

**Problem:** `{...listeners}` are on the tiny 12px grip `<span>`. On mobile, users must hit that exact icon. With `TouchSensor` (delay: 250ms) on the card itself, a quick tap still opens the modal and a 250ms hold anywhere activates drag.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx`

- [ ] **Step 1: Read the current TaskCard component**

Read `KanbanView.jsx` lines 46-133. Confirm the card div and grip span structure. Note the exact `className` values so you can preserve them.

- [ ] **Step 2: Move `{...listeners}` and `{...attributes}` from grip span to card div**

Current card div opening tag (around line 56):
```jsx
    <div
      ref={setNodeRef}
      style={style}
      className="group bg-background border border-border rounded p-2.5 cursor-pointer hover:border-accent-foreground/20 transition-colors"
      onClick={() => onClick(task.id)}
    >
```

Replace with (add `{...attributes}` and `{...listeners}`):
```jsx
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="group bg-background border border-border rounded p-2.5 cursor-pointer hover:border-accent-foreground/20 transition-colors"
      onClick={() => onClick(task.id)}
    >
```

Current grip span (around lines 63-70):
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

Replace with (remove attributes/listeners/stopPropagation, add pointer-events-none):
```jsx
        <span
          className="mt-0.5 opacity-30 md:opacity-0 md:group-hover:opacity-100 cursor-grab text-muted-foreground pointer-events-none"
        >
          <GripVertical size={12} />
        </span>
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/KanbanView.jsx
git commit -m "fix(projects): move dnd listeners to full card — drag anywhere on mobile"
```

---

### Task 2: Reset statusId in TaskFormModal on open

**Problem:** When the modal is opened a second time, `statusId` retains the value from the previous open (e.g., "En progreso" instead of the default "Por hacer"). The open `useEffect` resets all other fields but forgets `statusId`.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/TaskFormModal.jsx`

- [ ] **Step 1: Read the current reset useEffect**

Read `TaskFormModal.jsx` lines 32-45. Confirm the two `useEffect` hooks. The first resets `title`, `priority`, `assigneeId`, `dueDate` on open. The second sets `statusId` only when `statuses.length && !statusId`.

- [ ] **Step 2: Add statusId reset to the open useEffect**

Current first useEffect (lines 32-39):
```js
  useEffect(() => {
    if (open) {
      setTitle('')
      setPriority('NONE')
      setAssigneeId('__none__')
      setDueDate(null)
    }
  }, [open])
```

Replace with:
```js
  useEffect(() => {
    if (open) {
      setTitle('')
      setPriority('NONE')
      setAssigneeId('__none__')
      setDueDate(null)
      setStatusId(defaultStatusId ?? statuses.find((s) => s.isDefault)?.id ?? statuses[0]?.id ?? '')
    }
  }, [open])
```

Note: `statuses`, `defaultStatusId` are already in scope at this point in the component. The `setStatusId` function is already declared.

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/TaskFormModal.jsx
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/TaskFormModal.jsx
git commit -m "fix(projects): reset statusId to default when TaskFormModal opens"
```

---

### Task 3: Fix @mention dropdown on mobile (mousedown → pointerdown)

**Problem:** The mention suggestion buttons use `onMouseDown` to insert the mention. On mobile, `mousedown` doesn't fire — only `pointerdown` / `touchstart` / `click`. Tapping a suggestion does nothing. Additionally the outside-click listener uses `mousedown` so it also doesn't close on mobile tap-outside.

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx`

- [ ] **Step 1: Read the current MentionTextarea**

Read `MentionTextarea.jsx` lines 159-205. Confirm:
- Line ~162: `document.addEventListener('mousedown', handleClick)`
- Line ~165: `document.removeEventListener('mousedown', handleClick)`
- Line ~194: `onMouseDown={(e) => { e.preventDefault(); insertMention(m) }}`

- [ ] **Step 2: Replace mousedown with pointerdown in the outside-click listener**

Find (lines 159-166):
```js
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])
```

Replace with:
```js
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', handleClick)
    return () => document.removeEventListener('pointerdown', handleClick)
  }, [open])
```

- [ ] **Step 3: Replace onMouseDown with onPointerDown on suggestion buttons**

Find (line ~194 inside the `filtered.slice(0, 8).map(...)` block):
```jsx
              onMouseDown={(e) => {
                e.preventDefault()
                insertMention(m)
              }}
```

Replace with:
```jsx
              onPointerDown={(e) => {
                e.preventDefault()
                insertMention(m)
              }}
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx
```

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx
git commit -m "fix(projects): use pointerdown for mention dropdown — works on mobile touch"
```

---

## Self-Review Checklist

- [x] R1 (mobile drag anywhere) — Task 1: listeners on card div
- [x] R2 (quick tap opens modal) — Task 1: onClick on card div unchanged; TouchSensor delay 250ms handles distinction
- [x] R3 (statusId resets) — Task 2: setStatusId in open useEffect
- [x] R4 (mention dropdown on mobile) — Task 3: pointerdown fires on touch
- [x] R5 (tap suggestion inserts token) — Task 3: onPointerDown with preventDefault keeps focus in textarea
- [x] R6 (tap outside closes dropdown) — Task 3: pointerdown listener closes on outside touch
