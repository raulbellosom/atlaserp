# SDK Migration — Calendar & Fleet Raw Fetch Calls

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every raw `apiFetch` / `fetch` call in `atlas.calendar` and `atlas.fleet` with Atlas SDK methods so the offline transport intercept works for these modules.

**Architecture:** Add `calendar` and `fleet` namespaces to `packages/sdk/src/index.js` following the existing `toQueryString` + `withAuthHeaders` pattern, then do a mechanical find-and-replace in the three frontend files that bypass the SDK today. No logic changes — pure plumbing.

**Tech Stack:** JavaScript, `packages/sdk` (plain fetch wrapper), React + TanStack Query (frontend hooks), `node --test` for SDK tests.

---

## File Map

| File | Action | Why |
|---|---|---|
| `packages/sdk/src/index.js` | Modify — add `calendar` + `fleet` namespaces | SDK is the single fetch layer |
| `packages/sdk/src/__tests__/sdk-calendar.test.js` | Create | Tests for new calendar SDK methods |
| `packages/sdk/src/__tests__/sdk-fleet.test.js` | Create | Tests for new fleet SDK methods |
| `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` | Modify — remove `apiFetch`, replace 18 call sites | Offline transport only intercepts SDK requests |
| `apps/desktop/src/modules/atlas.fleet/components/VehicleImageCell.jsx` | Modify — remove raw `fetch`, use `atlas.files.getSignedUrl` + `atlas.fleet.getVehicleDocuments` | Same reason |
| `apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx` | Modify — remove raw `fetch`, use `atlas.fleet.getReport` | Same reason |

---

## Task 1: Add `calendar` namespace to SDK

**Files:**
- Modify: `packages/sdk/src/index.js`
- Create: `packages/sdk/src/__tests__/sdk-calendar.test.js`

### Background

`packages/sdk/src/index.js` exports `createAtlasClient({ baseUrl })`. Every namespace follows this pattern:

```js
calendar: {
  listCalendars: (token) =>
    request('/calendar/calendars', { headers: withAuthHeaders(token) }),
  createCalendar: (data, token) =>
    request('/calendar/calendars', { method: 'POST', headers: withAuthHeaders(token), body: JSON.stringify(data) }),
  // ...
}
```

The `request(path, options)` function is already defined in the closure. `withAuthHeaders(token)` adds `Authorization: Bearer <token>`. `toQueryString(obj)` converts a plain object to `?key=val&...`.

### Steps

- [ ] **Step 1: Write the failing SDK calendar tests**

Create `packages/sdk/src/__tests__/sdk-calendar.test.js`:

```js
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

// Minimal fetch mock — returns the path so tests can assert which URL was called
function makeFetch(status = 200) {
  return mock.fn(async (url) => ({
    ok: status < 400,
    status,
    json: async () => ({ url }),
    text: async () => String(status),
  }))
}

describe('atlas SDK — calendar namespace', () => {
  it('listCalendars GETs /calendar/calendars', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.listCalendars('tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/calendars')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

  it('createCalendar POSTs /calendar/calendars with body', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.createCalendar({ name: 'Mi agenda' }, 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/calendars')
    assert.equal(opts.method, 'POST')
    assert.equal(JSON.parse(opts.body).name, 'Mi agenda')
    fetchMock.mock.restore()
  })

  it('updateCalendar PATCHes /calendar/calendars/:id', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.updateCalendar('cal-1', { name: 'Nueva' }, 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.ok(url.includes('/calendar/calendars/cal-1'))
    assert.equal(opts.method, 'PATCH')
    fetchMock.mock.restore()
  })

  it('listEvents GETs /calendar/events with query string', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.listEvents('tok', { start: '2026-01-01', end: '2026-01-31' })
    const [url] = fetchMock.mock.calls[0].arguments
    assert.ok(url.includes('/calendar/events'))
    assert.ok(url.includes('start='))
    fetchMock.mock.restore()
  })

  it('listEvents with calendar_ids array appends multiple params', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.listEvents('tok', { start: '2026-01-01', end: '2026-01-31', calendar_ids: ['c1', 'c2'] })
    const [url] = fetchMock.mock.calls[0].arguments
    assert.ok(url.includes('calendar_ids=c1'), `url should include calendar_ids=c1, got: ${url}`)
    assert.ok(url.includes('calendar_ids=c2'), `url should include calendar_ids=c2, got: ${url}`)
    fetchMock.mock.restore()
  })

  it('markNotificationRead PATCHes /calendar/notifications/:id/read', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.markNotificationRead('notif-1', 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.ok(url.includes('/calendar/notifications/notif-1/read'))
    assert.equal(opts.method, 'PATCH')
    fetchMock.mock.restore()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
node --test packages/sdk/src/__tests__/sdk-calendar.test.js
```

