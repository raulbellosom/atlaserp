# Google Calendar Phase 3B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar automaticamente el historial completo de eventos de cada `GoogleCalendarSource` seleccionado hacia calendarios internos Atlas, con idempotencia, soporte para recurrentes/canceladas y desacople local.

**Architecture:** La fase 3B agrega un modelo tecnico `GoogleCalendarEventLink`, un cliente de lectura de eventos Google, un servicio de persistencia idempotente y un orquestador de importacion inicial por source. `POST /calendar/google/sources` sigue guardando la seleccion y despues dispara la importacion de los sources nuevos o reactivados. `GET /calendar/google/sources` pasa a reflejar estados de importacion observables por la UI.

**Tech Stack:** Node.js ESM, Prisma, Hono, `node:test`, React, React Query, `@atlas/ui`.

---

## Scope guard for this plan

Esta Fase 3B incluye:

- `GoogleCalendarEventLink`
- importacion inicial automatica al guardar fuentes Google
- historial completo por source
- idempotencia basada en link tecnico
- soporte para recurrentes e instancias canceladas
- desacople al editar eventos importados
- estado de sync observable por source

Esta Fase 3B excluye:

- `syncToken` operativo
- job incremental recurrente
- endpoint manual `POST /calendar/google/sync`
- manejo de `410 Gone`
- resincronizacion automatica

## File map

**Backend**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260608163000_google_calendar_event_links/migration.sql`
- Create: `apps/api/src/routes/calendar/google/google-calendar-events-service.js`
- Create: `apps/api/src/routes/calendar/google/google-calendar-event-link-service.js`
- Create: `apps/api/src/routes/calendar/google/google-calendar-initial-import-service.js`
- Modify: `apps/api/src/routes/calendar/google/google-source-service.js`
- Modify: `apps/api/src/routes/calendar/calendar-event-service.js`
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`

**Backend tests**

- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-events-service.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-google-initial-import-service.test.js`
- Modify: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`
- Modify: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-event-service.test.js`

**SDK + desktop**

- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`

**Docs**

- Modify: `docs/superpowers/specs/2026-06-08-google-calendar-phase-3b-initial-import-design.md`
- Modify: `docs/integrations/google-calendar-setup.md`

## Design decisions locked for this plan

- La importacion inicial se dispara automaticamente al guardar los sources.
- La unidad de trabajo es `GoogleCalendarSource`, no el usuario completo.
- La identidad canonica es `sourceId + googleEventId`.
- Recurrentes e instancias canceladas entran desde el inicio.
- Los eventos importados quedan editables desde el inicio.
- Un evento editado localmente queda desacoplado y no se sobreescribe en reimportaciones.
- Si un source falla, pasa a `ERROR` sin tumbar a los demas.

## Task 1: Add `GoogleCalendarEventLink` model and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260608163000_google_calendar_event_links/migration.sql`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`

- [ ] **Step 1: Write the failing event-link service tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarEventLinkService } from '../google/google-calendar-event-link-service.js'

