export function moduleAccessKey(moduleKey) {
  return `${moduleKey}.access`;
}

export function featureCrudKeys(moduleKey, featureKey) {
  return ["read", "create", "update", "delete"].map(
    (action) => `${moduleKey}.${featureKey}.${action}`,
  );
}

export function ensureUniquePermissionKeys(keys = []) {
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) {
      throw new Error(`Permiso duplicado detectado: ${key}`);
    }
    seen.add(key);
  }
  return [...seen];
}
