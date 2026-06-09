import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarEventLinkService } from '../google/google-calendar-event-link-service.js'

function assertDateBetween(value, start, end) {
  assert.ok(value instanceof Date)
  assert.ok(value.getTime() >= start.getTime())
  assert.ok(value.getTime() <= end.getTime())
}

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
    let createdEventPayload = null
    let createdLinkPayload = null
    const svc = createGoogleCalendarEventLinkService({
      prisma: makePrisma({
        calendarEvent: {
          create: async ({ data }) => {
            createdEventPayload = data
            return { id: 'evt-1', ...data }
          },
        },
        googleCalendarEventLink: {
          create: async ({ data }) => {
            createdLinkPayload = data
            return { id: 'glink-1', ...data }
          },
        },
      }),
    })

    const before = new Date()
    const googleEvent = {
      id: 'google-evt-1',
      summary: 'Cita',
      description: 'Desc',
      status: 'cancelled',
      iCalUID: 'ical-1',
      recurringEventId: 'series-1',
      originalStartTime: { date: '2026-06-08' },
      start: { date: '2026-06-08' },
      end: { date: '2026-06-09' },
      updated: '2026-06-08T09:00:00.000Z',
    }
    const result = await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent,
    })
    const after = new Date()

    assert.equal(result.atlasEvent.id, 'evt-1')
    assert.equal(result.mode, 'created')
    assert.equal(result.link.googleEventId, 'google-evt-1')
    assert.equal(result.link.sourceId, 'gsrc-1')
    assert.equal(createdEventPayload.calendarId, 'cal-1')
    assert.equal(createdEventPayload.title, 'Cita')
    assert.equal(createdEventPayload.description, 'Desc')
    assert.equal(createdEventPayload.allDay, true)
    assert.equal(createdEventPayload.startAt.toISOString(), '2026-06-08T12:00:00.000Z')
    assert.equal(createdEventPayload.endAt.toISOString(), '2026-06-09T12:00:00.000Z')
    assert.equal(createdLinkPayload.atlasEventId, 'evt-1')
    assert.equal(createdLinkPayload.googleICalUID, 'ical-1')
    assert.equal(createdLinkPayload.googleRecurringEventId, 'series-1')
    assert.equal(createdLinkPayload.googleOriginalStartAt.toISOString(), '2026-06-08T12:00:00.000Z')
    assert.equal(createdLinkPayload.googleUpdatedAt.toISOString(), '2026-06-08T09:00:00.000Z')
    assert.equal(createdLinkPayload.googleStatus, 'cancelled')
    assert.equal(createdLinkPayload.cancelledInGoogleAt.toISOString(), '2026-06-08T09:00:00.000Z')
    assertDateBetween(createdLinkPayload.lastSeenAt, before, after)
    assert.equal(result.link.googleICalUID, 'ical-1')
    assert.equal(result.link.googleRecurringEventId, 'series-1')
    assert.equal(result.link.googleOriginalStartAt.toISOString(), '2026-06-08T12:00:00.000Z')
    assert.equal(result.link.googleStatus, 'cancelled')
    assert.equal(result.link.cancelledInGoogleAt.toISOString(), '2026-06-08T09:00:00.000Z')
    assertDateBetween(result.link.lastSeenAt, before, after)
    assert.deepEqual(createdLinkPayload.rawSnapshot, googleEvent)
  })

  it('updates the existing atlas event when the link exists and is not detached', async () => {
    let updatedPayload = null
    let updatedLinkPayload = null
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
          update: async ({ where, data }) => {
            updatedLinkPayload = data
            return { id: where.id, ...data }
          },
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

    const before = new Date()
    const googleEvent = {
      id: 'google-evt-1',
      summary: 'Cita actualizada',
      description: 'Nueva desc',
      status: 'confirmed',
      iCalUID: 'ical-2',
      recurringEventId: 'series-2',
      originalStartTime: { dateTime: '2026-06-08T11:30:00.000Z' },
      start: { dateTime: '2026-06-08T12:00:00.000Z' },
      end: { dateTime: '2026-06-08T13:00:00.000Z' },
      updated: '2026-06-08T11:00:00.000Z',
    }
    const result = await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent,
    })
    const after = new Date()

    assert.equal(result.atlasEvent.id, 'evt-1')
    assert.equal(result.mode, 'updated')
    assert.equal(updatedPayload.title, 'Cita actualizada')
    assert.equal(updatedPayload.description, 'Nueva desc')
    assert.equal(updatedPayload.startAt.toISOString(), '2026-06-08T12:00:00.000Z')
    assert.equal(updatedPayload.endAt.toISOString(), '2026-06-08T13:00:00.000Z')
    assert.deepEqual(updatedLinkPayload.rawSnapshot, googleEvent)
    assert.equal(updatedLinkPayload.googleICalUID, 'ical-2')
    assert.equal(updatedLinkPayload.googleRecurringEventId, 'series-2')
    assert.equal(updatedLinkPayload.googleOriginalStartAt.toISOString(), '2026-06-08T11:30:00.000Z')
    assert.equal(updatedLinkPayload.googleUpdatedAt.toISOString(), '2026-06-08T11:00:00.000Z')
    assert.equal(updatedLinkPayload.googleStatus, 'confirmed')
    assert.equal(updatedLinkPayload.cancelledInGoogleAt, null)
    assertDateBetween(updatedLinkPayload.lastSeenAt, before, after)
    assert.deepEqual(result.link.rawSnapshot, googleEvent)
    assert.equal(result.link.googleUpdatedAt.toISOString(), '2026-06-08T11:00:00.000Z')
  })

  it('does not overwrite the atlas event when the link is detached', async () => {
    let updateCalls = 0
    let updatedLinkPayload = null
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
          update: async ({ where, data }) => {
            updatedLinkPayload = data
            return { id: where.id, ...data }
          },
        },
        calendarEvent: {
          update: async () => {
            updateCalls++
            return { id: 'evt-1' }
          },
        },
      }),
    })

    const before = new Date()
    const googleEvent = {
      id: 'google-evt-1',
      summary: 'No debe sobrescribir',
      status: 'confirmed',
      iCalUID: 'ical-detached',
      recurringEventId: 'series-detached',
      originalStartTime: { date: '2026-06-08' },
      start: { dateTime: '2026-06-08T15:00:00.000Z' },
      end: { dateTime: '2026-06-08T16:00:00.000Z' },
      updated: '2026-06-08T14:00:00.000Z',
    }
    const result = await svc.upsertImportedEvent({
      source: { id: 'gsrc-1', atlasCalendarId: 'cal-1' },
      googleEvent,
    })
    const after = new Date()

    assert.equal(updateCalls, 0)
    assert.equal(result.atlasEvent, null)
    assert.equal(result.mode, 'detached')
    assert.deepEqual(updatedLinkPayload.rawSnapshot, googleEvent)
    assert.equal(updatedLinkPayload.googleICalUID, 'ical-detached')
    assert.equal(updatedLinkPayload.googleRecurringEventId, 'series-detached')
    assert.equal(updatedLinkPayload.googleOriginalStartAt.toISOString(), '2026-06-08T12:00:00.000Z')
    assert.equal(updatedLinkPayload.googleUpdatedAt.toISOString(), '2026-06-08T14:00:00.000Z')
    assert.equal(updatedLinkPayload.googleStatus, 'confirmed')
    assert.equal(updatedLinkPayload.cancelledInGoogleAt, null)
    assertDateBetween(updatedLinkPayload.lastSeenAt, before, after)
  })
})
