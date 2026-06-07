import test from 'node:test'
import assert from 'node:assert/strict'
import { clearApiUrl, getApiUrl, setApiUrl } from '../runtimeConfig.js'

test('setApiUrl overrides the current API URL at runtime', () => {
  const previousUrl = getApiUrl()

  setApiUrl('https://demo.atlaserp.com')
  assert.equal(getApiUrl(), 'https://demo.atlaserp.com')

  clearApiUrl()
  assert.equal(getApiUrl(), previousUrl)
})
