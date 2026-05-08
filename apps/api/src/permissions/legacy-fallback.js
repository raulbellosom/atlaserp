export function resolveLegacyFallback(granularKey) {
  const parts = String(granularKey ?? "").split(".");
  if (parts.length !== 3) return null;

  const [moduleKey, featureKey, action] = parts;
  if (!moduleKey || !featureKey || !action) return null;
  if (["read", "create", "update", "delete"].includes(action)) {
    return `${moduleKey}.${action}`;
  }
  return null;
}
