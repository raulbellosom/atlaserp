import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSwipeController } from "../useSwipeToReply.js";

const target = { setPointerCapture() {}, releasePointerCapture() {} };

function drag(ctrl, points) {
  ctrl.onPointerDown({ clientX: points[0][0], clientY: points[0][1], pointerId: 1, currentTarget: target });
  for (const [x, y] of points.slice(1)) ctrl.onPointerMove({ clientX: x, clientY: y });
  ctrl.onPointerUp();
}

describe("createSwipeController", () => {
  it("fires onReply for a right swipe past threshold (direction=right)", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[0, 0], [30, 2], [80, 4]]);
    assert.equal(fired, 1);
  });

  it("does not fire for a right swipe that never reaches threshold", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[0, 0], [20, 0], [40, 0]]);
    assert.equal(fired, 0);
  });

  it("ignores a mostly-vertical drag (scroll intent) and never translates", () => {
    let fired = 0;
    const translates = [];
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => fired++, onTranslate: (v) => translates.push(v) });
    drag(ctrl, [[0, 0], [10, 40], [20, 120]]);
    assert.equal(fired, 0);
    assert.ok(translates.every((v) => v === 0), "no horizontal translate on vertical intent");
  });

  it("direction=left: a right drag never fires", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "left", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[100, 0], [140, 0], [180, 0]]);
    assert.equal(fired, 0);
  });

  it("direction=left: a left drag past threshold fires", () => {
    let fired = 0;
    const ctrl = createSwipeController({ threshold: 64, direction: "left", onReply: () => fired++, onTranslate: () => {} });
    drag(ctrl, [[200, 0], [160, 0], [120, 0]]);
    assert.equal(fired, 1);
  });

  it("resets translate to 0 on release below threshold", () => {
    const translates = [];
    const ctrl = createSwipeController({ threshold: 64, direction: "right", onReply: () => {}, onTranslate: (v) => translates.push(v) });
    drag(ctrl, [[0, 0], [30, 0]]);
    assert.equal(translates[translates.length - 1], 0);
  });
});
