import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notificationKey, claimNotification } from "../notificationDedup.js";

describe("notificationDedup", () => {
  it("keys on dedupeKey when present so both delivery surfaces collapse", () => {
    // The realtime broadcast and the service-worker push now both carry the
    // notification's dedupeKey — they must hash to the same string.
    const fromRealtime = notificationKey({
      dedupeKey: "chat.message.new:msg-1",
      eventType: "chat.message.new",
      title: "Nuevo mensaje de chat",
      body: "Hola",
    });
    const fromServiceWorker = notificationKey({
      dedupeKey: "chat.message.new:msg-1",
      eventType: "chat.message.new",
      title: "Nuevo mensaje de chat",
      body: "Hola (distinto preview)",
    });
    assert.equal(fromRealtime, fromServiceWorker);
    assert.equal(fromRealtime, "dk:chat.message.new:msg-1");
  });

  it("falls back to a content hash that still matches across surfaces without a dedupeKey", () => {
    const a = notificationKey({ eventType: "system.alert", title: "Aviso", body: "x" });
    const b = notificationKey({ dedupeKey: null, eventType: "system.alert", title: "Aviso", body: "x" });
    assert.equal(a, b);
  });

  it("claimNotification lets the first caller through and blocks the second within the window", () => {
    const key = `dk:test-${Math.random()}`;
    assert.equal(claimNotification(key), true);
    assert.equal(claimNotification(key), false);
  });

  it("claimNotification always lets through when there is no key", () => {
    assert.equal(claimNotification(null), true);
    assert.equal(claimNotification(null), true);
  });
});
