// The same logical notification reaches the browser twice: once over the
// Supabase realtime `notification.new` broadcast (in-app channel) and once
// over web-push (service worker -> postMessage). Both surfaces toast, so the
// user sees every alert doubled. This shared, module-level guard collapses
// them: whichever handler fires first "claims" the key for a short window and
// the other one skips.

const seen = new Map(); // key -> expiry timestamp

// A content key that both delivery paths can compute identically. dedupeKey is
// preferred when present (the API sets it per logical event); otherwise the
// eventType + title + body triple is stable across the two channels.
export function notificationKey(n) {
  if (!n) return null;
  if (n.dedupeKey) return `dk:${n.dedupeKey}`;
  const parts = [n.eventType ?? "", n.title ?? "", n.body ?? ""];
  if (!parts.some(Boolean)) return null;
  return `c:${parts.join("|")}`;
}

export function claimNotification(key, windowMs = 6000) {
  if (!key) return true; // no key -> can't dedupe, let it through
  const now = Date.now();
  if (seen.size > 200) {
    for (const [k, exp] of seen) if (exp < now) seen.delete(k);
  }
  const exp = seen.get(key);
  if (exp && exp > now) return false; // already claimed by the other surface
  seen.set(key, now + windowMs);
  return true;
}
