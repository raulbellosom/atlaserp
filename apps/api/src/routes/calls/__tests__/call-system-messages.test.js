import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatCallDuration, buildCallSystemMessage } from "../call-system-messages.js";

describe("formatCallDuration", () => {
  it("formats sub-hour durations as m:ss", () => {
    assert.equal(formatCallDuration(0), "0:00");
    assert.equal(formatCallDuration(9), "0:09");
    assert.equal(formatCallDuration(60), "1:00");
    assert.equal(formatCallDuration(754), "12:34");
  });
  it("formats hour-plus durations as h:mm:ss", () => {
    assert.equal(formatCallDuration(3600), "1:00:00");
    assert.equal(formatCallDuration(3661), "1:01:01");
  });
  it("clamps negatives and non-finite input to 0:00", () => {
    assert.equal(formatCallDuration(-5), "0:00");
    assert.equal(formatCallDuration(Number.NaN), "0:00");
    assert.equal(formatCallDuration(undefined), "0:00");
  });
});

describe("buildCallSystemMessage", () => {
  it("started + VIDEO", () => {
    const out = buildCallSystemMessage({ event: "started", kind: "VIDEO" });
    assert.equal(out.body, "Videollamada iniciada");
    assert.deepEqual(out.metadata.call, { kind: "VIDEO", event: "started", endReason: null, durationSec: null });
  });
  it("started + AUDIO", () => {
    const out = buildCallSystemMessage({ event: "started", kind: "AUDIO" });
    assert.equal(out.body, "Llamada de voz iniciada");
    assert.equal(out.metadata.call.kind, "AUDIO");
  });
  it("ended with a real duration", () => {
    const startedAt = new Date("2026-09-06T10:00:00.000Z");
    const endedAt = new Date("2026-09-06T10:12:34.000Z");
    const out = buildCallSystemMessage({ event: "ended", kind: "VIDEO", endReason: "ended", startedAt, endedAt });
    assert.equal(out.body, "Llamada finalizada · 12:34");
    assert.deepEqual(out.metadata.call, { kind: "VIDEO", event: "ended", endReason: "ended", durationSec: 754 });
  });
  it("ended with no startedAt => perdida (even when endReason is 'ended')", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "AUDIO", endReason: "ended", startedAt: null });
    assert.equal(out.body, "Llamada perdida");
    assert.equal(out.metadata.call.endReason, "missed");
    assert.equal(out.metadata.call.durationSec, null);
  });
  it("ended + missed", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "AUDIO", endReason: "missed" });
    assert.equal(out.body, "Llamada perdida");
    assert.equal(out.metadata.call.endReason, "missed");
  });
  it("ended + rejected wins over the missing startedAt", () => {
    const out = buildCallSystemMessage({ event: "ended", kind: "VIDEO", endReason: "rejected", startedAt: null });
    assert.equal(out.body, "Llamada rechazada");
    assert.equal(out.metadata.call.endReason, "rejected");
  });
});
