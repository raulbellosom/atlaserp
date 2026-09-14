import test from 'node:test'
import assert from 'node:assert/strict'
import { clearApiUrl, getApiUrl, setApiUrl } from '../runtimeConfig.js'

test('runtime reads the injected __RUNLY_RUNTIME_CONFIG__ global', async () => {
  const previous = globalThis.window;
  try {
    globalThis.window = { __RUNLY_RUNTIME_CONFIG__: { RUNLY_API_URL: 'https://runly.example' } };
    const mod = await import('../runtimeConfig.js?runly-fixture=1');
    assert.equal(mod.getConfiguredApiUrl(), 'https://runly.example');
    mod.setApiUrl('https://override.example/');
    assert.equal(mod.getApiUrl(), 'https://override.example');
    mod.clearApiUrl();
    assert.equal(mod.getApiUrl(), 'https://runly.example');
  } finally {
    if (previous === undefined) delete globalThis.window; else globalThis.window = previous;
  }
})

test('setApiUrl overrides the current API URL at runtime', () => {
  const previousUrl = getApiUrl()

  setApiUrl('https://demo.runlyerp.com')
  assert.equal(getApiUrl(), 'https://demo.runlyerp.com')

  clearApiUrl()
  assert.equal(getApiUrl(), previousUrl)
})
