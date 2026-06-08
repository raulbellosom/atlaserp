import { atlas } from "./atlas.js";

const STORAGE_KEY = "atlas.notifications.webpush.subscriptionId";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function isWebPushSupported() {
  if (typeof window === "undefined") return false;
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getStoredWebPushSubscriptionId() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function clearStoredWebPushSubscriptionId() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export async function registerNotificationServiceWorker() {
  if (!isWebPushSupported()) return null;
  const registration = await navigator.serviceWorker.register("/sw-notifications.js", {
    scope: "/",
  });
  return registration;
}

export async function getCurrentWebPushSubscription() {
  if (!isWebPushSupported()) return null;
  const registration =
    (await navigator.serviceWorker.getRegistration("/")) ??
    (await navigator.serviceWorker.getRegistration()) ??
    null;
  const subscription = await registration?.pushManager?.getSubscription?.();
  if (!subscription) {
    clearStoredWebPushSubscriptionId();
    return null;
  }
  return subscription;
}

export async function syncCurrentDeviceWebPushSubscription({
  token,
  deviceLabel = "Dispositivo web",
}) {
  const subscription = await getCurrentWebPushSubscription();
  if (!subscription) return { data: null };

  const json = subscription.toJSON();
  const response = await atlas.notifications.subscribeWebPush(token, {
    endpoint: json.endpoint,
    keys: {
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    },
    deviceLabel,
  });

  const subscriptionId = response?.data?.id ?? null;
  if (subscriptionId) {
    window.localStorage.setItem(STORAGE_KEY, subscriptionId);
  }
  return response;
}

export async function subscribeCurrentDeviceToWebPush({
  token,
  deviceLabel = "Dispositivo web",
}) {
  if (!isWebPushSupported()) {
    throw new Error("Este navegador no soporta notificaciones push.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permiso de notificaciones denegado.");
  }

  const keyResponse = await atlas.notifications.getWebPushPublicKey(token);
  const publicKey = keyResponse?.data?.publicKey;
  if (!publicKey) {
    throw new Error("No hay clave pública VAPID configurada.");
  }

  const registration =
    (await registerNotificationServiceWorker()) ??
    (await navigator.serviceWorker.ready);
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  return syncCurrentDeviceWebPushSubscription({ token, deviceLabel });
}

export async function unsubscribeCurrentDeviceFromWebPush({ token }) {
  if (isWebPushSupported()) {
    const registration = await navigator.serviceWorker.getRegistration(
      "/sw-notifications.js",
    );
    const subscription = await registration?.pushManager?.getSubscription?.();
    if (subscription) await subscription.unsubscribe();
  }

  const subscriptionId = getStoredWebPushSubscriptionId();
  if (subscriptionId) {
    await atlas.notifications.unsubscribeWebPush(token, subscriptionId).catch(() => {});
  }
  clearStoredWebPushSubscriptionId();
  return { deleted: true };
}
