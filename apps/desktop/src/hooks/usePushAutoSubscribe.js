import { useEffect, useRef } from "react";
import { useAuth } from "../auth/AuthProvider";
import {
  isWebPushSupported,
  getCurrentWebPushSubscription,
  subscribeCurrentDeviceToWebPush,
  syncCurrentDeviceWebPushSubscription,
} from "../lib/webPush";
import { atlas } from "../lib/atlas";

// Returns a human-readable label for the current device/context.
// Used as the device label stored in the DB so admins can identify subscriptions.
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

async function trySubscribe(token) {
  if (!isWebPushSupported()) return;
  // If the browser already denied push, requestPermission is a no-op
  // and we'd throw anyway — skip early to avoid noise.
  if (typeof Notification !== "undefined" && Notification.permission === "denied") return;

  // Only proceed if VAPID is configured on this server.
  const keyResponse = await atlas.notifications.getWebPushPublicKey(token).catch(() => null);
  if (!keyResponse?.data?.publicKey) return;

  const deviceLabel = getPwaLabel();

  // If the browser already has an active push subscription, just sync it to the
  // server (cheap upsert) without showing any permission prompt.
  const existing = await getCurrentWebPushSubscription().catch(() => null);
  if (existing) {
    await syncCurrentDeviceWebPushSubscription({ token, deviceLabel }).catch(() => {});
    return;
  }

  // No subscription → request permission and subscribe.
  // A short delay ensures the UI is stable and the page is interactive before
  // the browser shows the permission dialog.
  await new Promise((r) => setTimeout(r, 2500));
  await subscribeCurrentDeviceToWebPush({ token, deviceLabel });
}

/**
 * Auto-subscribes the current device to Web Push after login.
 * - Runs once per authenticated session.
 * - If already subscribed → silently syncs the endpoint with the server.
 * - If not subscribed → requests browser permission and subscribes.
 * - Also re-subscribes when a new PWA shortcut is installed (appinstalled).
 * - Never throws to the caller; push is always optional.
 */
export function usePushAutoSubscribe() {
  const { session, userProfile } = useAuth();
  const token = session?.access_token;
  const hasRunRef = useRef(false);

  // Run once per login session, after userProfile is loaded.
  useEffect(() => {
    if (!token || !userProfile?.id) return;
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    trySubscribe(token).catch(() => {});
  }, [token, userProfile?.id]);

  // When any PWA shortcut is installed, subscribe (or sync) for that session.
  useEffect(() => {
    if (!token || !userProfile?.id) return;

    function handleAppInstalled() {
      // Wait a moment for the PWA to finish launching before triggering.
      setTimeout(() => trySubscribe(token).catch(() => {}), 3000);
    }

    window.addEventListener("appinstalled", handleAppInstalled);
    return () => window.removeEventListener("appinstalled", handleAppInstalled);
  }, [token, userProfile?.id]);
}
