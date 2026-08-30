// Registry key: atlas.fleet:DriverLicenseBadge
// Props: { license_status, license_days_to_expiry } — computed server-side in driver-service.js
import { Badge } from "@atlas/ui";

const CONFIG = {
  valid: { label: "Vigente", variant: "success" },
  expiring: { label: "Por vencer", variant: "warning" },
  expired: { label: "Vencida", variant: "destructive" },
  unknown: { label: "Sin fecha", variant: "secondary" },
};

export default function DriverLicenseBadge({ license_status, license_days_to_expiry }) {
  const cfg = CONFIG[license_status] ?? CONFIG.unknown;
  let label = cfg.label;
  if (license_status === "expiring" && Number.isFinite(license_days_to_expiry)) {
    label = `Por vencer (${license_days_to_expiry} d)`;
  }
  return <Badge variant={cfg.variant}>{label}</Badge>;
}
