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
  const link =
    payload?.data?.link || payload?.link || "/app/m/atlas.notifications";
  const options = {
    body: payload?.body || "",
    icon: payload?.icon || "/icon-192.png",
    badge: payload?.badge || "/icon-192.png",
    tag: payload?.tag,
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
