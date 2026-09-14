import test from "node:test";
import assert from "node:assert/strict";

import {
  canCreateCalendar,
  canManageCalendar,
  canDeleteCalendar,
} from "../calendar-screen-access.js";

test("canDeleteCalendar returns false without delete permission", () => {
  assert.equal(
    canDeleteCalendar({
      userProfile: {
        isAdmin: false,
        permissions: ["calendar.calendars.read", "calendar.calendars.update"],
      },
      calendar: { id: "cal-1", isDefault: false },
    }),
    false,
  );
});

test("canDeleteCalendar returns true for admins on non-default calendars", () => {
  assert.equal(
    canDeleteCalendar({
      userProfile: {
        isAdmin: true,
        permissions: [],
      },
      calendar: { id: "cal-1", isDefault: false },
    }),
    true,
  );
});

test("canDeleteCalendar returns false for default calendars", () => {
  assert.equal(
    canDeleteCalendar({
      userProfile: {
        isAdmin: true,
        permissions: ["calendar.calendars.delete"],
      },
      calendar: { id: "cal-1", isDefault: true },
    }),
    false,
  );
});

test("canManageCalendar maps create, edit and delete permissions", () => {
  const userProfile = {
    isAdmin: false,
    permissions: ["calendar.calendars.create", "calendar.calendars.update"],
  };

  assert.equal(canCreateCalendar(userProfile), true);
  assert.equal(
    canManageCalendar(userProfile, "calendar.calendars.update"),
    true,
  );
  assert.equal(
    canManageCalendar(userProfile, "calendar.calendars.delete"),
    false,
  );
});
