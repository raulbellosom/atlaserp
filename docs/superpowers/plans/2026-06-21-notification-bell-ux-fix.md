# NotificationBell UX Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two UX bugs in `NotificationBell` — panel stays open after navigation, and navigation is blocked by the mark-as-read API call.

**Architecture:** Add a controlled `open` state to `DropdownMenu`, rewrite `handleNotificationClick` as synchronous with an optimistic TanStack Query cache update, fire mark-as-read without awaiting, and navigate immediately. Single-file change.

**Tech Stack:** React (`useState`), TanStack Query (`useQueryClient.setQueryData`), Radix UI `DropdownMenu` (controlled `open`/`onOpenChange`)

---

### Task 1: Controlled open state + instant close + optimistic read + immediate navigation

**Files:**
- Modify: `apps/desktop/src/components/NotificationBell.jsx`

**Context:** The current file has no `useState` import (line 1 only imports from `@tanstack/react-query`). The `DropdownMenu` at line 91 is uncontrolled. `handleNotificationClick` (lines 74–88) is `async` and blocks navigation behind `await markOneRead.mutateAsync(id)`. The "Ver todas" button at line ~177 calls `onSeeAll?.()` but does not close the panel.

- [ ] **Step 1: Add `useState` import**

At the top of `apps/desktop/src/components/NotificationBell.jsx`, insert a React import before the existing imports:

```jsx
import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
```

- [ ] **Step 2: Add `open` state inside `NotificationBell` and wire to `DropdownMenu`**

Inside the `NotificationBell` function body, add `open` state directly after the `markOneRead` mutation declaration:

```jsx
const [open, setOpen] = useState(false);
```

Then change the opening `<DropdownMenu>` tag from:

```jsx
<DropdownMenu>
```

to:

```jsx
<DropdownMenu open={open} onOpenChange={setOpen}>
```

- [ ] **Step 3: Replace `handleNotificationClick` with synchronous optimistic version**

Replace the entire existing `handleNotificationClick` function (the `async function handleNotificationClick` block) with:

```jsx
function handleNotificationClick(notification) {
  if (!notification) return;
  setOpen(false);
  if (!notification.read) {
    queryClient.setQueryData(["notifications", token], (old) => {
      const list = Array.isArray(old) ? old : (old?.data ?? []);
      const updated = list.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n
      );
      return Array.isArray(old) ? updated : { ...old, data: updated };
    });
    markOneRead.mutate(notification.id);
  }
  if (notification.link && typeof onNavigate === "function") {
    onNavigate(notification.link);
    return;
  }
  if (typeof onSeeAll === "function") {
    onSeeAll();
  }
}
```

Note: `queryClient.setQueryData` handles both cache shapes — plain array (`Array.isArray(old)`) and `{ data: [] }` object — matching the normalisation already present at line 58.

- [ ] **Step 4: Fix "Ver todas las notificaciones" footer button**

Find the footer button with `onClick={() => onSeeAll?.()}` and replace its `onClick` with:

```jsx
onClick={() => { setOpen(false); onSeeAll?.(); }}
```

- [ ] **Step 5: Verify manually**

Start the dev server:
```bash
pnpm dev
```

Open http://localhost:5173 and run through these checks:

| # | Action | Expected |
|---|--------|----------|
| 1 | Click bell, then click an unread notification that has a link | Panel closes on the same frame, unread dot disappears, navigation starts without delay |
| 2 | Re-open the bell | That notification is now shown as read (no blue dot) |
| 3 | Click bell, click "Ver todas las notificaciones" | Panel closes and the notifications inbox screen opens |
| 4 | Throttle network in DevTools to Slow 3G, click an unread notification | Panel still closes and navigation still starts — no waiting |
| 5 | Click bell, click an already-read notification | Panel closes and navigates (no mutation fired) |

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/components/NotificationBell.jsx
git commit -m "fix(notifications): close panel instantly and navigate without awaiting mark-as-read"
```
