import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  growthAnalyticsExportQuerySchema,
  growthAnalyticsQuerySchema,
} from "../index.js";

describe("growth analytics validators", () => {
  it("accepts valid filters and coerces comparison", () => {
    const result = growthAnalyticsQuerySchema.parse({
      from: "2026-06-01",
      to: "2026-06-14",
      compare: "true",
      siteId: "01900000-0000-7000-8000-000000000002",
    });
    assert.equal(result.compare, true);
  });

  it("rejects reversed and over-25-month ranges", () => {
    assert.equal(
      growthAnalyticsQuerySchema.safeParse({
        from: "2026-02-31",
        to: "2026-03-01",
      }).success,
      false,
    );
    assert.equal(
      growthAnalyticsQuerySchema.safeParse({
        from: "2026-06-14",
        to: "2026-06-01",
      }).success,
      false,
    );
    assert.equal(
      growthAnalyticsQuerySchema.safeParse({
        from: "2024-01-01",
        to: "2026-06-14",
      }).success,
      false,
    );
  });

  it("restricts export reports", () => {
    assert.equal(
      growthAnalyticsExportQuerySchema.safeParse({
        report: "overview",
        from: "2026-06-01",
        to: "2026-06-14",
      }).success,
      true,
    );
    assert.equal(
      growthAnalyticsExportQuerySchema.safeParse({
        report: "arbitrary",
      }).success,
      false,
    );
  });
});
