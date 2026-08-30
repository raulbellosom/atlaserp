// Registry key: atlas.fleet:ReportStatusBadge
// Props: { status: 'draft' | 'finalized' }
import { Badge } from "@atlas/ui";

const STATUS_CONFIG = {
  draft: { label: "Borrador", variant: "warning" },
  finalized: { label: "Finalizado", variant: "success" },
};

export default function ReportStatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status ?? "—", variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