function makePrisma(overrides = {}) {
  return {
    googleCalendarEventLink: {
      findUnique: async () => null,
      create: async ({ data }) => ({ id: 'glink-1', ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
      ...(overrides.googleCalendarEventLink ?? {}),
    },
    calendarEvent: {
      create: async ({ data }) => ({ id: 'evt-1', ...data }),
      update: async ({ where, data }) => ({ id: where.id, ...data }),
      ...(overrides.calendarEvent ?? {}),
    },
    $transaction: async (callback) => callback(makePrisma(overrides)),
  }
}

describe('google-calendar-event-link-service', () => {
  it('creates a calendar event and link when the google event is first seen', async () => {
    const svc = createGoogleCalendarEventLinkService({ prisma: makePrisma() })

    const result = await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent: {
        id: 'google-evt-1',
        summary: 'Cita',
        description: 'Desc',
        status: 'confirmed',
        start: { dateTime: '2026-06-08T10:00:00.000Z' },
        end: { dateTime: '2026-06-08T11:00:00.000Z' },
        updated: '2026-06-08T09:00:00.000Z',
      },
    })

    assert.equal(result.atlasEvent.id, 'evt-1')
    assert.equal(result.link.googleEventId, 'google-evt-1')
    assert.equal(result.link.sourceId, 'gsrc-1')
  })

  it('updates the existing atlas event when the link exists and is not detached', async () => {
    let updatedPayload = null
    const svc = createGoogleCalendarEventLinkService({
      prisma: makePrisma({
        googleCalendarEventLink: {
          findUnique: async () => ({
            id: 'glink-1',
            sourceId: 'gsrc-1',
            atlasEventId: 'evt-1',
            googleEventId: 'google-evt-1',
            isDetached: false,
          }),
        },
        calendarEvent: {
          create: async () => {
            throw new Error('should not create')
          },
          update: async ({ data }) => {
            updatedPayload = data
            return { id: 'evt-1', ...data }
          },
        },
      }),
    })

    const result = await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent: {
        id: 'google-evt-1',
        summary: 'Cita actualizada',
        status: 'confirmed',
        start: { dateTime: '2026-06-08T12:00:00.000Z' },
        end: { dateTime: '2026-06-08T13:00:00.000Z' },
        updated: '2026-06-08T11:00:00.000Z',
      },
    })

    assert.equal(result.atlasEvent.id, 'evt-1')
    assert.equal(updatedPayload.title, 'Cita actualizada')
  })

  it('does not overwrite the atlas event when the link is detached', async () => {
    let updateCalls = 0
    const svc = createGoogleCalendarEventLinkService({
      prisma: makePrisma({
        googleCalendarEventLink: {
          findUnique: async () => ({
            id: 'glink-1',
            sourceId: 'gsrc-1',
            atlasEventId: 'evt-1',
            googleEventId: 'google-evt-1',
            isDetached: true,
          }),
        },
        calendarEvent: {
          update: async () => {
            updateCalls++
            return { id: 'evt-1' }
          },
        },
      }),
    })

    await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent: {
        id: 'google-evt-1',
        summary: 'No debe sobrescribir',
        status: 'confirmed',
        start: { dateTime: '2026-06-08T15:00:00.000Z' },
        end: { dateTime: '2026-06-08T16:00:00.000Z' },
        updated: '2026-06-08T14:00:00.000Z',
      },
    })

    assert.equal(updateCalls, 0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`

Expected: FAIL with module-not-found for `google-calendar-event-link-service.js`.

- [ ] **Step 3: Add the Prisma model and relations**

```prisma
model GoogleCalendarEventLink {
  id                    String    @id @default(uuid(7)) @db.Uuid
  sourceId              String    @db.Uuid @map("source_id")
  atlasEventId          String    @db.Uuid @map("atlas_event_id")
  googleEventId         String    @map("google_event_id")
  googleICalUID         String?   @map("google_ical_uid")
  googleRecurringEventId String?  @map("google_recurring_event_id")
  googleOriginalStartAt DateTime? @map("google_original_start_at")
  googleUpdatedAt       DateTime? @map("google_updated_at")
  googleStatus          String?   @map("google_status")
  isDetached            Boolean   @default(false) @map("is_detached")
  detachedAt            DateTime? @map("detached_at")
  cancelledInGoogleAt   DateTime? @map("cancelled_in_google_at")
  lastSeenAt            DateTime? @map("last_seen_at")
  rawSnapshot           Json?     @map("raw_snapshot")
  createdAt             DateTime  @default(now()) @map("created_at")
  updatedAt             DateTime  @updatedAt @map("updated_at")

  source     GoogleCalendarSource @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  atlasEvent CalendarEvent        @relation(fields: [atlasEventId], references: [id], onDelete: Cascade)

  @@unique([sourceId, googleEventId])
  @@index([sourceId])
  @@index([atlasEventId])
  @@index([sourceId, googleRecurringEventId, googleOriginalStartAt])
  @@map("google_calendar_event_link")
}
```

- [ ] **Step 4: Add the migration**

```sql
CREATE TABLE "google_calendar_event_link" (
  "id" UUID PRIMARY KEY DEFAULT uuidv7(),
  "source_id" UUID NOT NULL REFERENCES "google_calendar_source"("id") ON DELETE CASCADE,
  "atlas_event_id" UUID NOT NULL REFERENCES "calendar_event"("id") ON DELETE CASCADE,
  "google_event_id" TEXT NOT NULL,
  "google_ical_uid" TEXT NULL,
  "google_recurring_event_id" TEXT NULL,
  "google_original_start_at" TIMESTAMP(3) NULL,
  "google_updated_at" TIMESTAMP(3) NULL,
  "google_status" TEXT NULL,
  "is_detached" BOOLEAN NOT NULL DEFAULT FALSE,
  "detached_at" TIMESTAMP(3) NULL,
  "cancelled_in_google_at" TIMESTAMP(3) NULL,
  "last_seen_at" TIMESTAMP(3) NULL,
  "raw_snapshot" JSONB NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "google_calendar_event_link_source_id_google_event_id_key"
    UNIQUE ("source_id", "google_event_id")
);

CREATE INDEX "google_calendar_event_link_source_id_idx"
  ON "google_calendar_event_link" ("source_id");

CREATE INDEX "google_calendar_event_link_atlas_event_id_idx"
  ON "google_calendar_event_link" ("atlas_event_id");

CREATE INDEX "google_calendar_event_link_source_recurring_original_idx"
  ON "google_calendar_event_link" ("source_id", "google_recurring_event_id", "google_original_start_at");
```

- [ ] **Step 5: Run `prisma validate`**

Run: `cmd /c pnpm prisma validate`

Expected: `The schema at prisma/schema.prisma is valid`.

## Task 2: Add Google events reader and import persistence service

**Files:**
- Create: `apps/api/src/routes/calendar/google/google-calendar-events-service.js`
- Create: `apps/api/src/routes/calendar/google/google-calendar-event-link-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-events-service.test.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`

- [ ] **Step 1: Write the failing Google events reader tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarEventsService } from '../google/google-calendar-events-service.js'

describe('google-calendar-events-service', () => {
  it('paginates all events for the selected google calendar', async () => {
    const fetchCalls = []
    const svc = createGoogleCalendarEventsService({
      fetchImpl: async (url) => {
        fetchCalls.push(url)
        const hasPage2 = String(url).includes('pageToken=page-2')
        return {
          ok: true,
          json: async () => hasPage2
            ? { items: [{ id: 'evt-2' }] }
            : { items: [{ id: 'evt-1' }], nextPageToken: 'page-2' },
        }
      },
    })

    const items = await svc.listAllEvents({
      accessToken: 'tok',
      calendarId: 'primary',
    })

    assert.equal(items.length, 2)
    assert.equal(fetchCalls.length, 2)
  })
})
```

- [ ] **Step 2: Run the reader test to verify it fails**

Run: `cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-events-service.test.js`

Expected: FAIL with module-not-found for `google-calendar-events-service.js`.

- [ ] **Step 3: Implement the Google events reader**

```js
const GOOGLE_CALENDAR_EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars'

export function createGoogleCalendarEventsService({ fetchImpl = fetch }) {
  async function listAllEvents({ accessToken, calendarId }) {
    const items = []
    let pageToken = null

    do {
      const params = new URLSearchParams({
        singleEvents: 'true',
        showDeleted: 'true',
        maxResults: '2500',
      })
      if (pageToken) params.set('pageToken', pageToken)

      const response = await fetchImpl(
        `${GOOGLE_CALENDAR_EVENTS_URL}/${encodeURIComponent(calendarId)}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      const payload = await response.json()
      if (!response.ok) {
        const error = new Error(`Google calendar events import failed. ${payload?.error?.message ?? ''}`.trim())
        error.status = response.status
        throw error
      }

      if (Array.isArray(payload.items)) {
        items.push(...payload.items)
      }
      pageToken = payload.nextPageToken ?? null
    } while (pageToken)

    return items
  }

  return {
    listAllEvents,
  }
}
```

- [ ] **Step 4: Implement the event-link persistence service**

```js
export function createGoogleCalendarEventLinkService({ prisma }) {
  async function upsertImportedEvent({ source, googleEvent }) {
    return prisma.$transaction(async (tx) => {
      const existingLink = await tx.googleCalendarEventLink.findUnique({
        where: {
          sourceId_googleEventId: {
            sourceId: source.id,
            googleEventId: googleEvent.id,
          },
        },
      })

      if (existingLink?.isDetached) {
        const link = await tx.googleCalendarEventLink.update({
          where: { id: existingLink.id },
          data: {
            googleUpdatedAt: googleEvent.updated ? new Date(googleEvent.updated) : null,
            googleStatus: googleEvent.status ?? null,
            cancelledInGoogleAt: googleEvent.status === 'cancelled' ? new Date() : null,
            lastSeenAt: new Date(),
            rawSnapshot: googleEvent,
          },
        })
        return { atlasEvent: null, link, mode: 'detached' }
      }

      const eventPayload = {
        calendarId: source.atlasCalendarId,
        title: String(googleEvent.summary ?? 'Evento de Google').trim(),
        description: googleEvent.description ?? null,
        startAt: new Date(googleEvent.start?.dateTime ?? `${googleEvent.start?.date}T00:00:00.000Z`),
        endAt: new Date(googleEvent.end?.dateTime ?? `${googleEvent.end?.date}T00:00:00.000Z`),
        allDay: Boolean(googleEvent.start?.date && !googleEvent.start?.dateTime),
        location: googleEvent.location ?? null,
      }

      if (!existingLink) {
        const atlasEvent = await tx.calendarEvent.create({ data: eventPayload })
        const link = await tx.googleCalendarEventLink.create({
          data: {
            sourceId: source.id,
            atlasEventId: atlasEvent.id,
            googleEventId: googleEvent.id,
            googleICalUID: googleEvent.iCalUID ?? null,
            googleRecurringEventId: googleEvent.recurringEventId ?? null,
            googleOriginalStartAt: googleEvent.originalStartTime?.dateTime
              ? new Date(googleEvent.originalStartTime.dateTime)
              : null,
            googleUpdatedAt: googleEvent.updated ? new Date(googleEvent.updated) : null,
            googleStatus: googleEvent.status ?? null,
            cancelledInGoogleAt: googleEvent.status === 'cancelled' ? new Date() : null,
            lastSeenAt: new Date(),
            rawSnapshot: googleEvent,
          },
        })
        return { atlasEvent, link, mode: 'created' }
      }

      const atlasEvent = await tx.calendarEvent.update({
        where: { id: existingLink.atlasEventId },
        data: eventPayload,
      })
      const link = await tx.googleCalendarEventLink.update({
        where: { id: existingLink.id },
        data: {
          googleICalUID: googleEvent.iCalUID ?? null,
          googleRecurringEventId: googleEvent.recurringEventId ?? null,
          googleOriginalStartAt: googleEvent.originalStartTime?.dateTime
            ? new Date(googleEvent.originalStartTime.dateTime)
            : null,
          googleUpdatedAt: googleEvent.updated ? new Date(googleEvent.updated) : null,
          googleStatus: googleEvent.status ?? null,
          cancelledInGoogleAt: googleEvent.status === 'cancelled' ? new Date() : null,
          lastSeenAt: new Date(),
          rawSnapshot: googleEvent,
        },
      })
      return { atlasEvent, link, mode: 'updated' }
    })
  }

  return {
    upsertImportedEvent,
  }
}
```

- [ ] **Step 5: Run the focused tests**

Run:

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-events-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`

