# Offline Phase 4C — atlas.calendar Tier 2 Read Cache

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `atlas.calendar` as a Tier 2 offline read cache — the sync pull endpoint returns calendars and events for the authenticated user, the frontend periodically syncs them into Dexie, and the three read hooks (`useCalendars`, `useCalendarEvents`, `useYearEvents`) return Dexie data when offline.

**Architecture:** Calendar entities are user-scoped (not company-scoped): `CalendarCalendar` filters by `ownerId = userId` and `CalendarEvent` filters by `calendarId IN (owned calendar IDs)`. The backend `resolveCompanyContext` is extended to also return `userId`, which is then forwarded to all pull handlers (existing handlers simply ignore it). The frontend hooks gain a short-circuit: when `!navigator.onLine`, they skip `apiFetch` and query `offline_records` directly from Dexie. No write (push) support for calendar in this phase — read cache only.

**Tech Stack:** Node.js, Hono, Prisma 7, `node --test`, React, TanStack Query v5, Dexie.js (IndexedDB via `@atlas/offline`)

---

## File Map

| File | Change |
|---|---|
| `apps/api/src/services/sync-service.js` | Add `userId` to `resolveCompanyContext` return; forward to handlers; add `atlas.calendar` registry entry |
| `apps/api/src/services/__tests__/sync-service.test.js` | Add `calendarCalendar` + `calendarEvent` to `makePrisma`; add 4 new tests for calendar pull |
| `packages/offline/src/offline-provider.jsx` | Add `'atlas.calendar'` to `OFFLINE_MODULES` array (line 12) |
| `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js` | Add offline fallback in `useCalendars`, `useCalendarEvents`, `useYearEvents` |

---

### Task 1: Backend — calendar handlers in sync-service

`CalendarCalendar` uses `ownerId` (not `companyId`) and `CalendarEvent` uses `calendarId IN (owned IDs)`. Because `makeHandler` filters by `companyId`, calendar needs custom inline handlers. We also need `userId` from `resolveCompanyContext` so handlers can scope by user.

**Files:**
- Modify: `apps/api/src/services/sync-service.js`
- Modify: `apps/api/src/services/__tests__/sync-service.test.js`

- [ ] **Step 1: Write 4 failing tests**

Add this `describe` block at the end of `apps/api/src/services/__tests__/sync-service.test.js`, inside the outer `describe('sync-service', ...)`:

```js
describe('atlas.calendar module', () => {
  it('returns calendar records scoped by userId (not companyId)', async () => {
    const cal = { id: 'cal1', ownerId: USER_ID, name: 'Mi agenda', color: '#6B46C1', isDefault: true, enabled: true, createdAt: past, updatedAt: now }
    const svc = createSyncService({
      prisma: makePrisma({
        calendarCalendar: { findMany: async () => [cal] },
        calendarEvent: { findMany: async () => [] },
      }),
    })
    const result = await svc.pull({ authUserId: 'auth-u1', modules: ['atlas.calendar'], cursor: null })
    const calRec = result.records.find((r) => r.entityType === 'calendar')
    assert.ok(calRec, 'calendar record must be present')
    assert.equal(calRec.id, 'cal1')
    assert.equal(calRec.moduleKey, 'atlas.calendar')
    assert.equal(calRec.deleted, false)
  })

  it('calendar handler uses ownerId = userId (not companyId)', async () => {
    let capturedWhere = null
    const svc = createSyncService({
      prisma: makePrisma({
        calendarCalendar: {
          findMany: async ({ where }) => { capturedWhere = where; return [] },
        },
        calendarEvent: { findMany: async () => [] },
      }),
    })
    await svc.pull({ authUserId: 'auth-u1', modules: ['atlas.calendar'], cursor: null })
    assert.equal(capturedWhere?.ownerId, USER_ID)
    assert.equal(capturedWhere?.enabled, true)
    assert.equal(capturedWhere?.companyId, undefined, 'calendar must NOT filter by companyId')
  })

  it('event handler fetches events for owned calendar IDs', async () => {
    const cal = { id: 'cal1', ownerId: USER_ID, name: 'Mi agenda', color: '#6B46C1', isDefault: true, enabled: true, createdAt: past, updatedAt: now }
    const event = { id: 'ev1', calendarId: 'cal1', title: 'Reunión', startAt: now, endAt: null, allDay: false, enabled: true, createdAt: past, updatedAt: now }
    let capturedEventWhere = null
    const svc = createSyncService({
      prisma: makePrisma({
        calendarCalendar: {
          findMany: async ({ select }) => select ? [{ id: 'cal1' }] : [cal],
        },
        calendarEvent: {
          findMany: async ({ where }) => { capturedEventWhere = where; return [event] },
        },
      }),
    })
    const result = await svc.pull({ authUserId: 'auth-u1', modules: ['atlas.calendar'], cursor: null })
    const evRec = result.records.find((r) => r.entityType === 'event')
    assert.ok(evRec, 'event record must be present')
    assert.equal(evRec.id, 'ev1')
    assert.deepEqual(capturedEventWhere?.calendarId, { in: ['cal1'] })
  })

  it('event handler returns empty when user owns no calendars', async () => {
    let eventFetchCalled = false
    const svc = createSyncService({
      prisma: makePrisma({
        calendarCalendar: { findMany: async () => [] },
        calendarEvent: { findMany: async () => { eventFetchCalled = true; return [] } },
      }),
    })
    const result = await svc.pull({ authUserId: 'auth-u1', modules: ['atlas.calendar'], cursor: null })
    assert.equal(result.records.filter((r) => r.entityType === 'event').length, 0)
    assert.equal(eventFetchCalled, false, 'event query must be skipped when no owned calendars')
  })
})
```

