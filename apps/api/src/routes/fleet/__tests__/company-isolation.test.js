// apps/api/src/routes/fleet/__tests__/company-isolation.test.js
//
// Guards the atlas.fleet multi-tenancy contract:
//   1. Every service rejects a call without a valid company UUID BEFORE it
//      touches the database (no "owner_id IS NULL"-style implicit sharing, no
//      company_id sourced from the request body).
//   2. Every read query the services emit is scoped by `company_id`.
//
// The services are AME3 (raw SQL) services, so we stub `$queryRaw` /
// `$queryRawUnsafe` / `$executeRawUnsafe` and assert on the SQL shape.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createFleetService, FleetServiceError } from "../fleet-service.js";
import { createDriverService } from "../driver-service.js";
import { createCatalogService } from "../catalog-service.js";
import { createInsuranceService } from "../insurance-service.js";
import { createReportsService } from "../reports-service.js";

const VALID_COMPANY = "01900000-0000-7000-8000-000000000001";

function sqlText(strings) {
  if (Array.isArray(strings)) return strings.join(" ? ");
  return String(strings ?? "");
}

function recordingPrisma() {
  const seen = [];
  const handler = (strings, ...values) => {
    seen.push({ sql: sqlText(strings), values });
    return Promise.resolve([]);
  };
  return {
    seen,
    $queryRaw: handler,
    $queryRawUnsafe: (sql, ...values) => {
      seen.push({ sql: String(sql), values });
      return Promise.resolve([]);
    },
    $executeRaw: handler,
    $executeRawUnsafe: (sql) => {
      seen.push({ sql: String(sql), values: [] });
      return Promise.resolve(0);
    },
    $transaction: async (fn) => fn(recordingPrisma()),
    auditLog: { create: async () => ({}) },
    company: { findUnique: async () => null },
    brandingConfig: { findUnique: async () => null },
  };
}

// [label, invoke(service, companyId)] — one representative read per service.
const READ_CALLS = [
  [
    "fleet.listVehicles",
    (prisma, companyId) =>
      createFleetService({ prisma }).listVehicles({ companyId }),
  ],
  [
    "drivers.listDrivers",
    (prisma, companyId) =>
      createDriverService({ prisma }).listDrivers({ companyId }),
  ],
  [
    "catalog.listVehicleTypes",
    (prisma, companyId) =>
      createCatalogService({ prisma }).listVehicleTypes({ companyId }),
  ],
  [
    "insurance.listPolicies",
    (prisma, companyId) =>
      createInsuranceService({ prisma }).listPolicies({ companyId }),
  ],
  [
    "reports.listReportsAnyType",
    (prisma, companyId) =>
      createReportsService({ prisma }).listReportsAnyType({ companyId }),
  ],
];

describe("atlas.fleet — company scoping is mandatory", () => {
  for (const [label, invoke] of READ_CALLS) {
    it(`${label} rejects a missing companyId with a 400 before querying`, async () => {
      const prisma = recordingPrisma();
      await assert.rejects(
        () => invoke(prisma, null),
        (err) =>
          err instanceof FleetServiceError && err.status === 400,
        `${label} must throw FleetServiceError(400) when companyId is absent`,
      );
      assert.equal(
        prisma.seen.length,
        0,
        `${label} must not issue any query when companyId is missing`,
      );
    });

    it(`${label} rejects a non-UUID companyId (e.g. a legacy cuid) with a 400`, async () => {
      const prisma = recordingPrisma();
      await assert.rejects(
        () => invoke(prisma, "ckpqr9s000000000000000000"),
        (err) => err instanceof FleetServiceError && err.status === 400,
      );
      assert.equal(prisma.seen.length, 0);
    });

    it(`${label} scopes every emitted query by company_id`, async () => {
      const prisma = recordingPrisma();
      await invoke(prisma, VALID_COMPANY).catch(() => {});
      assert.ok(prisma.seen.length > 0, `${label} should have issued a query`);
      for (const { sql } of prisma.seen) {
        assert.ok(
          /company_id/i.test(sql),
          `${label} emitted a query with no company_id filter:\n${sql}`,
        );
        assert.ok(
          !/owner_id\s+is\s+null/i.test(sql),
          `${label} must never treat a NULL owner/company as world-readable`,
        );
      }
    });
  }
});
