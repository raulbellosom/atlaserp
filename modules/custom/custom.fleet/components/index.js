// Registers custom.fleet React components into a ComponentRegistry-compatible instance.
// Called at boot by apps/desktop/src/lib/moduleComponentRegistry.js.
// The registry object must expose: register(key, component)

import VehicleStatusBadge from "./VehicleStatusBadge.jsx";
import ReportStatusBadge from "./ReportStatusBadge.jsx";

/**
 * @param {{ register: (key: string, component: unknown) => void }} registry
 */
export function register(registry) {
  registry.register("custom.fleet:VehicleStatusBadge", VehicleStatusBadge);
  registry.register("custom.fleet:ReportStatusBadge", ReportStatusBadge);
}
