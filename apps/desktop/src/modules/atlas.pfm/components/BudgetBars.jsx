// apps/desktop/src/modules/atlas.pfm/components/BudgetBars.jsx
import { Button, EmptyState } from "@atlas/ui";
import { Pencil, EyeOff } from "lucide-react";
import { formatMoney } from "../lib/format";

function barColor(pct, threshold) {
  if (pct >= 1) return "bg-red-500";
  if (pct >= (threshold ?? 0.8)) return "bg-amber-500";
  return "bg-emerald-500";
}

export function BudgetBars({ budgets, onEdit, onDisable }) {
  if (!budgets || budgets.length === 0) {
    return <EmptyState variant="compact" title="Sin presupuestos" />;
  }
  return (
    <ul className="space-y-4">
      {budgets.map((b) => (
        <li key={b.id}>
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-[hsl(var(--foreground))]">
              {b.categoryName}
            </span>
            <span className="flex shrink-0 items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
              {formatMoney(b.spent)} / {formatMoney(b.amount)}
              {onEdit && (
                <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(b)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDisable && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Quitar"
                  onClick={() => onDisable(b)}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className={`h-full rounded-full ${barColor(b.pct, b.alertThreshold)}`}
              style={{ width: `${Math.min(100, b.pct * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
