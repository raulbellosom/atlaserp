// Pure helpers for additive per-user permission grants (ALLOW-only).
// Effective permissions for a user = (role permissions) ∪ (grants). Never
// subtracts. Kept side-effect-free so it can be unit-tested with node --test.
// Spec: docs/superpowers/specs/2026-09-08-per-user-permission-grants.md

function toSet(v) {
  return v instanceof Set ? v : new Set(v ?? []);
}

// The keys that are worth persisting as a grant: requested AND currently active
// AND not already provided by the user's role(s) (a grant duplicating the role
// is noise). Order-preserving, de-duplicated.
export function filterGrantableKeys({ requestedKeys, activeKeys, roleKeys }) {
  const active = toSet(activeKeys);
  const role = toSet(roleKeys);
  const seen = new Set();
  const out = [];
  for (const k of requestedKeys ?? []) {
    if (typeof k !== "string" || !k) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!active.has(k)) continue;
    if (role.has(k)) continue;
    out.push(k);
  }
  return out;
}

// A non-admin manager may only hand out permissions their own account already
// holds. Returns the subset of targetKeys that would escalate beyond what the
// actor has ([] when the actor is an admin).
export function findEscalatingKeys({ targetKeys, actorHeldKeys, actorIsAdmin }) {
  if (actorIsAdmin) return [];
  const held = toSet(actorHeldKeys);
  return (targetKeys ?? []).filter((k) => !held.has(k));
}

// What changed between the persisted grant set and the requested one.
export function diffGrantKeys({ existingKeys, nextKeys }) {
  const existing = toSet(existingKeys);
  const next = toSet(nextKeys);
  return {
    added: [...next].filter((k) => !existing.has(k)),
    removed: [...existing].filter((k) => !next.has(k)),
  };
}

// The effective permission key set: base ∪ role ∪ active grants.
export function mergeEffectiveKeys({ baseKeys, roleKeys, grantKeys }) {
  const out = new Set(toSet(baseKeys));
  for (const k of toSet(roleKeys)) out.add(k);
  for (const k of toSet(grantKeys)) out.add(k);
  return out;
}
