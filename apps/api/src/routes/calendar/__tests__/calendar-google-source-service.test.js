import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarSourceService } from '../google/google-source-service.js'
import { CalendarServiceError } from '../calendar-service.js'

function makePrisma(overrides = {}) {
  const existingSources = [...(overrides.existingSources ?? [])]
  let nextSourceId = existingSources.length + 1

  return {
    googleCalendarSource: {
      findMany: async () => [],
      findFirst: async () => null,
      upsert: async ({ where, create, update }) => {
        const key = where?.connectionId_googleCalendarId
        const existing = existingSources.find((item) =>
          item.connectionId === key?.connectionId &&
          item.googleCalendarId === key?.googleCalendarId
        )

        if (existing) {
          const updated = { ...existing, ...update }
          const index = existingSources.indexOf(existing)
          existingSources[index] = updated
          return updated
        }

        const created = { id: `gsrc-${nextSourceId++}`, ...create }
        existingSources.push(created)
        return created
      },
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
    let createPayload = null
    const svc = createGoogleCalendarSourceService({
      prisma: makePrisma({
        calendarCalendar: {
          create: async ({ data }) => {
            createPayload = data
            return { id: 'cal-1', ...data }
          },
        },
      }),
    })

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
    assert.equal(result.importTargets.length, 1)
    assert.equal(result.importTargets[0].googleCalendarId, 'primary')
    assert.equal(createPayload.icon, 'Google')
  })

  it('disables sources omitted from the latest selection payload', async () => {
    let disabledArgs = null
    const prisma = makePrisma({
      googleCalendarSource: {
        findMany: async () => [
          { id: 'gsrc-1', googleCalendarId: 'primary', enabled: true },
          { id: 'gsrc-2', googleCalendarId: 'team', enabled: true },
        ],
        updateMany: async (args) => {
          disabledArgs = args
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

    assert.deepEqual(disabledArgs.where.googleCalendarId.in, ['team'])
    assert.equal(disabledArgs.data.enabled, false)
    assert.equal(disabledArgs.data.syncStatus, 'DISABLED')
  })

  it('reselecting an existing google calendar preserves its atlasCalendarId', async () => {
    let createCalls = 0
    const prisma = makePrisma({
      existingSources: [
        {
          id: 'gsrc-9',
          connectionId: 'gconn-1',
          googleCalendarId: 'primary',
          googleCalendarName: 'Principal anterior',
          googleCalendarTimeZone: 'America/Mexico_City',
          atlasCalendarId: 'cal-existing',
          syncStatus: 'ACTIVE',
          enabled: true,
        },
      ],
      googleCalendarSource: {
        findMany: async () => [
          {
            id: 'gsrc-9',
            connectionId: 'gconn-1',
            googleCalendarId: 'primary',
            googleCalendarName: 'Principal anterior',
            googleCalendarTimeZone: 'America/Mexico_City',
            atlasCalendarId: 'cal-existing',
            syncStatus: 'ACTIVE',
            enabled: true,
          },
        ],
      },
      calendarCalendar: {
        create: async ({ data }) => {
          createCalls += 1
          return { id: 'cal-new', ...data }
        },
      },
    })
    const svc = createGoogleCalendarSourceService({ prisma })

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

    assert.equal(createCalls, 0)
    assert.equal(result.items[0].atlasCalendarId, 'cal-existing')
    assert.equal(result.items[0].syncStatus, 'ACTIVE')
    assert.deepEqual(result.importTargets, [])
  })

  it('throws CalendarServiceError 400 when calendars is empty', async () => {
    const svc = createGoogleCalendarSourceService({ prisma: makePrisma() })

    await assert.rejects(
      () => svc.saveSelectedSources({
        connectionId: 'gconn-1',
        ownerId: 'user-1',
        calendars: [],
      }),
      (error) => {
        assert.equal(error instanceof CalendarServiceError, true)
        assert.equal(error.status, 400)
        return true
      }
    )
  })

  it('lists enabled sources for a connection ordered by createdAt', async () => {
    let findManyArgs = null
    const expected = [{ id: 'gsrc-1', googleCalendarId: 'primary', enabled: true }]
    const prisma = makePrisma({
      googleCalendarSource: {
        findMany: async (args) => {
          findManyArgs = args
          return expected
        },
      },
    })
    const svc = createGoogleCalendarSourceService({ prisma })

    const result = await svc.listSourcesForConnection('gconn-1')

    assert.deepEqual(result, expected)
    assert.deepEqual(findManyArgs, {
      where: { connectionId: 'gconn-1', enabled: true },
      orderBy: [{ createdAt: 'asc' }],
    })
  })

  it('disables all enabled sources for a connection', async () => {
    let updateManyArgs = null
    const prisma = makePrisma({
      googleCalendarSource: {
        updateMany: async (args) => {
          updateManyArgs = args
          return { count: 2 }
        },
      },
    })
    const svc = createGoogleCalendarSourceService({ prisma })

    const result = await svc.disableSourcesForConnection('gconn-1')

    assert.deepEqual(result, { count: 2 })
    assert.deepEqual(updateManyArgs, {
      where: { connectionId: 'gconn-1', enabled: true },
      data: { enabled: false, syncStatus: 'DISABLED' },
    })
  })

  it('reactivating a non-active source resets sync status and clears last error fields', async () => {
    let upsertArgs = null
    const prisma = makePrisma({
      existingSources: [
        {
          id: 'gsrc-4',
          connectionId: 'gconn-1',
          googleCalendarId: 'team',
          googleCalendarName: 'Equipo',
          googleCalendarTimeZone: 'America/Mexico_City',
          atlasCalendarId: 'cal-team',
          syncStatus: 'DISABLED',
          enabled: false,
          lastErrorAt: new Date('2026-06-08T10:00:00.000Z'),
          lastErrorMessage: 'falló sync',
        },
      ],
      googleCalendarSource: {
        findMany: async () => [
          {
            id: 'gsrc-4',
            connectionId: 'gconn-1',
            googleCalendarId: 'team',
            googleCalendarName: 'Equipo',
            googleCalendarTimeZone: 'America/Mexico_City',
            atlasCalendarId: 'cal-team',
            syncStatus: 'DISABLED',
            enabled: false,
            lastErrorAt: new Date('2026-06-08T10:00:00.000Z'),
            lastErrorMessage: 'falló sync',
          },
        ],
        upsert: async (args) => {
          upsertArgs = args
          return { id: 'gsrc-4', ...args.create, ...args.update }
        },
      },
      calendarCalendar: {
        create: async () => {
          throw new Error('calendar should not be created for reactivation')
        },
      },
    })
    const svc = createGoogleCalendarSourceService({ prisma })

    const result = await svc.saveSelectedSources({
      connectionId: 'gconn-1',
      ownerId: 'user-1',
      calendars: [{ id: 'team', summary: 'Equipo', timeZone: 'America/Mexico_City' }],
    })

    assert.equal(result.items[0].atlasCalendarId, 'cal-team')
    assert.equal(result.items[0].syncStatus, 'PENDING_INITIAL_SYNC')
    assert.equal(upsertArgs.update.syncStatus, 'PENDING_INITIAL_SYNC')
    assert.equal(upsertArgs.update.lastErrorAt, null)
    assert.equal(upsertArgs.update.lastErrorMessage, null)
  })

  it('deduplicates calendars by calendar.id before creating atlas calendars or sources', async () => {
    let createCalls = 0
    let upsertCalls = 0
    const svc = createGoogleCalendarSourceService({
      prisma: makePrisma({
        calendarCalendar: {
          create: async ({ data }) => {
            createCalls += 1
            return { id: 'cal-1', ...data }
          },
        },
        googleCalendarSource: {
          upsert: async ({ create }) => {
            upsertCalls += 1
            return { id: 'gsrc-1', ...create }
          },
        },
      }),
    })

    const result = await svc.saveSelectedSources({
      connectionId: 'gconn-1',
      ownerId: 'user-1',
      calendars: [
        { id: 'primary', summary: 'Principal', timeZone: 'America/Mexico_City' },
        { id: 'primary', summary: 'Principal duplicado', timeZone: 'America/Mexico_City' },
      ],
    })

    assert.equal(createCalls, 1)
    assert.equal(upsertCalls, 1)
    assert.equal(result.items.length, 1)
    assert.equal(result.items[0].googleCalendarId, 'primary')
  })

  it('throws CalendarServiceError 400 when a calendar item has an invalid id', async () => {
    const svc = createGoogleCalendarSourceService({ prisma: makePrisma() })

    await assert.rejects(
      () => svc.saveSelectedSources({
        connectionId: 'gconn-1',
        ownerId: 'user-1',
        calendars: [{ id: '   ', summary: 'Sin id' }],
      }),
      (error) => {
        assert.equal(error instanceof CalendarServiceError, true)
        assert.equal(error.status, 400)
        return true
      }
    )
  })
})
