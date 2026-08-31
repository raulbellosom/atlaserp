// apps/desktop/src/modules/atlas.pfm/components/GoalRings.jsx
import { Button, EmptyState } from "@atlas/ui";
import { Plus, Minus, Pencil } from "lucide-react";
import { formatMoney } from "../lib/format";

const R = 26;
const C = 2 * Math.PI * R;

function Ring({ pct, color }) {
  return (
    <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90">
      <circle cx="32" cy="32" r={R} fill="none" stroke="hsl(var(--muted))" strokeWidth="7" />
      <circle
        cx="32"
        cy="32"
        r={R}
        fill="none"
        stroke={color || "hsl(var(--primary))"}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={C}
        strokeDashoffset={C * (1 - Math.max(0, Math.min(1, pct)))}
      />
    </svg>
  );
}

export function GoalRings({ goals, onContribute, onEdit }) {
  if (!goals || goals.length === 0) {
    return <EmptyState variant="compact" title="Sin metas" />;
  }
  return (
    <ul className="space-y-4">
      {goals.map((g) => (
        <li key={g.id} className="flex items-center gap-3">
          <Ring pct={g.pct} color={g.color} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{g.name}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {formatMoney(g.currentAmount)} / {formatMoney(g.targetAmount)}
              {g.targetDate && ` · ${g.targetDate}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label="Aportar"
              onClick={() => onContribute(g, 1)}
            >
              <Plus className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Retirar"
              onClick={() => onContribute(g, -1)}
            >
              <Minus className="h-4 w-4" />
            </Button>
            {onEdit && (
              <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(g)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
