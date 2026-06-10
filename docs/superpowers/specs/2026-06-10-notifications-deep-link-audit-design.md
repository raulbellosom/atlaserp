# Notifications Deep Link Audit — Design Spec

**Date:** 2026-06-10
**Status:** Approved
**Scope:** Option B — Deep link contract + current state fixes

## Problem Statement

In-app notifications navigate to the correct module but never open the specific entity
(event, task, project) the notification refers to. Calendar links carry `?eventId=xxx` but
`CalendarScreen` ignores it. Project notifications link to `/app/m/atlas.projects` with no
identifier at all. Additionally, VAPID push configuration status is invisible to users in
Settings, causing silent subscription failures.

## Goals

1. Clicking any notification opens the exact entity it refers to (modal or panel).
2. A consistent, extensible URL convention governs all notification deep links.
3. Users can see at a glance whether push notifications are active on their device.

## Non-Goals

- Real-time notifications via SSE or WebSocket (future work).
- Email template redesign (future work).
- New notification event types.
- Changes to `NotificationBell`, `AtlasApp`, or the service worker — they already handle navigation correctly.

---

## Section 1: URL Deep Link Convention

### Contract

All notification `link` fields use the following format:

```
/app/m/<moduleKey>?open=<entityType>:<entityId>
```

Examples:
```
/app/m/atlas.calendar?open=event:01971a2b-0000-7000-8000-000000000001
/app/m/atlas.projects?open=task:01971a2b-0000-7000-8000-000000000002
/app/m/atlas.projects?open=project:01971a2b-0000-7000-8000-000000000003
```

### Rules

- The query param is always named `open`.
- Value format is `<entityType>:<entityId>` — no spaces, lowercase entity type.
- After processing the param on mount, the module clears it from the URL using
  `setSearchParams({}, { replace: true })` so the browser back button does not
  re-trigger the modal.
- If the entity does not exist (deleted or unauthorized), the module renders
  `ErrorState` instead of opening an empty modal.
- Modules that do not yet implement deep linking simply ignore the `open` param.
- No changes required in `NotificationBell`, `AtlasApp`, `sw-notifications.js`, or
  the SDK — they forward the `link` value unchanged.

### Existing `?eventId=` param

The calendar currently uses `?eventId=xxx`. This is replaced by `?open=event:xxx` in
`calendar-notification-service.js`. No other code reads `?eventId` at module level today,
so there is no migration risk.

---

## Section 2: Calendar — Event Modal from URL

### Affected files

| File | Change |
|---|---|
| `apps/api/src/routes/calendar/calendar-notification-service.js` | Update `link` to `?open=event:${reminder.eventId}` |
| `apps/desktop/src/modules/atlas.calendar/CalendarScreen.jsx` | Read `?open=event:id` on mount, open EventFormModal |

### Behavior

On `CalendarScreen` mount:

1. Read `useSearchParams()` and parse `open` param.
2. If format is `event:<id>`, call `setViewingEventId(id)` to open `EventFormModal`.
3. Clear `open` from URL with `replace: true`.
4. If the event fetch returns 404 or an error, `EventFormModal` renders `ErrorState`
   ("Este evento ya no existe o no tienes acceso").
5. If the `open` param is absent or malformed, the screen renders normally.

### Edge cases

- Event was deleted after notification was sent → `ErrorState` inside modal.
- User lacks permission for the event → same `ErrorState` path (API returns 403/404).
- Calendar is still loading when param is processed → `setViewingEventId` is called
  immediately; the modal waits for the fetch to resolve before rendering content.

---

## Section 3: Projects — Task and Project Panel from URL

### Affected files

| File | Change |
|---|---|
| `apps/api/src/routes/projects/projects-notification-service.js` | Update all task event links to `?open=task:${taskId}`; member.added to `?open=project:${projectId}` |
| `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx` | Read `?open=task:id` and `?open=project:id` on mount |

### Notification link mapping

| Event type | Old link | New link |
|---|---|---|
| `projects.task.assigned` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.task.unassigned` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.task.comment` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.task.mention` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.task.status_changed` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.task.due_soon` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=task:${sourceId}` |
| `projects.member.added` | `/app/m/atlas.projects` | `/app/m/atlas.projects?open=project:${sourceId}` |

`sourceId` is already set on every notification publish call — no new data is needed.

### Behavior on `ProjectsScreen` mount

**`?open=task:<id>`:**
1. Parse `open` param.
2. Call `openTask(id)` — `TaskDetailPanel` opens floating over the projects list.
   `TaskDetailPanel` fetches the task by ID independently; no project selection required.
3. Clear `open` from URL with `replace: true`.
4. If task not found → `TaskDetailPanel` renders `ErrorState`.

**`?open=project:<id>`:**
1. Parse `open` param.
2. Set the active project to `<id>` so the project detail view is selected in the list.
3. Clear `open` from URL with `replace: true`.
4. If project not found → no-op (list renders normally).

### Edge cases

- Task was deleted → `TaskDetailPanel` shows `ErrorState` ("Esta tarea ya no existe").
- User is not a member of the project → API returns 403/404, `TaskDetailPanel` shows
  `ErrorState`.
- `ProjectsScreen` is still loading its project list when param is read → the `open`
  param is captured in a `useRef` on first render. A `useEffect` that depends on
  `[projectsLoaded]` calls `openTask(pendingOpenRef.current)` once data is ready,
  then clears the ref.

---

## Section 4: VAPID Push Status in NotificationSettingsScreen

### Affected files

| File | Change |
|---|---|
| `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx` | Add push status banner and subscription toggle |

### Behavior

On settings screen mount, `GET /notifications/subscriptions/webpush/public-key` is called:

| API result | UI state |
|---|---|
| 200 + active subscription in DB | Green pill "Push activo en este dispositivo" + "Desactivar" button |
| 200 + no subscription yet | "Activar notificaciones push" button (calls subscribe flow) |
| 409 (`web_push_not_configured`) | Gray pill "Push no disponible — contacta al administrador" |
| Network error | Inline error message, retry button |

The subscribe flow already exists in the SDK (`atlas.notifications.subscribeWebPush`).
The settings screen currently exposes preference toggles but does not expose the
subscription state. This section adds that missing status block above the preference
toggles.

### No silent failures

The existing subscribe call in the PWA onboarding flow will surface errors via
`toast.error` instead of swallowing them silently. This is a one-line fix in the
subscription hook/component that calls `subscribeWebPush`.

---

## Architecture summary

```
Notification published
  └─ link: /app/m/<module>?open=<type>:<id>

User clicks notification (bell dropdown OR push toast)
  └─ NotificationBell / AtlasApp → navigate(link)   [no change needed]

Module mounts at /app/m/<module>?open=<type>:<id>
  └─ useSearchParams → parse "open"
  └─ openEntity(id)
  └─ clearSearchParam("open", { replace: true })
  └─ entity not found → ErrorState
```

The convention is open-ended: any future module that publishes notifications with
`?open=<type>:<id>` links gets deep linking for free by implementing the same
`useSearchParams` pattern on mount.

---

## Out of scope (future iterations)

- SSE / WebSocket for real-time in-app delivery (currently 60 s polling).
- Rich email templates with CTA buttons and unsubscribe links.
- Deep links for Finance, HR, Contacts, and other modules.
- Notification grouping / threading in the bell dropdown.
