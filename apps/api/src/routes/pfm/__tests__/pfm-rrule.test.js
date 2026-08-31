// apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeNextRun, firstRunOnOrAfter } from "../pfm-rrule.js";

const at = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe("pfm-rrule", () => {
  it("MONTHLY on byMonthDay=15 advances to the next month, same day", () => {
    const next = computeNextRun({ freq: "MONTHLY", interval: 1, byMonthDay: 15 }, at("2026-08-15"));
    assert.equal(next.toISOString().slice(0, 10), "2026-09-15");
  });

  it("MONTHLY interval=1 clamps byMonthDay=31 to the last day of a short month", () => {
    const next = computeNextRun({ freq: "MONTHLY", interval: 1, byMonthDay: 31 }, at("2026-01-31"));
    assert.equal(next.toISOString().slice(0, 10), "2026-02-28");
  });

  it("WEEKLY interval=2 advances 14 days", () => {
    const next = computeNextRun({ freq: "WEEKLY", interval: 2 }, at("2026-08-03"));
    assert.equal(next.toISOString().slice(0, 10), "2026-08-17");
  });

  it("YEARLY advances one year", () => {
    const next = computeNextRun({ freq: "YEARLY", interval: 1 }, at("2026-03-01"));
    assert.equal(next.toISOString().slice(0, 10), "2027-03-01");
  });

  it("DAILY interval=3 advances 3 days", () => {
    const next = computeNextRun({ freq: "DAILY", interval: 3 }, at("2026-08-10"));
    assert.equal(next.toISOString().slice(0, 10), "2026-08-13");
  });

  it("firstRunOnOrAfter(MONTHLY byMonthDay=15, anchor 2026-08-20) is 2026-09-15", () => {
    const first = firstRunOnOrAfter(
      { freq: "MONTHLY", interval: 1, byMonthDay: 15 },
      at("2026-08-20"),
    );
    assert.equal(first.toISOString().slice(0, 10), "2026-09-15");
  });

  it("firstRunOnOrAfter(MONTHLY byMonthDay=15, anchor 2026-08-10) is 2026-08-15", () => {
    const first = firstRunOnOrAfter(
      { freq: "MONTHLY", interval: 1, byMonthDay: 15 },
      at("2026-08-10"),
    );
    assert.equal(first.toISOString().slice(0, 10), "2026-08-15");
  });

  it("invalid freq returns null", () => {
    assert.equal(computeNextRun({ freq: "HOURLY" }, at("2026-08-10")), null);
  });
});
