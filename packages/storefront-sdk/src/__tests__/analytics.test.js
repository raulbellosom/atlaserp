import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createAnalyticsNamespace } from '../analytics.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  }
}

function createEventTarget(extra = {}) {
  const listeners = new Map()
  return {
    ...extra,
    addEventListener(type, listener) {
      const entries = listeners.get(type) ?? new Set()
      entries.add(listener)
      listeners.set(type, entries)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    dispatch(type, event = {}) {
      for (const listener of listeners.get(type) ?? []) listener(event)
    },
  }
}

function createHarness({
  analyticsMode = 'anonymous',
  doNotTrack = '0',
  failEvents = 0,
} = {}) {
  let now = Date.parse('2026-06-14T18:00:00.000Z')
  let id = 0
  let failuresRemaining = failEvents
  const calls = []
  const scheduled = []
  const beacons = []
  const storage = createStorage()
  const document = createEventTarget({
    visibilityState: 'visible',
    referrer: 'https://google.example/',
  })
  const window = createEventTarget({
    location: {
      pathname: '/inicio',
      href: 'https://shop.example.com/inicio',
    },
  })
  const navigator = {
    doNotTrack,
    sendBeacon(url, body) {
      beacons.push({ url, body })
      return true
    },
  }
  const request = async (method, path, body, options) => {
    calls.push({ method, path, body, options })
    if (path.endsWith('/config')) {
      return {
        data: {
          siteId: 'site-1',
          analyticsMode,
          respectDoNotTrack: true,
          capabilities: { analytics: analyticsMode !== 'off', forms: true },
        },
      }
    }
    if (failuresRemaining > 0) {
      failuresRemaining -= 1
      throw new Error('temporary')
    }
    return { data: { accepted: body.events.length, rejected: [] } }
  }
  const analytics = createAnalyticsNamespace({
    request,
    baseUrl: 'https://erp.example.com',
    company: 'acme',
    siteId: 'site-1',
    environment: {
      window,
      document,
      navigator,
      storage,
      now: () => now,
      randomId: () => `id-${++id}`,
      setInterval: () => 1,
      clearInterval: () => {},
      setTimeout(fn, delay) {
        scheduled.push({ fn, delay })
        return scheduled.length
      },
      clearTimeout: () => {},
    },
  })

  return {
    analytics,
    calls,
    beacons,
    document,
    window,
    scheduled,
    advance(milliseconds) {
      now += milliseconds
    },
  }
}

function eventCalls(harness) {
  return harness.calls.filter((call) => call.path.includes('/events/batch'))
}

describe('createAnalyticsNamespace', () => {
  it('stores consent and clears identifiers and queued events when denied', async () => {
    const harness = createHarness({ analyticsMode: 'consent_required' })
    await harness.analytics.start()
    harness.analytics.track('cta_click', { placement: 'hero' })
    assert.equal(await harness.analytics.flush(), null)

    harness.analytics.setConsent('granted')
    harness.analytics.track('cta_click', { placement: 'hero' })
    harness.analytics.setConsent('denied')
    assert.equal(harness.analytics.getConsent(), 'denied')
    assert.equal(await harness.analytics.flush(), null)
    assert.equal(eventCalls(harness).length, 0)
  })

  it('keeps consent granted before start after resolving site config', async () => {
    const harness = createHarness({ analyticsMode: 'consent_required' })
    harness.analytics.setConsent('granted')
    await harness.analytics.start()
    await harness.analytics.flush()

    assert.equal(harness.analytics.getConsent(), 'granted')
    assert.equal(eventCalls(harness).length, 1)
  })

  it('honors DNT even when analytics mode is anonymous', async () => {
    const harness = createHarness({ doNotTrack: '1' })
    await harness.analytics.start()
    harness.analytics.track('cta_click')
    await harness.analytics.flush()
    assert.equal(eventCalls(harness).length, 0)
  })

  it('rotates sessions after 30 minutes while keeping the visitor', async () => {
    const harness = createHarness()
    await harness.analytics.start()
    await harness.analytics.flush()
    const first = eventCalls(harness)[0].body

    harness.advance(30 * 60 * 1000 + 1)
    harness.analytics.track('cta_click')
    await harness.analytics.flush()
    const second = eventCalls(harness)[1].body

    assert.equal(second.visitorId, first.visitorId)
    assert.notEqual(second.sessionId, first.sessionId)
  })

  it('bounds the queue, batches at 50 events, and retries with backoff', async () => {
    const harness = createHarness({ failEvents: 1 })
    await harness.analytics.start()
    for (let index = 0; index < 120; index += 1) {
      harness.analytics.track('cta_click', { index })
    }

    await assert.rejects(() => harness.analytics.flush(), /temporary/)
    assert.equal(harness.scheduled.length, 1)
    assert.equal(harness.scheduled[0].delay, 1000)

    await harness.analytics.flush()
    await harness.analytics.flush()
    const successful = eventCalls(harness).slice(1)
    assert.deepEqual(successful.map((call) => call.body.events.length), [50, 50])
    assert.equal(successful[0].body.events[0].properties.index, 20)
  })

  it('captures the initial page and tagged elements without form values', async () => {
    const harness = createHarness()
    await harness.analytics.start()
    harness.document.dispatch('click', {
      target: {
        closest: () => ({
          dataset: {
            atlasEvent: 'pricing_cta',
            atlasLabel: 'Plan profesional',
            value: 'secret',
          },
          tagName: 'BUTTON',
        }),
      },
    })
    await harness.analytics.flush()

    const events = eventCalls(harness)[0].body.events
    assert.equal(events[0].name, 'page_view')
    assert.equal(events[1].name, 'pricing_cta')
    assert.equal(events[1].properties.label, 'Plan profesional')
    assert.equal(JSON.stringify(events).includes('secret'), false)
  })

  it('keeps form identifiers while dropping form values', async () => {
    const harness = createHarness()
    await harness.analytics.start()
    harness.analytics.track('form_submit', {
      formId: '01900000-0000-7000-8000-000000000003',
      submissionId: '01900000-0000-7000-8000-000000000004',
      formValues: 'private',
      values: 'private',
    })
    await harness.analytics.flush()

    const event = eventCalls(harness)[0].body.events[1]
    assert.equal(event.formId, '01900000-0000-7000-8000-000000000003')
    assert.equal(
      event.submissionId,
      '01900000-0000-7000-8000-000000000004',
    )
    assert.equal(event.properties.formValues, undefined)
    assert.equal(event.properties.values, undefined)
  })

  it('uses sendBeacon on pagehide and stop removes automatic listeners', async () => {
    const harness = createHarness()
    await harness.analytics.start()
    harness.analytics.track('cta_click')
    harness.window.dispatch('pagehide')

    assert.equal(harness.beacons.length, 1)
    assert.match(harness.beacons[0].url, /company=acme/)
    assert.match(harness.beacons[0].url, /siteId=site-1/)

    harness.analytics.stop()
    harness.document.dispatch('click', {
      target: {
        closest: () => ({
          dataset: { atlasEvent: 'after_stop' },
          tagName: 'BUTTON',
        }),
      },
    })
    await harness.analytics.flush()
    assert.equal(
      eventCalls(harness).some((call) =>
        call.body.events.some((event) => event.name === 'after_stop'),
      ),
      false,
    )
  })
})
