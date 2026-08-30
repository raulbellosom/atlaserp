// Registry key: atlas.fleet:DriverStatusBadge
// Props: { status: 'active' | 'inactive' | 'suspended' }
import { Badge } from "@atlas/ui";

const STATUS_CONFIG = {
  active: { label: "Activo", variant: "success" },
  inactive: { label: "Inactivo", variant: "secondary" },
  suspended: { label: "Suspendido", variant: "destructive" },
};

export default function DriverStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status ?? "—", variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
