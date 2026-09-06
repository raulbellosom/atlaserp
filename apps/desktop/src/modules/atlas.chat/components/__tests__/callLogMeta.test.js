import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getCallMeta } from "../callLogMeta.js";

describe("getCallMeta", () => {
  it("returns the call payload for a started system message", () => {
    const msg = {
      sender_type: "system",
      message_type: "system",
      metadata: { call: { callId: "c1", kind: "VIDEO", event: "started", endReason: null, durationSec: null } },
    };
    assert.deepEqual(getCallMeta(msg), {
      callId: "c1", kind: "VIDEO", event: "started", endReason: null, durationSec: null,
    });
  });
  it("returns the call payload for an ended system message", () => {
    const msg = {
      message_type: "system",
      metadata: { call: { callId: "c2", kind: "AUDIO", event: "ended", endReason: "ended", durationSec: 754 } },
    };
    assert.equal(getCallMeta(msg).durationSec, 754);
  });
  it("parses stringified metadata", () => {
    const msg = {
      sender_type: "system",
      metadata: JSON.stringify({ call: { kind: "AUDIO", event: "ended", endReason: "missed", durationSec: null } }),
    };
    assert.equal(getCallMeta(msg).endReason, "missed");
  });
  it("returns null for a normal user message", () => {
    assert.equal(getCallMeta({ sender_type: "user", message_type: "text", body: "hola" }), null);
  });
  it("returns null for a plain system message with no call payload", () => {
    assert.equal(getCallMeta({ sender_type: "system", message_type: "system", body: "creó el grupo" }), null);
  });
  it("returns null for junk metadata and missing input", () => {
    assert.equal(getCallMeta(null), null);
    assert.equal(getCallMeta({ sender_type: "system", metadata: "{not json" }), null);
    assert.equal(getCallMeta({ sender_type: "system", metadata: { call: { event: "weird" } } }), null);
  });
});
