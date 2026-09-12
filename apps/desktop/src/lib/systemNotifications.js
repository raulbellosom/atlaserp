import { native } from '../native/index.js';

export function isTauriRuntime() {
  return native.isAvailable();
}

export function isSystemNotificationSupported() {
  if (isTauriRuntime()) return true;
  return typeof globalThis.Notification !== "undefined";
}

export async function getSystemNotificationPermission() {
  return native.notifications.permission();
}

export async function requestSystemNotificationPermission() {
  return native.notifications.requestPermission();
}

export async function requestDesktopAttention() {
  return native.requestDesktopAttention();
}

export async function showSystemNotification({
  title,
  body,
  tag,
  data,
  requireInteraction = false,
}) {
  if (!title) return false;

  try {
    if (isTauriRuntime()) {
      return native.notifications.show({ title, body: body ?? '' });
    }

    if (
      typeof globalThis.Notification === "undefined" ||
      globalThis.Notification.permission !== "granted"
    ) {
      return false;
    }

    if ("serviceWorker" in navigator) {
      const registration =
        (await navigator.serviceWorker.getRegistration("/")) ??
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.ready.catch(() => null));
      if (registration?.showNotification) {
        await registration.showNotification(title, {
          body: body ?? "",
          tag,
          data,
          requireInteraction,
          vibrate: requireInteraction ? [400, 180, 400, 180, 400] : [180, 80, 180],
        });
        return true;
      }
    }

    new globalThis.Notification(title, { body: body ?? "", tag, data });
    return true;
  } catch {
    return false;
  }
}
