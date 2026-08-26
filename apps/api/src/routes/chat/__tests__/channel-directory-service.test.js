import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createChannelDirectoryService } from "../channel-directory-service.js";
import { ChatServiceError, _resetProfileIdCacheForTests } from "../chat-service.js";

const AUTH_USER_ID = "auth-user-1";
const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const COMPANY_ID = "01900000-0000-7000-8000-0000000000c9";
const CONV_ID = "01900000-0000-7000-8000-0000000000cc";

beforeEach(() => {
  _resetProfileIdCacheForTests();
});

function buildPrismaMock({ queryRawResults = [], membershipResult = { companyId: COMPANY_ID } } = {}) {
  let qIdx = 0;
  const calls = [];
  return {
    _queryRawCalls: calls,
    $queryRaw: async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
    membership: {
      findFirst: async () => membershipResult,
    },
  };
}

describe("channel-directory-service — listChannelDirectory", () => {
  it("returns an empty list when the caller has no active company membership", async () => {
    const prisma = buildPrismaMock({
      queryRawResults: [[{ id: PROFILE_ID }]],
      membershipResult: null,
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.listChannelDirectory({ authUserId: AUTH_USER_ID });
    assert.deepEqual(result, { data: [], nextCursor: null });
  });

  it("returns public channels for the caller's company", async () => {
    const channelRow = { id: CONV_ID, title: "General", description: null, slug: "general", isPublic: true, createdAt: new Date() };
    const prisma = buildPrismaMock({
      queryRawResults: [[{ id: PROFILE_ID }], [channelRow]],
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.listChannelDirectory({ authUserId: AUTH_USER_ID });
    assert.equal(result.data.length, 1);
    assert.equal(result.data[0].slug, "general");
  });
});

describe("channel-directory-service — joinChannel", () => {
  it("throws 404 when the target is not a public channel", async () => {
    const prisma = buildPrismaMock({ queryRawResults: [[{ id: PROFILE_ID }], []] });
    const svc = createChannelDirectoryService({ prisma });
    await assert.rejects(
      () => svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("throws 400 when the caller is already a member", async () => {
    const prisma = buildPrismaMock({
      queryRawResults: [
        [{ id: PROFILE_ID }],
        [{ id: CONV_ID, isPublic: true }],
        [{ id: "existing-member-row" }],
      ],
    });
    const svc = createChannelDirectoryService({ prisma });
    await assert.rejects(
      () => svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 400,
    );
  });

  it("inserts a membership row with the conversation's default Member role", async () => {
    const membershipRow = { id: "new-member", conversationId: CONV_ID, userId: PROFILE_ID, roleId: "role-member", joinedAt: new Date() };
    const prisma = buildPrismaMock({
      queryRawResults: [
        [{ id: PROFILE_ID }],
        [{ id: CONV_ID, isPublic: true }],
        [],
        [{ id: "role-member" }],
        [membershipRow],
      ],
    });
    const svc = createChannelDirectoryService({ prisma });
    const result = await svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID });
    assert.equal(result.roleId, "role-member");
  });

  it("scopes the conversation lookup to the caller's own company (cross-tenant join regression)", async () => {
    const prisma = buildPrismaMock({
      queryRawResults: [[{ id: PROFILE_ID }], []], // conversation lookup returns empty
      membershipResult: { companyId: COMPANY_ID },
    });
    const svc = createChannelDirectoryService({ prisma });
    await assert.rejects(
      () => svc.joinChannel({ conversationId: CONV_ID, authUserId: AUTH_USER_ID }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
    const convLookup = prisma._queryRawCalls[1];
    assert.ok(
      convLookup.values.includes(COMPANY_ID),
      "the conversation lookup must filter by the caller's company_id, not just conversationId",
    );
  });
});
