import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallsRouter } from "../index.js";
import { CallServiceError } from "../call-service.js";
import { CallRecordingError } from "../call-recording-service.js";

const ID = "11111111-1111-4111-8111-111111111111";
const PROFILE_ID = "profile-1";

// The real requirePermission (apps/api/src/index.js) resolves the tenant
// context and does `c.set("userId", context.profile.id)` before allowing the
// request through — the recording routes rely on that value being set. This
// stub mirrors that side effect instead of only calling next(), matching how
// the real middleware behaves.
const requirePermission = () => async (c, next) => {
  c.set("userId", PROFILE_ID);
  await next();
};

function createApp(service, recordingService) {
  return createCallsRouter({
    prisma: {},
    service,
    recordingService,
    authMiddleware: async (c, next) => {
      c.set("authUserId", "auth-user");
      await next();
    },
    requirePermission,
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
      requirePermission,
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

describe("calls recording routes", () => {
  it("starts a recording, threading the caller's resolved profile id through", async () => {
    let received;
    const recordingService = {
      startRecording: async (args) => {
        received = args;
        return { id: "rec-1", status: "STARTING" };
      },
    };
    const app = createApp({}, recordingService);
    const response = await app.request(`/calls/${ID}/recording/start`, { method: "POST" });
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.deepEqual(body, { data: { id: "rec-1", status: "STARTING" } });
    assert.deepEqual(received, { callId: ID, startedByUserId: PROFILE_ID, profileId: PROFILE_ID });
  });

  it("rejects starting a recording when the caller cannot manage the call (not the initiator, no channel.manage)", async () => {
    const recordingService = {
      startRecording: async () => {
        throw new CallServiceError("No tienes permiso para grabar la llamada.", 403);
      },
    };
    const app = createApp({}, recordingService);
    const response = await app.request(`/calls/${ID}/recording/start`, { method: "POST" });
    const body = await response.json();

    assert.equal(response.status, 403);
    assert.equal(body.error, "No tienes permiso para grabar la llamada.");
  });

  it("stops a recording", async () => {
    let received;
    const recordingService = {
      stopRecording: async (args) => {
        received = args;
        return { id: "rec-1", status: "PROCESSING" };
      },
    };
    const app = createApp({}, recordingService);
    const response = await app.request(`/calls/${ID}/recording/stop`, { method: "POST" });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: { id: "rec-1", status: "PROCESSING" } });
    assert.deepEqual(received, { callId: ID, profileId: PROFILE_ID });
  });

  it("rejects stopping a recording when the caller cannot manage the call", async () => {
    const recordingService = {
      stopRecording: async () => {
        throw new CallServiceError("No tienes permiso para grabar la llamada.", 403);
      },
    };
    const app = createApp({}, recordingService);
    const response = await app.request(`/calls/${ID}/recording/stop`, { method: "POST" });
    assert.equal(response.status, 403);
  });

  it("lists recordings for a conversation, resolving the caller's profile id from the auth user", async () => {
    let received;
    const recordingService = {
      listRecordings: async (args) => {
        received = args;
        return [{ id: "rec-1", status: "READY" }];
      },
    };
    // The GET route has no requirePermission gate, so profileId(c) is
    // resolved via the raw SQL lookup against user_profile, not c.get("userId").
    const app = createCallsRouter({
      prisma: { $queryRaw: async () => [{ id: PROFILE_ID }] },
      service: {},
      recordingService,
      authMiddleware: async (c, next) => {
        c.set("authUserId", "auth-user");
        await next();
      },
      requirePermission,
    });
    const response = await app.request(`/calls/conversations/${ID}/recordings`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, { data: [{ id: "rec-1", status: "READY" }] });
    assert.deepEqual(received, { conversationId: ID, profileId: PROFILE_ID });
  });

  it("rejects listing recordings for a conversation the caller is not a member of (IDOR guard)", async () => {
    const recordingService = {
      listRecordings: async () => {
        throw new CallRecordingError("Conversación no encontrada.", 404);
      },
    };
    const app = createCallsRouter({
      prisma: { $queryRaw: async () => [{ id: PROFILE_ID }] },
      service: {},
      recordingService,
      authMiddleware: async (c, next) => {
        c.set("authUserId", "auth-user");
        await next();
      },
      requirePermission,
    });
    const response = await app.request(`/calls/conversations/${ID}/recordings`);
    const body = await response.json();

    assert.equal(response.status, 404);
    assert.equal(body.error, "Conversación no encontrada.");
  });
});
