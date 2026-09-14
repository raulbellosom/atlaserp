import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { nextCallView, shouldShowScreenSegment, CALL_VIEWS } from "../callChat.js";

describe("nextCallView", () => {
  it("keeps a valid view when nothing forces a change", () => {
    assert.equal(nextCallView("video", { hasScreenShare: false }), "video");
    assert.equal(nextCallView("chat", { hasScreenShare: false }), "chat");
    assert.equal(nextCallView("chat", { hasScreenShare: true }), "chat");
    assert.equal(nextCallView("screen", { hasScreenShare: true }), "screen");
  });
  it("collapses screen -> video when the share ends", () => {
    assert.equal(nextCallView("screen", { hasScreenShare: false }), "video");
  });
  it("falls back to video for unknown views and missing options", () => {
    assert.equal(nextCallView("bogus", { hasScreenShare: true }), "video");
    assert.equal(nextCallView(undefined), "video");
    assert.equal(nextCallView("screen"), "video");
  });
});

describe("shouldShowScreenSegment", () => {
  it("mirrors screen-share liveness", () => {
    assert.equal(shouldShowScreenSegment(true), true);
    assert.equal(shouldShowScreenSegment(false), false);
    assert.equal(shouldShowScreenSegment(undefined), false);
  });
});

describe("CALL_VIEWS", () => {
  it("is the canonical ordered list", () => {
    assert.deepEqual(CALL_VIEWS, ["video", "screen", "chat"]);
  });
});
