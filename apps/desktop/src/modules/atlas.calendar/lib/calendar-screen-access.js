function hasPermission(userProfile, permissionKey) {
  if (!permissionKey) return false;
  if (userProfile?.isAdmin) return true;

  const permissions = Array.isArray(userProfile?.permissions)
    ? userProfile.permissions
    : [];

  return permissions.includes(permissionKey);
}

export function canCreateCalendar(userProfile) {
  return hasPermission(userProfile, "calendar.calendars.create");
}

export function canManageCalendar(userProfile, permissionKey) {
  return hasPermission(userProfile, permissionKey);
}

export function canDeleteCalendar({ userProfile, calendar }) {
  if (!calendar || calendar.isDefault) return false;
  return hasPermission(userProfile, "calendar.calendars.delete");
}
