import { useEffect } from "react";

export function getPwaManifestHref(moduleKey) {
  return moduleKey
    ? `/pwa/manifest/${encodeURIComponent(moduleKey)}.webmanifest`
    : "/site.webmanifest";
}

export function getPwaIconHref(moduleKey) {
  return moduleKey
    ? `/pwa/icon/${encodeURIComponent(moduleKey)}/192.png`
    : "/apple-touch-icon.png";
}

export function usePwaManifest(moduleKey, activeModule) {
  useEffect(() => {
    const manifestLink = document.querySelector('link[rel="manifest"]');
    const touchIconLink = document.querySelector('link[rel="apple-touch-icon"]');
    const appleTitleMeta = document.querySelector(
      'meta[name="apple-mobile-web-app-title"]',
    );
    const themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (manifestLink) {
      manifestLink.href = getPwaManifestHref(moduleKey);
      manifestLink.dataset.moduleKey = moduleKey ?? "";
    }

    if (touchIconLink) {
      touchIconLink.href = getPwaIconHref(moduleKey);
    }

    if (appleTitleMeta) {
      appleTitleMeta.content = moduleKey
        ? (activeModule?.pwa?.shortName ?? activeModule?.name ?? moduleKey)
        : "Atlas ERP";
    }

    if (themeColorMeta) {
      themeColorMeta.content = moduleKey
        ? (activeModule?.color ?? "#102A5E")
        : "#102A5E";
    }
  }, [
    activeModule?.color,
    activeModule?.name,
    activeModule?.pwa?.shortName,
    moduleKey,
  ]);
}
