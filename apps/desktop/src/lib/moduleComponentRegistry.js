import { createModuleComponentRegistry } from "./module-component-registry-core.js";

// atlas.fleet static cell components (migrated from bundle to static import)
import VehicleStatusBadge from "../modules/atlas.fleet/components/VehicleStatusBadge.jsx";
import DriverStatusBadge from "../modules/atlas.fleet/components/DriverStatusBadge.jsx";
import ReportStatusBadge from "../modules/atlas.fleet/components/ReportStatusBadge.jsx";
import DriverAvatarCell from "../modules/atlas.fleet/components/DriverAvatarCell.jsx";
import DriverAssignedVehicleCell from "../modules/atlas.fleet/components/DriverAssignedVehicleCell.jsx";
import VehicleImageCell from "../modules/atlas.fleet/components/VehicleImageCell.jsx";
import InsuranceBadgeCell from "../modules/atlas.fleet/components/InsuranceBadgeCell.jsx";
import CoverageTypeBadge from "../modules/atlas.fleet/components/CoverageTypeBadge.jsx";

const _isDev = Boolean(import.meta.env?.DEV);

function warnDev(message) {
  if (_isDev) {
    console.warn(`[moduleComponentRegistry] ${message}`);
  }
}

export const componentRegistry = createModuleComponentRegistry({
  warn: warnDev,
});

// Static registration for atlas.fleet core module components
componentRegistry.register(
  "atlas.fleet:VehicleStatusBadge",
  VehicleStatusBadge,
);
componentRegistry.register("atlas.fleet:DriverStatusBadge", DriverStatusBadge);
componentRegistry.register("atlas.fleet:ReportStatusBadge", ReportStatusBadge);
componentRegistry.register("atlas.fleet:DriverAvatarCell", DriverAvatarCell);
componentRegistry.register(
  "atlas.fleet:DriverAssignedVehicleCell",
  DriverAssignedVehicleCell,
);
componentRegistry.register("atlas.fleet:VehicleImageCell", VehicleImageCell);
componentRegistry.register(
  "atlas.fleet:InsuranceBadgeCell",
  InsuranceBadgeCell,
);
componentRegistry.register("atlas.fleet:CoverageTypeBadge", CoverageTypeBadge);

// Dynamic bundle registration is done at runtime by ModuleBundleLoader
// for modules that still use the bundle system (has_bundle=true).
// See apps/desktop/src/shell/ModuleBundleLoader.jsx
