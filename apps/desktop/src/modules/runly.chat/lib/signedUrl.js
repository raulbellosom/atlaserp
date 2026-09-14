const SIGNED_URL_REFRESH_MARGIN_MS = 5 * 60 * 1000;

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return globalThis.atob(padded);
}

export function getSignedUrlExpiresAt(url) {
  if (!url) return null;

  try {
    const token = new URL(url).searchParams.get("token");
    const payload = token?.split(".")?.[1];
    if (!payload) return null;

    const parsed = JSON.parse(decodeBase64Url(payload));
    return Number.isFinite(parsed?.exp) ? parsed.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isSignedUrlUsable(url, now = Date.now()) {
  if (!url) return false;
  const expiresAt = getSignedUrlExpiresAt(url);
  return expiresAt === null || expiresAt - now > SIGNED_URL_REFRESH_MARGIN_MS;
}
