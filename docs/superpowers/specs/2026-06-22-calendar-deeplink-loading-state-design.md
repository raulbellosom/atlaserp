# Spec: Calendar Deep-Link Loading State

**Date:** 2026-06-22
**Status:** Approved

## Problem

When a user clicks a calendar reminder notification, the link navigates to `/app/m/atlas.calendar?open=event:ID`. The `CalendarScreen` reads the event ID and fires `useCalendarEvent(deepLinkEventId)`, but only calls `setDetailEvent(event)` once the data arrives. During the 2-3 second API round-trip, the user sees nothing — the modal is invisible and there is no feedback that anything is loading.

This is the only currently broken deep-link pattern in the app. All other modules either open their panel immediately with a loading state inside (atlas.projects tasks via `TaskDetailPanel`) or navigate to a full-page detail screen with `LoadingState` (atlas.growth leads, atlas.inventory items).

## Goal

When navigating to CalendarScreen via a deep-link notification, the `EventDetailModal` must appear immediately with a skeleton loading state. The skeleton is replaced by real content as soon as the event data arrives. If the event no longer exists, the modal closes and an error toast appears.

This establishes the correct pattern that all future deep-link screens must follow.

## Scope

Two files in the Calendar module:
- `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/EventDetailModal.jsx`

No backend changes, no other modules.

## Design

### 1. `CalendarScreen.jsx` — open modal immediately on mount

Add a new `useEffect` that fires once on mount (same lifecycle as the URL-clear effect). When `deepLinkEventId` is present it immediately calls `setDetailEvent({ id: deepLinkEventId, _isLoading: true })`, opening the modal before any data has arrived.

The existing effect that replaces the stub with real data is unchanged:
```js
useEffect(() => {
  if (!deepLinkEventId || !deepLinkEventData) return;
  const event = deepLinkEventData?.data ?? deepLinkEventData;
  if (event?.id) setDetailEvent(event);
}, [deepLinkEventId, deepLinkEventData]);
```

The error effect gains `setDetailEvent(null)` to close the loading modal if the event no longer exists:
```js
useEffect(() => {
  if (!deepLinkEventId || !deepLinkEventError) return;
  setDetailEvent(null);
  toast.error("El evento no existe o ya fue eliminado.");
}, [deepLinkEventId, deepLinkEventError]);
```

The three mount-time effects (URL clear, immediate open, error clear) all use `[]` as the dep array and are grouped together for clarity.

### 2. `EventDetailModal.jsx` — skeleton loading state

Add `Skeleton` to the `@atlas/ui` import. After the existing `if (!event) return null` guard, add:

```jsx
if (event._isLoading) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-136 max-w-[calc(100vw-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-1.5 bg-[hsl(var(--muted))]" />
        <div className="flex items-center justify-end px-4 pt-3 pb-1">
          <button onClick={onClose} className="p-1.5 rounded hover:bg-[hsl(var(--muted))]">
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
```

This reuses the exact same modal chrome (overlay, card, color bar, close button) as the real modal. The user sees an instant visual response with a shape they recognise, then content fades in.

### 3. What stays unchanged

- The `useCalendarEvent(deepLinkEventId)` hook call — still fetches in background
- The URL-clear `useEffect` — unchanged
- All non-deep-link modal open/close flows — unchanged
- `onClose` callback contract — `_isLoading` modal closes the same way as any other

## Acceptance criteria

1. Clicking a calendar reminder notification closes the notification panel and navigates to CalendarScreen
2. The `EventDetailModal` appears immediately with skeleton content (no blank wait)
3. Within ~2 seconds, skeleton content is replaced by the real event data
4. If the event does not exist, the skeleton modal closes and a toast appears: "El evento no existe o ya fue eliminado."
5. Clicking the overlay or X button while loading closes the modal (same as normal)
6. Non-deep-link calendar flows (clicking an event in the calendar view) are unaffected

## Pattern rule (for future screens)

Any screen that handles a `?open=` deep-link and needs to open a modal/panel **must** open the panel immediately with a loading state inside. Do NOT wait for API data before calling `setState` to show the panel. Follow `TaskDetailPanel` (projects) and this Calendar fix as the reference implementation.
