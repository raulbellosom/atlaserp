import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createChatService, ChatServiceError, _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-fwd-1";
const PROFILE_ID = "01900000-0000-7000-8000-00000000fwd1";
const SRC_CONV = "01900000-0000-7000-8000-000000000src";
const TGT_A = "01900000-0000-7000-8000-000000000tga";
const TGT_B = "01900000-0000-7000-8000-000000000tgb";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

// Content-dispatch prisma mock: forwardMessages delegates every (target, source)
// pair to sendMessage, so a rigid ordered-queue stub would be unreadable. This
// answers by SQL fragment instead and records the INSERT / $executeRaw traffic.
function makePrisma({ sources, memberConvIds, attachmentCounts = {} }) {
  const execSql = [];
  const insertedMessages = [];
  const client = {
    _execSql: execSql,
    _insertedMessages: insertedMessages,
    $executeRaw: async (strings, ...values) => {
      execSql.push({ sql: strings.join(" ? "), values });
      return { count: 1 };
    },
    $queryRaw: async (strings, ...values) => {
      const sql = strings.join(" ? ");
      if (sql.includes("FROM user_profile WHERE auth_user_id")) {
        return [{ id: PROFILE_ID }];
      }
      if (sql.includes("m.message_type <> 'system'")) {
        return sources;
      }
      if (sql.includes("SELECT id FROM chat_conversation_members") && sql.includes("LIMIT 1")) {
        return memberConvIds.includes(values[0]) ? [{ id: "member-row" }] : [];
      }
      if (sql.includes("SELECT type, title FROM chat_conversations WHERE id")) {
        return [{ type: "group", title: "Grupo" }];
      }
      if (sql.includes("COUNT(*)::int AS n FROM chat_attachments")) {
        return [{ n: attachmentCounts[values[0]] ?? 0 }];
      }
      if (sql.includes("INSERT INTO chat_messages")) {
        const rec = {
          id: `new-msg-${insertedMessages.length + 1}`,
          conversation_id: values[0],
          created_at: new Date(),
          metadata: {},
          reply_to_message_id: null,
        };
        const metaJson = values.find((v) => typeof v === "string" && v.includes("forwardedFrom"));
        insertedMessages.push({
          targetConversationId: values[0],
          attachmentCount: values[4],
          forwardedFrom: metaJson ? JSON.parse(metaJson).forwardedFrom : null,
        });
        return [rec];
      }
      if (sql.includes("json_build_object") && sql.includes("FROM chat_messages m")) {
        return [{
          id: values[0], conversation_id: "x", sender_user_id: PROFILE_ID, sender_guest_id: null,
          sender_type: "user", body: "x", message_type: "text", attachment_count: 0, metadata: {},
          created_at: new Date(), edited_at: null, deleted_at: null, reply_to_message_id: null,
          sender: { id: PROFILE_ID, displayName: "Yo", avatarFileId: null }, attachments: null,
        }];
      }
      throw new Error(`Unexpected $queryRaw: ${sql.slice(0, 140)}`);
    },
    $transaction: async (fn) => fn(client),
    fileAsset: { findMany: async () => [] },
    membership: { findFirst: async () => null, findMany: async () => [] },
  };
  return client;
}

function src(id, { body = "hola", type = "text", createdAt, conv = SRC_CONV } = {}) {
  return {
    id,
    conversation_id: conv,
    body,
    message_type: type,
    sender_type: "user",
    created_at: createdAt ?? new Date(),
    sender_name: "Ada",
  };
}

