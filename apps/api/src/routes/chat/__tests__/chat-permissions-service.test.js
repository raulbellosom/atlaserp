import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_PERMISSIONS,
  DEFAULT_CHANNEL_ROLES,
  roleHasPermission,
  assertHigherPosition,
  ChatPermissionsError,
} from "../chat-permissions-service.js";

describe("chat-permissions-service — pure helpers", () => {
  it("DEFAULT_CHANNEL_ROLES has exactly 4 roles with the expected positions", () => {
    assert.equal(DEFAULT_CHANNEL_ROLES.length, 4);
    const byName = Object.fromEntries(DEFAULT_CHANNEL_ROLES.map((r) => [r.name, r]));
    assert.equal(byName.Owner.position, 100);
    assert.equal(byName.Owner.isSystem, true);
    assert.equal(byName.Admin.position, 75);
    assert.equal(byName.Moderator.position, 50);
    assert.equal(byName.Member.position, 0);
    assert.equal(byName.Admin.isSystem, false);
    assert.equal(byName.Moderator.isSystem, false);
    assert.equal(byName.Member.isSystem, false);
  });

  it("Owner's permissions object grants every key in CHAT_PERMISSIONS", () => {
    const owner = DEFAULT_CHANNEL_ROLES.find((r) => r.name === "Owner");
    for (const key of Object.values(CHAT_PERMISSIONS)) {
      assert.equal(owner.permissions[key], true, `Owner should grant ${key}`);
    }
  });

  it("Member only grants messages.send", () => {
    const member = DEFAULT_CHANNEL_ROLES.find((r) => r.name === "Member");
    assert.deepEqual(Object.keys(member.permissions), [CHAT_PERMISSIONS.MESSAGES_SEND]);
  });

  it("roleHasPermission returns false for a null role", () => {
    assert.equal(roleHasPermission(null, CHAT_PERMISSIONS.MESSAGES_SEND), false);
  });

  it("roleHasPermission always returns true for a system (Owner) role, regardless of its permissions object", () => {
    const role = { isSystem: true, permissions: {} };
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.CHANNEL_MANAGE), true);
  });

  it("roleHasPermission checks the permissions map for a non-system role", () => {
    const role = { isSystem: false, permissions: { [CHAT_PERMISSIONS.MESSAGES_SEND]: true } };
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.MESSAGES_SEND), true);
    assert.equal(roleHasPermission(role, CHAT_PERMISSIONS.CHANNEL_MANAGE), false);
  });

  it("assertHigherPosition throws ChatPermissionsError(403) when actor position is not strictly higher", () => {
    assert.throws(
      () => assertHigherPosition(50, 50),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
    assert.throws(
      () => assertHigherPosition(0, 50),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("assertHigherPosition does not throw when actor position is strictly higher", () => {
    assert.doesNotThrow(() => assertHigherPosition(75, 50));
  });
});
