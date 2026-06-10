# Notifications Deep Link Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken deep links in Calendar and Projects notifications so that clicking a notification opens the exact entity it refers to, using a consistent `?open=<type>:<id>` URL convention; and add VAPID push-configuration status in the notification settings screen.

**Architecture:** Each notification `link` field carries `?open=<entityType>:<entityId>`. On mount, the target module screen reads that param with `useSearchParams`, opens the modal/panel, then clears the param from the URL using `replace: true` so back-navigation doesn't re-trigger it. The convention is zero-cost to add to future modules — they just implement the same pattern.

**Tech Stack:** Node.js (API service tests — `node --test`), React + React Router `useSearchParams`, TanStack Query (`useQuery`), Sonner (`toast`), existing hooks `useCalendarEvent` and `openTask`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/api/src/routes/calendar/calendar-notification-service.js` | Modify | Change `?eventId=` link to `?open=event:` |
| `apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js` | Create | Assert link format for calendar reminders |
| `apps/api/src/routes/projects/projects-notification-service.js` | Modify | Replace generic `/atlas.projects` links with `?open=task:` / `?open=project:` |
| `apps/api/src/routes/projects/__tests__/projects-notification-service.test.js` | Create | Assert link format for all 7 notification types |
| `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx` | Modify | Read `?open=event:id`, fetch event, open `EventDetailModal` |
| `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx` | Modify | Read `?open=task:id` / `?open=project:id`, open panel or select project |
| `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx` | Modify | Add VAPID server-config status banner above push subscription UI |

---

## Task 1 — Update calendar notification link format

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-notification-service.js:133`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js`

- [ ] **Step 1.1 — Create the test file**

Create `apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCalendarNotificationService } from "../calendar-notification-service.js";

const EVENT_ID = "01971a2b-0000-7000-8000-000000000001";
const USER_ID  = "01971a2b-0000-7000-8000-000000000002";
const COMPANY_ID = "01971a2b-0000-7000-8000-000000000003";

function buildPrismaMock() {
  const now = new Date();
  const startAt = new Date(now.getTime() + 10 * 60 * 1000); // 10 min from now
  const published = [];

  const reminder = {
    id: "rem-1",
    userId: USER_ID,
    eventId: EVENT_ID,
    minutesBefore: 15,
    sentAt: null,
    event: { id: EVENT_ID, title: "Reunion de equipo", startAt, allDay: false, enabled: true },
  };

  return {
    instanceConfig: { findFirst: async () => null },
    calendarReminder: {
      findMany: async () => [reminder],
      updateMany: async () => {},
    },
    calendarNotification: { createMany: async () => {} },
    // findFirst used by processReminders to get companyId;
    // findMany used by resolveRecipientUserIds inside notificationSvc.publish.
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      findMany: async ({ where }) => {
        const ids = where?.userId?.in ?? [];
        return ids.map((id) => ({ userId: id }));
      },
    },
    $transaction: async (fn) =>
      fn({
        notification: {
          findFirst: async () => null,
          create: async ({ data }) => {
            published.push(data);
            return { id: "notif-1", ...data };
          },
        },
        notificationDelivery: { createMany: async () => {} },
      }),
    _published: published,
  };
}

