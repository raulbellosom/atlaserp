import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallsRouter } from "../index.js";
import { CallServiceError } from "../call-service.js";

const ID = "11111111-1111-4111-8111-111111111111";

function createApp(service) {
  return createCallsRouter({
    prisma: {},
    service,
    authMiddleware: async (c, next) => {
      c.set("authUserId", "auth-user");
      await next();
    },
  });
}

describe("calls routes", () => {
  it("does not apply call authentication to unrelated Atlas routes", async () => {
    let authCalls = 0;
    const app = createCallsRouter({
      prisma: {},
      service: {},
      authMiddleware: async (_c, next) => {
        authCalls += 1;
        await next();
      },
    });

    const response = await app.request("/modules/atlas.ledger/bundle.js");
    assert.equal(response.status, 404);
    assert.equal(authCalls, 0);
  });

  it("validates and forwards create payloads", async () => {
    let received;
    const app = createApp({
      getConfigStatus: async () => ({ enabled: true, mode: "embedded" }),
      createCall: async (payload) => {
        received = payload;
        return { callId: ID, token: "token", livekitUrl: "wss://rtc" };
      },
    });
    const response = await app.request("/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: ID, kind: "VIDEO" }),
    });

    assert.equal(response.status, 201);
    assert.deepEqual(received, { authUserId: "auth-user", conversationId: ID, kind: "VIDEO" });
  });

  it("preserves conflict details without leaking configuration", async () => {
    const app = createApp({
      createCall: async () => {
        throw new CallServiceError("Ya hay una llamada.", 409, { callId: ID });
      },
    });
    const response = await app.request("/calls", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: ID, kind: "AUDIO" }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.deepEqual(body, { error: "Ya hay una llamada.", details: { callId: ID } });
  });
});
