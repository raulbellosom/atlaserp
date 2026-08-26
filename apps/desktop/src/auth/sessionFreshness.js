// A session is "fresh enough to adopt" if its expires_at is still in the
// future by at least a small margin. Same 10s constant as the backend's
// JWT_CLOCK_SKEW_LEEWAY_SECS (apps/api/src/services/jwt-verification.js),
// but applied in the opposite direction by design: the backend widens what
// it accepts *past* a token's exp (a small grace period after expiry), while
// this requires margin *before* expires_at (won't trust a session that's
// about to expire). Not a mirror of the same check — a deliberately
// different, matching-sized margin on each side of the same boundary.
// Plain .js (no JSX) so it can be imported by node --test without a JSX transform.
export const SESSION_FRESHNESS_LEEWAY_SECS = 10;

export function isSessionFresh(session, nowMs = Date.now()) {
  if (!session?.expires_at) return false;
  const expiresAtMs = session.expires_at * 1000;
  return expiresAtMs > nowMs + SESSION_FRESHNESS_LEEWAY_SECS * 1000;
}