- [ ] **Step 2: Add `calendarCalendar` and `calendarEvent` to `makePrisma`**

In `apps/api/src/services/__tests__/sync-service.test.js`, find the `makePrisma` helper (around line 10) and add two new model mocks after `syncCursor`:

```js
calendarCalendar: {
  findMany: async () => [],
  ...(overrides.calendarCalendar ?? {}),
},
calendarEvent: {
  findMany: async () => [],
  ...(overrides.calendarEvent ?? {}),
},
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js 2>&1 | tail -20
```

Expected: 4 new calendar tests fail; all pre-existing tests still pass.

- [ ] **Step 4: Implement the changes in sync-service.js**

Replace the entire `apps/api/src/services/sync-service.js` with:

```js
export class SyncServiceError extends Error {
  constructor(message, status = 500, code = 'sync_error') {
    super(message)
    this.name = 'SyncServiceError'
    this.status = status
    this.code = code
  }
}

const RECORDS_LIMIT = 500

function makeHandler(entityType, prismaKey) {
  return {
    entityType,
    async fetch({ prisma, companyId, cursor, limit }) {
      const where = { companyId }
      if (cursor) where.updatedAt = { gt: new Date(cursor) }
      return prisma[prismaKey].findMany({
        where,
        take: limit,
        orderBy: { updatedAt: 'asc' },
      })
    },
    toRecord(row) {
      return {
        id: row.id,
        data: row,
        version: row.updatedAt.toISOString(),
        deleted: false,
      }
    },
  }
}

const SYNC_MODULE_REGISTRY = {
  'atlas.contacts': {
    handlers: [makeHandler('contact', 'contact')],
  },
  'atlas.hr': {
    handlers: [
      makeHandler('employee', 'hrEmployee'),
      makeHandler('department', 'hrDepartment'),
      makeHandler('job_title', 'hrJobTitle'),
    ],
  },
  'custom.fleet': {
    handlers: [
      makeHandler('vehicle', 'fleetVehicle'),
      makeHandler('driver', 'fleetDriver'),
    ],
  },
  'atlas.calendar': {
    handlers: [
      {
        entityType: 'calendar',
        async fetch({ prisma, userId, cursor, limit }) {
          const where = { ownerId: userId, enabled: true }
          if (cursor) where.updatedAt = { gt: new Date(cursor) }
          return prisma.calendarCalendar.findMany({
            where,
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        },
        toRecord(row) {
          return { id: row.id, data: row, version: row.updatedAt.toISOString(), deleted: false }
        },
      },
      {
        entityType: 'event',
        async fetch({ prisma, userId, cursor, limit }) {
          const owned = await prisma.calendarCalendar.findMany({
            where: { ownerId: userId, enabled: true },
            select: { id: true },
          })
          const calendarIds = owned.map((c) => c.id)
          if (!calendarIds.length) return []
          const where = { calendarId: { in: calendarIds }, enabled: true }
          if (cursor) where.updatedAt = { gt: new Date(cursor) }
          return prisma.calendarEvent.findMany({
            where,
            take: limit,
            orderBy: { updatedAt: 'asc' },
          })
        },
        toRecord(row) {
          return { id: row.id, data: row, version: row.updatedAt.toISOString(), deleted: false }
        },
      },
    ],
  },
}

export function createSyncService({ prisma }) {
  async function resolveCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    })
    if (!profile) {
      throw new SyncServiceError('Perfil de usuario no encontrado.', 404, 'profile_not_found')
    }
    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: 'desc' },
      select: { companyId: true },
    })
    if (!membership?.companyId) {
      throw new SyncServiceError('No tienes una empresa activa.', 403, 'no_active_company')
    }
    return { companyId: membership.companyId, userId: profile.id }
  }

  async function pull({ authUserId, modules, cursor }) {
    if (!modules || modules.length === 0) {
      return { records: [], nextCursor: cursor ?? null, hasMore: false }
    }

    const { companyId, userId } = await resolveCompanyContext(authUserId)
    const records = []
    let hasMore = false

    for (const moduleKey of modules) {
      const mod = SYNC_MODULE_REGISTRY[moduleKey]
      if (!mod) continue
      for (const handler of mod.handlers) {
        const rows = await handler.fetch({ prisma, companyId, userId, cursor, limit: RECORDS_LIMIT + 1 })
        if (rows.length > RECORDS_LIMIT) {
          hasMore = true
          rows.splice(RECORDS_LIMIT)
        }
        for (const row of rows) {
          records.push({ moduleKey, entityType: handler.entityType, ...handler.toRecord(row) })
        }
      }
    }

    const nextCursor =
      records.length > 0
        ? records.reduce((max, r) => (r.version > max ? r.version : max), records[0].version)
        : cursor ?? null

    return { records, nextCursor, hasMore }
  }

  async function getStatus({ authUserId }) {
    const { companyId } = await resolveCompanyContext(authUserId)
    const cursors = await prisma.syncCursor.findMany({
      where: { companyId },
      orderBy: [{ moduleKey: 'asc' }, { entityType: 'asc' }],
    })
    return cursors.map((c) => ({
      moduleKey: c.moduleKey,
      entityType: c.entityType,
      cursor: c.cursor.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    }))
  }

  return { pull, getStatus }
}
```

