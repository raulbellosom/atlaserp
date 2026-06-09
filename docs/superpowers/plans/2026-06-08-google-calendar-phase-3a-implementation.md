# Google Calendar Phase 3A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist selected Google calendars as `GoogleCalendarSource` records and create one internal Atlas calendar per selected Google calendar, without importing events yet.

**Architecture:** Extend the current Google Calendar integration with a new persistence layer for selected sources, then expose source selection/list/disconnect endpoints through the existing calendar router. The desktop UI stops being discovery-only and becomes a real selection flow that saves sources and refreshes the calendar sidebar, while leaving event import and sync tokens for Phase 3B.

**Tech Stack:** Node.js ESM, Prisma, Hono, `node:test`, React, React Query, `@atlas/ui`.

---

## Scope guard for this plan

This Phase 3A plan intentionally includes:

- `GoogleCalendarSource` persistence
- one Atlas `CalendarCalendar` per selected Google calendar
- source selection/list/disconnect endpoints
- desktop picker UI that saves selected calendars

This plan intentionally excludes:

- event import
- `GoogleCalendarEventLink`
- incremental sync jobs
- detached event behavior
- `syncToken` consumption beyond schema/storage

Those belong to Phase 3B and Phase 4.

## File map

**Backend**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260608120000_google_calendar_sources/migration.sql`
- Create: `apps/api/src/routes/calendar/google/google-source-service.js`
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`

**Backend tests**

- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`
- Modify: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`

**SDK + desktop**

- Modify: `packages/sdk/src/index.js`
- Modify: `packages/sdk/src/__tests__/sdk-calendar.test.js`
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`

**Docs**

- Modify: `docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md`
- Modify: `docs/integrations/google-calendar-setup.md`

## Design decisions locked for this plan

- Source identity is unique by `connectionId + googleCalendarId`.
- Selecting a Google calendar is idempotent: re-selecting updates metadata and returns the same source + Atlas calendar.
- Atlas calendar naming for imported sources uses the Google summary as-is on first creation.
- `GoogleCalendarSource.syncStatus` starts as `PENDING_INITIAL_SYNC`.
- Disconnecting Google revokes the connection and disables all sources for that connection, but does not delete the created Atlas calendars.
- The picker persists only the calendars currently selected in the submission payload:
  - new selections create or reactivate sources
  - omitted existing sources are marked `disabled`

## Task 1: Add the `GoogleCalendarSource` data model

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260608120000_google_calendar_sources/migration.sql`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`

- [ ] **Step 1: Write the failing source service tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarSourceService } from '../google/google-source-service.js'

function makePrisma(overrides = {}) {
  return {
    googleCalendarSource: {
      findMany: async () => [],
      findFirst: async () => null,
      upsert: async ({ create, update }) => ({ id: 'gsrc-1', ...create, ...update }),
      updateMany: async () => ({ count: 0 }),
      ...(overrides.googleCalendarSource ?? {}),
    },
    calendarCalendar: {
      create: async ({ data }) => ({ id: 'cal-1', ...data }),
      ...(overrides.calendarCalendar ?? {}),
    },
    $transaction: async (actions) => {
      if (typeof actions === 'function') return actions(makePrisma(overrides))
      return Promise.all(actions)
    },
  }
}

describe('google-source-service', () => {
  it('creates one atlas calendar and source per selected google calendar', async () => {
    const svc = createGoogleCalendarSourceService({ prisma: makePrisma() })

    const result = await svc.saveSelectedSources({
      connectionId: 'gconn-1',
      ownerId: 'user-1',
      calendars: [
        {
          id: 'primary',
          summary: 'Principal',
          timeZone: 'America/Mexico_City',
          backgroundColor: '#1a73e8',
        },
      ],
    })

    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].googleCalendarId, 'primary')
    assert.equal(result.items[0].atlasCalendarId, 'cal-1')
    assert.equal(result.items[0].syncStatus, 'PENDING_INITIAL_SYNC')
  })

  it('disables sources omitted from the latest selection payload', async () => {
    let disabledWhere = null
    const prisma = makePrisma({
      googleCalendarSource: {
        findMany: async () => [
          { id: 'gsrc-1', googleCalendarId: 'primary', enabled: true },
          { id: 'gsrc-2', googleCalendarId: 'team', enabled: true },
        ],
        updateMany: async ({ where }) => {
          disabledWhere = where
          return { count: 1 }
        },
      },
    })
    const svc = createGoogleCalendarSourceService({ prisma })

    await svc.saveSelectedSources({
      connectionId: 'gconn-1',
      ownerId: 'user-1',
      calendars: [{ id: 'primary', summary: 'Principal' }],
    })

    assert.deepEqual(disabledWhere.googleCalendarId.in, ['team'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js`

