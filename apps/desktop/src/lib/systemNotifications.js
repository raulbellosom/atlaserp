import { isTauri } from "@tauri-apps/api/core";

export function isTauriRuntime() {
  return isTauri();
}

export function isSystemNotificationSupported() {
  if (isTauriRuntime()) return true;
  return typeof globalThis.Notification !== "undefined";
}

export async function getSystemNotificationPermission() {
  if (isTauriRuntime()) {
    const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
    return (await isPermissionGranted()) ? "granted" : "default";
  }
  return globalThis.Notification?.permission ?? "unsupported";
}

export async function requestSystemNotificationPermission() {
  if (isTauriRuntime()) {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    if (await isPermissionGranted()) return "granted";
    return requestPermission();
  }
  if (typeof globalThis.Notification === "undefined") return "unsupported";
  return globalThis.Notification.requestPermission();
}

export async function requestDesktopAttention() {
  if (!isTauriRuntime()) return false;
  try {
    const { getCurrentWindow, UserAttentionType } = await import("@tauri-apps/api/window");
    await getCurrentWindow().requestUserAttention(UserAttentionType.Critical);
    return true;
  } catch {
    return false;
  }
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
      const { isPermissionGranted, sendNotification } = await import(
        "@tauri-apps/plugin-notification"
      );
      if (!(await isPermissionGranted())) return false;
      sendNotification({ title, body: body ?? "" });
      return true;
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
