import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REACTION_CAP, applyDataPacket, removeReaction, dropIdentity, raiseOrder } from "../callEphemeral.js";

const empty = () => ({ reactions: [], raisedHands: new Map() });

describe("applyDataPacket", () => {
  it("appends a reaction with an id and caps the list", () => {
    let s = empty();
    for (let i = 0; i < REACTION_CAP + 5; i++) {
      s = applyDataPacket(s, { type: "reaction", emoji: "❤️", fromName: "A" }, "me");
    }
    assert.equal(s.reactions.length, REACTION_CAP);
    assert.ok(s.reactions[0].id);
    assert.equal(s.reactions[0].emoji, "❤️");
  });

  it("ignores unknown / malformed packets (same reference)", () => {
    const s0 = empty();
    assert.equal(applyDataPacket(s0, { type: "chat", body: "hi" }, "me"), s0);
    assert.equal(applyDataPacket(s0, null, "me"), s0);
    assert.equal(applyDataPacket(s0, { type: "hand" }, "me"), s0); // no identity
  });

  it("raises, re-raises to the end, lowers, and hand-lowers", () => {
    let s = empty();
    s = applyDataPacket(s, { type: "hand", identity: "u1", name: "Uno", raised: true }, "me");
    s = applyDataPacket(s, { type: "hand", identity: "u2", name: "Dos", raised: true }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u1", "u2"]);

    s = applyDataPacket(s, { type: "hand", identity: "u1", name: "Uno", raised: true }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u2", "u1"]);

    s = applyDataPacket(s, { type: "hand", identity: "u2", name: "Dos", raised: false }, "me");
    assert.deepEqual(raiseOrder(s.raisedHands).map((h) => h.identity), ["u1"]);

    s = applyDataPacket(s, { type: "hand-lower", identity: "u1" }, "me");
    assert.equal(s.raisedHands.size, 0);

    // hand-lower on an unknown identity is a no-op
    assert.equal(applyDataPacket(s, { type: "hand-lower", identity: "ghost" }, "me"), s);
  });
});

describe("removeReaction / dropIdentity", () => {
  it("removeReaction drops by id, no-ops otherwise", () => {
    let s = applyDataPacket(empty(), { type: "reaction", emoji: "👍" }, "me");
    const id = s.reactions[0].id;
    assert.equal(removeReaction(s, "nope"), s);
    s = removeReaction(s, id);
    assert.equal(s.reactions.length, 0);
  });

  it("dropIdentity removes a raised hand for a departed participant", () => {
    let s = applyDataPacket(empty(), { type: "hand", identity: "g1", name: "Guest", raised: true }, "me");
    assert.equal(dropIdentity(s, undefined), s);
    assert.equal(dropIdentity(s, "other"), s);
    s = dropIdentity(s, "g1");
    assert.equal(s.raisedHands.size, 0);
  });
});
