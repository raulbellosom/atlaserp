import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useAuth } from "../auth/AuthProvider";
import {
  isWebPushSupported,
  getCurrentWebPushSubscription,
  subscribeCurrentDeviceToWebPush,
  syncCurrentDeviceWebPushSubscription,
} from "../lib/webPush";
import { atlas } from "../lib/atlas";
import {
  getSystemNotificationPermission,
  isTauriRuntime,
  requestSystemNotificationPermission,
} from "../lib/systemNotifications";
import { unlockCallSounds } from "../modules/atlas.chat/calls/callSounds";

const ENABLE_NOTIFICATIONS_TOAST_ID = "atlas-enable-notifications";

function getPwaLabel() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone) {
    const title = document.title?.trim() || "Atlas PWA";
    return title.length > 40 ? `${title.slice(0, 40)}...` : title;
  }
  const ua = navigator.userAgent ?? "";
  if (/iPhone|iPad/i.test(ua)) return "Safari iOS (web)";
  if (/Android/i.test(ua)) return "Android (web)";
  return "Navegador web";
}

function enableFromUserGesture(token) {
  const soundActivation = unlockCallSounds();
  toast.dismiss(ENABLE_NOTIFICATIONS_TOAST_ID);

  const notificationActivation = isTauriRuntime()
    ? requestSystemNotificationPermission().then((permission) => {
        if (permission !== "granted") throw new Error("Permiso de notificaciones denegado.");
      })
    : subscribeCurrentDeviceToWebPush({ token, deviceLabel: getPwaLabel() });

  Promise.all([soundActivation, notificationActivation])
    .then(([soundUnlocked]) => {
      if (!soundUnlocked) throw new Error("El dispositivo no permitio activar el sonido.");
      toast.success("Notificaciones y sonidos activados.");
    })
    .catch((error) => {
      toast.error(error?.message ?? "No se pudieron activar las notificaciones.");
    });
}

function showEnablePrompt(token) {
  toast("Activa las notificaciones", {
    id: ENABLE_NOTIFICATIONS_TOAST_ID,
    description: "Recibe avisos y escucha las llamadas aunque Atlas no este visible.",
    duration: Infinity,
    action: {
      label: "Activar",
      onClick: () => enableFromUserGesture(token),
    },
  });
}

async function prepareNotifications(token) {
  if (isTauriRuntime()) {
    const permission = await getSystemNotificationPermission().catch(() => "unsupported");
    if (permission === "default") showEnablePrompt(token);
    return;
  }

  if (!isWebPushSupported()) return;
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

  const keyResponse = await atlas.notifications.getWebPushPublicKey(token).catch(() => null);
  if (!keyResponse?.data?.publicKey) return;

  const deviceLabel = getPwaLabel();
  const existing = await getCurrentWebPushSubscription().catch(() => null);
  if (existing) {
    await syncCurrentDeviceWebPushSubscription({ token, deviceLabel }).catch(() => {});
    return;
  }

  if (Notification.permission === "granted") {
    await subscribeCurrentDeviceToWebPush({ token, deviceLabel }).catch(() => {});
    return;
  }

  // Browsers require requestPermission() to run directly from a user gesture.
  // The toast action is that gesture; a delayed automatic prompt gets blocked.
  showEnablePrompt(token);
}

/**
 * Prepares notifications after login.
 * - If already subscribed, silently syncs the endpoint with the server.
 * - If permission is pending, offers an explicit activation action.
 * - In Tauri, enables native OS notifications instead of Web Push.
 * - Also checks again when a PWA shortcut is installed.
 */
export function usePushAutoSubscribe() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (!token || !userProfile?.id) {
      hasRunRef.current = false;
      return;
    }
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    prepareNotifications(token).catch(() => {});
  }, [token, userProfile?.id]);

  useEffect(() => {
    if (!token || !userProfile?.id) return;
    let installTimer = null;

    function handleAppInstalled() {
      if (installTimer !== null) window.clearTimeout(installTimer);
      installTimer = window.setTimeout(() => prepareNotifications(token).catch(() => {}), 3000);
    }

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("appinstalled", handleAppInstalled);
      if (installTimer !== null) window.clearTimeout(installTimer);
    };
  }, [token, userProfile?.id]);
}
