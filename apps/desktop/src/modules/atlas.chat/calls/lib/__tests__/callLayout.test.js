import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolvePinnedEntry, spotlightStrip } from "../callLayout.js";

const p = (id, isLocal = false) => ({ participant: { identity: id, sid: id }, isLocal });
const parts = [p("me", true), p("a"), p("b")];

describe("resolvePinnedEntry", () => {
  it("returns the matching entry", () => {
    assert.equal(resolvePinnedEntry(parts, "a").participant.identity, "a");
  });
  it("null for an unknown or empty pin", () => {
    assert.equal(resolvePinnedEntry(parts, "ghost"), null);
    assert.equal(resolvePinnedEntry(parts, null), null);
  });
});

describe("spotlightStrip", () => {
  it("excludes the pinned entry from the strip", () => {
    const out = spotlightStrip({ participants: parts, pinnedIdentity: "a", screenShareEntry: null });
    assert.equal(out.mainEntry.participant.identity, "a");
    assert.deepEqual(out.others.map((e) => e.participant.identity), ["me", "b"]);
    assert.equal(out.showScreenTile, false);
  });
  it("shows a screen tile only when a screen exists and isn't the pinned one", () => {
    const screenB = p("b");
    assert.equal(spotlightStrip({ participants: parts, pinnedIdentity: "a", screenShareEntry: screenB }).showScreenTile, true);
    assert.equal(spotlightStrip({ participants: parts, pinnedIdentity: "b", screenShareEntry: screenB }).showScreenTile, false);
  });
  it("null main when the pin does not resolve", () => {
    const out = spotlightStrip({ participants: parts, pinnedIdentity: "ghost", screenShareEntry: null });
    assert.equal(out.mainEntry, null);
    assert.deepEqual(out.others, []);
  });
});
