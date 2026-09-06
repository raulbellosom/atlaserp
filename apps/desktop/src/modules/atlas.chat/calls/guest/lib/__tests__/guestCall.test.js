import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { guestPhase, endedReason, GUEST_PHASES, buildGuestJoinUrl } from "../guestCall.js";

describe("guestPhase", () => {
  it("gate before a join", () => {
    assert.equal(guestPhase({ joined: false }), "gate");
  });
  it("waiting-for-call maps to lobby", () => {
    assert.equal(guestPhase({ joined: true, status: "waiting" }), "lobby");
  });
  it("LOBBY => lobby, ADMITTED => room", () => {
    assert.equal(guestPhase({ joined: true, status: "LOBBY" }), "lobby");
    assert.equal(guestPhase({ joined: true, status: "ADMITTED" }), "room");
  });
  it("DENIED / KICKED / LEFT => ended", () => {
    assert.equal(guestPhase({ joined: true, status: "DENIED" }), "ended");
    assert.equal(guestPhase({ joined: true, status: "KICKED" }), "ended");
    assert.equal(guestPhase({ joined: true, status: "LEFT" }), "ended");
  });
  it("callEnded => ended even if ADMITTED", () => {
    assert.equal(guestPhase({ joined: true, status: "ADMITTED", callEnded: true }), "ended");
  });
  it("error flag wins", () => {
    assert.equal(guestPhase({ joined: true, status: "ADMITTED", error: "boom" }), "error");
  });
});

describe("endedReason", () => {
  it("distinguishes denied / kicked / generic", () => {
    assert.match(endedReason({ status: "DENIED" }), /no te admiti/i);
    assert.match(endedReason({ status: "KICKED" }), /te sac/i);
    assert.match(endedReason({ status: "LEFT" }), /termin/i);
  });
});

describe("buildGuestJoinUrl", () => {
  it("builds a code URL and an invite URL", () => {
    assert.equal(buildGuestJoinUrl({ origin: "https://a.test", code: "ABCD1234" }), "https://a.test/p/call?code=ABCD1234");
    assert.equal(buildGuestJoinUrl({ origin: "https://a.test/", token: "t", invite: "i" }), "https://a.test/p/call/t?i=i");
  });
});

describe("GUEST_PHASES", () => {
  it("is the canonical list", () => {
    assert.deepEqual(GUEST_PHASES, ["gate", "lobby", "room", "ended", "error"]);
  });
});
