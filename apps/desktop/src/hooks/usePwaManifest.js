import { useEffect, useRef } from "react";

// Render an SVG data URI onto a 180x180 canvas and return a PNG data URI.
// iOS Safari requires a raster image for <link rel="apple-touch-icon">;
// SVG data URIs are not accepted. Returns null on any failure.
function svgDataUriToPng(svgDataUri) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 180;
        canvas.height = 180;
        canvas.getContext("2d").drawImage(img, 0, 0, 180, 180);
        resolve(canvas.toDataURL("image/png"));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = svgDataUri;
  });
}

// Static SVG path data extracted from lucide-react v1.17.0 (ISC license).
// Maps PascalCase icon name to Lucide __iconNode array.
// Only includes icons actually referenced as module-level icons in Atlas manifests.
const LUCIDE_ICON_NODES = {
  Activity: [
    ["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2" }],
  ],
  BarChart3: [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
    ["path", { d: "M18 17V9" }],
    ["path", { d: "M13 17V5" }],
    ["path", { d: "M8 17v-3" }],
  ],
  Bell: [
    ["path", { d: "M10.268 21a2 2 0 0 0 3.464 0" }],
    ["path", { d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" }],
  ],
  BookOpen: [
    ["path", { d: "M12 7v14" }],
    ["path", { d: "M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" }],
  ],
  Building2: [
    ["path", { d: "M10 12h4" }],
    ["path", { d: "M10 8h4" }],
    ["path", { d: "M14 21v-3a2 2 0 0 0-4 0v3" }],
    ["path", { d: "M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2" }],
    ["path", { d: "M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" }],
  ],
  Calendar: [
    ["path", { d: "M8 2v4" }],
    ["path", { d: "M16 2v4" }],
    ["rect", { width: "18", height: "18", x: "3", y: "4", rx: "2" }],
    ["path", { d: "M3 10h18" }],
  ],
  ClipboardList: [
    ["rect", { width: "8", height: "4", x: "8", y: "2", rx: "1" }],
    ["path", { d: "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" }],
    ["path", { d: "M12 11h4" }],
    ["path", { d: "M12 16h4" }],
    ["path", { d: "M8 11h.01" }],
    ["path", { d: "M8 16h.01" }],
  ],
  Contact: [
    ["path", { d: "M16 2v2" }],
    ["path", { d: "M7 22v-2a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v2" }],
    ["path", { d: "M8 2v2" }],
    ["circle", { cx: "12", cy: "11", r: "3" }],
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }],
  ],
  ContactRound: [
    ["path", { d: "M16 2v2" }],
    ["path", { d: "M17.915 22a6 6 0 0 0-12 0" }],
    ["path", { d: "M8 2v2" }],
    ["circle", { cx: "12", cy: "12", r: "4" }],
    ["rect", { x: "3", y: "4", width: "18", height: "18", rx: "2" }],
  ],
  FolderOpen: [
    ["path", { d: "m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2" }],
  ],
  Globe: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }],
    ["path", { d: "M2 12h20" }],
  ],
  Landmark: [
    ["path", { d: "M10 18v-7" }],
    ["path", { d: "M11.119 2.205a2 2 0 0 1 1.762 0l7.84 3.846A.5.5 0 0 1 20.5 7h-17a.5.5 0 0 1-.22-.949z" }],
    ["path", { d: "M14 18v-7" }],
    ["path", { d: "M18 18v-7" }],
    ["path", { d: "M3 22h18" }],
    ["path", { d: "M6 18v-7" }],
  ],
  LayoutDashboard: [
    ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1" }],
    ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1" }],
  ],
  Layers: [
    ["path", { d: "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z" }],
    ["path", { d: "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12" }],
    ["path", { d: "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17" }],
  ],
  Network: [
    ["rect", { x: "16", y: "16", width: "6", height: "6", rx: "1" }],
    ["rect", { x: "2", y: "16", width: "6", height: "6", rx: "1" }],
    ["rect", { x: "9", y: "2", width: "6", height: "6", rx: "1" }],
    ["path", { d: "M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3" }],
    ["path", { d: "M12 12V8" }],
  ],
  Shield: [
    ["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }],
  ],
  ShieldCheck: [
    ["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" }],
    ["path", { d: "m9 12 2 2 4-4" }],
  ],
  ShoppingBag: [
    ["path", { d: "M16 10a4 4 0 0 1-8 0" }],
    ["path", { d: "M3.103 6.034h17.794" }],
    ["path", { d: "M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z" }],
  ],
  ShoppingCart: [
    ["circle", { cx: "8", cy: "21", r: "1" }],
    ["circle", { cx: "19", cy: "21", r: "1" }],
    ["path", { d: "M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" }],
  ],
  SquareKanban: [
    ["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2" }],
    ["path", { d: "M8 7v7" }],
    ["path", { d: "M12 7v4" }],
    ["path", { d: "M16 7v9" }],
  ],
  Truck: [
    ["path", { d: "M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" }],
    ["path", { d: "M15 18H9" }],
    ["path", { d: "M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" }],
    ["circle", { cx: "17", cy: "18", r: "2" }],
    ["circle", { cx: "7", cy: "18", r: "2" }],
  ],
  UserCheck: [
    ["path", { d: "m16 11 2 2 4-4" }],
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
  ],
  Users: [
    ["path", { d: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" }],
    ["path", { d: "M16 3.128a4 4 0 0 1 0 7.744" }],
    ["path", { d: "M22 21v-2a4 4 0 0 0-3-3.87" }],
    ["circle", { cx: "9", cy: "7", r: "4" }],
  ],
  UsersRound: [
    ["path", { d: "M18 21a8 8 0 0 0-16 0" }],
    ["circle", { cx: "10", cy: "8", r: "5" }],
    ["path", { d: "M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3" }],
  ],
};

// Serialize a Lucide __iconNode array to SVG element strings.
// The "key" attribute is Lucide-internal and must be omitted.
function serializeIconNodes(nodes) {
  return nodes
    .map(([tag, attrs]) => {
      const attrStr = Object.entries(attrs)
        .filter(([k]) => k !== "key")
        .map(([k, v]) => `${k}="${v}"`)
        .join(" ");
      return `<${tag} ${attrStr}/>`;
    })
    .join("");
}

// Generates a PWA icon as an inline SVG data URI — no network request, no CORS, works offline.
// Uses the actual Lucide icon shape when available, falls back to first letter.
function generateIconDataUri(name, color, lucideIconName) {
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(color ?? "") ? color : "#0A7BFF";
  const iconNodes = lucideIconName ? LUCIDE_ICON_NODES[lucideIconName] : null;

  let innerContent;
  if (iconNodes) {
    // Lucide icons are drawn on a 24×24 canvas.
    // Scale to 336px and center in the 512×512 PWA icon canvas (88px margin each side).
    const scale = 14;
    const offset = (512 - 24 * scale) / 2;
    innerContent =
      `<g transform="translate(${offset} ${offset}) scale(${scale})" ` +
      `stroke="white" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">` +
      serializeIconNodes(iconNodes) +
      `</g>`;
  } else {
    const initial = (name || "A")
      .charAt(0)
      .toUpperCase()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    innerContent = `<text x="256" y="370" text-anchor="middle" fill="white" font-size="300" font-family="Arial,Helvetica,sans-serif" font-weight="bold">${initial}</text>`;
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">` +
    `<rect width="512" height="512" rx="112" fill="${bg}"/>` +
    innerContent +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}


// Updates <link rel="manifest"> to a module-specific URL served by the Service
// Worker, which allows "Add to Home Screen" on both iOS and Android to install
// the module at its own start_url. Also updates Apple-specific head tags for
// iOS Safari, which reads those directly instead of using the manifest icons/name.
export function usePwaManifest(moduleKey, activeModule) {
  const originalManifestHrefRef = useRef(null);

  // Apple meta restore state — saved on first module activation, never overwritten
  // until the user leaves all modules, so we always restore to the pre-module values.
  const appleTitleMetaRef = useRef(null);   // the <meta name="apple-mobile-web-app-title"> element
  const appleTitlePrevRef = useRef(null);   // its content before we changed it
  const touchIconLinkRef = useRef(null);    // the <link rel="apple-touch-icon"> element
  const touchIconPrevRef = useRef(null);    // its href before we changed it

  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (!manifestLink) return;

    if (!moduleKey) {
      // Restore manifest href
      if (originalManifestHrefRef.current !== null) {
        manifestLink.href = originalManifestHrefRef.current;
        originalManifestHrefRef.current = null;
      }
      // Restore Apple title meta
      if (appleTitleMetaRef.current) {
        appleTitleMetaRef.current.content = appleTitlePrevRef.current ?? "Atlas ERP";
        appleTitleMetaRef.current = null;
        appleTitlePrevRef.current = null;
      }
      // Restore apple-touch-icon href
      if (touchIconLinkRef.current && touchIconPrevRef.current !== null) {
        touchIconLinkRef.current.setAttribute("href", touchIconPrevRef.current);
        touchIconLinkRef.current = null;
        touchIconPrevRef.current = null;
      }
      return;
    }

    // Save original manifest href (once — don't overwrite on module-to-module navigation)
    if (originalManifestHrefRef.current === null) {
      originalManifestHrefRef.current = manifestLink.href;
    }

    const name = activeModule?.name ?? moduleKey;
    const color = /^#[0-9a-fA-F]{3,8}$/.test(activeModule?.color ?? "") ? activeModule.color : "#0A7BFF";
    const lucideIconName = activeModule?.icon ?? null;
    const svgUri = generateIconDataUri(name, color, lucideIconName);

    // Point the manifest link to a real URL that the Service Worker intercepts.
    // This works on both iOS Safari and Android Chrome — no blob: URL needed.
    manifestLink.href = `/site.webmanifest?m=${encodeURIComponent(moduleKey)}`;

    // Notify the Service Worker so it can serve the full manifest (name, icon, color).
    // Falls back gracefully: if the SW hasn't started yet, the SW builds a minimal
    // manifest from the module key alone (still has the correct start_url).
    const swController = navigator.serviceWorker?.controller;
    if (swController) {
      swController.postMessage({
        type: "SET_MODULE",
        key: moduleKey,
        name,
        color,
        shortName: name.length <= 14 ? name : name.slice(0, 14),
        description: activeModule?.description ?? "",
        logoUrl: activeModule?.logoUrl ?? null,
        iconSvgDataUri: svgUri,
      });
    }

    // --- iOS Safari: update Apple-specific head tags ---
    // iOS reads these at "Add to Home Screen" time rather than the manifest icons/name.
    const titleMeta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
    if (titleMeta) {
      if (appleTitleMetaRef.current === null) {
        appleTitleMetaRef.current = titleMeta;
        appleTitlePrevRef.current = titleMeta.content;
      }
      titleMeta.content = name;
    }

    // Update <link rel="apple-touch-icon"> with a canvas-rendered PNG.
    // The canvas conversion is async — cancel if the module changes before it finishes.
    let cancelled = false;
    svgDataUriToPng(svgUri).then((pngUri) => {
      if (cancelled || !pngUri) return;
      const touchIcon = document.querySelector('link[rel="apple-touch-icon"]');
      if (!touchIcon) return;
      if (touchIconLinkRef.current === null) {
        touchIconLinkRef.current = touchIcon;
        touchIconPrevRef.current = touchIcon.getAttribute("href");
      }
      touchIcon.setAttribute("href", pngUri);
    });

    return () => { cancelled = true; };
  }, [moduleKey, activeModule]);

  // Cleanup on unmount: restore everything
  useEffect(() => {
    return () => {
      const manifestLink = document.querySelector('link[rel="manifest"]');
      if (manifestLink && originalManifestHrefRef.current !== null) {
        manifestLink.href = originalManifestHrefRef.current;
      }
      if (appleTitleMetaRef.current) {
        appleTitleMetaRef.current.content = appleTitlePrevRef.current ?? "Atlas ERP";
      }
      if (touchIconLinkRef.current && touchIconPrevRef.current !== null) {
        touchIconLinkRef.current.setAttribute("href", touchIconPrevRef.current);
      }
    };
  }, []);
}
