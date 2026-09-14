export function resolveHrScreenAccess({ token, userProfile }) {
  if (!token || !userProfile) return "loading";

  if (userProfile?.isAdmin) return "ready";

  const permissions = Array.isArray(userProfile?.permissions)
    ? userProfile.permissions
    : [];

  return permissions.includes("hr.employee.read") ? "ready" : "forbidden";
}
