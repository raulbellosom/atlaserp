import { getApiUrl } from "../../../lib/runtimeConfig.js";

export function buildHrEmployeesTableProps({
  blueprint,
  token,
  companyId = null,
  onView,
  bulkActions = [],
}) {
  return {
    blueprint,
    token,
    companyId,
    apiBaseUrl: getApiUrl(),
    onView,
    bulkActions,
  };
}