Expected: FAIL with module-not-found for `google-source-service.js`.

- [ ] **Step 3: Add the Prisma model and relation**

```prisma
enum GoogleCalendarSourceStatus {
  PENDING_INITIAL_SYNC
  ACTIVE
  DISABLED
  ERROR
  NEEDS_RESYNC
}

model GoogleCalendarSource {
  id                    String                     @id @default(uuid(7)) @db.Uuid
  connectionId          String                     @db.Uuid @map("connection_id")
  googleCalendarId      String                     @map("google_calendar_id")
  googleCalendarName    String                     @map("google_calendar_name")
  googleCalendarTimeZone String?                   @map("google_calendar_time_zone")
  atlasCalendarId       String                     @db.Uuid @map("atlas_calendar_id")
  syncToken             String?                    @map("sync_token")
  syncStatus            GoogleCalendarSourceStatus @default(PENDING_INITIAL_SYNC) @map("sync_status")
  lastFullSyncAt        DateTime?                  @map("last_full_sync_at")
  lastIncrementalSyncAt DateTime?                  @map("last_incremental_sync_at")
  lastErrorAt           DateTime?                  @map("last_error_at")
  lastErrorMessage      String?                    @map("last_error_message")
  enabled               Boolean                    @default(true)
  createdAt             DateTime                   @default(now()) @map("created_at")
  updatedAt             DateTime                   @updatedAt @map("updated_at")

  connection    GoogleCalendarConnection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  atlasCalendar CalendarCalendar         @relation(fields: [atlasCalendarId], references: [id], onDelete: Restrict)

  @@unique([connectionId, googleCalendarId])
  @@index([connectionId, enabled])
  @@map("google_calendar_source")
}
```

- [ ] **Step 4: Add the migration**

```sql
CREATE TYPE "GoogleCalendarSourceStatus" AS ENUM (
  'PENDING_INITIAL_SYNC',
  'ACTIVE',
  'DISABLED',
  'ERROR',
  'NEEDS_RESYNC'
);

CREATE TABLE "google_calendar_source" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "connection_id" UUID NOT NULL REFERENCES "google_calendar_connection"("id") ON DELETE CASCADE,
  "google_calendar_id" TEXT NOT NULL,
  "google_calendar_name" TEXT NOT NULL,
  "google_calendar_time_zone" TEXT NULL,
  "atlas_calendar_id" UUID NOT NULL REFERENCES "calendar_calendar"("id") ON DELETE RESTRICT,
  "sync_token" TEXT NULL,
  "sync_status" "GoogleCalendarSourceStatus" NOT NULL DEFAULT 'PENDING_INITIAL_SYNC',
  "last_full_sync_at" TIMESTAMPTZ NULL,
  "last_incremental_sync_at" TIMESTAMPTZ NULL,
  "last_error_at" TIMESTAMPTZ NULL,
  "last_error_message" TEXT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "google_calendar_source_connection_id_google_calendar_id_key"
    UNIQUE ("connection_id", "google_calendar_id")
);

CREATE INDEX "google_calendar_source_connection_id_enabled_idx"
  ON "google_calendar_source" ("connection_id", "enabled");
```

- [ ] **Step 5: Run `prisma validate`**

