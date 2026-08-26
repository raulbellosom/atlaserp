// A session is "fresh enough to adopt" if its expires_at is still in the
// future by at least a small margin — mirrors the backend's own
// JWT_CLOCK_SKEW_LEEWAY_SECS leeway (apps/api/src/services/jwt-verification.js)
// so both sides agree on what counts as "not actually expired."
// Plain .js (no JSX) so it can be imported by node --test without a JSX transform.
export const SESSION_FRESHNESS_LEEWAY_SECS = 10;

export function isSessionFresh(session, nowMs = Date.now()) {
  if (!session?.expires_at) return false;
  const expiresAtMs = session.expires_at * 1000;
  return expiresAtMs > nowMs + SESSION_FRESHNESS_LEEWAY_SECS * 1000;
}