Expected: PASS for both suites.

## Task 3: Implement initial-import orchestration per source

**Files:**
- Create: `apps/api/src/routes/calendar/google/google-calendar-initial-import-service.js`
- Modify: `apps/api/src/routes/calendar/google/google-source-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-initial-import-service.test.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`

- [ ] **Step 1: Write the failing import orchestration tests**

```js
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarInitialImportService } from '../google/google-calendar-initial-import-service.js'

describe('google-calendar-initial-import-service', () => {
  it('marks the source as SYNCING, imports all events, and finishes as ACTIVE', async () => {
    const statusUpdates = []
    const importedIds = []
    const svc = createGoogleCalendarInitialImportService({
      prisma: {
        googleCalendarSource: {
          update: async ({ data }) => {
            statusUpdates.push(data.syncStatus)
            return { id: 'gsrc-1', ...data }
          },
        },
      },
      eventsService: {
        listAllEvents: async () => [{ id: 'evt-1' }, { id: 'evt-2' }],
      },
      linkService: {
        upsertImportedEvent: async ({ googleEvent }) => {
          importedIds.push(googleEvent.id)
          return { mode: 'created' }
        },
      },
    })

    await svc.importSource({
      source: { id: 'gsrc-1', googleCalendarId: 'primary', atlasCalendarId: 'cal-1' },
      accessToken: 'tok',
    })

    assert.deepEqual(statusUpdates, ['SYNCING', 'ACTIVE'])
    assert.deepEqual(importedIds, ['evt-1', 'evt-2'])
  })

  it('marks the source as ERROR when import fails', async () => {
    let lastUpdate = null
    const svc = createGoogleCalendarInitialImportService({
      prisma: {
        googleCalendarSource: {
          update: async ({ data }) => {
            lastUpdate = data
            return { id: 'gsrc-1', ...data }
          },
        },
      },
      eventsService: {
        listAllEvents: async () => {
          throw new Error('boom')
        },
      },
      linkService: {
        upsertImportedEvent: async () => ({ mode: 'created' }),
      },
    })

    await svc.importSource({
      source: { id: 'gsrc-1', googleCalendarId: 'primary', atlasCalendarId: 'cal-1' },
      accessToken: 'tok',
    }).catch(() => null)

    assert.equal(lastUpdate.syncStatus, 'ERROR')
    assert.equal(typeof lastUpdate.lastErrorMessage, 'string')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-initial-import-service.test.js`

