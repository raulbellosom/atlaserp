// apps/api/src/routes/fleet/__tests__/reports-transaction.test.js
//
// A report and its parts must be written atomically: if a part insert fails,
// the report row must not survive. Regression guard for the pre-2026 code that
// inserted the report and then looped part inserts in separate statements.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createReportsService } from "../reports-service.js";

const COMPANY = "01900000-0000-7000-8000-000000000001";
const VEHICLE = "01900000-0000-7000-8000-0000000000aa";

function buildPrisma({ failOnPartInsert = false } = {}) {
  const state = { reportInserted: false, partsInserted: 0, committed: null };

  async function run(strings) {
    const sql = Array.isArray(strings) ? strings.join(" ") : String(strings);
    if (/INSERT INTO fleet_report\b/i.test(sql)) {
      state.reportInserted = true;
      return [{ id: "01900000-0000-7000-8000-0000000000bb", report_type: "maintenance", status: "draft" }];
    }
    if (/INSERT INTO fleet_report_part\b/i.test(sql)) {
      if (failOnPartInsert) throw new Error("simulated part insert failure");
      state.partsInserted += 1;
      return [];
    }
    if (/SELECT folio FROM fleet_report/i.test(sql)) return [];
    return [];
  }

  const prisma = {
    state,
    $queryRaw: (s, ...v) => run(s, ...v),
    $queryRawUnsafe: (s, ...v) => run(s, ...v),
    $executeRawUnsafe: async () => 0,
    auditLog: { create: async () => ({}) },
    async $transaction(fn) {
      try {
        const result = await fn(prisma);
        state.committed = true;
        return result;
      } catch (err) {
        state.committed = false;
        throw err;
      }
    },
  };
  return prisma;
}

const payload = {
  report_type: "maintenance",
  vehicle_id: VEHICLE,
  title: "Servicio 10k",
  report_date: "2026-08-01",
  maintenance_subtype: "preventive",
  next_service_date: "2026-11-01",
  labor_cost: 100,
  parts: [{ name: "Filtro", quantity: 1, unit_cost: 50 }],
};

describe("reports-service.createReport is transactional", () => {
  it("writes the report and its parts inside a single $transaction", async () => {
    const prisma = buildPrisma();
    const service = createReportsService({ prisma });
    await service.createReport({
      companyId: COMPANY,
      actorId: null,
      payload,
      reportType: "maintenance",
    }).catch(() => {});
    assert.equal(prisma.state.reportInserted, true);
    assert.equal(prisma.state.partsInserted, 1);
    assert.equal(prisma.state.committed, true, "the transaction should commit");
  });

  it("does not commit the report when a part insert fails", async () => {
    const prisma = buildPrisma({ failOnPartInsert: true });
    const service = createReportsService({ prisma });
    await assert.rejects(() =>
      service.createReport({
        companyId: COMPANY,
        actorId: null,
        payload,
        reportType: "maintenance",
      }),
    );
    assert.equal(
      prisma.state.committed,
      false,
      "a failed part insert must abort the whole transaction",
    );
  });
});
