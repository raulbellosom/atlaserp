self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request));
  }
});

function broadcastToClients(message) {
  return clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((windows) => {
      for (const client of windows) {
        client.postMessage(message);
      }
    });
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload?.title || "Atlas Notifications";
  const isIncomingCall = payload?.data?.eventType === "chat.call.incoming";
  const link =
    payload?.data?.link || payload?.link || "/app/m/atlas.notifications";
  const options = {
    body: payload?.body || "",
    icon: payload?.icon || "/icon-192.png",
    badge: payload?.badge || "/icon-192.png",
    tag: payload?.tag,
    // renotify only on iOS — Android Chrome triggers a spam warning on rapid pushes
    renotify: Boolean(payload?.tag) && /iphone|ipad|ipod/i.test(self.navigator?.userAgent ?? ""),
    requireInteraction: isIncomingCall,
    vibrate: isIncomingCall ? [500, 200, 500, 200, 500] : undefined,
    actions: isIncomingCall ? [{ action: "open-call", title: "Contestar" }] : undefined,
    data: {
      ...(payload?.data || {}),
      link,
    },
  };

  event.waitUntil(
    Promise.all([
      broadcastToClients({
        type: "atlas.notifications.push",
        title,
        body: options.body,
        link,
        notificationId: payload?.data?.notificationId ?? null,
        eventType: payload?.data?.eventType ?? null,
        callId: payload?.data?.metadata?.callId ?? payload?.data?.sourceId ?? null,
      }),
      self.registration.showNotification(title, options),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification?.data?.link || "/app/m/atlas.notifications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ("focus" in client) {
          client.postMessage({ type: "atlas.notifications.click", link });
          if (new URL(client.url).origin === self.location.origin) {
            client.navigate(link);
            return client.focus();
          }
        }
      }
      return clients.openWindow(link);
    }),
  );
});
