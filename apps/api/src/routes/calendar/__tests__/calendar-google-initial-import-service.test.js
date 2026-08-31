import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarInitialImportService } from '../google/google-calendar-initial-import-service.js'

describe('google-calendar-initial-import-service', () => {
  it('marks the source as SYNCING, imports all events, and finishes as ACTIVE', async () => {
    const updates = []
    const importedIds = []
    const svc = createGoogleCalendarInitialImportService({
      prisma: {
        googleCalendarSource: {
          update: async ({ data }) => {
            updates.push(data)
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

    const statusUpdates = updates.filter((data) => data.syncStatus).map((data) => data.syncStatus)
    assert.deepEqual(statusUpdates, ['SYNCING', 'ACTIVE'])
    assert.deepEqual(importedIds, ['evt-1', 'evt-2'])

    const initial = updates[0]
    assert.equal(initial.importTotalEvents, null)
    assert.equal(initial.importProcessedEvents, 0)

    const final = updates[updates.length - 1]
    assert.equal(final.syncStatus, 'ACTIVE')
    assert.equal(final.importTotalEvents, 2)
    assert.equal(final.importProcessedEvents, 2)

    // A progress update was persisted mid-import too, not just at the end.
    const progressUpdate = updates.find((data) => data.importProcessedEvents === 2 && !data.syncStatus)
    assert.ok(progressUpdate, 'expected a mid-import progress update')
  })

  it('reports a running total as pages arrive via onPage', async () => {
    const totals = []
    const svc = createGoogleCalendarInitialImportService({
      prisma: {
        googleCalendarSource: {
          update: async ({ data }) => {
            if (typeof data.importTotalEvents === 'number') totals.push(data.importTotalEvents)
            return { id: 'gsrc-1', ...data }
          },
        },
      },
      eventsService: {
        listAllEvents: async ({ onPage }) => {
          await onPage({ totalSoFar: 2500, done: false })
          await onPage({ totalSoFar: 3100, done: true })
          return new Array(3100).fill(null).map((_, index) => ({ id: `evt-${index}` }))
        },
      },
      linkService: {
        upsertImportedEvent: async () => ({ mode: 'created' }),
      },
    })

    await svc.importSource({
      source: { id: 'gsrc-1', googleCalendarId: 'primary', atlasCalendarId: 'cal-1' },
      accessToken: 'tok',
    })

    assert.deepEqual(totals.slice(0, 2), [2500, 3100])
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

  it('marks a source as ERROR directly via markSourceError', async () => {
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
      eventsService: { listAllEvents: async () => [] },
      linkService: { upsertImportedEvent: async () => ({ mode: 'created' }) },
    })

    await svc.markSourceError('gsrc-1', new Error('reconnect required'))

    assert.equal(lastUpdate.syncStatus, 'ERROR')
    assert.equal(lastUpdate.lastErrorMessage, 'reconnect required')
    assert.equal(lastUpdate.lastErrorAt instanceof Date, true)
  })
})
