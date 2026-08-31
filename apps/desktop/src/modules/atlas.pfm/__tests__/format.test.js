// apps/desktop/src/modules/atlas.pfm/__tests__/format.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  formatMoney,
  formatMonthLabel,
  percentDelta,
  creditUtilizationTone,
  creditUsage,
  formatRatePct,
  groupMovements,
} from "../lib/format.js";

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

  it("creditUtilizationTone uses fixed thresholds", () => {
    assert.equal(creditUtilizationTone(0.49), "success");
    assert.equal(creditUtilizationTone(0.5), "warning");
    assert.equal(creditUtilizationTone(0.8), "warning");
    assert.equal(creditUtilizationTone(0.81), "danger");
    assert.equal(creditUtilizationTone(null), "success");
    assert.equal(creditUtilizationTone(Number.NaN), "success");
  });

  it("creditUsage derives ocupado/disponible/util from a credit wallet", () => {
    assert.deepEqual(creditUsage({ currentBalance: -12000, creditLimit: 50000 }), {
      ocupado: 12000,
      limite: 50000,
      disponible: 38000,
      util: 0.24,
    });
  });

  it("creditUsage clamps negative debt to zero and handles no limit", () => {
    assert.deepEqual(creditUsage({ currentBalance: 500, creditLimit: null }), {
      ocupado: 0,
      limite: null,
      disponible: null,
      util: null,
    });
  });

  it("formatRatePct renders a fraction as a percent, trimming .0", () => {
    assert.equal(formatRatePct(0.15), "15%");
    assert.equal(formatRatePct(0.1325), "13.25%");
    assert.equal(formatRatePct(null), "");
    assert.equal(formatRatePct(Number.NaN), "");
  });

  it("groupMovements collapses consecutive same-month yield rows", () => {
    const rows = [
      { id: "a", isYield: false, occurredOn: "2026-08-20" },
      { id: "b", isYield: true, occurredOn: "2026-08-19", amount: 1 },
      { id: "c", isYield: true, occurredOn: "2026-08-18", amount: 2 },
      { id: "d", isYield: false, occurredOn: "2026-08-17" },
    ];
    const out = groupMovements(rows);
    assert.equal(out.length, 3);
    assert.equal(out[0].type, "movement");
    assert.equal(out[1].type, "yield-group");
    assert.equal(out[1].month, "2026-08");
    assert.equal(out[1].count, 2);
    assert.equal(out[1].total, 3);
    assert.equal(out[1].items.length, 2);
    assert.equal(out[2].type, "movement");
  });

  it("groupMovements starts a new group when the month changes and breaks on a non-yield row", () => {
    const rows = [
      { id: "a", isYield: true, occurredOn: "2026-08-02", amount: 1 },
      { id: "b", isYield: true, occurredOn: "2026-07-31", amount: 1 },
      { id: "c", isYield: false, occurredOn: "2026-07-30" },
      { id: "d", isYield: true, occurredOn: "2026-07-29", amount: 1 },
    ];
    const out = groupMovements(rows);
    assert.deepEqual(out.map((o) => o.type), ["yield-group", "yield-group", "movement", "yield-group"]);
    assert.equal(out[0].month, "2026-08");
    assert.equal(out[1].month, "2026-07");
  });

  it("groupMovements leaves a yield-free list untouched", () => {
    const rows = [
      { id: "a", isYield: false, occurredOn: "2026-08-20" },
      { id: "b", isYield: false, occurredOn: "2026-08-19" },
    ];
    const out = groupMovements(rows);
    assert.deepEqual(out.map((o) => o.type), ["movement", "movement"]);
    assert.equal(out[0].item.id, "a");
  });
});
