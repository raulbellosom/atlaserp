import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeActionSheetLayout } from "../messageActionLayout.js";

const base = {
  vw: 390,
  vh: 844,
  pillSize: { width: 220, height: 44 },
  panelSize: { width: 240, height: 300 },
  safeTop: 59,
  safeBottom: 34,
  gap: 8,
  margin: 8,
};

describe("computeActionSheetLayout — touch", () => {
  it("keeps the pill below the top safe inset for a message near the top", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 20, bottom: 70, left: 12, right: 300 },
    });
    assert.ok(out.pillTop >= base.margin + base.safeTop - 0.5, `pillTop ${out.pillTop}`);
    assert.ok(out.sRect.top >= base.margin + base.safeTop - 0.5, `sRect.top ${out.sRect.top}`);
    assert.ok(out.shiftY > 0, `expected downward shift, got ${out.shiftY}`);
  });

  it("keeps the card above the bottom safe inset for a message near the bottom", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 780, bottom: 830, left: 90, right: 378 },
    });
    assert.ok(out.panelTop + base.panelSize.height <= base.vh - base.margin - base.safeBottom + 0.5,
      `card bottom ${out.panelTop + base.panelSize.height} vs ${base.vh - base.margin - base.safeBottom}`);
    assert.ok(out.shiftY < 0, `expected upward shift, got ${out.shiftY}`);
  });

  it("does not shift a comfortably centered message that already fits", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 380, bottom: 430, left: 12, right: 300 },
    });
    assert.equal(out.shiftY, 0);
  });

  it("right-aligns the pill and panel for an own message", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 380, bottom: 430, left: 120, right: 378 },
    });
    // own → hug the right edge of the bubble
    assert.ok(out.panelLeft + base.panelSize.width <= 378 + 0.5);
  });
});

describe("computeActionSheetLayout — mouse", () => {
  it("anchors to the cursor point and never shifts", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: false,
      isOwn: true,
      anchorPoint: { x: 200, y: 400 },
      rect: { top: 380, bottom: 430, left: 120, right: 378 },
    });
    assert.equal(out.shiftY, 0);
    assert.ok(out.panelLeft >= base.margin);
    assert.ok(out.panelLeft <= base.vw - base.panelSize.width - base.margin);
  });
});
