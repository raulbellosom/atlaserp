import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatService,
  ChatServiceError,
  _resetProfileIdCacheForTests,
} from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const OTHER_PROFILE_ID = "01900000-0000-7000-8000-0000000000p2";
const CONV_ID = "01900000-0000-7000-8000-0000000000c1";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

// Mirrors the buildPrismaMock convention used in chat-permissions-service.test.js
// and channel-directory-service.test.js: a fixed-sequence array of results consumed
// in call order for $queryRaw / $executeRaw, plus a $transaction that shares the
// same counters (so calls inside the callback consume from the same arrays) and
// a _transactionCallCount so a test can prove the wrapper wasn't silently dropped.
function buildPrismaMock(queryRawResults = [], executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  const client = {
    _transactionCallCount: 0,
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => executeRawResults[eIdx++] ?? { count: 1 },
    $transaction: async (fn) => {
      client._transactionCallCount++;
      return fn(client);
    },
    membership: {
      findFirst: async () => null,
    },
  };
  return client;
}

function throwingAssertChannelPermission() {
  throw new Error("assertChannelPermission should not have been called");
}

describe("chat-service — updateConversation permission enforcement", () => {
  it("channel: calls assertChannelPermission with channel.manage and propagates a 403 rejection", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: "member-row" }], // assertMember
      [{ type: "channel" }], // conversation type lookup
    ]);
    let calledWith = null;
    const permissionsService = {
      assertChannelPermission: async (convId, profileId, key) => {
        calledWith = { convId, profileId, key };
        const err = new Error("No tienes permiso para realizar esta accion.");
        err.status = 403;
        throw err;
      },
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.updateConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { title: "New" } }),
      (err) => err.status === 403,
    );
    assert.deepEqual(calledWith, { convId: CONV_ID, profileId: PROFILE_ID, key: "channel.manage" });
  });

  it("channel: succeeds when assertChannelPermission resolves", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: "member-row" }], // assertMember (updateConversation)
      [{ type: "channel" }], // conversation type lookup
      [{ id: "member-row-2" }], // assertMember (inside the trailing getConversation call)
      [{ id: CONV_ID, title: "New", members: null }], // SELECT c.*, members inside getConversation
    ]);
    const permissionsService = {
      assertChannelPermission: async () => ({ position: 100, isSystem: true }),
    };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.updateConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { title: "New" } });
    assert.equal(result.title, "New");
  });

  it("direct: never calls assertChannelPermission — behavior unaffected", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }], // assertMember (updateConversation)
      [{ type: "direct" }], // conversation type lookup
      [{ id: "member-row-2" }], // assertMember (inside the trailing getConversation call)
      [{ id: CONV_ID, title: "New", members: null }], // SELECT c.*, members inside getConversation
    ]);
    const permissionsService = { assertChannelPermission: throwingAssertChannelPermission };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.updateConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { title: "New" } });
    assert.equal(result.title, "New");
  });

  it("no permissionsService supplied: behavior unchanged (no type lookup, no permission check)", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }], // assertMember (updateConversation)
      // no conversation-type lookup call expected — straight to the UPDATE + getConversation
      [{ id: "member-row-2" }], // assertMember (inside the trailing getConversation call)
      [{ id: CONV_ID, title: "New", members: null }], // SELECT c.*, members inside getConversation
    ]);
    const svc = createChatService({ prisma, permissionsService: null });
    const result = await svc.updateConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, updates: { title: "New" } });
    assert.equal(result.title, "New");
  });
});

describe("chat-service — addMembers permission enforcement", () => {
  it("group: calls assertChannelPermission with members.manage and propagates a 403 rejection", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ type: "group" }],
    ]);
    let calledWith = null;
    const permissionsService = {
      assertChannelPermission: async (convId, profileId, key) => {
        calledWith = { convId, profileId, key };
        const err = new Error("No tienes permiso para realizar esta accion.");
        err.status = 403;
        throw err;
      },
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.addMembers({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, userIds: [OTHER_PROFILE_ID] }),
      (err) => err.status === 403,
    );
    assert.deepEqual(calledWith, { convId: CONV_ID, profileId: PROFILE_ID, key: "members.manage" });
  });

  it("direct: never calls assertChannelPermission — behavior unaffected", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "member-row" }],
        [{ type: "direct" }],
        [{ display_name: "Other User" }], // newUser lookup inside the loop
      ],
      [],
    );
    const permissionsService = { assertChannelPermission: throwingAssertChannelPermission };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.addMembers({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, userIds: [OTHER_PROFILE_ID] });
    assert.deepEqual(result, { added: [OTHER_PROFILE_ID] });
  });
});

