import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createCalendarEventService } from '../calendar-event-service.js'

function makePrisma(overrides = {}) {
  return {
    calendarCalendar: {
      findMany: async () => [{ id: 'cal-1' }],
      ...(overrides.calendarCalendar ?? {}),
    },
    calendarShare: {
      findMany: async () => [],
      findFirst: async () => null,
      ...(overrides.calendarShare ?? {}),
    },
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
      ...(overrides.calendarEvent ?? {}),
    },
    googleCalendarEventLink: {
      findFirst: async () => null,
      update: async ({ where, data }) => ({ id: where.id, ...data }),
      ...(overrides.googleCalendarEventLink ?? {}),
    },
    calendarReminder: {
      updateMany: async () => ({ count: 0 }),
      ...(overrides.calendarReminder ?? {}),
    },
  }
}

describe('calendar-event-service', () => {
  it('marks an imported event as detached when the event is edited locally', async () => {
    let detachUpdate = null
    const svc = createCalendarEventService({
      prisma: makePrisma({
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
    assert.ok(detachUpdate.detachedAt instanceof Date)
  })
})
