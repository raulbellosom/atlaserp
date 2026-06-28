import NodeCache from "node-cache";

// Central in-process cache. Single-process Hono API — no Redis needed at current scale.
// Interface is intentionally thin so it can be swapped to ioredis/Upstash without changing call sites.
const _cache = new NodeCache({ useClones: false });

export const TTL = {
  BLUEPRINTS: 120,      // 2 min — changes only on module lifecycle events
  PERMISSIONS: 300,     // 5 min — changes only on admin permission writes
  USER_CONTEXT: 300,    // 5 min — extended to avoid thundering herd on concurrent polls
  REFERENCE_DATA: 300,  // 5 min — catalog lookups (brands, types, models, etc.)
};

export function get(key) {
  return _cache.get(key);
}

export function set(key, value, ttlSeconds) {
  _cache.set(key, value, ttlSeconds);
}

export function del(key) {
  _cache.del(key);
}

export function delByPrefix(prefix) {
  _cache.keys()
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => _cache.del(k));
}

export function flush() {
  _cache.flushAll();
}
