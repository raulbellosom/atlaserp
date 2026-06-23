# Calendar Deep-Link Loading State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `EventDetailModal` appear immediately with a skeleton when navigating to CalendarScreen via a notification deep-link, instead of waiting silently for the API response.

**Architecture:** Two-step change. First add `_isLoading` skeleton support to `EventDetailModal` so it can render without a full event object. Then fix `CalendarScreen` to call `setDetailEvent({ id, _isLoading: true })` on mount when a deep-link ID is present, replacing the current pattern that waits for data before opening the modal.

**Tech Stack:** React (`useState`, `useEffect`), TanStack Query (`useCalendarEvent`), `@atlas/ui` (`Skeleton`), Lucide (`X`)

---

### Task 1: Add skeleton loading branch to `EventDetailModal`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx`

**Context:** `EventDetailModal` currently starts with `if (!event) return null` (line 39). It uses a custom overlay (not a Radix Dialog). `X` is already imported from lucide-react (line 8). `Skeleton` is NOT currently imported — it must be added from `@atlas/ui`. The modal chrome is a fixed overlay div wrapping a card div with a color bar at top.

- [ ] **Step 1: Add `Skeleton` to the `@atlas/ui` import**

Find the existing import on line 16:
```jsx
import { MarkdownViewer, ConfirmDialog } from "@atlas/ui";
```

Replace it with:
```jsx
import { MarkdownViewer, ConfirmDialog, Skeleton } from "@atlas/ui";
```

- [ ] **Step 2: Add the `_isLoading` skeleton branch after the null guard**

Find the existing null guard (line 39):
```jsx
  if (!event) return null;

  const calColor = event.color || event.calendar?.color || "#6B46C1";
```

Replace it with:
```jsx
  if (!event) return null;

  if (event._isLoading) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
        onClick={onClose}
      >
        <div
          className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-136 max-w-[calc(100vw-2rem)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="h-1.5 bg-[hsl(var(--muted))]" />
          <div className="flex items-center justify-end px-4 pt-3 pb-1">
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
              title="Cerrar"
            >
              <X size={15} className="text-[hsl(var(--muted-foreground))]" />
            </button>
          </div>
          <div className="px-6 pb-6 space-y-3">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        </div>
      </div>
    );
  }

  const calColor = event.color || event.calendar?.color || "#6B46C1";
```

- [ ] **Step 3: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx
```

Expected: no output (clean).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx
git commit -m "feat(calendar): add skeleton loading state to EventDetailModal"
```

---

### Task 2: Fix CalendarScreen to open the modal immediately on deep-link mount

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx`

**Context:** The deep-link handling lives at lines 54–85. `deepLinkEventId` is captured in a lazy `useState` initializer. Three effects follow: URL clear (deps `[]`), open-on-data-arrive (deps `[deepLinkEventId, deepLinkEventData]`), and error toast (deps `[deepLinkEventId, deepLinkEventError]`). `setDetailEvent` is declared later at line 98 — this is valid because React effect callbacks close over the variable binding and only execute post-render after all hooks have initialised.

The fix adds one new `useEffect` with `[]` deps that immediately calls `setDetailEvent({ id: deepLinkEventId, _isLoading: true })` when a deep-link ID is present. The error effect gains `setDetailEvent(null)` to close the skeleton modal if the fetch fails.

- [ ] **Step 1: Add the immediate-open effect and fix the error effect**

Find the entire deep-link effects block (lines 70–85):
```js
  const { data: deepLinkEventData, isError: deepLinkEventError } = useCalendarEvent(deepLinkEventId);

  // Open EventDetailModal once the event data arrives.
  useEffect(() => {
    if (!deepLinkEventId || !deepLinkEventData) return;
    const event = deepLinkEventData?.data ?? deepLinkEventData;
    if (event?.id) {
      setDetailEvent(event);
    }
  }, [deepLinkEventId, deepLinkEventData]);

  // Show an error toast if the event no longer exists.
  useEffect(() => {
    if (!deepLinkEventId || !deepLinkEventError) return;
    toast.error("El evento no existe o ya fue eliminado.");
  }, [deepLinkEventId, deepLinkEventError]);
```

Replace it with:
```js
  const { data: deepLinkEventData, isError: deepLinkEventError } = useCalendarEvent(deepLinkEventId);

  // Open the modal immediately with a loading skeleton so the user sees feedback at once.
  useEffect(() => {
    if (!deepLinkEventId) return;
    setDetailEvent({ id: deepLinkEventId, _isLoading: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Replace the loading skeleton with real event data once it arrives.
  useEffect(() => {
    if (!deepLinkEventId || !deepLinkEventData) return;
    const event = deepLinkEventData?.data ?? deepLinkEventData;
    if (event?.id) {
      setDetailEvent(event);
    }
  }, [deepLinkEventId, deepLinkEventData]);

  // Close the loading modal and show an error toast if the event no longer exists.
  useEffect(() => {
    if (!deepLinkEventId || !deepLinkEventError) return;
    setDetailEvent(null);
    toast.error("El evento no existe o ya fue eliminado.");
  }, [deepLinkEventId, deepLinkEventError]);
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx
```

Expected: no output (clean).

- [ ] **Step 3: Manual verification**

Start the dev server:
```bash
pnpm dev
```

Open http://localhost:5173, log in, and verify:

| # | Action | Expected |
|---|--------|----------|
| 1 | Navigate to `/app/m/atlas.calendar?open=event:<valid-id>` in the browser address bar | `EventDetailModal` appears immediately with skeleton rows; within ~2 s real content replaces the skeleton |
| 2 | Click the X button while the skeleton is showing | Modal closes |
| 3 | Click the overlay while the skeleton is showing | Modal closes |
| 4 | Navigate to `/app/m/atlas.calendar?open=event:nonexistent-id` | Skeleton appears briefly, then closes; toast "El evento no existe o ya fue eliminado." |
| 5 | Click a normal calendar event (not via deep link) | `EventDetailModal` opens with full data as before — no regression |
| 6 | Navigate to calendar without `?open=` param | Calendar renders normally, no modal opens |

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx
git commit -m "fix(calendar): open EventDetailModal immediately with skeleton on deep-link navigation"
```
