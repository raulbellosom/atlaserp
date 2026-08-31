// apps/desktop/src/modules/atlas.pfm/components/BudgetBars.jsx
import { Button, EmptyState, ProgressMeter } from "@atlas/ui";
import { Pencil, EyeOff } from "lucide-react";
import { formatMoney } from "../lib/format";

export function BudgetBars({ budgets, onEdit, onDisable }) {
  if (!budgets || budgets.length === 0) {
    return <EmptyState variant="compact" title="Sin presupuestos" />;
  }
  return (
    <ul className="space-y-4">
      {budgets.map((b) => (
        <li key={b.id} className="group">
          <div className="mb-1 flex items-center justify-between gap-2 text-sm">
            <span className="truncate font-medium text-[hsl(var(--foreground))]">
              {b.categoryName}
            </span>
            <span className="flex shrink-0 items-center gap-1 text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {formatMoney(b.spent)} / {formatMoney(b.amount)}
              {onEdit && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Editar presupuesto"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onEdit(b)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
              {onDisable && (
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Quitar presupuesto"
                  className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  onClick={() => onDisable(b)}
                >
                  <EyeOff className="h-3.5 w-3.5" />
                </Button>
              )}
            </span>
          </div>
          <ProgressMeter value={b.spent} max={b.amount} warnAt={b.alertThreshold ?? 0.8} />
        </li>
      ))}
    </ul>
  );
}