Expected: FAIL with module-not-found for `google-calendar-initial-import-service.js`.

- [ ] **Step 3: Implement the initial import service**

```js
export function createGoogleCalendarInitialImportService({
  prisma,
  eventsService,
  linkService,
}) {
  async function updateSourceStatus(sourceId, data) {
    return prisma.googleCalendarSource.update({
      where: { id: sourceId },
      data,
    })
  }

  async function importSource({ source, accessToken }) {
    await updateSourceStatus(source.id, {
      syncStatus: 'SYNCING',
      lastErrorAt: null,
      lastErrorMessage: null,
    })

    try {
      const googleEvents = await eventsService.listAllEvents({
        accessToken,
        calendarId: source.googleCalendarId,
      })

      for (const googleEvent of googleEvents) {
        await linkService.upsertImportedEvent({ source, googleEvent })
      }

      await updateSourceStatus(source.id, {
        syncStatus: 'ACTIVE',
        lastFullSyncAt: new Date(),
        lastErrorAt: null,
        lastErrorMessage: null,
      })
    } catch (error) {
      await updateSourceStatus(source.id, {
        syncStatus: 'ERROR',
        lastErrorAt: new Date(),
        lastErrorMessage: error?.message ?? 'Google initial import failed.',
      })
      throw error
    }
  }

  return {
    importSource,
  }
}
```

