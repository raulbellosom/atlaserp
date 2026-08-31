// apps/desktop/src/modules/atlas.pfm/components/GoalRings.jsx
import { Button, EmptyState, RingProgress } from "@atlas/ui";
import { Plus, Minus, Pencil } from "lucide-react";
import { formatMoney } from "../lib/format";

export function GoalRings({ goals, onContribute, onEdit }) {
  if (!goals || goals.length === 0) {
    return <EmptyState variant="compact" title="Sin metas" />;
  }
  return (
    <ul className="space-y-4">
      {goals.map((g) => (
        <li key={g.id} className="flex items-center gap-3">
          <RingProgress value={g.currentAmount} max={g.targetAmount} color={g.color || undefined}>
            <span className="text-[10px] font-semibold tabular-nums text-[hsl(var(--foreground))]">
              {Math.round((g.pct ?? 0) * 100)}%
            </span>
          </RingProgress>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">{g.name}</p>
            <p className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {formatMoney(g.currentAmount)} / {formatMoney(g.targetAmount)}
              {g.targetDate && ` · ${g.targetDate}`}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button size="icon" variant="ghost" aria-label="Aportar" onClick={() => onContribute(g, 1)}>
              <Plus className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" aria-label="Retirar" onClick={() => onContribute(g, -1)}>
              <Minus className="h-4 w-4" />
            </Button>
            {onEdit && (
              <Button size="icon" variant="ghost" aria-label="Editar meta" onClick={() => onEdit(g)}>
                <Pencil className="h-4 w-4" />
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
