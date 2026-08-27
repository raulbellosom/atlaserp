import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatChannelLinksService } from "../chat-channel-links-service.js";

const CONV_ID = "01900000-0000-7000-8000-0000000000c1";
const OTHER_CONV_ID = "01900000-0000-7000-8000-0000000000c2";
const PROJECT_ID = "01900000-0000-7000-8000-0000000000pr";

function buildPrismaMock(queryRawResults = []) {
  let qIdx = 0;
  const calls = [];
  return {
    _queryRawCalls: calls,
    $queryRaw: async (strings, ...values) => {
      calls.push({ sql: strings.join("?"), values });
      if (qIdx >= queryRawResults.length) throw new Error(`Unexpected $queryRaw call #${qIdx + 1}`);
      return queryRawResults[qIdx++];
    },
  };
}

describe("chat-channel-links-service — findByLink", () => {
  it("returns null when no conversation has that link", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.findByLink("atlas.projects", PROJECT_ID);
    assert.equal(result, null);
  });

  it("returns the conversation row when a link exists", async () => {
    const row = { id: CONV_ID, linked_module: "atlas.projects", linked_entity_id: PROJECT_ID };
    const prisma = buildPrismaMock([[row]]);
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.findByLink("atlas.projects", PROJECT_ID);
    assert.deepEqual(result, row);
  });
});

describe("chat-channel-links-service — assertLinkAvailable", () => {
  it("does not throw when no conversation holds the link", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    await svc.assertLinkAvailable("atlas.projects", PROJECT_ID, null);
  });

  it("throws a 409 ChatServiceError when another conversation already holds the link", async () => {
    const prisma = buildPrismaMock([[{ id: OTHER_CONV_ID }]]);
    const svc = createChatChannelLinksService({ prisma });
    await assert.rejects(
      () => svc.assertLinkAvailable("atlas.projects", PROJECT_ID, CONV_ID),
      (err) => {
        assert.equal(err.name, "ChatServiceError");
        assert.equal(err.status, 409);
        return true;
      },
    );
  });

  it("excludes the given conversationId from the collision check (so re-saving the same link on the same channel is allowed)", async () => {
    const prisma = buildPrismaMock([[]]);
    const svc = createChatChannelLinksService({ prisma });
    await svc.assertLinkAvailable("atlas.projects", PROJECT_ID, CONV_ID);
    assert.match(prisma._queryRawCalls[0].sql, /id != \?/);
    assert.equal(prisma._queryRawCalls[0].values.at(-1), CONV_ID);
  });
});

describe("chat-channel-links-service — assertBothOrNeither", () => {
  it("does not throw when both are null", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    svc.assertBothOrNeither(null, null);
  });

  it("does not throw when both are set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    svc.assertBothOrNeither("atlas.projects", PROJECT_ID);
  });

  it("throws a 422 ChatServiceError when only linkedModule is set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    assert.throws(
      () => svc.assertBothOrNeither("atlas.projects", null),
      (err) => { assert.equal(err.name, "ChatServiceError"); assert.equal(err.status, 422); return true; },
    );
  });

  it("throws a 422 ChatServiceError when only linkedEntityId is set", () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    assert.throws(
      () => svc.assertBothOrNeither(null, PROJECT_ID),
      (err) => { assert.equal(err.status, 422); return true; },
    );
  });
});

describe("chat-channel-links-service — applyLinkUpdate", () => {
  it("returns an empty array (no-op) when linkedModule is not present in updates", async () => {
    const svc = createChatChannelLinksService({ prisma: {} });
    const result = await svc.applyLinkUpdate({}, CONV_ID);
    assert.deepEqual(result, []);
  });

  it("checks availability (excluding this conversation) and returns SET fragments when linking", async () => {
    const prisma = buildPrismaMock([[]]); // assertLinkAvailable finds no collision
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.applyLinkUpdate({ linkedModule: "atlas.projects", linkedEntityId: PROJECT_ID }, CONV_ID);
    assert.equal(result.length, 2);
    assert.match(prisma._queryRawCalls[0].sql, /id != \?/);
    assert.equal(prisma._queryRawCalls[0].values.at(-1), CONV_ID);
  });

  it("propagates the 409 from assertLinkAvailable when the project is already linked elsewhere", async () => {
    const prisma = buildPrismaMock([[{ id: OTHER_CONV_ID }]]);
    const svc = createChatChannelLinksService({ prisma });
    await assert.rejects(
      () => svc.applyLinkUpdate({ linkedModule: "atlas.projects", linkedEntityId: PROJECT_ID }, CONV_ID),
      (err) => { assert.equal(err.status, 409); return true; },
    );
  });

  it("skips the availability check and returns clearing SET fragments when unlinking (both null)", async () => {
    const prisma = buildPrismaMock([]); // no $queryRaw call expected at all
    const svc = createChatChannelLinksService({ prisma });
    const result = await svc.applyLinkUpdate({ linkedModule: null, linkedEntityId: null }, CONV_ID);
    assert.equal(result.length, 2);
  });
});
