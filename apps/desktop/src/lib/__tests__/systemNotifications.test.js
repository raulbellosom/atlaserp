import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  getSystemNotificationPermission,
  requestSystemNotificationPermission,
  showSystemNotification,
} from "../systemNotifications.js";

const originalNotification = globalThis.Notification;
const originalNavigator = globalThis.navigator;

afterEach(() => {
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    value: originalNotification,
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: originalNavigator,
  });
});

describe("system notifications in the browser", () => {
  it("reads and requests browser notification permission", async () => {
    let requested = false;
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: {
        permission: "default",
        async requestPermission() {
          requested = true;
          return "granted";
        },
      },
    });

    assert.equal(await getSystemNotificationPermission(), "default");
    assert.equal(await requestSystemNotificationPermission(), "granted");
    assert.equal(requested, true);
  });

  it("uses the service worker so clicks and persistent call notices stay supported", async () => {
    const shown = [];
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: { permission: "granted" },
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        serviceWorker: {
          async getRegistration() {
            return {
              async showNotification(title, options) {
                shown.push({ title, options });
              },
            };
          },
        },
      },
    });

    const displayed = await showSystemNotification({
      title: "Llamada entrante",
      body: "Videollamada entrante",
      tag: "call:123",
      data: { callId: "123" },
      requireInteraction: true,
    });

    assert.equal(displayed, true);
    assert.equal(shown.length, 1);
    assert.equal(shown[0].title, "Llamada entrante");
    assert.equal(shown[0].options.tag, "call:123");
    assert.equal(shown[0].options.requireInteraction, true);
  });

  it("does not display a system notice when permission is not granted", async () => {
    Object.defineProperty(globalThis, "Notification", {
      configurable: true,
      value: { permission: "denied" },
    });

    assert.equal(await showSystemNotification({ title: "Aviso" }), false);
  });
});