Run: `pnpm prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

## Task 2: Implement the source selection service

**Files:**
- Create: `apps/api/src/routes/calendar/google/google-source-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`

- [ ] **Step 1: Implement `saveSelectedSources`, `listSourcesForUser`, and `disableSourcesForConnection`**

```js
import { CalendarServiceError } from '../calendar-service.js'

export function createGoogleCalendarSourceService({ prisma }) {
  async function listSourcesForConnection(connectionId) {
    return prisma.googleCalendarSource.findMany({
      where: { connectionId, enabled: true },
      orderBy: [{ createdAt: 'asc' }],
    })
  }

  async function saveSelectedSources({ connectionId, ownerId, calendars }) {
    if (!Array.isArray(calendars) || calendars.length === 0) {
      throw new CalendarServiceError('Debes seleccionar al menos un calendario de Google.', 400)
    }

    return prisma.$transaction(async (tx) => {
      const existing = await tx.googleCalendarSource.findMany({
        where: { connectionId },
      })
      const selectedIds = calendars.map((item) => item.id)
      const items = []

      for (const item of calendars) {
        const current = existing.find((source) => source.googleCalendarId === item.id)
        let atlasCalendarId = current?.atlasCalendarId ?? null

        if (!atlasCalendarId) {
          const atlasCalendar = await tx.calendarCalendar.create({
            data: {
              ownerId,
              name: String(item.summary ?? 'Google Calendar').trim(),
              color: item.backgroundColor ?? '#1a73e8',
              icon: 'calendar',
            },
          })
          atlasCalendarId = atlasCalendar.id
        }

        const source = await tx.googleCalendarSource.upsert({
          where: {
            connectionId_googleCalendarId: {
              connectionId,
              googleCalendarId: item.id,
            },
          },
          create: {
            connectionId,
            googleCalendarId: item.id,
            googleCalendarName: String(item.summary ?? 'Google Calendar').trim(),
            googleCalendarTimeZone: item.timeZone ?? null,
            atlasCalendarId,
            syncStatus: 'PENDING_INITIAL_SYNC',
            enabled: true,
          },
          update: {
            googleCalendarName: String(item.summary ?? 'Google Calendar').trim(),
            googleCalendarTimeZone: item.timeZone ?? null,
            syncStatus: current?.syncStatus === 'ACTIVE' ? 'ACTIVE' : 'PENDING_INITIAL_SYNC',
            enabled: true,
            lastErrorAt: null,
            lastErrorMessage: null,
          },
        })

        items.push(source)
      }

      const omittedIds = existing
        .filter((source) => source.enabled && !selectedIds.includes(source.googleCalendarId))
        .map((source) => source.googleCalendarId)

      if (omittedIds.length > 0) {
        await tx.googleCalendarSource.updateMany({
          where: { connectionId, googleCalendarId: { in: omittedIds } },
          data: { enabled: false, syncStatus: 'DISABLED' },
        })
      }

      return { items }
    })
  }

  async function disableSourcesForConnection(connectionId) {
    return prisma.googleCalendarSource.updateMany({
      where: { connectionId, enabled: true },
      data: { enabled: false, syncStatus: 'DISABLED' },
    })
  }

  return {
    listSourcesForConnection,
    saveSelectedSources,
    disableSourcesForConnection,
  }
}
```

- [ ] **Step 2: Run the targeted test**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js`

Expected: PASS with `2 tests`.

## Task 3: Expose source selection/list/disconnect endpoints

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`
- Modify: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`

- [ ] **Step 1: Extend router dependencies with the source service**

```js
import { createGoogleCalendarSourceService } from './google/google-source-service.js'
```

```js
function getSourceService() {
  return (
    google.sourceService ??
    createGoogleCalendarSourceService({ prisma })
  )
}
```

- [ ] **Step 2: Add `GET /calendar/google/sources`**

