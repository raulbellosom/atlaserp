// apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatMonthLabel, percentDelta } from "../lib/format.js";

describe("pfm format helpers", () => {
  it("formatMoney renders MXN with 2 decimals and a currency symbol", () => {
    assert.equal(formatMoney(1234.5, "MXN"), "$1,234.50");
    assert.equal(formatMoney(-89, "MXN"), "-$89.00");
    assert.equal(formatMoney(null, "MXN"), "$0.00");
  });

  it("formatMonthLabel turns 2026-08 into a short Spanish label", () => {
    assert.equal(formatMonthLabel("2026-08"), "ago 2026");
  });

  it("percentDelta returns a rounded signed percentage or null when base is 0", () => {
    assert.equal(percentDelta(150, 100), 50);
    assert.equal(percentDelta(80, 100), -20);
    assert.equal(percentDelta(100, 0), null);
  });
});
