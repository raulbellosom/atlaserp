// apps/api/src/routes/chat/__tests__/meridian-routes.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createMeridianRoutes } from "../meridian-routes.js";

function app({ available = true, ensure } = {}) {
  const a = new Hono();
  a.use("*", async (c, next) => { c.set("authUserId", "auth1"); c.set("companyId", "co1"); await next(); });
  const requirePermission = () => async (c, next) => next();
  a.route("", createMeridianRoutes({
    requirePermission,
    meridianService: {
      isConfigured: () => available,
      ensureMeridianConversation: ensure ?? (async () => ({ conversationId: "mconv1", created: false })),
    },
    resolveProfileId: async () => "prof1",
  }));
  return a;
}

test("GET /chat/meridian returns a stable conversationId", async () => {
  const a = app();
  const r1 = await a.request("/chat/meridian");
  const r2 = await a.request("/chat/meridian");
  assert.equal(r1.status, 200);
  assert.equal((await r1.json()).data.conversationId, "mconv1");
  assert.equal((await r2.json()).data.conversationId, "mconv1");
});

test("GET /chat/meridian/status reflects configuration", async () => {
  const on = await app({ available: true }).request("/chat/meridian/status");
  const off = await app({ available: false }).request("/chat/meridian/status");
  assert.equal((await on.json()).data.available, true);
  assert.equal((await off.json()).data.available, false);
});
