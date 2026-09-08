import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuestChatDomain } from "../guestChat.js";

test("listMessages returns { messages, operatorLastReadAt } and normalizes to snake_case", async () => {
  const request = async () => ({
    data: [{ id: "m1", body: "hi", senderType: "guest", messageType: "text", createdAt: "t" }],
    operatorLastReadAt: "2026-09-08T00:00:00Z",
  });
  const d = createGuestChatDomain(request, "http://x", "anon");
  const res = await d.listMessages("tok");
  assert.equal(res.messages.length, 1);
  assert.equal(res.messages[0].sender_type, "guest");
  assert.equal(res.messages[0].message_type, "text");
  assert.equal(res.messages[0].created_at, "t");
  assert.equal(res.operatorLastReadAt, "2026-09-08T00:00:00Z");
});

test("listMessages tolerates a bare array payload", async () => {
  const request = async () => ({ data: [{ id: "m1", sender_type: "user", created_at: "t" }] });
  const d = createGuestChatDomain(request, "http://x", "anon");
  const res = await d.listMessages("tok");
  assert.equal(res.messages.length, 1);
  assert.equal(res.operatorLastReadAt, null);
});

test("sendTyping and markRead hit the right paths", async () => {
  const calls = [];
  const request = async (method, path) => { calls.push([method, path]); return {}; };
  const d = createGuestChatDomain(request, "http://x", "anon");
  await d.sendTyping("tok");
  await d.markRead("tok");
  assert.deepEqual(calls, [
    ["POST", "/public/chat/session/tok/typing"],
    ["POST", "/public/chat/session/tok/read"],
  ]);
});

test("getAttachmentUrl unwraps res.data.url", async () => {
  const request = async (method, path) => {
    assert.equal(path, "/public/chat/session/tok/attachments/att-1/url");
    return { data: { url: "https://signed" } };
  };
  const d = createGuestChatDomain(request, "http://x", "anon");
  assert.equal(await d.getAttachmentUrl("tok", "att-1"), "https://signed");
});

test("subscribeToReplies still accepts a bare onMessage function (back-compat)", () => {
  const d = createGuestChatDomain(async () => ({}), "", "");
  const unsub = d.subscribeToReplies("conv-1", () => {}, () => {});
  assert.equal(typeof unsub, "function");
  unsub();
});

test("subscribeToReplies accepts an options object", () => {
  const d = createGuestChatDomain(async () => ({}), "", "");
  const unsub = d.subscribeToReplies("conv-1", { onMessage: () => {}, onTyping: () => {}, onRead: () => {}, onClose: () => {} });
  assert.equal(typeof unsub, "function");
  unsub();
});
