// Registry key: atlas.fleet:InsuranceBadgeCell
// Props (insurance list): { value: 'active' | 'expired' | 'disabled' } — from `status` column
// Props (vehicle list):   { insurance_status: 'active' | 'expired' | 'none' }
import { Badge } from "@atlas/ui";

const STATUS_CONFIG = {
  active: { label: "Con poliza", variant: "success" },
  expired: { label: "Vencida", variant: "warning" },
  none: { label: "Sin poliza", variant: "secondary" },
  disabled: { label: "Desactivada", variant: "secondary" },
};

export default function InsuranceBadgeCell({ value, insurance_status }) {
  const key = value ?? insurance_status;
  const cfg = STATUS_CONFIG[key] ?? { label: key ?? "—", variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