```js
app.get('/calendar/google/sources', requirePermission('calendar.calendars.read'), async (c) => {
  try {
    googleDeps.requireConfig()
    const userId = getUserId(c)
    const connection = await googleDeps.getConnectionService().getConnectionByUserId(userId)

    if (!connection || connection.status !== 'ACTIVE') {
      throw new CalendarServiceError('No hay una cuenta Google conectada.', 409)
    }

    const items = await googleDeps.getSourceService().listSourcesForConnection(connection.id)
    return c.json({ items })
  } catch (err) {
    return handleError(c, err, 'No se pudieron obtener los calendarios vinculados.')
  }
})
```

- [ ] **Step 3: Add `POST /calendar/google/sources`**

```js
app.post('/calendar/google/sources', requirePermission('calendar.calendars.create'), async (c) => {
  try {
    googleDeps.requireConfig()
    const userId = getUserId(c)
    const connection = await googleDeps.getConnectionService().getConnectionByUserId(userId)

    if (!connection || connection.status !== 'ACTIVE') {
      throw new CalendarServiceError('No hay una cuenta Google conectada.', 409)
    }

    const body = await c.req.json()
    const calendars = Array.isArray(body?.calendars) ? body.calendars : []
    const result = await googleDeps.getSourceService().saveSelectedSources({
      connectionId: connection.id,
      ownerId: userId,
      calendars,
    })

    return c.json(result, 201)
  } catch (err) {
    return handleError(c, err, 'No se pudieron guardar los calendarios de Google.')
  }
})
```

- [ ] **Step 4: Add `POST /calendar/google/disconnect`**

```js
app.post('/calendar/google/disconnect', requirePermission('calendar.calendars.read'), async (c) => {
  try {
    googleDeps.requireConfig()
    const userId = getUserId(c)
    const connection = await googleDeps.getConnectionService().getConnectionByUserId(userId)

    if (!connection) {
      return c.json({ ok: true })
    }

    await googleDeps.getSourceService().disableSourcesForConnection(connection.id)
    await googleDeps.getConnectionService().disconnect(userId)

    return c.json({ ok: true })
  } catch (err) {
    return handleError(c, err, 'No se pudo desconectar Google Calendar.')
  }
})
```

- [ ] **Step 5: Expand route tests for the new endpoints**

Add cases for:

- listing zero sources for an active connection
- saving selected source payload and asserting `201`
- disconnecting and asserting source disable + connection revoke happen in order

- [ ] **Step 6: Run the route test suite**

Run: `pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js`

Expected: PASS with the new `/sources` and `/disconnect` coverage.

## Task 4: Extend the SDK and React Query hooks

**Files:**
- Modify: `packages/sdk/src/index.js`
- Modify: `packages/sdk/src/__tests__/sdk-calendar.test.js`
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`

- [ ] **Step 1: Add SDK methods**

```js
listGoogleSources: (token) =>
  request('/calendar/google/sources', {
    headers: withAuthHeaders(token),
  }),
saveGoogleSources: (data, token) =>
  request('/calendar/google/sources', {
    method: 'POST',
    headers: withAuthHeaders(token),
    body: JSON.stringify(data),
  }),
disconnectGoogleCalendar: (token) =>
  request('/calendar/google/disconnect', {
    method: 'POST',
    headers: withAuthHeaders(token),
  }),
```

- [ ] **Step 2: Add SDK tests**

Add assertions for:

- `listGoogleSources` → `GET /calendar/google/sources`
- `saveGoogleSources` → `POST /calendar/google/sources`
- `disconnectGoogleCalendar` → `POST /calendar/google/disconnect`

- [ ] **Step 3: Extend the React Query hooks**

```js
function getGoogleCalendarSourcesQueryKey(queryContext) {
  return [...getGoogleCalendarBaseQueryKey(queryContext), 'sources']
}

export function useGoogleCalendarSources(enabled = true) {
  const queryContext = useGoogleCalendarQueryContext()
  const { token } = queryContext

  return useQuery({
    queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
    queryFn: () => atlas.calendar.listGoogleSources(token),
    enabled: Boolean(token && enabled),
    staleTime: 30 * 1000,
  })
}