Expected: 6 FAIL — `client.calendar is undefined`

- [ ] **Step 3: Add `calendar` namespace to SDK**

In `packages/sdk/src/index.js`, after the closing `}` of the `website` namespace (before `setOfflineTransport`) add:

```js
    calendar: {
      listCalendars: (token) =>
        request('/calendar/calendars', { headers: withAuthHeaders(token) }),
      createCalendar: (data, token) =>
        request('/calendar/calendars', {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateCalendar: (id, data, token) =>
        request(`/calendar/calendars/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      deleteCalendar: (id, token) =>
        request(`/calendar/calendars/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: withAuthHeaders(token),
        }),
      shareCalendar: (calendarId, data, token) =>
        request(`/calendar/calendars/${encodeURIComponent(calendarId)}/share`, {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateShare: (calendarId, shareId, data, token) =>
        request(`/calendar/calendars/${encodeURIComponent(calendarId)}/share/${encodeURIComponent(shareId)}`, {
          method: 'PATCH',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      deleteShare: (calendarId, shareId, token) =>
        request(`/calendar/calendars/${encodeURIComponent(calendarId)}/share/${encodeURIComponent(shareId)}`, {
          method: 'DELETE',
          headers: withAuthHeaders(token),
        }),
      listEvents: (token, query = {}) => {
        // calendar_ids is an array — URLSearchParams.append is needed for multi-value
        const params = new URLSearchParams()
        if (query.start) params.set('start', query.start)
        if (query.end) params.set('end', query.end)
        if (Array.isArray(query.calendar_ids)) {
          query.calendar_ids.forEach((id) => params.append('calendar_ids', id))
        }
        const qs = params.toString()
        return request(qs ? `/calendar/events?${qs}` : '/calendar/events', {
          headers: withAuthHeaders(token),
        })
      },
      getEvent: (id, token) =>
        request(`/calendar/events/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
      createEvent: (data, token) =>
        request('/calendar/events', {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateEvent: (id, data, token) =>
        request(`/calendar/events/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      deleteEvent: (id, token) =>
        request(`/calendar/events/${encodeURIComponent(id)}`, {
          method: 'DELETE',
          headers: withAuthHeaders(token),
        }),
      createReminder: (eventId, data, token) =>
        request(`/calendar/events/${encodeURIComponent(eventId)}/reminders`, {
          method: 'POST',
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      deleteReminder: (eventId, reminderId, token) =>
        request(`/calendar/events/${encodeURIComponent(eventId)}/reminders/${encodeURIComponent(reminderId)}`, {
          method: 'DELETE',
          headers: withAuthHeaders(token),
        }),
      listNotifications: (token, query = {}) =>
        request(`/calendar/notifications${toQueryString(query)}`, {
          headers: withAuthHeaders(token),
        }),
      markNotificationRead: (id, token) =>
        request(`/calendar/notifications/${encodeURIComponent(id)}/read`, {
          method: 'PATCH',
          headers: withAuthHeaders(token),
        }),
      markAllNotificationsRead: (token) =>
        request('/calendar/notifications/read-all', {
          method: 'PATCH',
          headers: withAuthHeaders(token),
        }),
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test packages/sdk/src/__tests__/sdk-calendar.test.js
```

Expected: 6 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/index.js packages/sdk/src/__tests__/sdk-calendar.test.js
git commit -m "feat(sdk): add calendar namespace with 17 methods"
```

---

## Task 2: Add `fleet` namespace to SDK

**Files:**
- Modify: `packages/sdk/src/index.js`
- Create: `packages/sdk/src/__tests__/sdk-fleet.test.js`

The fleet module has two raw `fetch` sites that need SDK coverage:
- `GET /fleet/vehicles/:id/documents` — used in `VehicleImageCell.jsx`
- `GET /fleet/reports/:id` — used in `ReportDetailScreen.jsx`

### Steps

- [ ] **Step 1: Write the failing SDK fleet tests**

Create `packages/sdk/src/__tests__/sdk-fleet.test.js`:

```js
import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'

function makeFetch(status = 200) {
  return mock.fn(async (url) => ({
    ok: status < 400,
    status,
    json: async () => ({ url }),
    text: async () => String(status),
  }))
}

describe('atlas SDK — fleet namespace', () => {
  it('getVehicleDocuments GETs /fleet/vehicles/:id/documents', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.fleet.getVehicleDocuments('v-1', 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/fleet/vehicles/v-1/documents')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

  it('getReport GETs /fleet/reports/:id', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.fleet.getReport('r-1', 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/fleet/reports/r-1')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })
})
```

- [ ] **Step 2: Run to verify tests fail**

```bash
node --test packages/sdk/src/__tests__/sdk-fleet.test.js
```

Expected: 2 FAIL — `client.fleet is undefined`

- [ ] **Step 3: Add `fleet` namespace to SDK**

In `packages/sdk/src/index.js`, after the `calendar` namespace (before `setOfflineTransport`) add:

```js
    fleet: {
      getVehicleDocuments: (vehicleId, token) =>
        request(`/fleet/vehicles/${encodeURIComponent(vehicleId)}/documents`, {
          headers: withAuthHeaders(token),
        }),
      getReport: (id, token) =>
        request(`/fleet/reports/${encodeURIComponent(id)}`, {
          headers: withAuthHeaders(token),
        }),
    },
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
node --test packages/sdk/src/__tests__/sdk-fleet.test.js
```

Expected: 2 PASS

- [ ] **Step 5: Commit**

```bash
git add packages/sdk/src/index.js packages/sdk/src/__tests__/sdk-fleet.test.js
git commit -m "feat(sdk): add fleet namespace with getVehicleDocuments and getReport"
```

---

## Task 3: Migrate `useCalendarData.js` to SDK

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js`

### Background

The file currently has a local `apiFetch(path, token, options)` helper (lines 11–25) and 18 call sites. The `atlas` SDK singleton is at `apps/desktop/src/lib/atlas.js`:

```js
import { createAtlasClient } from '@atlas/sdk'
import { getApiUrl } from './runtimeConfig.js'
export const atlas = createAtlasClient({ baseUrl: getApiUrl() })
```

The migration is mechanical: remove `apiFetch`, import `atlas`, and replace each call site with the matching `atlas.calendar.*` method.

**Important:** The offline fallback paths (`if (!isOnline)`) are unchanged — they read from IndexedDB and do not touch the fetch layer at all. Only the `else`-path (online) calls are being migrated.

The `useUserSearch` hook calls `/identity/users` — use `atlas.identity.listUsers(token, { search, pageSize: 10, enabled: true })` which already exists in the SDK.

### Steps

- [ ] **Step 1: Replace the import block and remove `apiFetch`**

Replace the top of the file (lines 1–25):

```js
// BEFORE:
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig'
import { useOfflineContext, useOfflineStore } from '@atlas/offline'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

async function apiFetch(path, token, options = {}) {
  const res = await fetch(`${getApiUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || `HTTP ${res.status}`)
  }
  return res.json()
}
```

With:

```js
// AFTER:
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { useOfflineContext, useOfflineStore } from '@atlas/offline'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}
```

- [ ] **Step 2: Migrate calendar CRUD call sites**

Replace each `apiFetch` call in the calendar section with its SDK equivalent:

```js
// useCalendars — online path:
return apiFetch('/calendar/calendars', token)
// becomes:
return atlas.calendar.listCalendars(token)

// useCreateCalendar:
mutationFn: (data) => apiFetch('/calendar/calendars', token, { method: 'POST', body: JSON.stringify(data) })
// becomes:
mutationFn: (data) => atlas.calendar.createCalendar(data, token)

// useUpdateCalendar:
mutationFn: ({ id, ...data }) => apiFetch(`/calendar/calendars/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
// becomes:
mutationFn: ({ id, ...data }) => atlas.calendar.updateCalendar(id, data, token)

// useDeleteCalendar:
mutationFn: (id) => apiFetch(`/calendar/calendars/${id}`, token, { method: 'DELETE' })
// becomes:
mutationFn: (id) => atlas.calendar.deleteCalendar(id, token)

// useShareCalendar:
mutationFn: ({ calendarId, ...data }) =>
  apiFetch(`/calendar/calendars/${calendarId}/share`, token, { method: 'POST', body: JSON.stringify(data) })
// becomes:
mutationFn: ({ calendarId, ...data }) => atlas.calendar.shareCalendar(calendarId, data, token)

// useUpdateShare:
mutationFn: ({ calendarId, shareId, ...data }) =>
  apiFetch(`/calendar/calendars/${calendarId}/share/${shareId}`, token, { method: 'PATCH', body: JSON.stringify(data) })
// becomes:
mutationFn: ({ calendarId, shareId, ...data }) => atlas.calendar.updateShare(calendarId, shareId, data, token)

// useDeleteShare:
mutationFn: ({ calendarId, shareId }) =>
  apiFetch(`/calendar/calendars/${calendarId}/share/${shareId}`, token, { method: 'DELETE' })
// becomes:
mutationFn: ({ calendarId, shareId }) => atlas.calendar.deleteShare(calendarId, shareId, token)
```

- [ ] **Step 3: Migrate event call sites**

The two event list queries (`useCalendarEvents` and `useYearEvents`) currently build a `URLSearchParams` object and embed it in the URL string. The SDK's `listEvents` accepts `{ start, end, calendar_ids }`. Replace only the online paths:

```js
// useCalendarEvents — online path:
// OLD (params is a URLSearchParams built at function scope):
return apiFetch(`/calendar/events?${params}`, token)
// NEW:
return atlas.calendar.listEvents(token, { start, end, calendar_ids: calendarIds })

// useYearEvents — online path:
// OLD:
return apiFetch(`/calendar/events?${params}`, token)
// NEW:
return atlas.calendar.listEvents(token, {
  start: yearStart.toISOString(),
  end: yearEnd.toISOString(),
  calendar_ids: calendarIds,
})
```

Remove the `URLSearchParams` construction lines (`const params = new URLSearchParams()` through `calendarIds.forEach(...)` and the `params.set(...)` lines) from both hooks after replacing the call site — the SDK now handles them internally.

For `useYearEvents`, the `yearStart` and `yearEnd` Date objects are still needed for the offline filter logic — keep them.

```js
// useCreateEvent:
mutationFn: (data) => apiFetch('/calendar/events', token, { method: 'POST', body: JSON.stringify(data) })
// becomes:
mutationFn: (data) => atlas.calendar.createEvent(data, token)

// useCalendarEvent (single event fetch):
queryFn: () => apiFetch(`/calendar/events/${eventId}`, token)
// becomes:
queryFn: () => atlas.calendar.getEvent(eventId, token)

// useUpdateEvent:
mutationFn: ({ id, ...data }) => apiFetch(`/calendar/events/${id}`, token, { method: 'PATCH', body: JSON.stringify(data) })
// becomes:
mutationFn: ({ id, ...data }) => atlas.calendar.updateEvent(id, data, token)

// useDeleteEvent:
mutationFn: (id) => apiFetch(`/calendar/events/${id}`, token, { method: 'DELETE' })
// becomes:
mutationFn: (id) => atlas.calendar.deleteEvent(id, token)

// useAddEventReminder:
mutationFn: ({ eventId, minutesBefore }) =>
  apiFetch(`/calendar/events/${eventId}/reminders`, token, {
    method: 'POST',
    body: JSON.stringify({ minutes_before: minutesBefore }),
  })
// becomes:
mutationFn: ({ eventId, minutesBefore }) =>
  atlas.calendar.createReminder(eventId, { minutes_before: minutesBefore }, token)

// useDeleteEventReminder:
mutationFn: ({ eventId, reminderId }) =>
  apiFetch(`/calendar/events/${eventId}/reminders/${reminderId}`, token, { method: 'DELETE' })
// becomes:
mutationFn: ({ eventId, reminderId }) => atlas.calendar.deleteReminder(eventId, reminderId, token)
```

- [ ] **Step 4: Migrate notification and user search call sites**

```js
// useCalendarNotifications:
queryFn: () => apiFetch('/calendar/notifications?unread_only=true', token)
// becomes:
queryFn: () => atlas.calendar.listNotifications(token, { unread_only: true })

// useMarkNotificationRead:
mutationFn: (id) => apiFetch(`/calendar/notifications/${id}/read`, token, { method: 'PATCH' })
// becomes:
mutationFn: (id) => atlas.calendar.markNotificationRead(id, token)

// useMarkAllNotificationsRead:
mutationFn: () => apiFetch('/calendar/notifications/read-all', token, { method: 'PATCH' })
// becomes:
mutationFn: () => atlas.calendar.markAllNotificationsRead(token)

// useUserSearch:
queryFn: () => apiFetch(`/identity/users?search=${encodeURIComponent(q)}&pageSize=10&enabled=true`, token)
// becomes:
queryFn: () => atlas.identity.listUsers(token, { search: q, pageSize: 10, enabled: true })
```

- [ ] **Step 5: Verify no `apiFetch` references remain**

```bash
grep -n "apiFetch" apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js
git commit -m "feat(calendar): migrate useCalendarData.js from apiFetch to atlas SDK"
```

---

## Task 4: Migrate `VehicleImageCell.jsx` to SDK

**Files:**
- Modify: `apps/desktop/src/modules/atlas.fleet/components/VehicleImageCell.jsx`

### Background

`VehicleImageCell` receives `{ token, apiBaseUrl }` as props and makes two raw fetch calls:

1. `resolveSignedUrl` (line 10): `GET /files/:fileAssetId/signed-url` — this is already covered by `atlas.files.getSignedUrl(id, token)`
2. `openVehicleViewer` (line 91): `GET /fleet/vehicles/:vehicleId/documents` — now covered by `atlas.fleet.getVehicleDocuments(vehicleId, token)`

The `atlas` singleton uses `getApiUrl()` internally, so `apiBaseUrl` prop is no longer needed for these two calls. However, `apiBaseUrl` may still be passed from the parent — keep accepting it as a prop but stop using it in fetch calls.

### Steps

- [ ] **Step 1: Add the SDK import**

At the top of `VehicleImageCell.jsx`, after the existing imports, add:

```js
import { atlas } from '../../../lib/atlas'
```

- [ ] **Step 2: Replace `resolveSignedUrl` helper**

Remove the entire `resolveSignedUrl` function (lines 8–17):

```js
// REMOVE THIS:
async function resolveSignedUrl({ apiBaseUrl, token, fileAssetId }) {
  if (!fileAssetId) return null;
  const response = await fetch(`${getBaseUrl(apiBaseUrl)}/files/${encodeURIComponent(fileAssetId)}/signed-url`, {
    method: "GET",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) return null;
  const payload = await response.json();
  return payload?.data?.signedUrl ?? payload?.data?.url ?? null;
}
```

Also remove the `getBaseUrl` helper (lines 4–6) — it is only used by `resolveSignedUrl`.

Update the `getSignedUrl` callback to call the SDK directly:

```js
// BEFORE:
const getSignedUrl = useCallback(
  async (fileAssetId) => {
    if (!fileAssetId) return null;
    if (signedUrlCache[fileAssetId]) return signedUrlCache[fileAssetId];
    const url = await resolveSignedUrl({ apiBaseUrl, token, fileAssetId });
    if (!url) return null;
    setSignedUrlCache((prev) => ({ ...prev, [fileAssetId]: url }));
    return url;
  },
  [apiBaseUrl, signedUrlCache, token],
);

// AFTER:
const getSignedUrl = useCallback(
  async (fileAssetId) => {
    if (!fileAssetId) return null;
    if (signedUrlCache[fileAssetId]) return signedUrlCache[fileAssetId];
    const payload = await atlas.files.getSignedUrl(fileAssetId, token).catch(() => null);
    const url = payload?.data?.signedUrl ?? payload?.data?.url ?? null;
    if (!url) return null;
    setSignedUrlCache((prev) => ({ ...prev, [fileAssetId]: url }));
    return url;
  },
  [signedUrlCache, token],
);
```

Note: `apiBaseUrl` removed from the dependency array since it's no longer used here.

- [ ] **Step 3: Replace the vehicle documents fetch in `openVehicleViewer`**

```js
// BEFORE (lines 91–97):
const response = await fetch(`${getBaseUrl(apiBaseUrl)}/fleet/vehicles/${encodeURIComponent(vehicleId)}/documents`, {
  method: "GET",
  headers: token ? { Authorization: `Bearer ${token}` } : {},
});
if (!response.ok) return;
const payload = await response.json();
const rows = Array.isArray(payload?.data) ? payload.data : [];

// AFTER:
const payload = await atlas.fleet.getVehicleDocuments(vehicleId, token).catch(() => null);
if (!payload) return;
const rows = Array.isArray(payload?.data) ? payload.data : [];
```

Also update the `useCallback` dependency array for `openVehicleViewer` — remove `apiBaseUrl`:

```js
// BEFORE:
}, [apiBaseUrl, coverImageAssetId, hasAnyImage, token, vehicleId]);

// AFTER:
}, [coverImageAssetId, hasAnyImage, token, vehicleId]);
```

Also update the thumbnail `useEffect` dependency array — remove `apiBaseUrl`:

```js
// BEFORE:
}, [apiBaseUrl, coverImageAssetId, getSignedUrl]);

// AFTER:
}, [coverImageAssetId, getSignedUrl]);
```

- [ ] **Step 4: Remove unused `getBaseUrl` import guard and verify**

```bash
grep -n "getBaseUrl\|apiFetch\|apiBaseUrl.*fetch" apps/desktop/src/modules/atlas.fleet/components/VehicleImageCell.jsx
```

Expected: no output. (`apiBaseUrl` still exists as a prop and in the early return guard `if (!coverImageAssetId || !apiBaseUrl)` — that guard can stay or be simplified, but don't break it.)

Actually check: `apiBaseUrl` is used in two guards:
- `if (!coverImageAssetId || !apiBaseUrl)` in the thumbnail useEffect
- `if (!vehicleId || !apiBaseUrl || !hasAnyImage)` in `openVehicleViewer`

These guards prevent running when the parent hasn't passed `apiBaseUrl`. Since the SDK no longer uses `apiBaseUrl`, these guards are now overly defensive but safe to leave as-is — they protect against the caller not passing the prop. Leave them.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/components/VehicleImageCell.jsx
git commit -m "feat(fleet): migrate VehicleImageCell raw fetch to atlas SDK"
```

---

## Task 5: Migrate `ReportDetailScreen.jsx` to SDK

**Files:**
- Modify: `apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx`

### Background

`ReportDetailScreen` has one raw `fetch` call on line 153: `GET /fleet/reports/:id`. It uses `API_BASE = import.meta.env.VITE_ATLAS_API_URL` as the base URL. After migrating, `API_BASE` is still needed because `AtlasCrudView` receives it as `apiBaseUrl` prop.

### Steps

- [ ] **Step 1: Add the SDK import**

After the existing imports, add:

```js
import { atlas } from '../../../lib/atlas'
```

- [ ] **Step 2: Replace the raw fetch in the `useQuery` call**

```js
// BEFORE:
const { data: reportData } = useQuery({
  queryKey: ['fleet-report-type', recordId, token],
  queryFn: async () => {
    const res = await fetch(`${API_BASE}/fleet/reports/${recordId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  },
  enabled: Boolean(recordId && token),
})

// AFTER:
const { data: reportData } = useQuery({
  queryKey: ['fleet-report-type', recordId, token],
  queryFn: () => atlas.fleet.getReport(recordId, token).catch(() => null),
  enabled: Boolean(recordId && token),
})
```

- [ ] **Step 3: Verify no raw fetch remains in this file**

```bash
grep -n "fetch(" apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.fleet/screens/ReportDetailScreen.jsx
git commit -m "feat(fleet): migrate ReportDetailScreen raw fetch to atlas SDK"
```

---

## Self-Review

### Spec coverage

The offline spec (section 12, Phase 2) says:
- ✅ Migrate `useCalendarData.js` from raw fetch to SDK — Task 3
- ✅ Migrate `VehicleImageCell.jsx` from raw fetch to SDK — Task 4
- The spec mentions "raw fetch calls" in Calendar and Fleet. `ReportDetailScreen.jsx` is in Fleet — covered by Task 5 (bonus, same principle)

### Placeholder scan

None found. Every step contains actual code.

### Type consistency

- `atlas.calendar.listEvents(token, { start, end, calendar_ids })` — defined in Task 1, used in Task 3 ✅
- `atlas.files.getSignedUrl(fileAssetId, token)` — pre-existing SDK method, used in Task 4 ✅
- `atlas.fleet.getVehicleDocuments(vehicleId, token)` — defined in Task 2, used in Task 4 ✅
- `atlas.fleet.getReport(id, token)` — defined in Task 2, used in Task 5 ✅
