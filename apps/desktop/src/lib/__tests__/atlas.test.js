import test from 'node:test'
import assert from 'node:assert/strict'
import { getAtlasClient, initAtlasClient, setActiveCompanyId, getActiveCompanyId } from '../atlas.js'

test('initAtlasClient binds SDK requests to the runtime URL', async () => {
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
    initAtlasClient('https://demo.atlaserp.com')
    await getAtlasClient().health()
    assert.equal(requests[0], 'https://demo.atlaserp.com/health')
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('setActiveCompanyId makes subsequent SDK requests carry X-Atlas-Company-Id', async () => {
  const originalFetch = globalThis.fetch
  const seenHeaders = []

  globalThis.fetch = async (_url, options = {}) => {
    seenHeaders.push(options.headers ?? {})
    return { ok: true, json: async () => ({}) }
  }

  try {
    initAtlasClient('https://demo.atlaserp.com')
    assert.equal(getActiveCompanyId(), null)

    setActiveCompanyId('company-a')
    await getAtlasClient().profile.me('tok')
    assert.equal(seenHeaders[0]['X-Atlas-Company-Id'], 'company-a')

    setActiveCompanyId('company-b')
    await getAtlasClient().profile.me('tok')
    assert.equal(seenHeaders[1]['X-Atlas-Company-Id'], 'company-b')

    setActiveCompanyId(null)
    await getAtlasClient().profile.me('tok')
    assert.equal('X-Atlas-Company-Id' in seenHeaders[2], false)
  } finally {
    globalThis.fetch = originalFetch
    setActiveCompanyId(null)
  }
})
