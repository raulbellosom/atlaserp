import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLongPressController } from "../useLongPress.js";

// Minimal fake pointer event. `tagName` drives the interactive-target guard.
function evt(x, y, tagName = "DIV") {
  return { clientX: x, clientY: y, target: { tagName, closest: null } };
}

function makeCtrl(onLongPress) {
  const ctrl = createLongPressController({
    delay: 450,
    moveTolerance: 10,
    onLongPress,
    // deterministic scheduler: capture the fn, never auto-fire
    schedule: (fn) => { ctrl.__fn = fn; return 1; },
    cancelScheduled: () => { ctrl.__fn = null; },
    vibrate: () => {},
  });
  return ctrl;
}

describe("createLongPressController", () => {
  it("fires onLongPress after the delay when the pointer does not move", () => {
    let fired = 0;
    const ctrl = makeCtrl(() => { fired++; });
    ctrl.onPointerDown(evt(0, 0));
    assert.equal(ctrl.pending, true);
    ctrl.flush();
    assert.equal(fired, 1);
  });

  it("cancels when the pointer moves beyond moveTolerance", () => {
    let fired = 0;
    const ctrl = makeCtrl(() => { fired++; });
    ctrl.onPointerDown(evt(0, 0));
    ctrl.onPointerMove(evt(40, 0));
    assert.equal(ctrl.pending, false);
    ctrl.flush();
    assert.equal(fired, 0);
  });

  it("cancels on pointerup before the delay elapses", () => {
    const ctrl = makeCtrl(() => {});
    ctrl.onPointerDown(evt(0, 0));
    ctrl.onPointerUp();
    assert.equal(ctrl.pending, false);
  });

  it("does not start on an interactive target", () => {
    const ctrl = makeCtrl(() => {});
    ctrl.onPointerDown(evt(0, 0, "A"));
    assert.equal(ctrl.pending, false);
    ctrl.onPointerDown(evt(0, 0, "BUTTON"));
    assert.equal(ctrl.pending, false);
  });

  it("tolerates small jitter under moveTolerance", () => {
    let fired = 0;
    const ctrl = makeCtrl(() => { fired++; });
    ctrl.onPointerDown(evt(0, 0));
    ctrl.onPointerMove(evt(5, 4));
    assert.equal(ctrl.pending, true);
    ctrl.flush();
    assert.equal(fired, 1);
  });

  it("fires on an interactive target when ignoreInteractiveTarget is set", () => {
    let fired = 0;
    let fn = null;
    const ctrl = createLongPressController({
      delay: 450,
      moveTolerance: 10,
      ignoreInteractiveTarget: true,
      onLongPress: () => { fired++; },
      schedule: (f) => { fn = f; return 1; },
      cancelScheduled: () => { fn = null; },
      vibrate: () => {},
    });
    ctrl.onPointerDown(evt(0, 0, "BUTTON"));
    assert.equal(ctrl.pending, true);
    fn();
    assert.equal(fired, 1);
  });
});
