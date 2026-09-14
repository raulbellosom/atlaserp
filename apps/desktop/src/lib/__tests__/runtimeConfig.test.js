import test from 'node:test'
import assert from 'node:assert/strict'
import { clearApiUrl, getApiUrl, setApiUrl } from '../runtimeConfig.js'

test('runtime accepts legacy/current globals and Runly wins conflicts', async t => {
  const previous = globalThis.window;
  t.after(() => { if (previous === undefined) delete globalThis.window; else globalThis.window = previous; });
  for (const [index, [config, expected]] of [
    [{ __ATLAS_RUNTIME_CONFIG__: { ATLAS_API_URL: 'https://legacy.example' } }, 'https://legacy.example'],
    [{ __RUNLY_RUNTIME_CONFIG__: { RUNLY_API_URL: 'https://runly.example', ATLAS_API_URL: 'https://legacy.example' } }, 'https://runly.example'],
    [{ __RUNLY_RUNTIME_CONFIG__: { RUNLY_API_URL: 'https://runly.example' }, __ATLAS_RUNTIME_CONFIG__: { ATLAS_API_URL: 'https://legacy.example' } }, 'https://runly.example'],
  ].entries()) {
    globalThis.window = config;
    const mod = await import(`../runtimeConfig.js?runly-fixture=${index}`);
    assert.equal(mod.getConfiguredApiUrl(), expected);
    mod.setApiUrl('https://override.example/');
    assert.equal(mod.getApiUrl(), 'https://override.example');
    mod.clearApiUrl();
    assert.equal(mod.getApiUrl(), expected);
  }
})

test('setApiUrl overrides the current API URL at runtime', () => {
  const previousUrl = getApiUrl()

  setApiUrl('https://demo.atlaserp.com')
  assert.equal(getApiUrl(), 'https://demo.atlaserp.com')

  clearApiUrl()
  assert.equal(getApiUrl(), previousUrl)
})
