import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuestChatService } from "../guest-service.js";

// Lightweight prisma stub: records every $queryRaw / $executeRaw call with its
// SQL skeleton (tagged-template strings joined by "?") and its bound values, so
// a test can assert exactly which statement ran and how it was scoped.
function makePrismaStub(overrides = {}) {
  const calls = [];
  const stub = {
    calls,
    async $queryRaw(strings, ...values) {
      const sql = strings.join("?");
      calls.push({ kind: "query", sql, values });
      if (overrides.query) {
        const r = overrides.query(sql, values);
        if (r !== undefined) return r;
      }
      if (sql.includes("FROM chat_guest_sessions")) return [{ id: "sess-1", email: "v@x.com", name: "Vic" }];
      if (sql.includes("FROM chat_conversations")) return [{ id: "conv-1", company_id: null, assigned_user_id: null }];
      if (sql.includes("INSERT INTO chat_messages")) return [{ id: "msg-1", created_at: new Date("2026-09-08T00:00:00Z") }];
      return [];
    },
    async $executeRaw(strings, ...values) {
      const sql = strings.join("?");
      calls.push({ kind: "execute", sql, values });
      if (overrides.execute) {
        const r = overrides.execute(sql, values);
        if (r !== undefined) return r;
      }
      if (sql.includes("UPDATE chat_attachments") && sql.includes("SET message_id")) return 1;
      return 0;
    },
  };
  return stub;
}

test("sendGuestMessage links a pending attachment to the new message", async () => {
  const prisma = makePrismaStub();
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster: null });

  await svc.sendGuestMessage({
    rawToken: "tok",
    body: "foto.png",
    messageType: "file",
    metadata: { attachmentId: "att-1", fileName: "foto.png", mimeType: "image/png", sizeBytes: 1234 },
  });

  const linkCall = prisma.calls.find(
    (c) => c.kind === "execute" && c.sql.includes("UPDATE chat_attachments") && c.sql.includes("SET message_id"),
  );
  assert.ok(linkCall, "expected an UPDATE chat_attachments SET message_id call");
  assert.ok(linkCall.values.includes("att-1"), "update should be scoped to the attachmentId");
  assert.ok(linkCall.values.includes("conv-1"), "update should be scoped to the conversation");

  const countCall = prisma.calls.find(
    (c) => c.kind === "execute" && c.sql.includes("UPDATE chat_messages") && c.sql.includes("attachment_count"),
  );
  assert.ok(countCall, "expected attachment_count to be bumped when a row was linked");
});

test("sendGuestMessage does not bump attachment_count when nothing was linked", async () => {
  const prisma = makePrismaStub({
    execute: (sql) => (sql.includes("UPDATE chat_attachments") && sql.includes("SET message_id") ? 0 : undefined),
  });
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster: null });

  await svc.sendGuestMessage({
    rawToken: "tok",
    body: "foto.png",
    messageType: "file",
    metadata: { attachmentId: "att-stale" },
  });

  const countCall = prisma.calls.find(
    (c) => c.kind === "execute" && c.sql.includes("UPDATE chat_messages") && c.sql.includes("attachment_count"),
  );
  assert.equal(countCall, undefined, "no linked row -> no attachment_count bump");
});

test("sendGuestMessage without attachmentId never touches chat_attachments", async () => {
  const prisma = makePrismaStub();
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster: null });

  await svc.sendGuestMessage({ rawToken: "tok", body: "hola", messageType: "text", metadata: {} });

  const linkCall = prisma.calls.find((c) => c.sql.includes("UPDATE chat_attachments"));
  assert.equal(linkCall, undefined);
});

test("getGuestAttachmentUrl returns a signed url for an attachment in the session's conversation", async () => {
  const prisma = makePrismaStub({
    query: (sql) => {
      if (sql.includes("FROM chat_attachments") && sql.includes("object_key")) {
        return [{ bucket: "atlas-chat", object_key: "conversations/conv-1/guest/abc.png" }];
      }
      return undefined;
    },
  });
  const supabaseAdmin = {
    storage: {
      from: (bucket) => ({
        createSignedUrl: async (key) => {
          assert.equal(bucket, "atlas-chat");
          assert.equal(key, "conversations/conv-1/guest/abc.png");
          return { data: { signedUrl: "https://x/signed" }, error: null };
        },
      }),
    },
  };
  const svc = createGuestChatService({ prisma, supabaseAdmin, notificationService: null, broadcaster: null });
  const res = await svc.getGuestAttachmentUrl({ rawToken: "tok", attachmentId: "att-1" });
  assert.equal(res.url, "https://x/signed");
  assert.equal(res.expiresIn, 300);
});

test("getGuestAttachmentUrl throws 404 when the attachment is not in the conversation", async () => {
  const prisma = makePrismaStub({
    query: (sql) => (sql.includes("FROM chat_attachments") ? [] : undefined),
  });
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster: null });
  await assert.rejects(
    () => svc.getGuestAttachmentUrl({ rawToken: "tok", attachmentId: "att-x" }),
    /no encontrado/i,
  );
});