- [ ] **Step 5: Run all sync-service tests**

```bash
node --test apps/api/src/services/__tests__/sync-service.test.js 2>&1 | tail -20
```

Expected: All tests pass, including the 4 new calendar tests.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/sync-service.js apps/api/src/services/__tests__/sync-service.test.js
git commit -m "feat(offline): add atlas.calendar pull handlers to sync service (user-scoped)"
```

---

### Task 2: Frontend — OFFLINE_MODULES + offline fallback in read hooks

Three read hooks need to return Dexie data when offline. The `useOfflineContext()` hook (exported from `@atlas/offline`) exposes `{ dbRef, engineRef }` — `dbRef.current` is the live Dexie instance. The hooks check `navigator.onLine` at query time; if offline, they read `offline_records` filtered by `moduleKey = 'atlas.calendar'` and `entityType`.

**Files:**
- Modify: `packages/offline/src/offline-provider.jsx` (line 12 — one word change)
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js`

- [ ] **Step 1: Add `atlas.calendar` to `OFFLINE_MODULES`**

In `packages/offline/src/offline-provider.jsx`, find line 12:

```js
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet']
```

Change it to:

```js
const OFFLINE_MODULES = ['atlas.contacts', 'atlas.hr', 'custom.fleet', 'atlas.calendar']
```

- [ ] **Step 2: Update `useCalendars` with offline fallback**

In `apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js`, find the import block at the top (lines 1-3):

```js
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig'
```

Replace with:

```js
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { getApiUrl } from '../../../lib/runtimeConfig'
import { useOfflineContext } from '@atlas/offline'
```

Then find `useCalendars` (lines 28-36):

```js
export function useCalendars() {
  const token = useToken()
  return useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: () => apiFetch('/calendar/calendars', token),
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}
```

Replace with:

```js
export function useCalendars() {
  const token = useToken()
  const ctx = useOfflineContext()
  return useQuery({
    queryKey: ['calendar', 'calendars'],
    queryFn: async () => {
      if (!navigator.onLine) {
        const db = ctx?.dbRef?.current
        if (!db) return { owned: [], shared: [] }
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'calendar')
          .toArray()
        return { owned: records.map((r) => r.data), shared: [] }
      }
      return apiFetch('/calendar/calendars', token)
    },
    enabled: Boolean(token),
    staleTime: 2 * 60 * 1000,
  })
}
```

- [ ] **Step 3: Update `useCalendarEvents` with offline fallback**

Find `useCalendarEvents` (lines 97-109):

```js
export function useCalendarEvents({ start, end, calendarIds = [] }) {
  const token = useToken()
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', start, end, calendarIds.join(',')],
    queryFn: () => apiFetch(`/calendar/events?${params}`, token),
    enabled: Boolean(token && start && end),
    staleTime: 60 * 1000,
  })
}
```

Replace with:

