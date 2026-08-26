import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  createChatModerationService,
  ChatModerationServiceError,
} from "../chat-moderation-service.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const OTHER_PROFILE_ID = "01900000-0000-7000-8000-0000000000p2";
const CONV_ID = "01900000-0000-7000-8000-0000000000c1";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

function buildPrismaMock(queryRawResults = [], executeRawResults = []) {
  let qIdx = 0;
  let eIdx = 0;
  const client = {
    _executeRawCallCount: 0,
    $queryRaw: async () => {
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    $executeRaw: async () => {
      client._executeRawCallCount++;
      return executeRawResults[eIdx++] ?? { count: 1 };
    },
  };
  return client;
}

describe("chat-moderation-service — muteConversation", () => {
  it("sets muted_at when muted:true and the caller is a member", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.muteConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, muted: true });
    assert.deepEqual(result, { conversationId: CONV_ID, muted: true });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("clears muted_at when muted:false", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.muteConversation({ conversationId: CONV_ID, authUserId: AUTH_USER_ID, muted: false });
    assert.deepEqual(result, { conversationId: CONV_ID, muted: false });
  });
});

describe("chat-moderation-service — block/unblock", () => {
  it("blockUser rejects blocking yourself", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId for caller
    ]);
    const service = createChatModerationService({ prisma });
    await assert.rejects(
      () => service.blockUser({ authUserId: AUTH_USER_ID, targetUserId: PROFILE_ID }),
      (err) => err instanceof ChatModerationServiceError && err.status === 400,
    );
  });

  it("blockUser inserts a chat_blocks row for a different user", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.blockUser({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { blocked: true });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("unblockUser deletes the matching chat_blocks row", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.unblockUser({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { blocked: false });
    assert.equal(prisma._executeRawCallCount, 1);
  });

  it("getBlockStatus reports both directions", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }],
      [{ blocker_user_id: PROFILE_ID, blocked_user_id: OTHER_PROFILE_ID }], // blockedByMe row exists
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.getBlockStatus({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.deepEqual(result, { blockedByMe: true, blockedByThem: false });
  });
});

describe("chat-moderation-service — getGroupsInCommon", () => {
  it("returns group/channel conversations shared by both users", async () => {
    const prisma = buildPrismaMock([
      [{ id: PROFILE_ID }], // resolveUserProfileId
      [{ id: CONV_ID, type: "group", title: "Proyecto X", avatar_url: null, avatar_emoji: null }],
    ]);
    const service = createChatModerationService({ prisma });
    const result = await service.getGroupsInCommon({ authUserId: AUTH_USER_ID, targetUserId: OTHER_PROFILE_ID });
    assert.equal(result.length, 1);
    assert.equal(result[0].id, CONV_ID);
  });
});
