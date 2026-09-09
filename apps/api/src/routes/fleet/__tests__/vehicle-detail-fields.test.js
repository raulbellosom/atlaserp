// Guards the fields the redesigned vehicle detail hero depends on:
//   - cover_image_file_asset_id  (first image among the vehicle's documents)
//   - driver_photo_asset_id      (assigned driver's photo)
// getVehicle() emits one raw SELECT; we stub $queryRaw and assert on its shape.
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createFleetService } from "../fleet-service.js";

const VALID_COMPANY = "01900000-0000-7000-8000-000000000001";
const VALID_ID = "01900000-0000-7000-8000-0000000000aa";

function sqlText(strings) {
  return Array.isArray(strings) ? strings.join(" ? ") : String(strings ?? "");
}

function stubPrisma() {
  const seen = [];
  return {
    seen,
    $queryRaw: (strings, ...values) => {
      seen.push({ sql: sqlText(strings), values });
      return Promise.resolve([
        {
          id: VALID_ID,
          company_id: VALID_COMPANY,
          plate: "PVR-8109",
          cover_image_file_asset_id: null,
          driver_photo_asset_id: null,
        },
      ]);
    },
  };
}

describe("fleet getVehicle detail fields", () => {
  it("selects cover_image_file_asset_id and driver_photo_asset_id", async () => {
    const prisma = stubPrisma();
    const service = createFleetService({ prisma });
    await service.getVehicle({ companyId: VALID_COMPANY, id: VALID_ID });

    assert.equal(prisma.seen.length, 1);
    const { sql } = prisma.seen[0];
    assert.match(sql, /cover_image_file_asset_id/);
    assert.match(sql, /driver_photo_asset_id/);
    // cover image must be scoped by company + enabled + image mime, like the list query
    assert.match(sql, /fleet_vehicle_document/);
    assert.match(sql, /mime_type.{0,20}ILIKE .{0,10}image/i);
  });

  it("returns the two keys on the row object", async () => {
    const prisma = stubPrisma();
    const service = createFleetService({ prisma });
    const row = await service.getVehicle({ companyId: VALID_COMPANY, id: VALID_ID });
    assert.ok(Object.prototype.hasOwnProperty.call(row, "cover_image_file_asset_id"));
    assert.ok(Object.prototype.hasOwnProperty.call(row, "driver_photo_asset_id"));
  });
});