```js
export function useCalendarEvents({ start, end, calendarIds = [] }) {
  const token = useToken()
  const ctx = useOfflineContext()
  const params = new URLSearchParams()
  if (start) params.set('start', start)
  if (end) params.set('end', end)
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', start, end, calendarIds.join(',')],
    queryFn: async () => {
      if (!navigator.onLine) {
        const db = ctx?.dbRef?.current
        if (!db) return []
        const startMs = start ? new Date(start).getTime() : null
        const endMs = end ? new Date(end).getTime() : null
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'event')
          .toArray()
        return records
          .map((r) => r.data)
          .filter((ev) => {
            if (calendarIds.length && !calendarIds.includes(ev.calendarId)) return false
            const evMs = new Date(ev.startAt).getTime()
            if (startMs !== null && evMs < startMs) return false
            if (endMs !== null && evMs > endMs) return false
            return true
          })
      }
      return apiFetch(`/calendar/events?${params}`, token)
    },
    enabled: Boolean(token && start && end),
    staleTime: 60 * 1000,
  })
}
```

- [ ] **Step 4: Update `useYearEvents` with offline fallback**

Find `useYearEvents` (lines 112-125):

```js
export function useYearEvents(year, calendarIds = [], enabled = true) {
  const token = useToken()
  const params = new URLSearchParams()
  params.set('start', new Date(year, 0, 1).toISOString())
  params.set('end', new Date(year, 11, 31, 23, 59, 59).toISOString())
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', 'year', year, calendarIds.join(',')],
    queryFn: () => apiFetch(`/calendar/events?${params}`, token),
    enabled: Boolean(token && enabled),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
```

Replace with:

```js
export function useYearEvents(year, calendarIds = [], enabled = true) {
  const token = useToken()
  const ctx = useOfflineContext()
  const params = new URLSearchParams()
  const yearStart = new Date(year, 0, 1)
  const yearEnd = new Date(year, 11, 31, 23, 59, 59)
  params.set('start', yearStart.toISOString())
  params.set('end', yearEnd.toISOString())
  calendarIds.forEach((id) => params.append('calendar_ids', id))
  return useQuery({
    queryKey: ['calendar', 'events', 'year', year, calendarIds.join(',')],
    queryFn: async () => {
      if (!navigator.onLine) {
        const db = ctx?.dbRef?.current
        if (!db) return []
        const startMs = yearStart.getTime()
        const endMs = yearEnd.getTime()
        const records = await db.offline_records
          .where('moduleKey').equals('atlas.calendar')
          .filter((r) => r.entityType === 'event')
          .toArray()
        return records
          .map((r) => r.data)
          .filter((ev) => {
            if (calendarIds.length && !calendarIds.includes(ev.calendarId)) return false
            const evMs = new Date(ev.startAt).getTime()
            return evMs >= startMs && evMs <= endMs
          })
      }
      return apiFetch(`/calendar/events?${params}`, token)
    },
    enabled: Boolean(token && enabled),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
  })
}
```

- [ ] **Step 5: Verify the build compiles**

```bash
cd apps/desktop && npx vite build --mode development 2>&1 | tail -20
```

Expected: No errors. Warnings about bundle size are acceptable.

- [ ] **Step 6: Commit**

```bash
git add packages/offline/src/offline-provider.jsx apps/desktop/src/modules/atlas.calendar/hooks/useCalendarData.js
git commit -m "feat(offline): add atlas.calendar Tier 2 read cache — OFFLINE_MODULES + offline fallback hooks"
```

---

## Self-Review

**Spec coverage:**
- `atlas.calendar` added to Tier 2 offline read cache: Task 1 (backend pull) + Task 2 (frontend sync + hooks) — covered.
- `calendar` entity type (owned calendars, user-scoped by `ownerId`): Task 1 handler — covered.
- `event` entity type (events on owned calendars, user-scoped): Task 1 handler — covered.
- Frontend: `OFFLINE_MODULES` updated: Task 2 Step 1 — covered.
- Frontend: hooks fall back to Dexie when offline: Task 2 Steps 2-4 — covered.
- Shared calendars: intentionally out of scope (requires share-based cursor logic; deferred).

**Placeholder scan:** None. All steps contain complete code.

**Type consistency:**
- `resolveCompanyContext` returns `{ companyId, userId }` in Task 1 Step 4; both destructured in `pull()` and `getStatus()` (only `companyId` used in `getStatus` — correct).
- `handler.fetch({ prisma, companyId, userId, cursor, limit })` — calendar handlers destructure `userId`; existing `makeHandler` handlers destructure `companyId` and ignore `userId` (no breaking change).
- `offline_records.where('moduleKey').equals('atlas.calendar').filter(r => r.entityType === 'calendar')` — consistent across all three hook fallbacks.
- `ctx?.dbRef?.current` — consistent with `use-conflicts.js` and `use-pending-mutations.js` patterns.
