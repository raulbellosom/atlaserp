import assert from "node:assert/strict";
import { test } from "node:test";

import {
  GROWTH_LEAD_PRIORITIES,
  GROWTH_LEAD_STATUSES,
  growthLeadCreateSchema,
  growthLeadUpdateSchema,
} from "../index.js";

test("exports the Growth lead enums and validators", () => {
  assert.deepEqual(GROWTH_LEAD_STATUSES, [
    "new",
    "follow_up",
    "qualified",
    "discarded",
    "converted",
  ]);
  assert.deepEqual(GROWTH_LEAD_PRIORITIES, ["low", "normal", "high"]);
  assert.equal(
    growthLeadCreateSchema.parse({ name: "Ana" }).priority,
    "normal",
  );
  assert.equal(
    growthLeadUpdateSchema.safeParse({
      updatedAt: "2026-06-14T21:30:00.000Z",
    }).success,
    false,
  );
});
