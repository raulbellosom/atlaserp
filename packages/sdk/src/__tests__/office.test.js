import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAtlasClient } from '../index.js';

test('Office session SDK authenticates, encodes IDs and never queues offline capabilities', async () => {
  const originalFetch = globalThis.fetch;
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ data: { mode: 'view' } }); };
  Object.defineProperty(globalThis, 'navigator', { value: { onLine: false }, configurable: true });
  try {
    const api = createAtlasClient({ baseUrl: 'https://atlas.example.com' });
    api.setOfflineTransport({ queue: () => { throw new Error('Office must not queue'); } });
    await api.files.createOfficeSession('id/encoded', 'view', 'auth-token');
    assert.equal(calls[0].url, 'https://atlas.example.com/files/id%2Fencoded/office/session');
    assert.equal(calls[0].options.headers.Authorization, 'Bearer auth-token');
    assert.deepEqual(JSON.parse(calls[0].options.body), { mode: 'view' });
    assert.equal(calls[0].options.onlineOnly, undefined);
    await api.files.officeStatus('auth-token');
    assert.equal(calls[1].url, 'https://atlas.example.com/files/office/status');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator);
    else delete globalThis.navigator;
  }
});
