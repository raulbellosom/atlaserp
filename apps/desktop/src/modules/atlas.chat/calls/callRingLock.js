// Cross-tab lock so an incoming call rings in ONE tab of this browser, not all
// of them. localStorage is shared across same-origin tabs; the holder writes a
// heartbeat and other tabs stay silent while it's fresh. If the holder tab
// dies, the lock goes stale and another tab can take over.

const KEY = "atlas-call-ring-lock";
const STALE_MS = 4000;

// A stable id for this tab, for this page load.
export const TAB_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(value) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Try to become the ringing tab for `callId`. Returns true if we hold it.
export function acquireRingLock(callId) {
  if (!callId) return false;
  const cur = read();
  const now = Date.now();
  const fresh = cur && now - (cur.ts ?? 0) < STALE_MS;
  if (fresh && cur.callId === callId && cur.tabId !== TAB_ID) return false; // another tab owns it
  return write({ callId, tabId: TAB_ID, ts: now });
}

export function refreshRingLock(callId) {
  const cur = read();
  if (cur && cur.callId === callId && cur.tabId === TAB_ID) {
    write({ callId, tabId: TAB_ID, ts: Date.now() });
  }
}

export function releaseRingLock(callId) {
  const cur = read();
  if (cur && cur.tabId === TAB_ID && (!callId || cur.callId === callId)) {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  }
}

export function ringLockIsMine(callId) {
  const cur = read();
  return Boolean(cur && cur.callId === callId && cur.tabId === TAB_ID);
}
