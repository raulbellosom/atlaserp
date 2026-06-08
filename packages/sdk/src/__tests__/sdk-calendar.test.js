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

describe('atlas SDK â€” calendar namespace', () => {
  it('getGoogleStatus GETs /calendar/google/status', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.getGoogleStatus('tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/google/status')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

  it('startGoogleConnect POSTs /calendar/google/connect/start', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.startGoogleConnect('tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/google/connect/start')
    assert.equal(opts.method, 'POST')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

  it('finishGoogleConnect GETs /calendar/google/connect/callback with code', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.finishGoogleConnect({ code: 'code-123' }, 'tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/google/connect/callback?code=code-123')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

  it('listGoogleCalendars GETs /calendar/google/calendars', async () => {
    const fetchMock = makeFetch()
    const { createAtlasClient } = await import('../index.js')
    const client = createAtlasClient({ baseUrl: 'http://api' })
    globalThis.fetch = fetchMock
    await client.calendar.listGoogleCalendars('tok')
    const [url, opts] = fetchMock.mock.calls[0].arguments
    assert.equal(url, 'http://api/calendar/google/calendars')
    assert.equal(opts.headers.Authorization, 'Bearer tok')
    fetchMock.mock.restore()
  })

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