describe("chat-service — removeMember permission enforcement", () => {
  it("removing someone else in a group without members.manage propagates a 403", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ type: "group" }],
    ]);
    const permissionsService = {
      isLastOwner: async () => false,
      assertChannelPermission: async () => {
        const err = new Error("No tienes permiso para realizar esta accion.");
        err.status = 403;
        throw err;
      },
      getMemberRole: async () => ({ position: 0 }),
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID }),
      (err) => err.status === 403,
    );
  });

  it("removing someone else ranked at or above the actor is rejected with the rank-specific 403", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ type: "group" }],
    ]);
    const permissionsService = {
      isLastOwner: async () => false,
      assertChannelPermission: async () => ({ position: 75, isSystem: false }), // actor: Admin
      getMemberRole: async () => ({ position: 75 }), // target: also Admin (equal rank)
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID }),
      (err) => err instanceof ChatServiceError && err.status === 403 && /rango igual o mayor/.test(err.message),
    );
  });

  it("removing someone else ranked below the actor succeeds", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "member-row" }],
        [{ type: "group" }],
        [{ display_name: "Removed User" }], // removedUser lookup
      ],
      [],
    );
    const permissionsService = {
      isLastOwner: async () => false,
      assertChannelPermission: async () => ({ position: 75, isSystem: false }), // actor: Admin
      getMemberRole: async () => ({ position: 0 }), // target: Member (lower rank)
    };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { ok: true });
  });

  it("self-removal (leaving) always succeeds regardless of rank and does not require members.manage", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "member-row" }],
        // NOTE: no conversation-type lookup, no assertChannelPermission call expected —
        // self-removal must skip that whole block. If it were called it would throw.
        [{ display_name: "Self User" }], // removedUser lookup
      ],
      [],
    );
    const permissionsService = {
      isLastOwner: async () => false,
      assertChannelPermission: throwingAssertChannelPermission,
      getMemberRole: throwingAssertChannelPermission,
    };
    const svc = createChatService({ prisma, permissionsService });
    // This is the test that would fail against the naive/buggy implementation
    // where self-removal was routed through the members.manage + hierarchy check.
    const result = await svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: PROFILE_ID });
    assert.deepEqual(result, { ok: true });
  });

  it("the pre-existing last-Owner guard still fires and short-circuits before the new checks run", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      // no conversation-type lookup expected — isLastOwner throws before we get there
    ]);
    const permissionsService = {
      isLastOwner: async () => true,
      assertChannelPermission: throwingAssertChannelPermission,
      getMemberRole: throwingAssertChannelPermission,
    };
    const svc = createChatService({ prisma, permissionsService });
    await assert.rejects(
      () => svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID }),
      (err) => err instanceof ChatServiceError && err.status === 400 && /unico Owner/.test(err.message),
    );
  });

  it("no permissionsService supplied: behavior unchanged (removal succeeds, no guards run)", async () => {
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }],
        [{ id: "member-row" }],
        [{ display_name: "Removed User" }],
      ],
      [],
    );
    const svc = createChatService({ prisma, permissionsService: null });
    const result = await svc.removeMember({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { ok: true });
  });
});

