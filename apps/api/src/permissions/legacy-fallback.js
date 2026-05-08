export function resolveLegacyFallback(granularKey) {
  const key = String(granularKey ?? "").trim();
  if (!key) return null;

  const explicitFallback = {
    "core.access": "core.read",
    "core.modules.read": "modules.read",
    "core.modules.create": "modules.install",
    "core.modules.update": "modules.disable",
    "core.modules.delete": "modules.uninstall",
    "core.instance.read": "core.manage",
    "core.instance.create": "core.manage",
    "core.instance.update": "core.manage",
    "core.instance.delete": "core.manage",
    "identity.access": "identity.read",
    "identity.users.read": "identity.read",
    "identity.users.create": "identity.manage",
    "identity.users.update": "identity.manage",
    "identity.users.delete": "identity.manage",
    "identity.roles.read": "roles.read",
    "identity.roles.create": "roles.manage",
    "identity.roles.update": "roles.manage",
    "identity.roles.delete": "roles.manage",
    "identity.permissions.read": "permissions.read",
    "identity.permissions.create": "permissions.manage",
    "identity.permissions.update": "permissions.manage",
    "identity.permissions.delete": "permissions.manage",
    "files.access": "files.read",
    "files.assets.read": "files.read",
    "files.assets.create": "files.upload",
    "files.assets.update": "files.manage",
    "files.assets.delete": "files.delete",
    "company.access": "company.read",
    "company.profile.read": "company.read",
    "company.profile.create": "company.manage",
    "company.profile.update": "company.manage",
    "company.profile.delete": "company.manage",
    "company.address.read": "company.read",
    "company.address.create": "company.manage",
    "company.address.update": "company.manage",
    "company.address.delete": "company.manage",
    "company.branding.read": "company.read",
    "company.branding.create": "company.manage",
    "company.branding.update": "company.manage",
    "company.branding.delete": "company.manage",
    "contacts.access": "contacts.read",
    "contacts.contacts.read": "contacts.read",
    "contacts.contacts.create": "contacts.create",
    "contacts.contacts.update": "contacts.update",
    "contacts.contacts.delete": "contacts.delete",
    "finance.access": "finance.read",
    "hr.access": "hr.read",
    "hr.employee.read": "hr.read",
    "hr.employee.create": "hr.create",
    "hr.employee.update": "hr.update",
    "hr.employee.delete": "hr.delete",
    "hr.department.read": "hr.read",
    "hr.department.create": "hr.create",
    "hr.department.update": "hr.update",
    "hr.department.delete": "hr.delete",
    "hr.job_title.read": "hr.read",
    "hr.job_title.create": "hr.create",
    "hr.job_title.update": "hr.update",
    "hr.job_title.delete": "hr.delete",
    "hr.org_chart.read": "hr.read",
    "hr.org_chart.create": "hr.create",
    "hr.org_chart.update": "hr.update",
    "hr.org_chart.delete": "hr.delete",
  };

  if (explicitFallback[key]) {
    return explicitFallback[key];
  }

  const parts = key.split(".");
  if (parts.length !== 3) return null;

  const [moduleKey, featureKey, action] = parts;
  if (!moduleKey || !featureKey || !action) return null;
  if (["read", "create", "update", "delete"].includes(action)) {
    return `${moduleKey}.${action}`;
  }
  return null;
}

export function hasPermissionWithLegacyFallback(
  permissionSet,
  permissionKey,
  fallbackEnabled = true,
) {
  if (!permissionSet || !permissionKey) return false;
  if (permissionSet.has(permissionKey)) return true;
  if (!fallbackEnabled) return false;

  const legacyKey = resolveLegacyFallback(permissionKey);
  if (!legacyKey) return false;
  return permissionSet.has(legacyKey);
}

export function hasAnyPermissionWithLegacyFallback(
  permissionSet,
  permissionKeys = [],
  fallbackEnabled = true,
) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [];
  return keys.some((permissionKey) =>
    hasPermissionWithLegacyFallback(permissionSet, permissionKey, fallbackEnabled),
  );
}
