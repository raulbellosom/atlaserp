export function resolveLegacyFallback(granularKey) {
  const [moduleKey, , action] = String(granularKey ?? "").split(".");
  if (!moduleKey || !action) return null;
  if (["read", "create", "update", "delete"].includes(action)) {
    return `${moduleKey}.${action}`;
  }
  return null;
}
