// Prepend older message pages onto the latest page, de-duped by id, keeping
// chronological (older-first) order. Pure — kept in its own module so it can be
// unit-tested with the Node test runner without pulling in the hook's
// Vite-only transitive imports.
export function mergeExternalPages(older, latest) {
  if (!older.length) return latest;
  const seen = new Set(older.map((m) => m.id));
  return [...older, ...latest.filter((m) => !seen.has(m.id))];
}