- [ ] **Step 4: Extend source saving to return import targets**

```js
const importTargets = []

for (const calendar of uniqueCalendars) {
  const existingSource = existingByGoogleCalendarId.get(calendar.id)
  const shouldImport = !existingSource || existingSource.syncStatus !== 'ACTIVE'

  const source = await tx.googleCalendarSource.upsert({
    where: {
      connectionId_googleCalendarId: {
        connectionId,
        googleCalendarId: calendar.id,
      },
    },
    create: createPayload,
    update: updatePayload,
  })
  items.push(source)

  if (shouldImport) {
    importTargets.push(source)
  }
}

return { items, importTargets }
```

- [ ] **Step 5: Run the focused tests**

Run:

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-initial-import-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js`

Expected: PASS for both suites.

## Task 4: Wire routes to trigger import and mark local edits as detached

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`
- Modify: `apps/api/src/routes/calendar/calendar-event-service.js`
- Modify: `apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`
- Create: `apps/api/src/routes/calendar/__tests__/calendar-event-service.test.js`

- [ ] **Step 1: Write the failing route and detach tests**

```js
it('triggers initial import for newly selected sources after saving them', async () => {
  const importCalls = []
  const app = createCalendarRouter({
    prisma: {},
    requirePermission: makeRequirePermission([]),
    google: {
      resolveConfig: () => ({
        configured: true,
        missing: [],
        clientId: 'client-id',
        clientSecret: 'client-secret',
        redirectUri: 'https://atlas.example.com/app/google/calendar/callback',
        encryptionKey: Buffer.alloc(32, 7).toString('base64'),
        scopes: ['openid', 'email'],
      }),
      connectionService: {
        getConnectionByUserId: async () => ({
          id: 'gconn-1',
          status: 'ACTIVE',
          accessTokenEncrypted: 'enc-token',
          tokenExpiresAt: '2099-06-08T12:00:00.000Z',
        }),
      },
      tokenCrypto: { decrypt: () => 'tok' },
      sourceService: {
        saveSelectedSources: async () => ({
          items: [{ id: 'gsrc-1' }],
          importTargets: [{ id: 'gsrc-1', googleCalendarId: 'primary', atlasCalendarId: 'cal-1' }],
        }),
      },
      initialImportService: {
        importSource: async (input) => {
          importCalls.push(input)
        },
      },
    },
  })

  await app.request('http://localhost/calendar/google/sources', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok', 'Content-Type': 'application/json' },
    body: JSON.stringify({ calendars: [{ id: 'primary', summary: 'Principal' }] }),
  })

  await new Promise((resolve) => setTimeout(resolve, 0))

  assert.equal(importCalls.length, 1)
  assert.equal(importCalls[0].source.id, 'gsrc-1')
})
```

