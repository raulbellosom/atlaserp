import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallMessagesService, CallMessageError } from "../call-messages-service.js";

const CALL = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";

describe("createCallMessagesService.postMemberMessage", () => {
  it("rejects an empty body", async () => {
    const svc = createCallMessagesService({ prisma: {} });
    await assert.rejects(svc.postMemberMessage({ profileId: "u", callId: CALL, body: "   " }),
      (e) => e instanceof CallMessageError && e.status === 422);
  });
  it("rejects a >4000 char body", async () => {
    const svc = createCallMessagesService({ prisma: {} });
    await assert.rejects(svc.postMemberMessage({ profileId: "u", callId: CALL, body: "x".repeat(4001) }),
      (e) => e instanceof CallMessageError);
  });
  it("inserts a user message after checking membership", async () => {
    let insertData;
    const prisma = {
      $queryRaw: async (s) => {
        const sql = String(Array.isArray(s) ? s.join("?") : s);
        if (sql.includes('FROM "call"')) return [{ id: CALL, conversationId: CONV }];
        if (sql.includes("chat_conversation_members")) return [{ id: "member" }];
        if (sql.includes("user_profile")) return [{ displayName: "Ana" }];
        return [];
      },
      callMessage: { create: async ({ data }) => { insertData = data; return { id: "m1", ...data, createdAt: new Date() }; } },
    };
    const svc = createCallMessagesService({ prisma });
    const out = await svc.postMemberMessage({ profileId: "u", callId: CALL, body: "  hola  " });
    assert.equal(insertData.senderKind, "user");
    assert.equal(insertData.body, "hola");
    assert.equal(insertData.senderName, "Ana");
    assert.equal(out.message.id, "m1");
  });
});

describe("createCallMessagesService.postGuestMessage", () => {
  it("refuses a guest that is not ADMITTED", async () => {
    const guestService = { resolveAdmittedGuestForMessage: async () => { throw new CallMessageError("no", 403); } };
    const svc = createCallMessagesService({ prisma: {}, guestService });
    await assert.rejects(svc.postGuestMessage({ guestToken: "gt", body: "hi" }), (e) => e.status === 403);
  });
  it("inserts a guest message", async () => {
    let insertData;
    const prisma = { callMessage: { create: async ({ data }) => { insertData = data; return { id: "m2", ...data, createdAt: new Date() }; } } };
    const guestService = {
      resolveAdmittedGuestForMessage: async () => ({ guestId: "g1", callId: CALL, displayName: "Vis" }),
    };
    const svc = createCallMessagesService({ prisma, guestService });
    await svc.postGuestMessage({ guestToken: "gt", body: "hola" });
    assert.equal(insertData.senderKind, "guest");
    assert.equal(insertData.senderGuestId, "g1");
    assert.equal(insertData.senderName, "Vis");
  });
});

describe("createCallMessagesService.listMessages", () => {
  it("returns messages ordered ascending and honours sinceId", async () => {
    let where;
    const prisma = { callMessage: { findMany: async (args) => { where = args.where; return [{ id: "a" }, { id: "b" }]; } } };
    const svc = createCallMessagesService({ prisma });
    const out = await svc.listMessages({ callId: CALL, sinceId: "a" });
    assert.equal(out.messages.length, 2);
    assert.ok(where.id?.gt === "a" || where.createdAt);
  });
});

describe("createCallMessagesService.listMessagesGuarded", () => {
  it("checks membership before listing", async () => {
    let listed = false;
    const prisma = {
      $queryRaw: async (s) => {
        const sql = String(Array.isArray(s) ? s.join("?") : s);
        if (sql.includes('FROM "call"')) return [{ id: CALL, conversationId: CONV }];
        if (sql.includes("chat_conversation_members")) return [];
        return [];
      },
      callMessage: { findMany: async () => { listed = true; return []; } },
    };
    const svc = createCallMessagesService({ prisma });
    await assert.rejects(svc.listMessagesGuarded({ profileId: "u", callId: CALL }), (e) => e.status === 403);
    assert.equal(listed, false);
  });
});