describe("createCalendarNotificationService", () => {
  describe("processReminders", () => {
    it("publishes notification with ?open=event:<id> link format", async () => {
      const prisma = buildPrismaMock();
      const svc = createCalendarNotificationService({ prisma });

      await svc.processReminders();

      assert.ok(prisma._published.length > 0, "expected at least one notification published");
      const link = prisma._published[0].link;
      assert.ok(
        typeof link === "string" && link.includes(`?open=event:${EVENT_ID}`),
        `expected link to contain ?open=event:${EVENT_ID}, got: ${link}`,
      );
    });
  });
});
```

- [ ] **Step 1.2 — Run the test to confirm it fails**

```bash
node --test apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js
```

Expected: FAIL — the current link uses `?eventId=` not `?open=event:`.

- [ ] **Step 1.3 — Update the link in `calendar-notification-service.js`**

In `apps/api/src/routes/calendar/calendar-notification-service.js`, find line ~133 inside `processReminders`:

```js
// OLD
link: `/app/m/atlas.calendar?eventId=${reminder.eventId}`,
```

Replace with:

```js
// NEW
link: `/app/m/atlas.calendar?open=event:${reminder.eventId}`,
```

- [ ] **Step 1.4 — Run the test to confirm it passes**

```bash
node --test apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js
```

Expected: PASS.

- [ ] **Step 1.5 — Commit**

```bash
git add apps/api/src/routes/calendar/calendar-notification-service.js apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js
git commit -m "feat(notifications): use ?open=event:id convention in calendar reminders"
```

---

## Task 2 — Update projects notification link format

**Files:**
- Modify: `apps/api/src/routes/projects/projects-notification-service.js`
- Create: `apps/api/src/routes/projects/__tests__/projects-notification-service.test.js`

- [ ] **Step 2.1 — Create the test file**

Create `apps/api/src/routes/projects/__tests__/projects-notification-service.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createProjectsNotificationService } from "../projects-notification-service.js";

const COMPANY_ID  = "01971a2b-0000-7000-8000-000000000001";
const ACTOR_ID    = "01971a2b-0000-7000-8000-000000000002";
const USER_A      = "01971a2b-0000-7000-8000-000000000003";
const TASK_ID     = "01971a2b-0000-7000-8000-000000000010";
const PROJECT_ID  = "01971a2b-0000-7000-8000-000000000020";
const STATUS_A_ID = "01971a2b-0000-7000-8000-000000000030";
const STATUS_B_ID = "01971a2b-0000-7000-8000-000000000031";

function buildPrismaMock() {
  const published = [];

  const fakeTask = {
    id: TASK_ID,
    title: "Tarea de prueba",
    taskNumber: 42,
    projectId: PROJECT_ID,
    project: { id: PROJECT_ID, name: "Proyecto X", companyId: COMPANY_ID },
    assignees: [{ userId: USER_A }],
  };

  const fakeProject = { id: PROJECT_ID, name: "Proyecto X" };

  return {
    task: {
      findFirst: async () => fakeTask,
    },
    project: {
      findFirst: async () => fakeProject,
    },
    taskStatus: {
      findFirst: async ({ where }) =>
        where.id === STATUS_A_ID
          ? { name: "Por hacer" }
          : { name: "En progreso" },
    },
    // findFirst used by notifyMemberAdded path (unused in notification-service itself);
    // findMany used by resolveRecipientUserIds inside notifSvc.publish.
    membership: {
      findFirst: async () => ({ companyId: COMPANY_ID }),
      findMany: async ({ where }) => {
        const ids = where?.userId?.in ?? [];
        return ids.map((id) => ({ userId: id }));
      },
    },
    $transaction: async (fn) =>
      fn({
        notification: {
          findFirst: async () => null,
          create: async ({ data }) => {
            published.push(data);
            return { id: "notif-1", ...data };
          },
        },
        notificationDelivery: { createMany: async () => {} },
      }),
    _published: published,
  };
}

