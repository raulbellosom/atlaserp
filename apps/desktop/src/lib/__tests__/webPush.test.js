import test from "node:test";
import assert from "node:assert/strict";
import {
  clearStoredWebPushSubscriptionId,
  getCurrentWebPushSubscription,
  getStoredWebPushSubscriptionId,
} from "../webPush.js";

function createLocalStorageMock(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

test("clears stale stored subscription id when browser has no active push subscription", async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalNotification = globalThis.Notification;

  const mockedWindow = {
    localStorage: createLocalStorageMock({
      "atlas.notifications.webpush.subscriptionId": "server-sub-1",
    }),
    PushManager: class PushManagerMock {},
    Notification: { permission: "granted" },
  };
  const mockedNavigator = {
    serviceWorker: {
      async getRegistration() {
        return {
          pushManager: {
            async getSubscription() {
              return null;
            },
          },
        };
      },
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockedWindow,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: mockedNavigator,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: { permission: "granted" },
  });

  try {
    const subscription = await getCurrentWebPushSubscription();
    assert.equal(subscription, null);
    assert.equal(getStoredWebPushSubscriptionId(), null);
  } finally {
    clearStoredWebPushSubscriptionId();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: originalNotification,
    });
  }
});

test("returns the active browser subscription when present", async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const originalNotification = globalThis.Notification;
  const activeSubscription = {
    endpoint: "https://push.example/subscription-1",
  };

  const mockedWindow = {
    localStorage: createLocalStorageMock({
      "atlas.notifications.webpush.subscriptionId": "server-sub-2",
    }),
    PushManager: class PushManagerMock {},
    Notification: { permission: "granted" },
  };
  const mockedNavigator = {
    serviceWorker: {
      async getRegistration() {
        return {
          pushManager: {
            async getSubscription() {
              return activeSubscription;
            },
          },
        };
      },
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockedWindow,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: mockedNavigator,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: { permission: "granted" },
  });

  try {
    const subscription = await getCurrentWebPushSubscription();
    assert.equal(subscription, activeSubscription);
    assert.equal(getStoredWebPushSubscriptionId(), "server-sub-2");
  } finally {
    clearStoredWebPushSubscriptionId();
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: originalNavigator,
    });
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: originalNotification,
    });
  }
});
