import { Hono } from "hono";

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateModuleIcon(name, color) {
  const initial = escapeXml((name || "A").charAt(0).toUpperCase());
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(color ?? "") ? color : "#0A7BFF";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="112" fill="${escapeXml(bg)}"/>` +
    `<text x="256" y="370" text-anchor="middle" fill="white" font-size="300" font-family="Arial,Helvetica,sans-serif" font-weight="bold">${initial}</text>` +
    `</svg>`;
}

export function createPwaRouter({ prisma }) {
  const router = new Hono();

  // GET /pwa/manifest?module=atlas.contacts
  // Returns a dynamic Web App Manifest scoped to the given module.
  // No auth required — browser fetches this during PWA install flow.
  router.get("/manifest", async (c) => {
    const moduleKey = c.req.query("module");
    if (!moduleKey || typeof moduleKey !== "string" || moduleKey.length > 100) {
      return c.json({ error: "Invalid module parameter" }, 400);
    }

    let mod;
    try {
      mod = await prisma.atlasModule.findUnique({
        where: { key: moduleKey },
        select: { key: true, manifest: true, status: true },
      });
    } catch {
      return c.json({ error: "Internal error" }, 500);
    }

    if (!mod || mod.status === "UNINSTALLED") {
      return c.json({ error: "Module not found" }, 404);
    }

    const manifest = mod.manifest ?? {};
    const name = manifest.name ?? moduleKey;
    const color = /^#[0-9a-fA-F]{3,8}$/.test(manifest.color ?? "")
      ? manifest.color
      : "#0A7BFF";
    const description = manifest.description ?? "";
    const shortName = name.length <= 14 ? name : name.slice(0, 14);

    const webManifest = {
      name: `${name} — Atlas`,
      short_name: shortName,
      description,
      id: `/app/m/${moduleKey}`,
      start_url: `/app/m/${moduleKey}`,
      scope: "/",
      display: "standalone",
      orientation: "portrait-primary",
      background_color: "#0A1D44",
      theme_color: color,
      lang: "es-MX",
      categories: ["business", "productivity"],
      prefer_related_applications: false,
      icons: [
        {
          src: `/pwa/icon?module=${encodeURIComponent(moduleKey)}`,
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    };

    c.header("Content-Type", "application/manifest+json");
    c.header("Cache-Control", "public, max-age=300");
    return c.json(webManifest);
  });

  // GET /pwa/icon?module=atlas.contacts
  // Returns an SVG icon for the module (first letter on module-color background).
  // No auth required — manifest icon refs are fetched by the browser directly.
  router.get("/icon", async (c) => {
    const moduleKey = c.req.query("module");
    if (!moduleKey || typeof moduleKey !== "string" || moduleKey.length > 100) {
      return c.text("Invalid module parameter", 400);
    }

    let manifest = {};
    try {
      const mod = await prisma.atlasModule.findUnique({
        where: { key: moduleKey },
        select: { manifest: true },
      });
      manifest = mod?.manifest ?? {};
    } catch {
      // Serve fallback icon even if DB fails
    }

    const name = manifest.name ?? moduleKey;
    const color = manifest.color ?? "#0A7BFF";
    const svg = generateModuleIcon(name, color);

    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", "public, max-age=3600");
    return c.text(svg);
  });

  return router;
}
