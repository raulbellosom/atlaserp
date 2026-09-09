# Fleet detail redesign — Plan A (API fields) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `GET /fleet/vehicles/:id` returns two extra fields the redesigned detail hero needs — the vehicle's cover image asset id and the assigned driver's photo asset id.

**Architecture:** `getVehicle()` in the fleet AME3 service is a single `prisma.$queryRaw` tagged-template SELECT. Add one correlated sub-select (lifted verbatim from the list query `getVehicles`) and one column from the already-joined `fleet_driver` alias `fd`. No migration, no new endpoint, no permission change.

**Tech Stack:** Node.js, Hono, Prisma 7 `$queryRaw`, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-fleet-detail-presentation-redesign.md`

---

### Task 1: `getVehicle` returns `cover_image_file_asset_id` and `driver_photo_asset_id`

**Files:**
- Modify: `apps/api/src/routes/fleet/fleet-service.js` (function `getVehicle`, the `SELECT` around lines 341-415)
- Test: `apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js` (create)

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js`
Expected: FAIL — first test fails on `assert.match(sql, /cover_image_file_asset_id/)` because `getVehicle` does not select that column yet.

- [ ] **Step 3: Add `driver_photo_asset_id` to the SELECT**

In `apps/api/src/routes/fleet/fleet-service.js`, inside `getVehicle`, find:

```js
          fd.phone AS driver_phone,
          fd.license_number AS driver_license_number,
```

Replace with:

```js
          fd.phone AS driver_phone,
          fd.license_number AS driver_license_number,
          fd.photo_asset_id AS driver_photo_asset_id,
```

- [ ] **Step 4: Add the `cover_image_file_asset_id` sub-select**

In the same `getVehicle` SELECT, find:

```js
            ELSE NULL
          END AS full_economic_number,
          (SELECT json_build_object(
```

Replace with (insert the sub-select between `full_economic_number` and the `active_insurance_policy` json_build_object — it is lifted verbatim from `getVehicles`, where `fv` is the same vehicle alias):

```js
            ELSE NULL
          END AS full_economic_number,
          (SELECT fvd3.file_asset_id
           FROM fleet_vehicle_document fvd3
           JOIN "file_asset" fa3 ON fa3.id::text = fvd3.file_asset_id::text
           WHERE fvd3.vehicle_id::text = fv.id::text
             AND fvd3.company_id::text = fv.company_id::text
             AND fvd3.enabled = true
             AND fa3."mime_type" ILIKE 'image/%'
           ORDER BY fvd3.created_at ASC
           LIMIT 1) AS cover_image_file_asset_id,
          (SELECT json_build_object(
```

- [ ] **Step 5: Run the new test to verify it passes**

Run: `node --test apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Syntax check + full fleet suite (no regression)**

Run: `node --check apps/api/src/routes/fleet/fleet-service.js`
Expected: no output (valid).

Run: `node --test apps/api/src/routes/fleet/__tests__/`
Expected: all pass — the 3 existing files (`company-isolation`, `pdf-branding`, `reports-transaction`, 28 assertions) plus the new `vehicle-detail-fields` file. `company-isolation.test.js` asserts every `getVehicle` read is company-scoped; the new sub-select is scoped by `fvd3.company_id::text = fv.company_id::text`, so it stays green.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/routes/fleet/fleet-service.js apps/api/src/routes/fleet/__tests__/vehicle-detail-fields.test.js
git commit -m "feat(fleet): getVehicle returns cover_image + driver_photo asset ids

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Verify driver + insurance detail payloads (read-only check, no code)

**Files:** none (verification only — record findings in the commit message of Plan B2 if anything must change).

- [ ] **Step 1: Confirm `getDriver` already returns `photo_asset_id_resolved`**

Run: `grep -n "photo_asset_id_resolved" apps/api/src/routes/fleet/driver-service.js`
Expected: a match inside `async function getDriver` (around line 408). The driver hero blueprint will use `imageField: "photo_asset_id_resolved"`. If — and only if — the match is absent from `getDriver`, note it; the blueprint would then use `imageField: "photo_asset_id"` instead (no renderer change).

- [ ] **Step 2: Confirm `getPolicy` returns `is_active`, `vehicle_plate`, `coverage_type_label`**

Run: `grep -n "is_active\|vehicle_plate\|coverage_type_label" apps/api/src/routes/fleet/insurance-service.js`
Expected: matches inside the single-policy getter. These back the insurance hero (`statusField: "is_active"` + `statusMap`, chips for plate / coverage / expiry). If any is missing, note it for Plan B2 (the chip/kpi for that field is dropped rather than adding API work).

- [ ] **Step 3: No commit** (nothing changed).

---

## Self-review

- **Spec coverage:** Spec "API change" section = Task 1 (both fields, verbatim sub-select, no migration). Spec "Plan A verifies `getDriver`…" = Task 2. Covered.
- **Placeholders:** none — full test code and exact anchored edits provided.
- **Type consistency:** field names `cover_image_file_asset_id` / `driver_photo_asset_id` match the spec's `VEHICLE_DETAIL` hero (`imageField: "cover_image_file_asset_id"`) and relation-card (`avatarField: "driver_photo_asset_id"`) in Plan B2.
