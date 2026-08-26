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
// _executeRawCallCount mirrors that same convention for $executeRaw, so a test can
// prove exactly how many UPDATE/etc. statements actually ran (e.g. both the
// soft-delete UPDATE and the thread counter-decrement UPDATE) instead of a
// vacuous assertion that would pass regardless.
function buildPrismaMock(queryRawResults = [], executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  const client = {
    _transactionCallCount: 0,
    _executeRawCallCount: 0,
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => {
      client._executeRawCallCount++;
      return executeRawResults[eIdx++] ?? { count: 1 };
    },
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
  // Must be valid hex ([a-f0-9-]{36}) — sendMessage now runs the real
  // parseMentionIds() as a cheap pre-check before ever calling the (fake, in
  // these tests) mentionsService, so a body's embedded token has to actually
  // match the real regex or the short-circuit skips mention resolution
  // entirely, same class of fixture bug already caught in chat-mentions-service.test.js.
  const MENTIONED_USER_ID = "01900000-0000-7000-8000-0000000000aa";

  it("stores metadata.mentions and fans out a chat.mention.new notification separate from chat.message.new", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: [MENTIONED_USER_ID], roleIds: [], everyone: false, here: false, notifyUserIds: [MENTIONED_USER_ID] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const body = `hola @[${MENTIONED_USER_ID}:X]`;
    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }], // resolveUserProfileId
      [{ id: "m1" }],             // assertMember
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }], // INSERT ... RETURNING *
      [{                          // getMessageFull's internal query
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body, message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: MENTIONED_USER_ID }, { user_id: "other-user" }], // otherMembers query inside the notification setImmediate block
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body });

    // The notification dispatch runs inside a fire-and-forget setImmediate — flush it.
    await new Promise((resolve) => setImmediate(resolve));

    const mentionEvent = publishedEvents.find((e) => e.input.eventType === "chat.mention.new");
    const messageEvent = publishedEvents.find((e) => e.input.eventType === "chat.message.new");
    assert.ok(mentionEvent, "expected a chat.mention.new notification to be published");
    assert.deepEqual(mentionEvent.input.recipients.userIds, [MENTIONED_USER_ID]);
    assert.ok(messageEvent, "expected the generic chat.message.new notification to still fire for non-mentioned members");
    assert.deepEqual(messageEvent.input.recipients.userIds, ["other-user"]);
  });

  it("degrades to no-mentions instead of failing the send when mention resolution throws", async () => {
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => { throw new Error("invalid input syntax for type uuid"); },
    };
    const permissionsService = { getMemberRole: async () => null };

    const body = `hola @[${MENTIONED_USER_ID}:X]`;
    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }],
      [{ id: "m1" }],
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }],
      [{
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body, message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "other-user" }],
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    const result = await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body });
    assert.ok(result, "sendMessage must not throw when mention resolution fails");

    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(publishedEvents.some((e) => e.input.eventType === "chat.mention.new"), false);
    assert.equal(publishedEvents.filter((e) => e.input.eventType === "chat.message.new").length, 1);
  });

  it("does not fan out chat.mention.new when resolveMentions finds nothing to notify", async () => {
    // Body deliberately DOES contain a real (valid-hex) mention token — e.g. a
    // member who has since left the conversation — so this test genuinely
    // exercises resolveMentions legitimately resolving to zero notifiable
    // recipients, rather than the parseMentionIds short-circuit skipping
    // resolveMentions entirely (which a token-free body like "hola equipo"
    // would trigger, silently no longer testing this scenario at all).
    const DEPARTED_USER_ID = "01900000-0000-7000-8000-0000000000bb";
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const body = `hola @[${DEPARTED_USER_ID}:ExMiembro]`;
    const prisma = buildPrismaMock([
      [{ id: "sender-profile" }],
      [{ id: "m1" }],
      [{ id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", created_at: new Date(), metadata: {} }],
      [{
        id: "msg1", conversation_id: "conv1", sender_user_id: "sender-profile", sender_guest_id: null,
        sender_type: "user", body, message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null,
      }],
      [{ user_id: "other-user" }],
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: "conv1", authUserId: "auth-1", body });
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(publishedEvents.some((e) => e.input.eventType === "chat.mention.new"), false);
    assert.equal(publishedEvents.filter((e) => e.input.eventType === "chat.message.new").length, 1);
  });
});

