import { test } from "node:test";
import assert from "node:assert/strict";
import { createGuestChatService } from "../guest-service.js";
import { createChatExternalInboxService } from "../chat-external-inbox-service.js";

function makeBroadcaster() {
  const events = [];
  return {
    events,
    broadcastToChannel: (channel, event, payload) => events.push({ channel, event, payload }),
  };
}

function guestPrismaStub(overrides = {}) {
  return {
    async $queryRaw(strings) {
      const sql = strings.join("?");
      if (overrides.query) {
        const r = overrides.query(sql);
        if (r !== undefined) return r;
      }
      if (sql.includes("FROM chat_guest_sessions")) return [{ id: "sess-1", email: "v@x.com", name: "Vic" }];
      if (sql.includes("FROM chat_conversations")) return [{ id: "conv-1" }];
      return [];
    },
    async $executeRaw() {
      return 0;
    },
  };
}

test("broadcastGuestTyping emits guest_typing on the conversation channel", async () => {
  const broadcaster = makeBroadcaster();
  const svc = createGuestChatService({ prisma: guestPrismaStub(), supabaseAdmin: {}, notificationService: null, broadcaster });
  await svc.broadcastGuestTyping({ rawToken: "tok" });
  assert.equal(broadcaster.events.length, 1);
  assert.equal(broadcaster.events[0].channel, "chat:conv:conv-1");
  assert.equal(broadcaster.events[0].event, "guest_typing");
  assert.ok(broadcaster.events[0].payload.at, "payload carries a timestamp");
});

test("broadcastGuestTyping is a no-op when there is no active conversation", async () => {
  const broadcaster = makeBroadcaster();
  const prisma = guestPrismaStub({ query: (sql) => (sql.includes("FROM chat_conversations") ? [] : undefined) });
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster });
  await svc.broadcastGuestTyping({ rawToken: "tok" });
  assert.equal(broadcaster.events.length, 0);
});

test("broadcastOperatorTyping emits operator_typing", async () => {
  const broadcaster = makeBroadcaster();
  const svc = createChatExternalInboxService({
    prisma: { async $queryRaw() { return []; }, async $executeRaw() { return 0; } },
    broadcaster,
  });
  await svc.broadcastOperatorTyping({ conversationId: "conv-9" });
  assert.equal(broadcaster.events[0].channel, "chat:conv:conv-9");
  assert.equal(broadcaster.events[0].event, "operator_typing");
  assert.ok(broadcaster.events[0].payload.at);
});

test("markGuestRead sets guest_last_read_at and broadcasts guest_read", async () => {
  const broadcaster = makeBroadcaster();
  const executed = [];
  const prisma = {
    async $queryRaw(strings) {
      const sql = strings.join("?");
      if (sql.includes("FROM chat_guest_sessions")) return [{ id: "sess-1" }];
      if (sql.includes("FROM chat_conversations")) return [{ id: "conv-1" }];
      return [];
    },
    async $executeRaw(strings) {
      executed.push(strings.join("?"));
      return 1;
    },
  };
  const svc = createGuestChatService({ prisma, supabaseAdmin: {}, notificationService: null, broadcaster });
  await svc.markGuestRead({ rawToken: "tok" });
  assert.ok(
    executed.some((sql) => sql.includes("UPDATE chat_guest_sessions") && sql.includes("guest_last_read_at")),
    "expected an UPDATE ... guest_last_read_at statement",
  );
  assert.ok(broadcaster.events.some((e) => e.event === "guest_read" && e.channel === "chat:conv:conv-1"));
});

test("markExternalRead broadcasts operator_read", async () => {
  const broadcaster = makeBroadcaster();
  const prisma = {
    async $queryRaw() { return [{ id: "profile-1" }]; },
    async $executeRaw() { return 1; },
  };
  const svc = createChatExternalInboxService({ prisma, broadcaster });
  await svc.markExternalRead({ conversationId: "conv-5", authUserId: "auth-1" });
  assert.ok(broadcaster.events.some((e) => e.event === "operator_read" && e.channel === "chat:conv:conv-5"));
});
