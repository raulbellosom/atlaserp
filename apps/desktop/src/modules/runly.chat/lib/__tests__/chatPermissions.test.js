import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { CHAT_PERMISSIONS, roleHasPermission, findOwnMember } from "../chatPermissions.js";

describe("chatPermissions — roleHasPermission", () => {
  it("returns false for a null/undefined member", () => {
    assert.equal(roleHasPermission(null, CHAT_PERMISSIONS.MEMBERS_MANAGE), false);
    assert.equal(roleHasPermission(undefined, CHAT_PERMISSIONS.MEMBERS_MANAGE), false);
  });

  it("returns true for any permission when the member's role is a system role (Owner)", () => {
    const member = { roleIsSystem: true, rolePermissions: {} };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.CHANNEL_MANAGE), true);
  });

  it("checks rolePermissions for a non-system role", () => {
    const member = { roleIsSystem: false, rolePermissions: { "members.manage": true } };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.MEMBERS_MANAGE), true);
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.CHANNEL_MANAGE), false);
  });

  it("returns false when rolePermissions is missing entirely (e.g. direct/external_support members)", () => {
    const member = { roleIsSystem: false, rolePermissions: undefined };
    assert.equal(roleHasPermission(member, CHAT_PERMISSIONS.MESSAGES_SEND), false);
  });
});

describe("chatPermissions — findOwnMember", () => {
  it("finds the member matching the current user's id", () => {
    const members = [{ userId: "u1" }, { userId: "u2" }];
    assert.deepEqual(findOwnMember(members, "u2"), { userId: "u2" });
  });

  it("returns null when there is no match or members is empty/undefined", () => {
    assert.equal(findOwnMember([{ userId: "u1" }], "u2"), null);
    assert.equal(findOwnMember(undefined, "u2"), null);
    assert.equal(findOwnMember([], "u2"), null);
  });
});
