// Builds the { profileId, companyId, isAdmin, permissionSet } shape services
// like files-service.js expect, from what requirePermission/requireAnyPermission
// already resolved and set on the Hono context (c.get("userId"),
// c.get("companyId"), c.get("tenantContext")) — so a service never has to
// re-derive "the current company" (or admin/permission status) on its own.
// See docs/superpowers/specs/2026-09-10-multi-tenant-architecture-design.md §5.
export function tenantActiveContext(c) {
  const tenant = c.get("tenantContext");
  return {
    profileId: c.get("userId") ?? null,
    companyId: c.get("companyId") ?? null,
    isAdmin: Boolean(tenant?.isAdmin),
    permissionSet: tenant?.permissionSet,
  };
}
