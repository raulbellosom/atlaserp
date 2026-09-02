// apps/api/src/routes/pfm/__tests__/assistant-routes.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createAssistantRouter } from "../assistant-routes.js";

const COMPANY = "01900000-0000-7000-8000-0000000009c1";
const PROFILE = "01900000-0000-7000-8000-0000000009c2";

function app(assistant) {
  const a = new Hono();
  a.use("*", async (c, next) => {
    c.set("userContext", { profile: { id: PROFILE }, memberships: [{ companyId: COMPANY }] });
    await next();
  });
  a.route("/", createAssistantRouter({ requirePermission: () => (c, next) => next(), assistant }));
  return a;
}

const baseAssistant = {
  isConfigured: () => true,
  listThreads: async () => ({ data: [{ id: "t1", title: "hola", updatedAt: new Date() }] }),
  createThread: async () => ({ id: "t2" }),
  getThread: async () => ({ id: "t1", title: "hola", messages: [] }),
  deleteThread: async () => ({ id: "t1", deleted: true }),
  sendMessage: async ({ content }) => ({
    message: { role: "ASSISTANT", content: `eco:${content}`, createdAt: new Date() },
  }),
};

describe("assistant-routes", () => {
  it("GET /pfm/assistant/status reports availability", async () => {
    const res = await app(baseAssistant).request("/pfm/assistant/status");
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).data, { available: true });
  });

  it("POST /pfm/assistant/threads/:id/messages returns the assistant reply", async () => {
    const res = await app(baseAssistant).request("/pfm/assistant/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hola" }),
    });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).data.message.content, "eco:hola");
  });

  it("rejects an empty content with 400", async () => {
    const res = await app(baseAssistant).request("/pfm/assistant/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "   " }),
    });
    assert.equal(res.status, 400);
  });

  it("rejects content over 2000 chars with 400", async () => {
    const res = await app(baseAssistant).request("/pfm/assistant/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "x".repeat(2001) }),
    });
    assert.equal(res.status, 400);
  });

  it("maps a PfmServiceError status through (429)", async () => {
    const a = {
      ...baseAssistant,
      sendMessage: async () => {
        const { PfmServiceError } = await import("../service-helpers.js");
        throw new PfmServiceError("lento", 429);
      },
    };
    const res = await app(a).request("/pfm/assistant/threads/t1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "hola" }),
    });
    assert.equal(res.status, 429);
  });
});
