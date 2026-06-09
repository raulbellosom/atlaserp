import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGoogleCalendarEventsService } from '../google/google-calendar-events-service.js'

describe('google-calendar-events-service', () => {
  it('paginates all events for the selected google calendar', async () => {
    const fetchCalls = []
    const svc = createGoogleCalendarEventsService({
      fetchImpl: async (url, options) => {
        fetchCalls.push({ url: String(url), options })
        const hasPage2 = String(url).includes('pageToken=page-2')

        return {
          ok: true,
          json: async () => (
            hasPage2
              ? { items: [{ id: 'evt-2' }] }
              : { items: [{ id: 'evt-1' }], nextPageToken: 'page-2' }
          ),
        }
      },
    })

    const items = await svc.listAllEvents({
      accessToken: 'tok',
      calendarId: 'primary',
    })

    assert.deepEqual(items, [{ id: 'evt-1' }, { id: 'evt-2' }])
    assert.equal(fetchCalls.length, 2)
    assert.match(fetchCalls[0].url, /singleEvents=true/)
    assert.match(fetchCalls[0].url, /showDeleted=true/)
    assert.match(fetchCalls[0].url, /maxResults=2500/)
    assert.match(fetchCalls[1].url, /pageToken=page-2/)
    assert.equal(fetchCalls[0].options.headers.Authorization, 'Bearer tok')
  })

  it('throws an error with status when google returns a non-ok response', async () => {
    const svc = createGoogleCalendarEventsService({
      fetchImpl: async () => ({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            message: 'Forbidden',
          },
        }),
      }),
    })

    await assert.rejects(
      () => svc.listAllEvents({ accessToken: 'tok', calendarId: 'primary' }),
      (error) => {
        assert.equal(error.status, 403)
        assert.match(error.message, /Forbidden/)
        return true
      }
    )
  })

  it('wraps fetch network failures with google import context', async () => {
    const svc = createGoogleCalendarEventsService({
      fetchImpl: async () => {
        throw new Error('socket hang up')
      },
    })

    await assert.rejects(
      () => svc.listAllEvents({ accessToken: 'tok', calendarId: 'primary' }),
      (error) => {
        assert.match(error.message, /Google calendar events import failed\./)
        assert.match(error.message, /socket hang up/)
        assert.equal(error.status, undefined)
        return true
      }
    )
  })
})