```js
it('marks an imported event as detached when the event is edited locally', async () => {
  let detachUpdate = null
  const svc = createCalendarEventService({
    prisma: makePrisma({
      calendarEvent: {
        findFirst: async () => ({
          id: 'evt-1',
          calendarId: 'cal-1',
          title: 'Evento importado',
          startAt: new Date('2026-06-08T10:00:00.000Z'),
          enabled: true,
          calendar: {
            id: 'cal-1',
            ownerId: 'user-1',
          },
        }),
        update: async ({ where, data }) => ({ id: where.id, ...data }),
      },
      calendarCalendar: {
        findMany: async () => [{ id: 'cal-1' }],
      },
      calendarShare: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      googleCalendarEventLink: {
        findFirst: async () => ({
          id: 'glink-1',
          atlasEventId: 'evt-1',
          isDetached: false,
        }),
        update: async ({ data }) => {
          detachUpdate = data
          return { id: 'glink-1', ...data }
        },
      },
    }),
  })

  await svc.updateEvent('user-1', 'evt-1', { title: 'Cambio local' })

  assert.equal(detachUpdate.isDetached, true)
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run:

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-event-service.test.js`

Expected: FAIL because import trigger and detach behavior do not exist yet.

- [ ] **Step 3: Add route dependency and import trigger**

```js
import { createGoogleCalendarInitialImportService } from './google/google-calendar-initial-import-service.js'
import { createGoogleCalendarEventsService } from './google/google-calendar-events-service.js'
import { createGoogleCalendarEventLinkService } from './google/google-calendar-event-link-service.js'

function getEventsService() {
  return google.eventsService ?? createGoogleCalendarEventsService()
}

function getEventLinkService() {
  return google.eventLinkService ?? createGoogleCalendarEventLinkService({ prisma })
}

function getInitialImportService() {
  return (
    google.initialImportService ??
    createGoogleCalendarInitialImportService({
      prisma,
      eventsService: getEventsService(),
      linkService: getEventLinkService(),
    })
  )
}
```

```js
const result = await googleDeps.getSourceService().saveSelectedSources({
  connectionId: connection.id,
  ownerId: userId,
  calendars: body?.calendars,
})

if (Array.isArray(result.importTargets) && result.importTargets.length > 0) {
  const accessToken = googleDeps.getTokenCrypto().decrypt(connection.accessTokenEncrypted)

  queueMicrotask(() => {
    Promise.allSettled(
      result.importTargets.map((source) =>
        googleDeps.getInitialImportService().importSource({ source, accessToken }),
      ),
    ).catch((error) => {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[atlas.calendar] google initial import dispatch failed', error)
      }
    })
  })
}

return c.json({ items: result.items }, 201)
```

- [ ] **Step 4: Mark imported events as detached on local update**

```js
const importedLink = await prisma.googleCalendarEventLink.findFirst({
  where: { atlasEventId: eventId },
})

await prisma.calendarEvent.update({ where: { id: eventId }, data: updateData })

if (importedLink && !importedLink.isDetached && Object.keys(updateData).length > 0) {
  await prisma.googleCalendarEventLink.update({
    where: { id: importedLink.id },
    data: {
      isDetached: true,
      detachedAt: new Date(),
    },
  })
}
```

- [ ] **Step 5: Run the route/event test suites**

Run:

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-event-service.test.js`

Expected: PASS with import trigger and detach coverage.

## Task 5: Surface source sync states in the desktop UI

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/hooks/useGoogleCalendarData.js`

- [ ] **Step 1: Poll source status while imports are running**

