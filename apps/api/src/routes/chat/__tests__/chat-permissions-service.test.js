import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  CHAT_PERMISSIONS,
  DEFAULT_CHANNEL_ROLES,
  roleHasPermission,
  assertHigherPosition,
  ChatPermissionsError,
  createChatPermissionsService,
} from "../chat-permissions-service.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

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

const CONV_ID = "01900000-0000-7000-8000-0000000000c1";
const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const OTHER_PROFILE_ID = "01900000-0000-7000-8000-0000000000p2";
const OWNER_ROLE = { id: "role-owner", name: "Owner", position: 100, isSystem: true, permissions: {} };
const ADMIN_ROLE = { id: "role-admin", name: "Admin", position: 75, isSystem: false, permissions: { "roles.manage": true } };
const MEMBER_ROLE = { id: "role-member", name: "Member", position: 0, isSystem: false, permissions: { "messages.send": true } };

function buildPrismaMock(queryRawResults, executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  const client = {
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => executeRawResults[eIdx++] ?? { count: 1 },
    // Mirrors the real prisma.$transaction shape closely enough for these tests:
    // the callback receives a tx client that shares the same call-order counters,
    // so calls made via tx.$queryRaw/tx.$executeRaw consume from the same
    // queryRawResults/executeRawResults arrays as calls made directly on prisma.
    $transaction: async (fn) => fn(client),
  };
  return client;
}

describe("chat-permissions-service — assertChannelPermission", () => {
  it("throws 404 when the caller is not a member of the conversation", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [], // assertConversationMember: no active membership row
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.listRoles({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 404,
    );
  });
});

describe("chat-permissions-service — createRole", () => {
  it("blocks creating a role at or above the actor's own position (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],       // resolveUserProfileId
      [{ id: "m1" }],             // assertConversationMember
      [ADMIN_ROLE],               // getMemberRole (actor is Admin, position 75)
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Super", position: 90, permissions: {} }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks a duplicate role name in the same conversation (400)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "existing-role" }], // duplicate name lookup finds one
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Admin", position: 10, permissions: {} }),
      (err) => err instanceof ChatPermissionsError && err.status === 400,
    );
  });

  it("creates the role when the actor outranks the requested position", async () => {
    const newRole = { id: "role-new", conversationId: CONV_ID, name: "Support", color: null, position: 10, isSystem: false, permissions: {}, createdAt: new Date(), updatedAt: new Date() };
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [],           // no duplicate
      [newRole],    // insert RETURNING
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.createRole({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, name: "Support", position: 10, permissions: {} });
    assert.equal(result.name, "Support");
  });
});

describe("chat-permissions-service — updateRole", () => {
  it("refuses to modify the system Owner role (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "role-owner", is_system: true, position: 100, name: "Owner" }], // target role
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.updateRole({ conversationId: CONV_ID, roleId: "role-owner", authUserId: AUTH_USER_ID, updates: { name: "Renamed" } }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks a position update that would put the role at or above the actor's own position (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE], // actor: Admin, position 75
      [{ id: "role-custom", is_system: false, position: 10, name: "Custom" }], // target role, actor outranks it
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.updateRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID, updates: { position: 90 } }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks a rename to a name that already exists in the same conversation (400)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "role-custom", is_system: false, position: 10, name: "Custom" }], // target role
      [{ id: "existing-role" }], // duplicate name lookup finds one
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.updateRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID, updates: { name: "Moderator" } }),
      (err) => err instanceof ChatPermissionsError && err.status === 400,
    );
  });

  it("applies a successful partial update that changes only name, leaving permissions intact", async () => {
    const updatedRole = {
      id: "role-custom",
      conversationId: CONV_ID,
      name: "Renamed",
      color: null,
      position: 10,
      isSystem: false,
      permissions: { "messages.send": true },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "role-custom", is_system: false, position: 10, name: "Custom", permissions: { "messages.send": true } }], // target role
      [], // no duplicate name
      [updatedRole], // UPDATE ... RETURNING
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.updateRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID, updates: { name: "Renamed" } });
    assert.equal(result.name, "Renamed");
    assert.deepEqual(result.permissions, { "messages.send": true });
  });

  it("applies a successful position update when the actor outranks both the current and the new position", async () => {
    const updatedRole = {
      id: "role-custom",
      conversationId: CONV_ID,
      name: "Custom",
      color: null,
      position: 20,
      isSystem: false,
      permissions: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE], // actor: Admin, position 75
      [{ id: "role-custom", is_system: false, position: 10, name: "Custom" }], // target role, current position 10
      [updatedRole], // UPDATE ... RETURNING (no name change, so no dupe-check call)
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.updateRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID, updates: { position: 20 } });
    assert.equal(result.position, 20);
  });
});