describe("chat-service — forwardMessages", () => {
  it("forwards one text message to one target and tags metadata.forwardedFrom", async () => {
    const created = new Date("2026-09-01T10:00:00Z");
    const prisma = makePrisma({
      sources: [src("msg-1", { createdAt: created })],
      memberConvIds: [SRC_CONV, TGT_A],
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });

    const result = await service.forwardMessages({
      authUserId: AUTH_USER_ID,
      messageIds: ["msg-1"],
      targetConversationIds: [TGT_A],
    });

    assert.equal(result.forwarded, 1);
    assert.equal(prisma._insertedMessages.length, 1);
    assert.deepEqual(prisma._insertedMessages[0].forwardedFrom, {
      conversationId: SRC_CONV,
      messageId: "msg-1",
      senderName: "Ada",
      at: created.toISOString(),
    });
  });

  it("clones the source attachments onto the forwarded message, re-owned to the forwarder", async () => {
    const prisma = makePrisma({
      sources: [src("msg-att", { body: "" })],
      memberConvIds: [SRC_CONV, TGT_A],
      attachmentCounts: { "msg-att": 2 },
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });

    await service.forwardMessages({
      authUserId: AUTH_USER_ID,
      messageIds: ["msg-att"],
      targetConversationIds: [TGT_A],
    });

    // attachment_count bound into the message INSERT comes from the source count
    assert.equal(prisma._insertedMessages[0].attachmentCount, 2);

    const clone = prisma._execSql.find(
      (e) => e.sql.includes("INSERT INTO chat_attachments") && e.sql.includes("object_key"),
    );
    assert.ok(clone, "expected a chat_attachments clone INSERT ... SELECT");
    assert.ok(clone.sql.includes("FROM chat_attachments"), "clone reads from the source rows");
    assert.ok(clone.values.includes(PROFILE_ID), "clone rewrites uploaded_by_user_id to the forwarder");
    assert.ok(clone.values.includes("msg-att"), "clone is scoped to the source message id");
  });

  it("forwards an attachment-only message (empty body) without error", async () => {
    const prisma = makePrisma({
      sources: [src("msg-only-file", { body: "" })],
      memberConvIds: [SRC_CONV, TGT_A],
      attachmentCounts: { "msg-only-file": 1 },
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });
    const result = await service.forwardMessages({
      authUserId: AUTH_USER_ID,
      messageIds: ["msg-only-file"],
      targetConversationIds: [TGT_A],
    });
    assert.equal(result.forwarded, 1);
  });

  it("multi-message multi-target: inserts per target in ascending created_at order", async () => {
    const older = new Date("2026-09-01T08:00:00Z");
    const newer = new Date("2026-09-01T09:00:00Z");
    const prisma = makePrisma({
      // deliberately passed newest-first
      sources: [
        src("m-new", { createdAt: newer }),
        src("m-old", { createdAt: older }),
      ],
      memberConvIds: [SRC_CONV, TGT_A, TGT_B],
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });

    const result = await service.forwardMessages({
      authUserId: AUTH_USER_ID,
      messageIds: ["m-new", "m-old"],
      targetConversationIds: [TGT_A, TGT_B],
    });

    assert.equal(result.forwarded, 4);
    const trace = prisma._insertedMessages.map((m) => [m.targetConversationId, m.forwardedFrom.messageId]);
    assert.deepEqual(trace, [
      [TGT_A, "m-old"],
      [TGT_A, "m-new"],
      [TGT_B, "m-old"],
      [TGT_B, "m-new"],
    ]);
  });

  it("rejects with 403 when the caller is not a member of a source conversation", async () => {
    const prisma = makePrisma({
      sources: [src("msg-x")],
      memberConvIds: [TGT_A], // not SRC_CONV
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.forwardMessages({
        authUserId: AUTH_USER_ID,
        messageIds: ["msg-x"],
        targetConversationIds: [TGT_A],
      }),
      (err) => err instanceof ChatServiceError && err.status === 403,
    );
  });

  it("rejects with 404 when a message id is missing or soft-deleted", async () => {
    const prisma = makePrisma({
      sources: [src("msg-present")], // asked for two, only one comes back
      memberConvIds: [SRC_CONV, TGT_A],
    });
    const service = createChatService({ prisma, supabaseAdmin: {} });
    await assert.rejects(
      () => service.forwardMessages({
        authUserId: AUTH_USER_ID,
        messageIds: ["msg-present", "msg-gone"],
        targetConversationIds: [TGT_A],
      }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });
});
