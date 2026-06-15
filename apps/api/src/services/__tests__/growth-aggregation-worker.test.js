import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createGrowthAggregationWorker } from "../growth-aggregation-worker.js";

const NOW = new Date("2026-06-14T12:00:00.000Z");
const COMPANY_ID = "01900000-0000-7000-8000-000000000001";
const SITE_ID = "01900000-0000-7000-8000-000000000002";

function dayKey(value) {
  return value.toISOString().slice(0, 10);
}

function createPrisma() {
  const state = {
    watermark: "2026-06-13",
    queriedDays: [],
    metrics: new Map(),
  };

  const rowsByDay = {
    "2026-06-12": [
      {
        companyId: COMPANY_ID,
        siteId: SITE_ID,
        dimensionType: "site",
        dimensionKey: "",
        metrics: { sessions: 3, engagedSessions: 2 },
      },
      {
        companyId: COMPANY_ID,
        siteId: SITE_ID,
        dimensionType: "source",
        dimensionKey: "google|cpc|summer",
        metrics: { sessions: 2, conversions: 1 },
      },
      {
        companyId: COMPANY_ID,
        siteId: SITE_ID,
        dimensionType: "funnel",
        dimensionKey: "form_view",
        metrics: { count: 4 },
      },
    ],
    "2026-06-13": [
      {
        companyId: COMPANY_ID,
        siteId: SITE_ID,
        dimensionType: "retention",
        dimensionKey: "2026-06-12",
        metrics: { cohortVisitors: 2, d1: 1, d7: 0, d30: 0 },
      },
    ],
  };

  const prisma = {
    instanceConfig: {
      findUnique: async () => ({ value: state.watermark }),
      upsert: async ({ create, update }) => {
        state.watermark = update.value ?? create.value;
      },
    },
    growthEvent: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    growthSession: {
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    growthDailyMetric: {
      upsert: async ({ where, create, update }) => {
        const keyData =
          where.siteId_metricDate_dimensionType_dimensionKey;
        const key = [
          keyData.siteId,
          dayKey(keyData.metricDate),
          keyData.dimensionType,
          keyData.dimensionKey,
        ].join(":");
        state.metrics.set(key, {
          ...(state.metrics.get(key) ?? create),
          ...update,
        });
      },
      findMany: async () => [],
      deleteMany: async () => ({ count: 0 }),
    },
    $queryRaw: async (_strings, dayStart) => {
      const key = dayKey(dayStart);
      state.queriedDays.push(key);
      return rowsByDay[key] ?? [];
    },
    $transaction: async (callback) => callback(prisma),
    _state: state,
  };
  return prisma;
}

describe("createGrowthAggregationWorker", () => {
  it("recomputes recent complete days and upserts every metric dimension", async () => {
    const prisma = createPrisma();
    const worker = createGrowthAggregationWorker({
      prisma,
      now: () => NOW,
      reprocessDays: 2,
    });

    const first = await worker.runOnce();
    assert.deepEqual(prisma._state.queriedDays, [
      "2026-06-12",
      "2026-06-13",
    ]);
    assert.equal(first.aggregatedDays, 2);
    assert.equal(first.aggregatedDimensions, 4);
    assert.equal(prisma._state.metrics.size, 4);
    assert.equal(prisma._state.watermark, "2026-06-13");
    assert.deepEqual(
      prisma._state.metrics.get(
        `${SITE_ID}:2026-06-13:retention:2026-06-12`,
      ).metrics,
      { cohortVisitors: 2, d1: 1, d7: 0, d30: 0 },
    );

    prisma._state.queriedDays = [];
    await worker.runOnce();
    assert.equal(prisma._state.metrics.size, 4);
    assert.ok(!prisma._state.queriedDays.includes("2026-06-14"));
  });

  it("purges retained models in bounded batches after aggregation", async () => {
    const prisma = createPrisma();
    const cutoffs = {};
    prisma.growthEvent.findMany = async ({ where, take }) => {
      cutoffs.events = where.serverReceivedAt.lt;
      assert.equal(take, 2);
      return [{ id: "event-1" }, { id: "event-2" }];
    };
    prisma.growthEvent.deleteMany = async ({ where }) => ({
      count: where.id.in.length,
    });
    prisma.growthSession.findMany = async ({ where, take }) => {
      cutoffs.sessions = where.lastSeenAt.lt;
      assert.equal(take, 2);
      return [{ id: "session-1" }];
    };
    prisma.growthSession.deleteMany = async ({ where }) => ({
      count: where.id.in.length,
    });
    prisma.growthDailyMetric.findMany = async ({ where, take }) => {
      cutoffs.metrics = where.metricDate.lt;
      assert.equal(take, 2);
      return [{ id: "metric-1" }];
    };
    prisma.growthDailyMetric.deleteMany = async ({ where }) => ({
      count: where.id.in.length,
    });

    const worker = createGrowthAggregationWorker({
      prisma,
      now: () => NOW,
      purgeBatchSize: 2,
    });
    const result = await worker.runOnce();

    assert.deepEqual(result.purged, {
      events: 2,
      sessions: 1,
      metrics: 1,
    });
    assert.equal(dayKey(cutoffs.events), "2026-03-16");
    assert.equal(dayKey(cutoffs.sessions), "2024-05-14");
    assert.equal(dayKey(cutoffs.metrics), "2024-05-01");
  });
});
