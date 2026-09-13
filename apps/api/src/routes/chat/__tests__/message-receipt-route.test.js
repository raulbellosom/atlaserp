// End-to-end smoke test for GET /chat/messages/:id/receipt through the real
// Hono router (createChatRouter), not just the service in isolation — this is
// what actually catches route-wiring mistakes (wrong path, wrong method,
// permission gate never invoked, wrong mount point) that a pure service unit
// test cannot see.
import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createChatRouter } from "../index.js";
import { _resetProfileIdCacheForTests } from "../chat-service.js";

const PROFILE_ID = "01900000-0000-7000-8000-0000000000p1";
const MESSAGE_ID = "01900000-0000-7000-8000-0000000000m1";
const CONVERSATION_ID = "01900000-0000-7000-8000-0000000000c1";
const SENDER_ID = "01900000-0000-7000-8000-0000000000s1";
const CREATED_AT = new Date("2026-09-12T10:00:00.000Z");

async function authMiddleware(c, next) {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return c.json({ error: "No autorizado. Debes iniciar sesion." }, 401);
  c.set("authUserId", "auth-1");
  await next();
}

function buildApp({ requirePermissionCalls = null } = {}) {
  let call = 0;
  const prisma = {
    $queryRaw: async () => {
      call += 1;
      if (call === 1) return [{ id: PROFILE_ID }]; // resolveUserProfileId
      if (call === 2) {
        return [
          {
            id: MESSAGE_ID,
            conversation_id: CONVERSATION_ID,
            created_at: CREATED_AT,
            sender_user_id: SENDER_ID,
            conversation_type: "group",
          },
        ];
      }
      // member rows
      return [
        {
          user_id: "u-seen",
          last_read_at: new Date("2026-09-12T11:00:00.000Z"),
          display_name: "Ana",
          avatar_file_id: null,
          auth_avatar_url: null,
        },
      ];
    },
    $executeRaw: async () => 0,
  };
  const supabaseAdmin = { storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: "stub" }) }) } };
  const requirePermission = (perm) => async (c, next) => {
    requirePermissionCalls?.push(perm);
    return next();
  };

  const app = new Hono();
  app.route("/", createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission }));
  return app;
}

test("GET /chat/messages/:id/receipt requires auth", async () => {
  _resetProfileIdCacheForTests();
  const res = await buildApp().request(`/chat/messages/${MESSAGE_ID}/receipt`);
  assert.equal(res.status, 401);
});

test("GET /chat/messages/:id/receipt is gated by chat.conversations.read", async () => {
  _resetProfileIdCacheForTests();
  const seen = [];
  await buildApp({ requirePermissionCalls: seen }).request(`/chat/messages/${MESSAGE_ID}/receipt`, {
    headers: { Authorization: "Bearer tok" },
  });
  assert.ok(seen.includes("chat.conversations.read"), `expected chat.conversations.read among ${JSON.stringify(seen)}`);
});

test("GET /chat/messages/:id/receipt returns Enviado + Visto por through the real router", async () => {
  _resetProfileIdCacheForTests();
  const res = await buildApp().request(`/chat/messages/${MESSAGE_ID}/receipt`, {
    headers: { Authorization: "Bearer tok" },
  });
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.messageId, MESSAGE_ID);
  assert.equal(body.conversationType, "group");
  assert.equal(body.seenBy.length, 1);
  assert.equal(body.seenBy[0].displayName, "Ana");
  assert.equal(body.seenBy[0].seenAt, "2026-09-12T11:00:00.000Z");
});

test("GET /chat/messages/:id/receipt 404s when the message doesn't exist / caller isn't a member", async () => {
  _resetProfileIdCacheForTests();
  let call = 0;
  const prisma = {
    $queryRaw: async () => {
      call += 1;
      if (call === 1) return [{ id: PROFILE_ID }];
      return []; // message lookup: no row
    },
  };
  const supabaseAdmin = { storage: { from: () => ({}) } };
  const requirePermission = () => async (c, next) => next();
  const app = new Hono();
  app.route("/", createChatRouter({ prisma, supabaseAdmin, authMiddleware, requirePermission }));

  const res = await app.request(`/chat/messages/${MESSAGE_ID}/receipt`, {
    headers: { Authorization: "Bearer tok" },
  });
  assert.equal(res.status, 404);
});
