// Registry key: atlas.fleet:VehicleStatusBadge
// Props: { status: 'active' | 'inactive' | 'maintenance' | 'retired' | 'pending' | 'disabled' }
// Registered via ComponentRegistry.register in the Route Loader (Phase 4+).
import { Badge } from "@atlas/ui";

const STATUS_CONFIG = {
  active: { label: "Activo", variant: "success" },
  inactive: { label: "Inactivo", variant: "secondary" },
  maintenance: { label: "En mantenimiento", variant: "warning" },
  retired: { label: "Retirado", variant: "destructive" },
  pending: { label: "Pendiente", variant: "outline" },
  disabled: { label: "Desactivado", variant: "secondary" },
};

export default function VehicleStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status ?? "—", variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
