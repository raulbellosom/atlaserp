import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createCallGuestService, CallGuestError } from "../call-guest-service.js";

const CALL = "11111111-1111-4111-8111-111111111111";
const CONV = "22222222-2222-4222-8222-222222222222";
const GUEST = "99999999-9999-4999-8999-999999999999";

function env() {
  return {
    LIVEKIT_MODE: "embedded",
    LIVEKIT_URL: "wss://rtc.example.test",
    LIVEKIT_INTERNAL_URL: "http://livekit:7880",
    LIVEKIT_API_KEY: "api-key",
    LIVEKIT_API_SECRET: "super-secret",
  };
}

class FakeToken {
  constructor(key, secret, opts) { this.key = key; this.secret = secret; this.opts = opts; this.grant = null; }
  addGrant(g) { this.grant = g; }
  async toJwt() { return "guest-jwt"; }
}

const liveCall = { id: CALL, conversationId: CONV, kind: "VIDEO", status: "ACTIVE", livekitRoomName: `call_${CALL}` };

function baseLinksService(link = { id: "l1", conversationId: CONV, requireLobby: true, useCount: 0 }) {
  return {
    resolveLinkForJoin: async () => link,
    resolveInvite: async () => null,
  };
}

describe("createCallGuestService.joinAsGuest", () => {
  it("rate-limits the 9th attempt from one IP in 10 minutes", async () => {
    const prisma = {
      callGuestJoinAttempt: { count: async () => 8, create: async () => ({}) },
      $queryRaw: async () => [liveCall],
      callGuest: { count: async () => 0, create: async ({ data }) => ({ id: GUEST, ...data }) },
      callLink: { update: async () => ({}) },
    };
    const svc = createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService() });
    await assert.rejects(
      svc.joinAsGuest({ token: "t", displayName: "Ana", ip: "1.2.3.4" }),
      (e) => e instanceof CallGuestError && e.status === 429,
    );
  });

  it("creates a LOBBY guest when the link requires a lobby", async () => {
    let createData;
    const prisma = {
      callGuestJoinAttempt: { count: async () => 0, create: async () => ({}) },
      $queryRaw: async () => [liveCall],
      callGuest: { count: async () => 0, create: async ({ data }) => { createData = data; return { id: GUEST, ...data }; } },
      callLink: { update: async () => ({}) },
      callParticipant: { findMany: async () => [] },
    };
    const svc = createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService() });
    const out = await svc.joinAsGuest({ token: "t", displayName: "  Ana  ", ip: "1.2.3.4" });
    assert.equal(out.status, "LOBBY");
    assert.equal(createData.status, "LOBBY");
    assert.equal(createData.displayName, "Ana");
    assert.match(createData.livekitIdentity, /^guest_/);
    assert.ok(out.guestToken && out.guestToken.length >= 32);
  });

  it("admits immediately when the link does not require a lobby", async () => {
    const prisma = {
      callGuestJoinAttempt: { count: async () => 0, create: async () => ({}) },
      $queryRaw: async () => [liveCall],
      callGuest: { count: async () => 0, create: async ({ data }) => ({ id: GUEST, ...data }) },
      callLink: { update: async () => ({}) },
      callParticipant: { findMany: async () => [] },
    };
    const links = baseLinksService({ id: "l1", conversationId: CONV, requireLobby: false, useCount: 0 });
    const svc = createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: links });
    const out = await svc.joinAsGuest({ token: "t", displayName: "Ana", ip: "1.2.3.4" });
    assert.equal(out.status, "ADMITTED");
  });

  it("returns waiting when there is no live call", async () => {
    const prisma = {
      callGuestJoinAttempt: { count: async () => 0, create: async () => ({}) },
      $queryRaw: async () => [],
    };
    const svc = createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService() });
    const out = await svc.joinAsGuest({ token: "t", displayName: "Ana", ip: "1.2.3.4" });
    assert.equal(out.status, "waiting");
  });

  it("rejects the 21st concurrent guest", async () => {
    const prisma = {
      callGuestJoinAttempt: { count: async () => 0, create: async () => ({}) },
      $queryRaw: async () => [liveCall],
      callGuest: { count: async () => 20, create: async () => ({}) },
    };
    const svc = createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService() });
    await assert.rejects(
      svc.joinAsGuest({ token: "t", displayName: "Ana", ip: "1.2.3.4" }),
      (e) => e instanceof CallGuestError && e.status === 409,
    );
  });
});

