import test from 'node:test'
import assert from 'node:assert/strict'
import { getAtlasClient, initAtlasClient } from '../atlas.js'

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