describe("chat-permissions-service — deleteRole", () => {
  it("refuses to delete the system Owner role (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],
      [{ id: "role-owner", is_system: true, position: 100 }],
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.deleteRole({ conversationId: CONV_ID, roleId: "role-owner", authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("reassigns members holding the deleted role to Member and reports the count", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "m1" }],
        [ADMIN_ROLE],
        [{ id: "role-custom", is_system: false, position: 10 }], // target role
        [{ id: "role-member" }],                                  // fallback Member role lookup
        [{ id: "member-1" }, { id: "member-2" }],                 // UPDATE ... RETURNING id
      ],
    );
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.deleteRole({ conversationId: CONV_ID, roleId: "role-custom", authUserId: AUTH_USER_ID });
    assert.equal(result.reassignedMemberCount, 2);
  });
});

describe("chat-permissions-service — assignMemberRole", () => {
  it("allows self-demotion without the self-hierarchy check blocking it", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],  // resolveUserProfileId (actor)
      [{ id: "m1" }],        // assertConversationMember
      [ADMIN_ROLE],          // getMemberRole (actor)
      [ADMIN_ROLE],          // getMemberRole (target current role — same person, self-demotion)
      [MEMBER_ROLE],         // new role lookup
    ]);
    const svc = createChatPermissionsService({ prisma });
    const result = await svc.assignMemberRole({
      conversationId: CONV_ID,
      memberUserId: PROFILE_ID, // demoting self
      roleId: MEMBER_ROLE.id,
      authUserId: AUTH_USER_ID,
    });
    assert.equal(result.roleId, MEMBER_ROLE.id);
  });

  it("blocks managing a member ranked at or above the actor (403)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],           // actor: Admin (75)
      [ADMIN_ROLE],           // target's current role: also Admin (75) — different person
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: OTHER_PROFILE_ID, roleId: MEMBER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("only an Owner (system role holder) can grant the Owner role", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [ADMIN_ROLE],           // actor: Admin, not system
      [MEMBER_ROLE],          // target's current role
      [OWNER_ROLE],           // the role being granted is Owner (is_system)
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: OTHER_PROFILE_ID, roleId: OWNER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 403,
    );
  });

  it("blocks demoting the last remaining Owner away from the Owner role (400)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "m1" }],
      [OWNER_ROLE],           // actor is the Owner
      [OWNER_ROLE],           // self-demotion target current role: Owner
      [MEMBER_ROLE],          // new role: Member (not system)
      [OWNER_ROLE],           // getMemberRole inside isLastOwner
      [{ count: 1 }],         // COUNT of active system-role holders: only 1
    ]);
    const svc = createChatPermissionsService({ prisma });
    await assert.rejects(
      () => svc.assignMemberRole({ conversationId: CONV_ID, memberUserId: PROFILE_ID, roleId: MEMBER_ROLE.id, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatPermissionsError && err.status === 400,
    );
  });
});

describe("chat-permissions-service — isLastOwner", () => {
  it("returns false when the member does not hold a system role", async () => {
    const prisma = buildPrismaMock([[MEMBER_ROLE]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), false);
  });

  it("returns true when exactly one active system-role holder remains", async () => {
    const prisma = buildPrismaMock([[OWNER_ROLE], [{ count: 1 }]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), true);
  });

  it("returns false when more than one active system-role holder remains", async () => {
    const prisma = buildPrismaMock([[OWNER_ROLE], [{ count: 2 }]]);
    const svc = createChatPermissionsService({ prisma });
    assert.equal(await svc.isLastOwner(CONV_ID, PROFILE_ID), false);
  });
});
