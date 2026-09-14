import test from "node:test";
import assert from "node:assert/strict";

import { setApiUrl, clearApiUrl } from "../../../../lib/runtimeConfig.js";
import { buildHrEmployeesTableProps } from "../hr-employees-table-props.js";

test("buildHrEmployeesTableProps wires AtlasTable to the configured API base URL", () => {
  const blueprint = { key: "hr.employees.table" };
  const token = "token-123";
  const onView = () => {};
  const bulkActions = [{ label: "Exportar Excel" }];

  setApiUrl("https://api.example.test");

  try {
    const props = buildHrEmployeesTableProps({
      blueprint,
      token,
      onView,
      bulkActions,
    });

    assert.equal(props.blueprint, blueprint);
    assert.equal(props.token, token);
    assert.equal(props.onView, onView);
    assert.equal(props.bulkActions, bulkActions);
    assert.equal(props.apiBaseUrl, "https://api.example.test");
  } finally {
    clearApiUrl();
  }
});
