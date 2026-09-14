import test from 'node:test'
import assert from 'node:assert/strict'
import { getRunlyClient, initRunlyClient, setActiveCompanyId, getActiveCompanyId } from '../runly.js'

test('initRunlyClient binds SDK requests to the runtime URL', async () => {
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url) => {
    requests.push(url)
    return {
      ok: true,
      json: async () => ({ status: 'ok' }),
    }
  }

  try {
    initRunlyClient('https://demo.runlyerp.com')
    await getRunlyClient().health()
    assert.equal(requests[0], 'https://demo.runlyerp.com/health')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('setActiveCompanyId makes subsequent SDK requests carry X-Runly-Company-Id', async () => {
  const originalFetch = globalThis.fetch
  const seenHeaders = []

  globalThis.fetch = async (_url, options = {}) => {
    seenHeaders.push(options.headers ?? {})
    return { ok: true, json: async () => ({}) }
  }

  try {
    initRunlyClient('https://demo.runlyerp.com')
    assert.equal(getActiveCompanyId(), null)

    setActiveCompanyId('company-a')
    await getRunlyClient().profile.me('tok')
    assert.equal(seenHeaders[0]['X-Runly-Company-Id'], 'company-a')

    setActiveCompanyId('company-b')
    await getRunlyClient().profile.me('tok')
    assert.equal(seenHeaders[1]['X-Runly-Company-Id'], 'company-b')

    setActiveCompanyId(null)
    await getRunlyClient().profile.me('tok')
    assert.equal('X-Runly-Company-Id' in seenHeaders[2], false)
  } finally {
    globalThis.fetch = originalFetch
    setActiveCompanyId(null)
  }
})
