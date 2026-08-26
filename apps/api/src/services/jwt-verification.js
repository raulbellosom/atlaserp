import crypto from "node:crypto";

// Small clock-skew tolerance for JWT expiry checks. Without this, a background
// PWA module window whose access token expires by only a few seconds (e.g. after
// system sleep, where setTimeout-based refresh timers are unreliable) gets an
// immediate 401 instead of a chance to refresh. Kept small (seconds, not minutes)
// so it does not meaningfully weaken the real expiration guarantee.
export const JWT_CLOCK_SKEW_LEEWAY_SECS = 10;

// Verify a Supabase HS256 JWT locally without a network call.
// Returns the payload if valid, null otherwise.
export function verifySupabaseJwt(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${headerB64}.${payloadB64}`)
      .digest("base64url");

    const expectedBuf = Buffer.from(expectedSig);
    const receivedBuf = Buffer.from(signatureB64);
    // timingSafeEqual requires identical lengths; mismatch means invalid signature
    if (expectedBuf.length !== receivedBuf.length) return null;
    if (!crypto.timingSafeEqual(expectedBuf, receivedBuf)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp + JWT_CLOCK_SKEW_LEEWAY_SECS <= now) return null;
    return payload;
  } catch {
    return null;
  }
}
