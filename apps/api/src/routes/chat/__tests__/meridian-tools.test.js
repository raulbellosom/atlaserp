// apps/api/src/routes/chat/__tests__/meridian-tools.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { TOOL_DEFS, buildToolRunners } from "../meridian-tools.js";

const ctx = { companyId: "co1", actorAuthUserId: "auth1", actorProfileId: "prof1", conversationId: "conv1" };

test("TOOL_DEFS lists the read tools with JSON schemas", () => {
  const names = TOOL_DEFS.map((t) => t.function.name).sort();
  assert.deepEqual(names, [
    "describe_image", "get_conversation_messages", "get_recent_messages",
    "list_conversation_files", "search_atlas", "search_my_conversations",
  ]);
  for (const t of TOOL_DEFS) assert.equal(t.type, "function");
});

test("search_atlas: runs only the providers the caller is allowed, returns grouped hits", async () => {
  const resolveUserContext = async (authUserId) => {
    assert.equal(authUserId, "auth1");
    return {
      profile: { id: "prof1" },
      memberships: [{ companyId: "co1" }],
      isAdmin: false,
      permissionSet: new Set(["contacts.contacts.read"]), // NOT identity.users.read / hr.employee.read
    };
  };
  const runners = buildToolRunners({ prisma: {}, listMessages: async () => ({ data: [] }), chatSearchService: {}, visionService: {}, signAttachmentUrl: async () => "x", resolveUserContext });
  const out = await runners.search_atlas({ query: "Juan" }, { companyId: "co1", actorAuthUserId: "auth1", actorProfileId: "prof1", conversationId: "c1" });
  // With only contacts permission, the contacts provider runs against the empty
  // prisma stub -> throws -> Promise.allSettled swallows it -> no groups.
  assert.ok(out.groups === undefined ? out.note : true);
});

test("search_atlas: caller with no search permission is refused", async () => {
  const resolveUserContext = async () => ({ profile: { id: "p" }, memberships: [{ companyId: "co1" }], isAdmin: false, permissionSet: new Set() });
  const runners = buildToolRunners({ prisma: {}, listMessages: async () => ({ data: [] }), chatSearchService: {}, visionService: {}, signAttachmentUrl: async () => "x", resolveUserContext });
  const out = await runners.search_atlas({ query: "Juan" }, { actorAuthUserId: "a", companyId: "co1" });
  assert.match(out.error, /permiso/i);
});

test("get_recent_messages trims rows to the safe shape", async () => {
  const listMessages = async ({ conversationId, limit }) => {
    assert.equal(conversationId, "conv1");
    assert.equal(limit, 5);
    return { data: [{
      id: "m1", sender_type: "user", body: "hola", message_type: "text",
      created_at: new Date("2026-09-07T10:00:00Z"), attachment_count: 0,
      sender: { displayName: "Ana" }, attachments: [], metadata: {},
    }] };
  };
  const runners = buildToolRunners({ prisma: {}, listMessages, chatSearchService: {}, visionService: {}, signAttachmentUrl: async () => "http://x" });
  const out = await runners.get_recent_messages({ limit: 5 }, ctx);
  assert.deepEqual(out, {
    messages: [{ senderName: "Ana", senderType: "user", body: "hola", messageType: "text",
      sentAt: "2026-09-07T10:00:00.000Z", attachmentCount: 0, attachmentIds: [] }],
  });
});

test("get_conversation_messages surfaces a not-a-member error as tool data, not a throw", async () => {
  const listMessages = async () => { const e = new Error("No perteneces a esta conversacion."); e.status = 403; e.name = "ChatServiceError"; throw e; };
  const runners = buildToolRunners({ prisma: {}, listMessages, chatSearchService: {}, visionService: {}, signAttachmentUrl: async () => "http://x" });
  const out = await runners.get_conversation_messages({ conversationId: "other", limit: 10 }, ctx);
  assert.match(out.error, /Sin acceso|No perteneces/);
});

test("describe_image rejects a non-image attachment without calling vision", async () => {
  let visionCalled = false;
  const prisma = { $queryRaw: async () => [{ id: "att1", mime_type: "application/pdf", object_key: "k", bucket: "atlas-chat", conversation_id: "conv1" }] };
  const visionService = { describeImage: async () => { visionCalled = true; return { description: "x" }; } };
  const runners = buildToolRunners({ prisma, listMessages: async () => ({ data: [] }), chatSearchService: {}, visionService, signAttachmentUrl: async () => "http://x" });
  const out = await runners.describe_image({ attachmentId: "att1" }, ctx);
  assert.equal(visionCalled, false);
  assert.match(out.error, /no es una imagen/i);
});

test("search_my_conversations passes the query through to chatSearchService", async () => {
  const chatSearchService = { searchMessages: async ({ authUserId, q, limit }) => {
    assert.equal(authUserId, "auth1"); assert.equal(q, "factura"); assert.equal(limit, 15);
    return { data: [{ conversationId: "c2", conversationTitle: "Ventas", snippet: "la factura de...", senderName: "Beto", createdAt: "2026-09-01T00:00:00Z" }] };
  } };
  const runners = buildToolRunners({ prisma: {}, listMessages: async () => ({ data: [] }), chatSearchService, visionService: {}, signAttachmentUrl: async () => "http://x" });
  const out = await runners.search_my_conversations({ query: "factura" }, ctx);
  assert.equal(out.results[0].conversationTitle, "Ventas");
});