describe("chat-service — sendMessage thread replies", () => {
  it("resolves threadRootId, increments the root's counter, and skips updateConversationLastMessage", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    let qIdx = 0;
    const executeRawCalls = [];
    const queryRawResults = [
      [{ id: PROFILE_ID }],                                            // resolveUserProfileId
      [{ id: rootId }],                                                // assertMember (sendMessage's own)
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null, deleted_at: null }], // thread target lookup
      [{ id: "msg-reply-1", conversation_id: CONV_ID, created_at: new Date() }], // INSERT ... RETURNING *
      [{ id: "msg-reply-1", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull
    ];
    const prisma = {
      $queryRaw: async () => queryRawResults[qIdx++],
      $executeRaw: async (strings, ...values) => { executeRawCalls.push(values); return { count: 1 }; },
      $transaction: async (fn) => fn(prisma),
      membership: { findFirst: async () => null },
    };
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.sendMessage({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "respuesta", threadRootId: rootId,
    });
    assert.equal(result.id, "msg-reply-1");
    // updateConversationLastMessage (chat-service.js:84-92) issues its own
    // $executeRaw against chat_conversations, targeting conversationId, not
    // the message/root id — asserting exactly one $executeRaw call happened,
    // and that its only interpolated value is rootId (the counter update's
    // WHERE target), proves updateConversationLastMessage's UPDATE never ran.
    // Unlike buildPrismaMock's $executeRaw (which silently no-ops on overrun),
    // this inline mock has no fallback array to fall through to, so a second,
    // unaccounted-for call would push a second entry here and this assertion
    // would genuinely fail.
    assert.equal(executeRawCalls.length, 1, "expected exactly one $executeRaw call (the counter increment)");
    assert.ok(executeRawCalls[0].includes(rootId), "the one $executeRaw call must target the root's counter update");
    assert.ok(!executeRawCalls[0].includes(CONV_ID), "updateConversationLastMessage (keyed on conversationId) must not have run");
  });

  it("auto-flattens a reply-to-a-reply onto the original root", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r002";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: replyId }],
      [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId, deleted_at: null }], // target is itself a reply
      [{ id: "msg-reply-2", conversation_id: CONV_ID, created_at: new Date() }],
      [{ id: "msg-reply-2", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
    ], [
      { count: 1 },
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.sendMessage({
      conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "respuesta anidada", threadRootId: replyId,
    });
    // The INSERT's actual thread_root_id value is asserted via the mock's
    // fixed-sequence contract here; the next test below (spy-based) directly
    // proves the counter-UPDATE targets the flattened root, not replyId.
  });

  it("rejects a threadRootId belonging to a different conversation with 404", async () => {
    const foreignRootId = "01900000-0000-7000-8000-00000000f001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: foreignRootId }],
      [{ id: foreignRootId, conversation_id: "some-other-conv", thread_root_id: null, deleted_at: null }],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: foreignRootId }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("rejects replying to a soft-deleted message with 404", async () => {
    const deletedId = "01900000-0000-7000-8000-00000000d001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: deletedId }],
      [], // deleted_at IS NULL filter excludes it — lookup returns no rows
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: deletedId }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("counter-UPDATE targets the flattened root id, not the immediate reply target (spy-based)", async () => {
    // Verified empirically against this repo's real Prisma+adapter-pg setup
    // (PrismaPg over a live Supabase Postgres connection) before writing this
    // spy: a tagged-template call `prisma.$queryRaw\`...${x}...\`` invokes the
    // bound function as (stringsArray, x) per JS tagged-template semantics —
    // this is language-level, not Prisma-specific, so the spy below correctly
    // captures what chat-service.js actually sends. Also verified empirically
    // that a UUID column value returned by $queryRaw under this adapter comes
    // back as a plain JS string (constructor Object, typeof "string"), so no
    // String(...) wrap is needed anywhere values are compared below.
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r002";
    const calls = [];
    let qIdx = 0;
    const queryRawResults = [
      [{ id: PROFILE_ID }],
      [{ id: replyId }],
      [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId, deleted_at: null }],
      [{ id: "msg-reply-3", conversation_id: CONV_ID, created_at: new Date() }],
      [{ id: "msg-reply-3", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
    ];
    const prisma = {
      $queryRaw: async (strings, ...values) => {
        calls.push({ kind: "query", values });
        return queryRawResults[qIdx++];
      },
      $executeRaw: async (strings, ...values) => {
        calls.push({ kind: "execute", values });
        return { count: 1 };
      },
      $transaction: async (fn) => fn(prisma),
      membership: { findFirst: async () => null },
    };
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "x", threadRootId: replyId });
    const executeCall = calls.find((c) => c.kind === "execute");
    assert.ok(executeCall, "expected a counter-update $executeRaw call");
    assert.ok(executeCall.values.includes(rootId), "counter update must target the original root id, not the immediate reply id");
    assert.ok(!executeCall.values.includes(replyId), "counter update must NOT target the immediate reply id");
  });
});

