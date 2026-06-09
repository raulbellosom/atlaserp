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
