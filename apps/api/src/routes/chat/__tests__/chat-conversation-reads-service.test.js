import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatConversationReadsService } from "../chat-conversation-reads-service.js";
import { ChatServiceError } from "../chat-service-error.js";

const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const MESSAGE_ID = "01900000-0000-7000-8000-0000000000m1";
const CONVERSATION_ID = "01900000-0000-7000-8000-0000000000c1";
const SENDER_ID = "01900000-0000-7000-8000-0000000000s1";
const CREATED_AT = new Date("2026-09-12T10:00:00.000Z");

function messageRow(overrides = {}) {
  return {
    id: MESSAGE_ID,
    conversation_id: CONVERSATION_ID,
    created_at: CREATED_AT,
    sender_user_id: SENDER_ID,
    conversation_type: "group",
    ...overrides,
  };
}

// call #1 returns the message row (or []); call #2 returns the member rows.
function mockPrisma({ message = [messageRow()], members = [] } = {}) {
  let call = 0;
  return {
    $queryRaw: async () => {
      call += 1;
      if (call === 1) return message;
      return members;
    },
  };
}

function makeService(overrides = {}) {
  return createChatConversationReadsService({
    prisma: mockPrisma(overrides),
    getUserProfileId: async () => PROFILE_ID,
    assertMember: async () => {},
    batchSignAvatarUrls: async (ids) =>
      Object.fromEntries(ids.map((id) => [id, `https://signed/${id}`])),
  });
}

describe("getMessageReceipt", () => {
  it("throws 404 when the caller is not a member of the message's conversation (or it doesn't exist)", async () => {
    const svc = makeService({ message: [] });
    await assert.rejects(
      () => svc.getMessageReceipt({ messageId: MESSAGE_ID, authUserId: "auth-1" }),
      (err) => err instanceof ChatServiceError && err.status === 404,
    );
  });

  it("marks a member as seen when their last_read_at is at/after the message's created_at", async () => {
    const svc = makeService({
      members: [
        {
          user_id: "u-seen",
          last_read_at: new Date("2026-09-12T11:00:00.000Z"),
          display_name: "Ana",
          avatar_file_id: null,
          auth_avatar_url: null,
        },
      ],
    });
    const out = await svc.getMessageReceipt({ messageId: MESSAGE_ID, authUserId: "auth-1" });
    assert.equal(out.messageId, MESSAGE_ID);
    assert.equal(out.conversationType, "group");
    assert.equal(out.seenBy.length, 1);
    assert.equal(out.seenBy[0].displayName, "Ana");
    assert.deepEqual(out.seenBy[0].seenAt, new Date("2026-09-12T11:00:00.000Z"));
  });

  it("reports seenAt: null for a member whose last_read_at is before the message (or never read)", async () => {
    const svc = makeService({
      members: [
        {
          user_id: "u-behind",
          last_read_at: new Date("2026-09-12T09:00:00.000Z"), // before CREATED_AT
          display_name: "Beto",
          avatar_file_id: null,
          auth_avatar_url: null,
        },
        {
          user_id: "u-never",
          last_read_at: null,
          display_name: "Cami",
          avatar_file_id: null,
          auth_avatar_url: null,
        },
      ],
    });
    const out = await svc.getMessageReceipt({ messageId: MESSAGE_ID, authUserId: "auth-1" });
    assert.equal(out.seenBy[0].seenAt, null);
    assert.equal(out.seenBy[1].seenAt, null);
  });

  it("resolves a signed avatar URL for members with an avatar_file_id", async () => {
    const svc = makeService({
      members: [
        {
          user_id: "u-1",
          last_read_at: null,
          display_name: "Dani",
          avatar_file_id: "file-1",
          auth_avatar_url: null,
        },
      ],
    });
    const out = await svc.getMessageReceipt({ messageId: MESSAGE_ID, authUserId: "auth-1" });
    assert.equal(out.seenBy[0].avatarUrl, "https://signed/file-1");
  });
});
