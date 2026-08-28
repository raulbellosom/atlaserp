import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CallServiceError,
  createCallService,
  readLiveKitConfig,
} from "../call-service.js";

const CALL_ID = "11111111-1111-4111-8111-111111111111";
const CONVERSATION_ID = "22222222-2222-4222-8222-222222222222";
const CALLER_ID = "33333333-3333-4333-8333-333333333333";
const CALLEE_ID = "44444444-4444-4444-8444-444444444444";

function enabledEnv() {
  return {
    LIVEKIT_MODE: "embedded",
    LIVEKIT_URL: "wss://rtc.example.test",
    LIVEKIT_INTERNAL_URL: "http://livekit:7880",
    LIVEKIT_API_KEY: "api-key",
    LIVEKIT_API_SECRET: "super-secret",
  };
}

describe("readLiveKitConfig", () => {
  it("defaults to embedded but remains unavailable until every credential exists", () => {
    assert.deepEqual(readLiveKitConfig({}), {
      mode: "embedded",
      enabled: false,
      publicUrl: "",
      internalUrl: "",
      apiKey: "",
      apiSecret: "",
    });
    assert.equal(readLiveKitConfig({ LIVEKIT_MODE: "embedded" }).enabled, false);
  });
});

describe("createCallService", () => {
  it("returns 501 before touching the database when calls are disabled", async () => {
    const service = createCallService({ prisma: {}, env: {} });
    await assert.rejects(
      service.createCall({ authUserId: "auth", conversationId: CONVERSATION_ID, kind: "AUDIO" }),
      (error) => error instanceof CallServiceError && error.status === 501,
    );
  });

  it("creates participants, keeps the secret server-side and scopes the token to one room", async () => {
    let participantData;
    let tokenOptions;
    let tokenGrant;
    let broadcastCall;
    const createdCall = {
      id: CALL_ID,
      conversationId: CONVERSATION_ID,
      calendarEventId: null,
      kind: "VIDEO",
      status: "RINGING",
      initiatedByUserId: CALLER_ID,
      livekitRoomName: `call_${CALL_ID}`,
      participants: [
        { userId: CALLER_ID, status: "JOINED", user: { id: CALLER_ID, displayName: "Caller" } },
        { userId: CALLEE_ID, status: "RINGING", user: { id: CALLEE_ID, displayName: "Callee" } },
      ],
      initiator: { id: CALLER_ID, displayName: "Caller" },
      calendarEvent: null,
    };
    const tx = {
      $queryRaw: async () => [{ id: CALL_ID }],
      callParticipant: {
        createMany: async ({ data }) => { participantData = data; },
      },
      call: { findUnique: async () => ({ id: CALL_ID }) },
    };
    const prisma = {
      userProfile: {
        findUnique: async () => ({ id: CALLER_ID, displayName: "Caller", avatarFileId: null }),
      },
      calendarEvent: { findFirst: async () => null },
      call: {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => createdCall,
      },
      $queryRaw: async () => [
        { userId: CALLER_ID, displayName: "Caller" },
        { userId: CALLEE_ID, displayName: "Callee" },
      ],
      $transaction: async (callback) => callback(tx),
    };
    class FakeToken {
      constructor(key, secret, options) {
        tokenOptions = { key, secret, ...options };
      }
      addGrant(grant) { tokenGrant = grant; }
      async toJwt() { return "signed-token"; }
    }
    const service = createCallService({
      prisma,
      env: enabledEnv(),
      AccessTokenImpl: FakeToken,
      broadcaster: {
        broadcastToUsers: async (userIds, event, payload) => {
          broadcastCall = { userIds, event, payload };
        },
      },
    });

    const result = await service.createCall({
      authUserId: "auth-user",
      conversationId: CONVERSATION_ID,
      kind: "VIDEO",
    });

    assert.equal(result.token, "signed-token");
    assert.equal(result.livekitUrl, "wss://rtc.example.test");
    assert.equal(JSON.stringify(result).includes("super-secret"), false);
    assert.equal(tokenOptions.secret, "super-secret");
    assert.equal(tokenOptions.identity, CALLER_ID);
    assert.deepEqual(tokenGrant, {
      room: `call_${CALL_ID}`,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
    assert.deepEqual(participantData.map((entry) => entry.status), ["JOINED", "RINGING"]);
    assert.deepEqual(broadcastCall, {
      userIds: [CALLEE_ID],
      event: "chat.call.incoming",
      payload: {
        callId: CALL_ID,
        conversationId: CONVERSATION_ID,
        kind: "VIDEO",
        initiatorId: CALLER_ID,
        initiatorName: "Caller",
      },
    });
  });

  it("rejects a duplicate live call with the existing id", async () => {
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLER_ID, displayName: "Caller" }) },
      call: {
        findMany: async () => [],
        findFirst: async () => ({ id: CALL_ID }),
      },
      $queryRaw: async () => [
        { userId: CALLER_ID },
        { userId: CALLEE_ID },
      ],
    };
    const service = createCallService({ prisma, env: enabledEnv() });
    await assert.rejects(
      service.createCall({ authUserId: "auth", conversationId: CONVERSATION_ID, kind: "AUDIO" }),
      (error) => error.status === 409 && error.details.callId === CALL_ID,
    );
  });

  it("does not ring a participant who is already in another call", async () => {
    const otherCallId = "55555555-5555-4555-8555-555555555555";
    let queryNumber = 0;
    let participantsCreated = false;
    const tx = {
      $queryRaw: async () => {
        queryNumber += 1;
        if (queryNumber === 1) return [{ id: CALLER_ID }, { id: CALLEE_ID }];
        return [{ userId: CALLEE_ID, callId: otherCallId }];
      },
      callParticipant: {
        createMany: async () => { participantsCreated = true; },
      },
    };
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLER_ID, displayName: "Caller" }) },
      calendarEvent: { findFirst: async () => null },
      call: {
        findMany: async () => [],
        findFirst: async () => null,
      },
      $queryRaw: async () => [
        { userId: CALLER_ID, displayName: "Caller" },
        { userId: CALLEE_ID, displayName: "Callee" },
      ],
      $transaction: async (callback) => callback(tx),
    };
    const service = createCallService({ prisma, env: enabledEnv() });

    await assert.rejects(
      service.createCall({ authUserId: "auth", conversationId: CONVERSATION_ID, kind: "AUDIO" }),
      (error) => error.status === 409
        && error.details.code === "recipient_busy"
        && error.details.busyUserIds[0] === CALLEE_ID,
    );
    assert.equal(participantsCreated, false);
  });

  it("activates a ringing call when an invited participant joins", async () => {
    const updates = [];
    const ringingCall = {
      id: CALL_ID,
      conversationId: CONVERSATION_ID,
      kind: "AUDIO",
      status: "RINGING",
      initiatedByUserId: CALLER_ID,
      livekitRoomName: `call_${CALL_ID}`,
      startedAt: null,
      participants: [
        { userId: CALLER_ID, status: "JOINED", joinedAt: new Date(), user: { displayName: "Caller" } },
        { userId: CALLEE_ID, status: "RINGING", joinedAt: null, user: { displayName: "Callee" } },
      ],
      initiator: { id: CALLER_ID, displayName: "Caller" },
      calendarEvent: null,
    };
    const activeCall = { ...ringingCall, status: "ACTIVE" };
    let reads = 0;
    const prisma = {
      userProfile: { findUnique: async () => ({ id: CALLEE_ID, displayName: "Callee" }) },
      call: {
        findMany: async () => [],
        findUnique: async () => (reads++ === 0 ? ringingCall : activeCall),
        update: (operation) => { updates.push({ model: "call", operation }); return Promise.resolve({}); },
      },
      callParticipant: {
        update: (operation) => { updates.push({ model: "participant", operation }); return Promise.resolve({}); },
      },
      $queryRaw: async () => [{ id: "membership" }],
      $transaction: async (operations) => Promise.all(operations),
    };
    class FakeToken {
      addGrant() {}
      async toJwt() { return "join-token"; }
    }
    const service = createCallService({ prisma, env: enabledEnv(), AccessTokenImpl: FakeToken });

    const result = await service.joinCall({ authUserId: "callee-auth", callId: CALL_ID });

    assert.equal(result.token, "join-token");
    assert.equal(updates.find((entry) => entry.model === "participant").operation.data.status, "JOINED");
    assert.equal(updates.find((entry) => entry.model === "call").operation.data.status, "ACTIVE");
  });

  it("marks unanswered calls missed after the ringing window and closes the room", async () => {
    const participantUpdates = [];
    let callUpdate;
    let deletedRoom;
    const prisma = {
      call: {
        findMany: async () => [{ id: CALL_ID, livekitRoomName: `call_${CALL_ID}` }],
        updateMany: (operation) => { callUpdate = operation; return Promise.resolve({ count: 1 }); },
      },
      callParticipant: {
        updateMany: (operation) => { participantUpdates.push(operation); return Promise.resolve({ count: 1 }); },
      },
      $transaction: async (operations) => Promise.all(operations),
    };
    class FakeRoomServiceClient {
      async deleteRoom(roomName) { deletedRoom = roomName; }
    }
    const now = new Date("2026-08-28T12:00:00.000Z");
    const service = createCallService({
      prisma,
      env: enabledEnv(),
      now: () => now,
      RoomServiceClientImpl: FakeRoomServiceClient,
    });

    assert.equal(await service.expireStaleCalls(), 1);
    assert.equal(participantUpdates[0].data.status, "MISSED");
    assert.equal(participantUpdates[1].data.status, "LEFT");
    assert.deepEqual(callUpdate.data, { status: "ENDED", endedAt: now, endReason: "missed" });
    assert.equal(deletedRoom, `call_${CALL_ID}`);
  });
});