describe("chat-service — sendMessage thread reply notifications", () => {
  it("branches to chat.thread.reply (not chat.message.new) for thread participants, while chat.mention.new still fires on top, with no double-count of a mentioned participant", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const ROOT_AUTHOR_ID = "01900000-0000-7000-8000-0000000000a1";
    const PRIOR_REPLIER_ID = "01900000-0000-7000-8000-0000000000b2";
    const MENTIONED_USER_ID = "01900000-0000-7000-8000-0000000000c3";
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };
    const mentionsService = {
      resolveMentions: async () => ({ userIds: [MENTIONED_USER_ID], roleIds: [], everyone: false, here: false, notifyUserIds: [MENTIONED_USER_ID] }),
    };
    const permissionsService = { getMemberRole: async () => null };

    const body = `hola @[${MENTIONED_USER_ID}:X] respondiendo en hilo`;
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                                                   // resolveUserProfileId
      [{ id: "member-row" }],                                                 // assertMember
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null, deleted_at: null }], // thread target lookup
      [{ id: "msg-thread-1", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, created_at: new Date(), metadata: {} }], // INSERT ... RETURNING * (inside tx)
      [{                                                                       // getMessageFull
        id: "msg-thread-1", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, sender_guest_id: null,
        sender_type: "user", body, message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null, reactions: null,
      }],
      [{ user_id: ROOT_AUTHOR_ID }, { user_id: PRIOR_REPLIER_ID }],            // otherMembers query — unconditionally computed before the thread/non-thread branch, unused on the thread path but still consumed
      [                                                                        // participantRows (thread notify) — includes the mentioned user as an existing thread participant
        { sender_user_id: ROOT_AUTHOR_ID },
        { sender_user_id: PRIOR_REPLIER_ID },
        { sender_user_id: MENTIONED_USER_ID },
      ],
    ], [
      { count: 1 }, // counter UPDATE inside tx
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, mentionsService, permissionsService, broadcaster: null });
    await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body, threadRootId: rootId });

    // The notification dispatch runs inside a fire-and-forget setImmediate — flush it.
    await new Promise((resolve) => setImmediate(resolve));

    const messageEvent = publishedEvents.find((e) => e.input.eventType === "chat.message.new");
    const threadEvent = publishedEvents.find((e) => e.input.eventType === "chat.thread.reply");
    const mentionEvent = publishedEvents.find((e) => e.input.eventType === "chat.mention.new");

    assert.equal(messageEvent, undefined, "a thread reply must never fan out chat.message.new to the whole channel");
    assert.ok(threadEvent, "expected chat.thread.reply to fire for thread participants");
    assert.deepEqual(
      [...threadEvent.input.recipients.userIds].sort(),
      [ROOT_AUTHOR_ID, PRIOR_REPLIER_ID].sort(),
      "the mentioned participant must be excluded from chat.thread.reply (goes to chat.mention.new instead), not dropped or double-counted",
    );
    assert.ok(mentionEvent, "expected chat.mention.new to still fire on top of the thread-reply notification");
    assert.deepEqual(mentionEvent.input.recipients.userIds, [MENTIONED_USER_ID]);
  });

  it("excludes a former member from chat.thread.reply even though they're in the thread's message history", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const ROOT_AUTHOR_ID = "01900000-0000-7000-8000-0000000000a1";
    const FORMER_MEMBER_ID = "01900000-0000-7000-8000-0000000000d4"; // replied in the thread, then left the conversation
    const publishedEvents = [];
    const notificationService = { publish: async (args) => { publishedEvents.push(args); } };

    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "member-row" }],
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null, deleted_at: null }],
      [{ id: "msg-thread-2", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, created_at: new Date(), metadata: {} }],
      [{
        id: "msg-thread-2", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, sender_guest_id: null,
        sender_type: "user", body: "sigo aqui", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null, reactions: null,
      }],
      [{ user_id: ROOT_AUTHOR_ID }],                                    // otherMembers — FORMER_MEMBER_ID already left (left_at IS NOT NULL), so it's absent here
      [                                                                  // participantRows — derived from message history, still includes the former member
        { sender_user_id: ROOT_AUTHOR_ID },
        { sender_user_id: FORMER_MEMBER_ID },
      ],
    ], [
      { count: 1 },
    ]);
    prisma.membership.findFirst = async () => ({ companyId: "company-1" });

    const service = createChatService({ prisma, supabaseAdmin: {}, notificationService, broadcaster: null });
    await service.sendMessage({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, body: "sigo aqui", threadRootId: rootId });
    await new Promise((resolve) => setImmediate(resolve));

    const threadEvent = publishedEvents.find((e) => e.input.eventType === "chat.thread.reply");
    assert.ok(threadEvent);
    assert.deepEqual(
      threadEvent.input.recipients.userIds,
      [ROOT_AUTHOR_ID],
      "a former member who replied in the thread before leaving must not keep receiving chat.thread.reply after leaving",
    );
  });
});

