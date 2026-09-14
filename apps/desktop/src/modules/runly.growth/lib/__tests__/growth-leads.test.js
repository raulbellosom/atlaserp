import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  describeLeadActivity,
  getAllowedLeadStatuses,
  getGrowthLeadId,
  getLeadStatusLabel,
} from "../growth-leads.js";

describe("growth lead presentation helpers", () => {
  it("keeps converted terminal and allows discarded leads to reopen", () => {
    assert.deepEqual(
      getAllowedLeadStatuses("converted").map((option) => option.value),
      ["converted"],
    );
    assert.deepEqual(
      getAllowedLeadStatuses("discarded").map((option) => option.value),
      ["follow_up", "discarded"],
    );
  });

  it("extracts the lead id from the module wildcard", () => {
    assert.equal(getGrowthLeadId("leads/lead-1"), "lead-1");
    assert.equal(getGrowthLeadId("leads"), null);
  });

  it("describes status activities in Spanish", () => {
    assert.equal(getLeadStatusLabel("follow_up"), "En seguimiento");
    assert.equal(
      describeLeadActivity({
        activityType: "status_changed",
        payload: { from: "new", to: "qualified" },
      }),
      "Nuevo a Calificado",
    );
  });
});
