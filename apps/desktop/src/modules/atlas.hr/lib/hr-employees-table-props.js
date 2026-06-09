import { getApiUrl } from "../../../lib/runtimeConfig.js";

export function buildHrEmployeesTableProps({
  blueprint,
  token,
  onView,
  bulkActions = [],
}) {
  return {
    blueprint,
    token,
    apiBaseUrl: getApiUrl(),
    onView,
    bulkActions,
  };
}