```js
export function useGoogleCalendarSources(enabled = true) {
  const queryContext = useGoogleCalendarQueryContext()
  const { token } = queryContext

  return useQuery({
    queryKey: getGoogleCalendarSourcesQueryKey(queryContext),
    queryFn: () => atlas.calendar.listGoogleSources(token),
    enabled: Boolean(token && enabled),
    staleTime: 5 * 1000,
    refetchInterval: (query) => {
      const items = query.state.data?.items ?? []
      return items.some((item) => item.syncStatus === 'SYNCING' || item.syncStatus === 'PENDING_INITIAL_SYNC')
        ? 3000
        : false
    },
  })
}
```

- [ ] **Step 2: Add compact source-status rendering**

```jsx
function SourceStatusBadge({ status }) {
  if (status === 'ACTIVE') return <Badge variant="success">Sincronizado</Badge>
  if (status === 'SYNCING') return <Badge variant="secondary">Sincronizando</Badge>
  if (status === 'PENDING_INITIAL_SYNC') return <Badge variant="outline">Pendiente</Badge>
  if (status === 'ERROR') return <Badge variant="destructive">Error</Badge>
  return <Badge variant="secondary">{status || 'Sin estado'}</Badge>
}
```

```jsx
{linked ? <SourceStatusBadge status={linked.syncStatus} /> : null}
```

- [ ] **Step 3: Show import state in the connection card**

```jsx
const syncingCount = (sourcesData?.items ?? []).filter(
  (item) => item.syncStatus === 'SYNCING' || item.syncStatus === 'PENDING_INITIAL_SYNC',
).length

const errorCount = (sourcesData?.items ?? []).filter(
  (item) => item.syncStatus === 'ERROR',
).length
```

```jsx
{syncingCount > 0 ? (
  <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
    Importando {syncingCount} calendario(s) de Google en segundo plano.
  </p>
) : null}
```

- [ ] **Step 4: Run React Doctor**

Run: `cmd /c npx -y react-doctor@latest . --verbose --diff`

Expected: sin hallazgos nuevos en los archivos modificados de `atlas.calendar`; si aparecen warnings preexistentes fuera del alcance, documentarlos y no expandir la fase.

## Task 6: Update docs and verification notes

**Files:**
- Modify: `docs/superpowers/specs/2026-06-08-google-calendar-phase-3b-initial-import-design.md`
- Modify: `docs/integrations/google-calendar-setup.md`

- [ ] **Step 1: Update the spec status**

```md
Estado: Implementacion lista para ejecucion
```

Agregar una breve nota de checklist completado cuando 3B se implemente:

```md
- importacion inicial automatica al guardar sources
- `GoogleCalendarEventLink`
- idempotencia de reimportacion
- recurrentes e instancias canceladas
- desacople al editar localmente
```

- [ ] **Step 2: Update setup/operator verification**

Agregar una seccion nueva al setup guide:

```md
## Verificacion de importacion inicial

1. Conecta Google Calendar
2. Selecciona uno o mas calendarios Google
3. Guarda la seleccion
4. Verifica que el source pase por `Pendiente` o `Sincronizando`
5. Verifica que termine en `Sincronizado`
6. Confirma que los eventos aparezcan en el calendario Atlas creado
7. Edita un evento importado y confirma que futuras reimportaciones no lo sobreescriben
```

- [ ] **Step 3: Run the final verification set**

Run:

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-events-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-event-link-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-initial-import-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-source-service.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-google-routes.test.js`

`cmd /c pnpm --filter @atlas/api exec node --test src/routes/calendar/__tests__/calendar-event-service.test.js`

`cmd /c pnpm exec node --test packages/sdk/src/__tests__/sdk-calendar.test.js`

`cmd /c pnpm prisma validate`

`cmd /c npx -y react-doctor@latest . --verbose --diff`

Expected:

- backend suites PASS
- sdk suite PASS
- prisma validate PASS
- react-doctor sin nuevos errores de `atlas.calendar`

## Self-review

- Spec coverage: cubre modelo, lector Google, persistencia idempotente, orquestacion por source, trigger de ruta, desacople local, UX de estados y verificacion final.
- Placeholder scan: no quedan `TODO`, `TBD` ni referencias incompletas.
- Type consistency: los nombres usados en todo el plan son `GoogleCalendarEventLink`, `createGoogleCalendarEventsService`, `createGoogleCalendarEventLinkService` y `createGoogleCalendarInitialImportService`.
