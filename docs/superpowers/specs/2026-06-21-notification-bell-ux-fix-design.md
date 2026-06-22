# Spec: NotificationBell UX Fix — Instant Close + Optimistic Read

**Date:** 2026-06-21
**Status:** Approved

## Problem

Two UX regressions in `NotificationBell`:

1. **Panel stays open after navigation.** Clicking a notification fires `onNavigate` (in `Topbar`) but the `DropdownMenu` never receives a close signal — its inner items are raw `<button>` elements, not `DropdownMenuItem`, so Radix's auto-close doesn't trigger.
2. **Navigation is blocked by the mark-as-read API call.** `handleNotificationClick` is `async` and does `await markOneRead.mutateAsync(id)` before calling `onNavigate`. On a slow network this can take several seconds, leaving the user with no feedback and causing repeated clicks.

## Goal

Clicking a notification should:
- Close the panel instantly
- Remove the unread dot instantly (optimistic update)
- Navigate immediately
- Persist the read state to the server in the background

## Scope

Single file: `apps/desktop/src/components/NotificationBell.jsx`. No backend changes, no other files.

## Design

### 1. Controlled dropdown open state

Add `const [open, setOpen] = useState(false)` and wire it to `<DropdownMenu open={open} onOpenChange={setOpen}>`. This gives the component explicit control to close the panel at any time.

### 2. Refactored `handleNotificationClick` (no longer async)

```
function handleNotificationClick(notification) {
  // 1. Close the panel immediately
  setOpen(false);

  // 2. Optimistic read update — mutate cache in place, no await
  if (!notification.read) {
    queryClient.setQueryData(["notifications", token], (old) => {
      const list = Array.isArray(old) ? old : (old?.data ?? []);
      const updated = list.map((n) =>
        n.id === notification.id ? { ...n, read: true } : n
      );
      return Array.isArray(old) ? updated : { ...old, data: updated };
    });
    markOneRead.mutate(notification.id);   // fire-and-forget
  }

  // 3. Navigate immediately
  if (notification.link && typeof onNavigate === "function") {
    onNavigate(notification.link);
    return;
  }
  if (typeof onSeeAll === "function") {
    onSeeAll();
  }
}
```

**Cache shape handling:** the query may return a plain array or `{ data: [] }` — the optimistic update handles both cases, matching the existing normalisation at line 58.

**No rollback on error:** if `markOneRead` fails, the server read state diverges from the cache until the next refetch (60 s or window focus). Acceptable — the user is not impacted visually.

### 3. "Ver todas" button also closes the panel

The footer button calls `onSeeAll` but doesn't close the dropdown. Wrap it: `onClick={() => { setOpen(false); onSeeAll?.(); }}`.

### 4. "Marcar todo como leído" — no change needed

`markAllRead.mutate()` triggers `invalidateQueries`, which re-fetches from the server. This is correct; the user is not navigating, so no close is needed.

## What does NOT change

- API routes, `Topbar.jsx`, SDK, or any other component
- Refetch interval (60 s) and stale time remain the same
- No loading spinner is added — making navigation instant removes the need for one

## Acceptance criteria

- Clicking a notification closes the panel on the same frame as the click
- The unread dot disappears immediately on click
- Navigation starts immediately (no perceptible delay from the mark-as-read call)
- "Ver todas las notificaciones" also closes the panel
- On slow networks, the panel closes and navigation happens even if mark-as-read takes several seconds