describe("createCallGuestService.getGuestLiveKitToken", () => {
  function svcFor(guest, call = liveCall) {
    const prisma = {
      callGuest: { findFirst: async () => guest, update: async () => ({}) },
      $queryRaw: async () => (call ? [call] : []),
    };
    return createCallGuestService({ prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService() });
  }
  it("refuses a guest that is not ADMITTED", async () => {
    await assert.rejects(
      svcFor({ id: GUEST, status: "LOBBY", callId: CALL, livekitIdentity: "guest_x", displayName: "Ana", sessionTokenHash: "h" }).getGuestLiveKitToken({ guestToken: "gt" }),
      (e) => e instanceof CallGuestError && e.status === 403,
    );
  });
  it("mints a room-scoped token for an ADMITTED guest and never returns the secret", async () => {
    const out = await svcFor({ id: GUEST, status: "ADMITTED", callId: CALL, livekitIdentity: "guest_x", displayName: "Ana", sessionTokenHash: "h" }).getGuestLiveKitToken({ guestToken: "gt" });
    assert.equal(out.token, "guest-jwt");
    assert.equal(out.livekitUrl, "wss://rtc.example.test");
    assert.equal(JSON.stringify(out).includes("super-secret"), false);
  });
  it("refuses when the call is no longer live", async () => {
    await assert.rejects(
      svcFor({ id: GUEST, status: "ADMITTED", callId: CALL, livekitIdentity: "guest_x", displayName: "Ana", sessionTokenHash: "h" }, null).getGuestLiveKitToken({ guestToken: "gt" }),
      (e) => e instanceof CallGuestError,
    );
  });
});

describe("createCallGuestService moderation", () => {
  it("admitGuest sets ADMITTED + admittedBy and broadcasts", async () => {
    let updateArgs;
    const broadcasts = [];
    const prisma = {
      $queryRaw: async () => [{ ...liveCall, initiatedByUserId: "host" }],
      callGuest: { findFirst: async () => ({ id: GUEST, callId: CALL, status: "LOBBY" }), update: async (a) => { updateArgs = a; return {}; } },
      callParticipant: { findMany: async () => [{ userId: "host" }] },
    };
    const svc = createCallGuestService({
      prisma, env: env(), AccessTokenImpl: FakeToken, linksService: baseLinksService(),
      callService: { assertCanManageCall: async () => {} },
      broadcaster: { broadcastToUsers: async (u, ev) => broadcasts.push(ev) },
    });
    await svc.admitGuest({ authUserId: "auth", profileId: "host", callId: CALL, guestId: GUEST });
    assert.equal(updateArgs.data.status, "ADMITTED");
    assert.equal(updateArgs.data.admittedByUserId, "host");
    assert.ok(broadcasts.includes("chat.call.guest_admitted"));
  });

  it("kickGuest flips status and calls removeParticipant", async () => {
    let removed;
    class FakeRoom { async removeParticipant(room, id) { removed = { room, id }; } }
    const prisma = {
      $queryRaw: async () => [{ ...liveCall, initiatedByUserId: "host" }],
      callGuest: { findFirst: async () => ({ id: GUEST, callId: CALL, status: "ADMITTED", livekitIdentity: "guest_x" }), update: async () => ({}) },
      callParticipant: { findMany: async () => [] },
    };
    const svc = createCallGuestService({
      prisma, env: env(), AccessTokenImpl: FakeToken, RoomServiceClientImpl: FakeRoom,
      linksService: baseLinksService(), callService: { assertCanManageCall: async () => {} },
      broadcaster: { broadcastToUsers: async () => {} },
    });
    await svc.kickGuest({ authUserId: "auth", profileId: "host", callId: CALL, guestId: GUEST });
    assert.deepEqual(removed, { room: `call_${CALL}`, id: "guest_x" });
  });
});