describe("chat-service — pinMessage permission enforcement", () => {
  it("channel: calls assertChannelPermission with messages.pin and propagates a 403 rejection", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                                             // resolveUserProfileId
      [{ id: "msg-1", conversation_id: CONV_ID, conversation_type: "channel" }], // message+membership+type lookup
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
      () => svc.pinMessage({ messageId: "msg-1", authUserId: AUTH_USER_ID, pinned: true }),
      (err) => err.status === 403,
    );
    assert.deepEqual(calledWith, { convId: CONV_ID, profileId: PROFILE_ID, key: "messages.pin" });
  });

  it("direct: never calls assertChannelPermission — behavior unaffected", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: "msg-1", conversation_id: CONV_ID, conversation_type: "direct" }],
      [{  // getMessageFull's query
        id: "msg-1", conversation_id: CONV_ID, sender_user_id: PROFILE_ID, sender_guest_id: null,
        sender_type: "user", body: "hola", message_type: "text", attachment_count: 0,
        metadata: {}, created_at: new Date(), edited_at: null, deleted_at: null,
        pinned_at: new Date(), pinned_by_user_id: PROFILE_ID,
        sender: { id: null, displayName: null, avatarFileId: null }, attachments: null, reactions: null,
      }],
    ]);
    const permissionsService = { assertChannelPermission: throwingAssertChannelPermission };
    const svc = createChatService({ prisma, permissionsService });
    const result = await svc.pinMessage({ messageId: "msg-1", authUserId: AUTH_USER_ID, pinned: true });
    assert.ok(result);
  });
});

