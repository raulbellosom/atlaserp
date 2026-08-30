// Registry key: atlas.fleet:CoverageTypeBadge
// Props: { value: 'basic' | 'comprehensive' | 'third_party' | 'other' | string }
import { Badge } from "@atlas/ui";

const COVERAGE_CONFIG = {
  basic: { label: "Básica", variant: "outline" },
  comprehensive: { label: "Integral", variant: "success" },
  third_party: { label: "Terceros", variant: "secondary" },
  other: { label: "Otro", variant: "secondary" },
};

export default function CoverageTypeBadge({ value }) {
  if (!value) {
    return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
  }
  const cfg = COVERAGE_CONFIG[value] ?? { label: value, variant: "secondary" };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
