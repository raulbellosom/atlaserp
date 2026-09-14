import test from "node:test";
import assert from "node:assert/strict";

import { resolveHrScreenAccess } from "../hr-screen-access.js";

test("resolveHrScreenAccess keeps hr screen in loading while auth context is incomplete", () => {
  assert.equal(
    resolveHrScreenAccess({ token: null, userProfile: null }),
    "loading",
  );

  assert.equal(
    resolveHrScreenAccess({
      token: "token-123",
      userProfile: null,
    }),
    "loading",
  );
});

test("resolveHrScreenAccess denies access when profile exists without hr read permission", () => {
  assert.equal(
    resolveHrScreenAccess({
      token: "token-123",
      userProfile: {
        isAdmin: false,
        permissions: ["contacts.contacts.read"],
      },
    }),
    "forbidden",
  );
});

test("resolveHrScreenAccess allows admins and users with hr read permission", () => {
  assert.equal(
    resolveHrScreenAccess({
      token: "token-123",
      userProfile: {
        isAdmin: true,
        permissions: [],
      },
    }),
    "ready",
  );

  assert.equal(
    resolveHrScreenAccess({
      token: "token-123",
      userProfile: {
        isAdmin: false,
        permissions: ["hr.employee.read"],
      },
    }),
    "ready",
  );
});
