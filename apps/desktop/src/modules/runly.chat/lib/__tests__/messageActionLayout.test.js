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
const mTop = base.margin + base.safeTop;       // 67
const mBottom = base.margin + base.safeBottom;  // 42

describe("computeActionSheetLayout — touch spotlight", () => {
  it("does not scale or move a small message that already fits", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 380, bottom: 430, left: 12, right: 300 },
    });
    assert.equal(out.mode, "spotlight");
    assert.equal(out.scale, 1);
    assert.equal(out.cloneTop, 380, "clone stays exactly over the real bubble");
    assert.equal(out.cloneLeft, 12);
    // origin echoes the real bubble so the raise transition is a no-op here
    assert.equal(out.originTop, 380);
    assert.equal(out.originLeft, 12);
  });

  it("scales the copy down when pill + bubble + card can't fit the safe area", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 60, bottom: 660, left: 12, right: 320 }, // 600px tall
    });
    assert.ok(out.scale < 1, `expected scale < 1, got ${out.scale}`);
    assert.ok(out.scale >= 0.55, `never past minScale, got ${out.scale}`);
    // the whole stack now fits between the insets
    assert.ok(out.pillTop >= mTop - 0.5, `pillTop ${out.pillTop}`);
    assert.ok(
      out.panelTop + base.panelSize.height <= base.vh - mBottom + 0.5,
      `card bottom ${out.panelTop + base.panelSize.height}`,
    );
    // sRect (on-screen copy) height reflects the scale
    assert.ok(
      Math.abs((out.sRect.bottom - out.sRect.top) - 600 * out.scale) < 1,
      "sRect height tracks the scaled copy",
    );
  });

  it("pushes the copy down so the pill clears the top inset for a message near the top", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 20, bottom: 70, left: 12, right: 300 },
    });
    assert.ok(out.cloneTop >= mTop + base.pillSize.height + base.gap - 0.5, `cloneTop ${out.cloneTop}`);
    assert.ok(out.pillTop >= mTop - 0.5, `pillTop ${out.pillTop}`);
  });

  it("pulls the copy up so the card clears the bottom inset for a message near the bottom", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 790, bottom: 838, left: 90, right: 378 },
    });
    assert.ok(out.cloneTop < 790, `expected upward move, cloneTop ${out.cloneTop}`);
    assert.ok(
      out.panelTop + base.panelSize.height <= base.vh - mBottom + 0.5,
      `card bottom ${out.panelTop + base.panelSize.height}`,
    );
  });

  it("hugs the right edge of an own message for the pill and the card", () => {
    const rect = { top: 380, bottom: 430, left: 120, right: 378 };
    const out = computeActionSheetLayout({
      ...base, coarse: true, isOwn: true, anchorPoint: null, rect,
    });
    assert.ok(out.pillLeft + base.pillSize.width <= rect.right + 0.5, `pill right ${out.pillLeft + base.pillSize.width}`);
    assert.ok(out.panelLeft + base.panelSize.width <= rect.right + 0.5, `card right ${out.panelLeft + base.panelSize.width}`);
  });

  it("hugs the left edge of a received message", () => {
    const rect = { top: 380, bottom: 430, left: 14, right: 260 };
    const out = computeActionSheetLayout({
      ...base, coarse: true, isOwn: false, anchorPoint: null, rect,
    });
    assert.equal(out.cloneLeft, 14);
    assert.ok(out.pillLeft >= base.margin);
    assert.ok(out.panelLeft >= base.margin);
  });
  it("pins the card to the bubble's own edge instead of overlapping a huge message", () => {
    // 2200px-tall content: even minScale can't shrink it into the safe area.
    const ownOut = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: true,
      anchorPoint: null,
      rect: { top: 100, bottom: 2300, left: 40, right: 378 },
    });
    assert.equal(ownOut.scale, 0.55, "clamped to minScale");
    // Pinned near the top-right edge — clear of the centered bubble copy.
    assert.ok(ownOut.panelLeft + base.panelSize.width <= base.vw - base.margin + 0.5);
    assert.ok(ownOut.panelLeft >= base.vw - base.margin - base.panelSize.width - 0.5);
    assert.ok(ownOut.panelTop >= mTop - 0.5);

    const receivedOut = computeActionSheetLayout({
      ...base,
      coarse: true,
      isOwn: false,
      anchorPoint: null,
      rect: { top: 100, bottom: 2300, left: 12, right: 320 },
    });
    // Pinned near the top-left edge for a received message.
    assert.ok(receivedOut.panelLeft <= base.margin + 0.5);
  });
});

describe("computeActionSheetLayout — mouse", () => {
  it("anchors a bare menu at the cursor, no spotlight, no scale", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: false,
      isOwn: true,
      anchorPoint: { x: 200, y: 400 },
      rect: { top: 380, bottom: 430, left: 120, right: 378 },
    });
    assert.equal(out.mode, "menu");
    assert.equal(out.scale, 1);
    assert.ok(out.panelLeft >= base.margin);
    assert.ok(out.panelLeft <= base.vw - base.panelSize.width - base.margin);
    assert.ok(out.panelTop >= mTop - 0.5);
    assert.ok(out.pillTop >= mTop - 0.5);
  });

  it("clamps the menu inside the bottom inset when the cursor is low", () => {
    const out = computeActionSheetLayout({
      ...base,
      coarse: false,
      isOwn: false,
      anchorPoint: { x: 40, y: 830 },
      rect: null,
    });
    assert.ok(out.panelTop + base.panelSize.height <= base.vh - mBottom + 0.5);
  });
});