export function useSaveGoogleCalendarSources() {
  const queryContext = useGoogleCalendarQueryContext()
  const { token } = queryContext
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (payload) => atlas.calendar.saveGoogleSources(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGoogleCalendarStatusQueryKey(queryContext) })
      queryClient.invalidateQueries({ queryKey: getGoogleCalendarCalendarsQueryKey(queryContext) })
      queryClient.invalidateQueries({ queryKey: getGoogleCalendarSourcesQueryKey(queryContext) })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}

export function useDisconnectGoogleCalendar() {
  const queryContext = useGoogleCalendarQueryContext()
  const { token } = queryContext
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => atlas.calendar.disconnectGoogleCalendar(token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: getGoogleCalendarStatusQueryKey(queryContext) })
      queryClient.invalidateQueries({ queryKey: getGoogleCalendarSourcesQueryKey(queryContext) })
      queryClient.invalidateQueries({ queryKey: ['calendar'] })
    },
  })
}
```

- [ ] **Step 4: Run SDK tests**

Run: `pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js`

Expected: PASS with the new Google source assertions.

## Task 5: Turn the picker into a real source selection flow

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`

- [ ] **Step 1: Load both discovered calendars and saved sources**

The dialog should read:

- discovered calendars from `useGoogleCalendarList(open)`
- saved sources from `useGoogleCalendarSources(open)`

Preselect any discovered calendar whose `id` exists in the saved source list.

- [ ] **Step 2: Add multi-select state and save action**

Implement local selection with `Set` semantics:

```jsx
const [selectedIds, setSelectedIds] = useState([])
```

On open:

- seed `selectedIds` from saved sources

On row click:

- toggle membership

On save:

- send `saveGoogleSources({ calendars: selectedItems })`
- close dialog on success
- show `toast.success('Calendarios de Google vinculados.')`

- [ ] **Step 3: Add a disconnect action to the connection card**

When connected:

- keep `Elegir calendarios`
- add secondary action `Desconectar Google`
- call `useDisconnectGoogleCalendar`
- on success, close picker if open and refresh status/sidebar

- [ ] **Step 4: Keep the UI honest about current scope**

Add a compact note inside the dialog:

- calendars are linked now
- event import starts in Phase 3B

Example:

`Atlas ya puede crear los calendarios internos. La importacion de eventos llegara en la siguiente fase.`

- [ ] **Step 5: Run React Doctor**

Run: `npx -y react-doctor@latest . --verbose --diff`

Expected: no new correctness/performance issues introduced by the picker flow.

## Task 6: Update docs and verification notes

**Files:**
- Modify: `docs/superpowers/specs/2026-06-07-google-calendar-sync-design.md`
- Modify: `docs/integrations/google-calendar-setup.md`

- [ ] **Step 1: Update the spec status for Phase 3A completion**

Clarify that after selection:

- a source record is created per selected Google calendar
- an Atlas calendar is created immediately
- event import is still pending Phase 3B

- [ ] **Step 2: Update the setup guide with the new operator-visible behavior**

Add a verification section:

1. connect Google
2. open `Elegir calendarios`
3. select one or more Google calendars
4. confirm they appear as internal Atlas calendars
5. confirm no events import yet

- [ ] **Step 3: Run final verification for this phase**

Run:

```bash
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js
pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js
pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js
pnpm prisma validate
npx -y react-doctor@latest . --verbose --diff
git diff --check
```

Expected:

- all tests PASS
- Prisma validates
- no whitespace errors in diff
- React Doctor shows no new blocking issues

## Self-review notes

- Spec coverage:
  - selected Google calendars persisted: Task 1, Task 2, Task 3
  - one Atlas calendar per selected Google calendar: Task 2
  - UI selection flow: Task 5
  - disconnect semantics: Task 3, Task 4, Task 5
- Intentional deferrals:
  - initial event import
  - event links
  - `syncToken` use
  - background sync
- Scope check:
  - This plan stays inside one shippable slice and can be verified without touching event sync logic.