describe("createProjectsNotificationService", () => {
  it("notifyTaskAssigned uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskAssigned({ companyId: COMPANY_ID, actorId: ACTOR_ID, taskId: TASK_ID, assignedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskUnassigned uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskUnassigned({ companyId: COMPANY_ID, actorId: ACTOR_ID, taskId: TASK_ID, removedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskComment uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskComment({ companyId: COMPANY_ID, authorId: ACTOR_ID, taskId: TASK_ID });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyTaskStatusChanged uses ?open=task:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyTaskStatusChanged({
      companyId: COMPANY_ID, actorId: ACTOR_ID,
      taskId: TASK_ID, oldStatusId: STATUS_A_ID, newStatusId: STATUS_B_ID,
    });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=task:${TASK_ID}`), `got: ${link}`);
  });

  it("notifyMemberAdded uses ?open=project:<id> link", async () => {
    const prisma = buildPrismaMock();
    const svc = createProjectsNotificationService({ prisma });
    await svc.notifyMemberAdded({ companyId: COMPANY_ID, actorId: ACTOR_ID, projectId: PROJECT_ID, addedUserId: USER_A });
    const link = prisma._published[0]?.link;
    assert.ok(link?.includes(`?open=project:${PROJECT_ID}`), `got: ${link}`);
  });
});
```

- [ ] **Step 2.2 — Run the tests to confirm they fail**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-notification-service.test.js
```

Expected: all 5 FAIL — current links are the generic `/app/m/atlas.projects`.

- [ ] **Step 2.3 — Update links in `projects-notification-service.js`**

In `apps/api/src/routes/projects/projects-notification-service.js`, make these 6 replacements:

**`notifyMemberAdded`** — change:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=project:${projectId}`,
```

**`notifyTaskAssigned`** — change:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=task:${taskId}`,
```

**`notifyTaskUnassigned`** — change:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=task:${taskId}`,
```

**`notifyTaskComment` (both publish calls inside the function, lines ~115 and ~136)** — change both:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=task:${taskId}`,
```

**`notifyTaskStatusChanged`** — change:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=task:${taskId}`,
```

Note: `processTasksDueSoon` uses `task.id` not a local variable `taskId`. For that function change:
```js
link: '/app/m/atlas.projects',
```
to:
```js
link: `/app/m/atlas.projects?open=task:${task.id}`,
```

- [ ] **Step 2.4 — Run the tests to confirm they pass**

```bash
node --test apps/api/src/routes/projects/__tests__/projects-notification-service.test.js
```

Expected: all 5 PASS.

- [ ] **Step 2.5 — Commit**

```bash
git add apps/api/src/routes/projects/projects-notification-service.js apps/api/src/routes/projects/__tests__/projects-notification-service.test.js
git commit -m "feat(notifications): use ?open=task/project:id convention in projects notifications"
```

---

## Task 3 — Deep link handler in CalendarScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx`

`CalendarScreen` already imports `useState, useEffect, useRef` and `useCalendarEvent`. It has `detailEvent` state that drives `EventDetailModal`. We add `useSearchParams` to capture the `?open=event:id` param, trigger the fetch, then set `detailEvent` once the data arrives.

- [ ] **Step 3.1 — Add `useSearchParams` import**

In `apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx`, change line 1:

```js
// OLD
import { useState, useEffect, useRef } from "react";
```

to:

```js
// NEW
import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 3.2 — Add `useCalendarEvent` import**

The hook is in `../hooks/useCalendarData`. Add it to the existing import from that file:

```js
// Find the existing import:
import { useDeleteCalendar } from "../hooks/useCalendarData";

// Change to:
import { useDeleteCalendar, useCalendarEvent } from "../hooks/useCalendarData";
```

- [ ] **Step 3.3 — Add deep link state and URL clearing inside `CalendarScreen()`**

Immediately after the `useCalendarStore()` destructure (around line 46), insert:

```js
const [searchParams, setSearchParams] = useSearchParams();

// Capture the deep-link event ID before clearing the URL param.
const [deepLinkEventId] = useState(() => {
  const open = searchParams.get("open");
  if (typeof open === "string" && open.startsWith("event:")) {
    return open.slice("event:".length) || null;
  }
  return null;
});

// Clear ?open from the URL immediately so back-navigation doesn't re-trigger the modal.
useEffect(() => {
  if (searchParams.has("open")) {
    setSearchParams({}, { replace: true });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 3.4 — Fetch the deep-link event and open the detail modal**

After the block added in Step 3.3, insert:

```js
const {
  data: deepLinkEventData,
  isError: deepLinkEventError,
} = useCalendarEvent(deepLinkEventId);

// Open EventDetailModal once the event data arrives.
useEffect(() => {
  if (!deepLinkEventId || !deepLinkEventData) return;
  const event = deepLinkEventData?.data ?? deepLinkEventData;
  if (event?.id) {
    setDetailEvent(event);
  }
}, [deepLinkEventId, deepLinkEventData]);

// Show an error if the event no longer exists.
useEffect(() => {
  if (!deepLinkEventId || !deepLinkEventError) return;
  toast.error("El evento no existe o ya fue eliminado.");
}, [deepLinkEventId, deepLinkEventError]);
```

- [ ] **Step 3.5 — Manual smoke test**

Start the dev server (`pnpm dev`) and navigate to:
```
http://localhost:5173/app/m/atlas.calendar?open=event:<a-real-event-id>
```
Verify:
1. Calendar screen loads normally.
2. `EventDetailModal` opens automatically showing the event.
3. The URL bar no longer contains `?open=event:...` after load.
4. Clicking the modal's close button works normally.

Then repeat with a non-existent ID and verify a toast error appears.

- [ ] **Step 3.6 — Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/screens/CalendarScreen.jsx
git commit -m "feat(notifications): open event detail modal from ?open=event:id URL param"
```

---

## Task 4 — Deep link handler in ProjectsScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx`

`ProjectsScreen` already has `openTask(taskId)` (`setTaskPanelId`) and `setSelectedId`. We add `useRef` + `useSearchParams` to capture the param before clearing, then open the right entity.

- [ ] **Step 4.1 — Add `useRef` and `useSearchParams` imports**

In `apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx`, change line 1:

```js
// OLD
import { useState, useMemo } from "react";
```

to:

```js
// NEW
import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
```

- [ ] **Step 4.2 — Capture the URL param before clearing**

Inside `ProjectsScreen()`, after all the existing `useState` declarations (around line 66), insert:

```js
const [searchParams, setSearchParams] = useSearchParams();

// Capture the deep-link value on first render before clearing the URL.
const initialOpenRef = useRef(searchParams.get("open") ?? null);

// Clear ?open from the URL immediately.
useEffect(() => {
  if (searchParams.has("open")) {
    setSearchParams({}, { replace: true });
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 4.3 — Process the deep link once data is ready**

Immediately after the block added in Step 4.2, insert:

```js
// Process deep link: tasks open immediately; projects wait for the project list to load.
useEffect(() => {
  const open = initialOpenRef.current;
  if (!open) return;

  if (open.startsWith("task:")) {
    const taskId = open.slice("task:".length);
    if (taskId) {
      initialOpenRef.current = null;
      openTask(taskId);
    }
    return;
  }

  if (open.startsWith("project:") && !isLoading) {
    const projectId = open.slice("project:".length);
    if (projectId) {
      initialOpenRef.current = null;
      setSelectedId(projectId);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [isLoading]);
```

Note: the `eslint-disable` suppresses the exhaustive-deps warning for `openTask` and `setSelectedId`. These functions are stable (defined with plain `function` declarations inside the component body and not re-created) so the omission is safe.

- [ ] **Step 4.4 — Manual smoke test**

Start the dev server and navigate to:
```
http://localhost:5173/app/m/atlas.projects?open=task:<a-real-task-id>
```
Verify:
1. Projects screen loads normally.
2. `TaskDetailPanel` slides open automatically showing the correct task.
3. The URL bar no longer contains `?open=task:...` after load.
4. Closing the panel works normally.

Then test with a project ID:
```
http://localhost:5173/app/m/atlas.projects?open=project:<a-real-project-id>
```
Verify the project is selected in the sidebar/list.

- [ ] **Step 4.5 — Commit**

```bash
git add apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx
git commit -m "feat(notifications): open task panel or select project from ?open=task/project:id URL param"
```

---

## Task 5 — VAPID server-config status in NotificationSettingsScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`

The screen already manages `pushSupported`, `pushPermission`, and `hasBrowserPushSubscription`. What's missing is a check for whether the server-side VAPID keys are actually configured. When they aren't, the subscribe button silently fails. We add one query to detect this and render a gray banner instead of the useless button.

- [ ] **Step 5.1 — Add the VAPID config query**

Inside `NotificationSettingsScreen()`, after the existing `upsertMutation` definition (around line 163), insert:

```js
const {
  data: vapidConfig,
  isError: vapidError,
  error: vapidErr,
  isLoading: vapidLoading,
} = useQuery({
  queryKey: ["notifications-webpush-public-key", token],
  queryFn: () => atlas.notifications.getWebPushPublicKey(token),
  enabled: Boolean(token) && canRead,
  retry: false,
  staleTime: 10 * 60 * 1000,
});

const vapidNotConfigured =
  vapidError && vapidErr?.status === 409;
const vapidConfigured = Boolean(vapidConfig?.data?.publicKey);
```

- [ ] **Step 5.2 — Render the VAPID status banner**

Find the JSX block for "Push web en este dispositivo" (`<CardContent className="space-y-3">`). It currently renders:

```jsx
{!pushSupported ? (
  <div ...>Este navegador no soporta Web Push.</div>
) : (
  <div className="space-y-2">
    {/* subscribe/unsubscribe buttons */}
  </div>
)}
```

Replace the entire conditional with:

```jsx
{vapidLoading ? (
  <Skeleton className="h-10 w-full rounded-lg" />
) : vapidNotConfigured ? (
  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
    Push no disponible en este servidor — contacta al administrador para configurar VAPID.
  </div>
) : !pushSupported ? (
  <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
    Este navegador no soporta Web Push.
  </div>
) : (
  <div className="space-y-2">
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 px-3 py-2 text-sm text-[hsl(var(--muted-foreground))]">
      Estado del permiso:{" "}
      <span className="font-medium text-[hsl(var(--foreground))]">
        {pushPermission === "granted"
          ? "Permitido"
          : pushPermission === "denied"
            ? "Bloqueado"
          : "Pendiente"}
      </span>
      <span className="mx-2">·</span>
      Suscripcion del navegador:{" "}
      <span className="font-medium text-[hsl(var(--foreground))]">
        {hasBrowserPushSubscription ? "Activa" : "No activa"}
      </span>
    </div>
    {pushPermission === "granted" && !hasBrowserPushSubscription ? (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
        Este Chrome tiene permiso, pero no una suscripcion push activa. Vuelve a suscribirte en este dispositivo.
      </div>
    ) : null}
    <div className="flex flex-wrap gap-2">
      <Button
        type="button"
        onClick={handleSubscribeCurrentDevice}
        disabled={pushBusy || pushPermission === "denied"}
      >
        {pushBusy ? "Procesando..." : "Suscribirme a push"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={handleUnsubscribeCurrentDevice}
        disabled={
          pushBusy || (!hasBrowserPushSubscription && !pushSubscriptionId)
        }
      >
        {pushBusy ? "Procesando..." : "Desuscribirme"}
      </Button>
    </div>
  </div>
)}
```

- [ ] **Step 5.3 — Manual smoke test**

Navigate to `/app/m/atlas.notifications/settings`. Verify:

- If VAPID is configured: the existing subscribe/unsubscribe UI appears (unchanged behaviour).
- If VAPID is **not** configured (server returns 409): the gray "Push no disponible..." banner appears instead of the subscribe button. The subscribe button is completely hidden — no silent failures.

To simulate a 409 temporarily, you can rename `VAPID_PUBLIC_KEY` in the `.env` and restart the API.

- [ ] **Step 5.4 — Commit**

```bash
git add apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx
git commit -m "feat(notifications): show VAPID server-config status in push settings"
```

---

## Task 6 — End-to-end verification

- [ ] **Step 6.1 — Run all notification service tests**

```bash
node --test apps/api/src/routes/calendar/__tests__/calendar-notification-service.test.js
node --test apps/api/src/routes/projects/__tests__/projects-notification-service.test.js
node --test apps/api/src/services/__tests__/notification-service.test.js
```

Expected: all PASS.

- [ ] **Step 6.2 — Full flow test via the bell**

1. Trigger a real calendar reminder by inserting a test reminder that fires within the next worker cycle (or call `processReminders` directly via a curl to the worker endpoint).
2. Wait for the in-app notification to appear in the bell dropdown.
3. Click it — confirm `CalendarScreen` opens and `EventDetailModal` appears on the correct event.
4. Trigger a `projects.task.assigned` notification (assign a task to yourself from another session, or publish via `POST /notifications/publish` with `link: "/app/m/atlas.projects?open=task:<id>"`).
5. Click the notification — confirm `TaskDetailPanel` opens.

- [ ] **Step 6.3 — Final commit if any loose ends**

```bash
git add -p
git commit -m "chore(notifications): final verification cleanup"
```