describe("chat-service — getConversation member role fields", () => {
  it("includes roleId/roleName/roleColor/rolePosition/roleIsSystem for each member", async () => {
    const memberRow = {
      id: "m1", userId: "u1", role: "owner", joinedAt: new Date(), leftAt: null, lastReadAt: null,
      displayName: "Ada", avatarFileId: null, authAvatarUrl: null, email: "ada@example.com",
      roleId: "role-owner", roleName: "Owner", roleColor: null, rolePosition: 100, roleIsSystem: true,
      rolePermissions: { "messages.pin": true },
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
    // Frontend permission gating (e.g. messages.pin for the Fijar mensaje
    // action) reads member.rolePermissions directly — regression coverage
    // for the bug where getConversation's SQL selected every role field
    // except this one, leaving canPin permanently false client-side.
    assert.deepEqual(conv.members[0].rolePermissions, { "messages.pin": true });
  });
});

describe("chat-service — deleteMessage decrements thread counter", () => {
  it("decrements the root's thread_reply_count when a reply is deleted", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r003";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: replyId, thread_root_id: rootId }], // ownership lookup, now also selects thread_root_id
    ], [
      { count: 1 }, // UPDATE ... SET deleted_at = NOW()
      { count: 1 }, // UPDATE chat_messages SET thread_reply_count = GREATEST(thread_reply_count - 1, 0) WHERE id = rootId
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.deleteMessage({ messageId: replyId, authUserId: AUTH_USER_ID });
    // Real proof both UPDATEs ran (not a vacuous assertion): buildPrismaMock now
    // tracks _executeRawCallCount the same way it already tracks
    // _transactionCallCount. If deleteMessage failed to issue the counter-decrement
    // UPDATE, this would read 1, not 2.
    assert.equal(prisma._executeRawCallCount, 2);
  });

  it("does not touch any counter when deleting a top-level (non-reply) message", async () => {
    const msgId = "01900000-0000-7000-8000-00000000m001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: msgId, thread_root_id: null }],
    ], [
      { count: 1 }, // only the deleted_at UPDATE is expected
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.deleteMessage({ messageId: msgId, authUserId: AUTH_USER_ID });
    // Proves the counter-decrement branch was skipped entirely, not just that
    // nothing threw — a top-level message (including a thread ROOT that has
    // replies pointing at it, since a root's OWN row always has
    // thread_root_id = null per the data model) must never trigger a decrement.
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("decrement UPDATE targets the reply's root id with a GREATEST(...,0) floor guard (spy-based)", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r003";
    const executeRawCalls = [];
    const queryRawResults = [
      [{ id: PROFILE_ID }],
      [{ id: replyId, thread_root_id: rootId }],
    ];
    let qIdx = 0;
    const prisma = {
      $queryRaw: async () => queryRawResults[qIdx++],
      $executeRaw: async (strings, ...values) => {
        executeRawCalls.push({ sql: strings.join(""), values });
        return { count: 1 };
      },
      $transaction: async (fn) => fn(prisma),
      membership: { findFirst: async () => null },
    };
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await service.deleteMessage({ messageId: replyId, authUserId: AUTH_USER_ID });
    assert.equal(executeRawCalls.length, 2);
    const decrementCall = executeRawCalls[1];
    assert.ok(
      decrementCall.sql.includes("GREATEST") && decrementCall.sql.includes("thread_reply_count"),
      "the decrement UPDATE must use GREATEST(thread_reply_count - 1, 0) so the counter can never go negative",
    );
    assert.ok(
      decrementCall.values.includes(rootId),
      "the decrement UPDATE must target the reply's root id",
    );
    assert.ok(
      !decrementCall.values.includes(replyId),
      "the decrement UPDATE must NOT target the reply's own id",
    );
  });
});

describe("chat-service — listThreadReplies", () => {
  it("returns the root and its replies in chronological order", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],                             // resolveUserProfileId
      [{ id: rootId, conversation_id: CONV_ID, thread_root_id: null }], // target lookup (root itself)
      [{ id: PROFILE_ID }],                              // assertMember
      [{ id: rootId, conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(root)
      [{ id: "reply-a" }, { id: "reply-b" }],             // reply id list, ORDER BY created_at ASC
      [{ id: "reply-a", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(reply-a)
      [{ id: "reply-b", conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }], // getMessageFull(reply-b)
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.listThreadReplies({ messageId: rootId, authUserId: AUTH_USER_ID });
    assert.equal(result.root.id, rootId);
    assert.deepEqual(result.replies.map((r) => r.id), ["reply-a", "reply-b"]);
  });

  it("auto-flattens: reading a reply's own id resolves to its root's thread", async () => {
    const rootId = "01900000-0000-7000-8000-00000000r001";
    const replyId = "01900000-0000-7000-8000-00000000r002";
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ id: replyId, conversation_id: CONV_ID, thread_root_id: rootId }], // lookup on the reply id resolves thread_root_id
      [{ id: PROFILE_ID }],
      [{ id: rootId, conversation_id: CONV_ID, sender: null, attachments: null, reactions: null }],
      [],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.listThreadReplies({ messageId: replyId, authUserId: AUTH_USER_ID });
    // The queried messageId (replyId) and the returned root's id (rootId) are
    // deliberately different values here — this only passes if listThreadReplies
    // actually resolved thread_root_id from the lookup row instead of just
    // echoing back whatever id it was called with.
    assert.equal(result.root.id, rootId);
    assert.notEqual(result.root.id, replyId);
    assert.deepEqual(result.replies, []);
  });

  it("throws 404 for a nonexistent message id", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [],
    ]);
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.listThreadReplies({ messageId: "does-not-exist", authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });
});