describe("chat-service — createConversation transactional role-seeding regression", () => {
  it("wraps role-seeding + owner/member role assignment in a single $transaction for a channel", async () => {
    const conv = { id: CONV_ID, type: "channel", title: "General" };
    const prisma = buildPrismaMock(
      [
        [{ id: PROFILE_ID }], // resolveUserProfileId (creator) — cached, so getConversation's later call reuses it
        [conv], // INSERT chat_conversations RETURNING
        [{ id: "member-row" }], // assertMember, inside the final getConversation call
        [{ id: conv.id, type: "channel", title: "General", members: null }], // SELECT c.*, members inside getConversation
      ],
      [
        { count: 1 }, // INSERT chat_conversation_members (creator, owner)
      ],
    );
    // seedDefaultRoles + isLastOwner not exercised directly here — only the
    // transaction wrapper itself is under test — so a minimal fake suffices.
    const permissionsService = {
      seedDefaultRoles: async (conversationId, tx) => {
        assert.ok(tx, "seedDefaultRoles must receive the tx client from inside $transaction");
        return { Owner: "role-owner", Member: "role-member" };
      },
    };
    const svc = createChatService({ prisma, permissionsService });
    await svc.createConversation({
      authUserId: AUTH_USER_ID,
      type: "channel",
      title: "General",
      memberUserIds: [],
    });
    // Catches a regression that strips the $transaction wrapper back out — without
    // it, a crash between seeding roles and assigning the Owner role could leave
    // every member (including the creator) with role_id NULL and no reseed path.
    assert.equal(prisma._transactionCallCount, 1);
  });
});

describe("chat-service — sendMessage mentions", () => {
  it("stores metadata.mentions and fans out a chat.mention.new notification separate from chat.message.new", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: ["u-mentioned"], roleIds: [], everyone: false, here: false, notifyUserIds: ["u-mentioned"] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }], // resolveUserProfileId
      [{ id: "m1" }],             // assertMember
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }], // INSERT ... RETURNING *
      [{                          // getMessageFull's internal query
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body: "hola @[u-mentioned:X]", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "u-mentioned" }, { user_id: "other-user" }], // otherMembers query inside the notification setImmediate block
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body: "hola @[u-mentioned:X]" });

    // The notification dispatch runs inside a fire-and-forget setImmediate — flush it.
    await new Promise((resolve) => setImmediate(resolve));

    const mentionEvent = publishedEvents.find((e) => e.input.eventType === "chat.mention.new");
    const messageEvent = publishedEvents.find((e) => e.input.eventType === "chat.message.new");
    assert.ok(mentionEvent, "expected a chat.mention.new notification to be published");
    assert.deepEqual(mentionEvent.input.recipients.userIds, ["u-mentioned"]);
    assert.ok(messageEvent, "expected the generic chat.message.new notification to still fire for non-mentioned members");
    assert.deepEqual(messageEvent.input.recipients.userIds, ["other-user"]);
  });

  it("does not fan out chat.mention.new when resolveMentions finds nothing to notify", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }],
      [{ id: "m1" }],
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }],
      [{
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body: "hola equipo", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "other-user" }],
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body: "hola equipo" });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(publishedEvents.some((e) => e.input.eventType === "chat.mention.new"), false);
    assert.equal(publishedEvents.filter((e) => e.input.eventType === "chat.message.new").length, 1);
  });
});

describe("chat-service — getConversation member role fields", () => {
  it("includes roleId/roleName/roleColor/rolePosition/roleIsSystem for each member", async () => {
    const memberRow = {
      id: "m1", userId: "u1", role: "owner", joinedAt: new Date(), leftAt: null, lastReadAt: null,
      displayName: "Ada", avatarFileId: null, authAvatarUrl: null, email: "ada@example.com",
      roleId: "role-owner", roleName: "Owner", roleColor: null, rolePosition: 100, roleIsSystem: true,
    };
    const prisma = buildPrismaMock([
      [{ id: "u1" }], // resolveUserProfileId
      [{ id: "m1" }], // assertMember
      [{ id: "conv1", type: "channel", members: [memberRow] }], // getConversation main query
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const conv = await service.getConversation({ conversationId: "conv1", authUserId: "auth-1" });
    assert.equal(conv.members[0].roleId, "role-owner");
    assert.equal(conv.members[0].roleName, "Owner");
    assert.equal(conv.members[0].rolePosition, 100);
    assert.equal(conv.members[0].roleIsSystem, true);
  });
});
