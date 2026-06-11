// Take control of all open pages immediately on activation so the fetch handler
// is live from the very first load — no page reload required.
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

// In-memory cache of module info sent from the page via postMessage.
// Keyed by module key (e.g. "atlas.contacts"). Survives page navigation but
// resets if the SW restarts — we fall back to a key-only manifest in that case.
const moduleCache = new Map();

self.addEventListener("message", (event) => {
  if (event.data?.type === "SET_MODULE" && event.data?.key) {
    moduleCache.set(event.data.key, event.data);
  }
});

// Build a Web App Manifest for the given module, using cached info when available.
// Always produces the correct start_url from the module key alone.
function buildModuleManifest(origin, moduleKey) {
  const info = moduleCache.get(moduleKey);
  const name = info?.name ?? moduleKey;
  const color = /^#[0-9a-fA-F]{3,8}$/.test(info?.color ?? "") ? info.color : "#0A7BFF";
  const shortName = name.length <= 14 ? name : name.slice(0, 14);

  const icons = [];
  if (info?.logoUrl) {
    const logoSrc = info.logoUrl.startsWith("http") ? info.logoUrl : `${origin}${info.logoUrl}`;
    icons.push({ src: logoSrc, sizes: "128x128", type: "image/webp" });
  }
  if (info?.iconSvgDataUri) {
    icons.push({ src: info.iconSvgDataUri, sizes: "any", type: "image/svg+xml", purpose: "any maskable" });
  }
  if (icons.length === 0) {
    icons.push({ src: `${origin}/icon-512.png`, sizes: "512x512", type: "image/png" });
  }

  return JSON.stringify({
    name: `${name} — Atlas`,
    short_name: shortName,
    description: info?.description ?? "",
    id: `${origin}/app/m/${moduleKey}`,
    start_url: `${origin}/app/m/${moduleKey}`,
    scope: `${origin}/`,
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0A1D44",
    theme_color: color,
    lang: "es-MX",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    icons,
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Intercept manifest requests with a module key parameter.
  // This makes the "Add to Home Screen" flow on both iOS and Android install
  // the module at its own URL instead of the root start_url.
  if (url.pathname === "/site.webmanifest" && url.searchParams.has("m")) {
    const moduleKey = url.searchParams.get("m");
    event.respondWith(
      new Response(buildModuleManifest(url.origin, moduleKey), {
        headers: {
          "Content-Type": "application/manifest+json",
          "Cache-Control": "no-store",
        },
      })
    );
    return;
  }

  // Pass navigate requests through normally; no caching performed.
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
