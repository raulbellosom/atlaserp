import test from 'node:test';
import assert from 'node:assert/strict';
import { isWebPushSupported, registerServiceWorker } from '../webPush.js';

test('Web and PWA register Web Push; native Desktop, Android and iOS leave it to native delivery', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    for (const runtime of ['web', 'pwa', 'desktop', 'android', 'ios']) {
      let registrations = 0;
      const navigator = { userAgent: runtime === 'android' ? 'Android' : runtime === 'ios' ? 'iPhone' : 'Windows', serviceWorker: { register: async () => { registrations++; return {}; } } };
      const native = ['desktop', 'android', 'ios'].includes(runtime);
      Object.defineProperty(globalThis, 'window', { configurable: true, value: {
        navigator, matchMedia: () => ({ matches: runtime === 'pwa' }),
        PushManager: class {}, Notification: {},
        ...(native ? { __TAURI_INTERNALS__: { invoke() {} } } : {}),
      } });
      Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator });
      assert.equal(isWebPushSupported(), !native, runtime);
      await registerServiceWorker();
      assert.equal(registrations, native ? 0 : 1, runtime);
    }
  } finally {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else delete globalThis.window;
    if (originalNavigator) Object.defineProperty(globalThis, 'navigator', originalNavigator); else delete globalThis.navigator;
  }
});
