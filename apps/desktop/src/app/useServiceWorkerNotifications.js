import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { playCallSound } from "../modules/atlas.chat/calls/callSounds.js";

function resolveNotificationLink(href) {
  if (!href || typeof href !== "string") return null;
  if (/^https?:\/\//i.test(href)) return href;
  return href.startsWith("/m/") ? `/app${href}` : href;
}

function openNotificationLink(link, navigate) {
  if (/^https?:\/\//i.test(link)) {
    window.open(link, "_blank", "noopener,noreferrer");
    return;
  }
  navigate(link);
}

export function useServiceWorkerNotifications({ navigate, queryClient }) {
  const seenNotificationIds = useRef(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;

    function invalidateNotifications() {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-inbox"] });
    }

    function handleServiceWorkerMessage(event) {
      const message = event?.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "atlas.notifications.push") {
        const notificationId = message.notificationId ?? null;
        if (notificationId && seenNotificationIds.current.has(notificationId)) return;
        if (notificationId) {
          seenNotificationIds.current.add(notificationId);
          if (seenNotificationIds.current.size > 200) seenNotificationIds.current.clear();
        }

        if (
          message.eventType === "chat.message.new"
          && window.location.pathname.includes("/m/atlas.chat")
        ) {
          invalidateNotifications();
          return;
        }

        const title = typeof message.title === "string" && message.title.trim()
          ? message.title
          : "Nueva notificacion";
        const body = typeof message.body === "string" && message.body.trim()
          ? message.body
          : "";
        const link = resolveNotificationLink(message.link);

        playCallSound("notification", { volume: 0.6 });
        toast(title, {
          description: body || undefined,
          action: link
            ? { label: "Abrir", onClick: () => openNotificationLink(link, navigate) }
            : undefined,
        });
        invalidateNotifications();
        return;
      }

      if (message.type === "atlas.notifications.click") {
        const link = resolveNotificationLink(message.link);
        if (link) openNotificationLink(link, navigate);
      }
    }

    navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    return () => navigator.serviceWorker.removeEventListener("message", handleServiceWorkerMessage);
  }, [navigate, queryClient]);
}
