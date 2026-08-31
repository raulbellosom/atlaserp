// apps/desktop/src/modules/atlas.pfm/components/YieldGroupRow.jsx
import { useState } from "react";
import { TrendingUp, ChevronRight } from "lucide-react";
import { formatMoney, formatMonthLabel } from "../lib/format";
import { MovementRow } from "./MovementRow";

export function YieldGroupRow({ group, currency }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 py-2 text-left"
      >
        <TrendingUp className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
            Rendimiento · {formatMonthLabel(group.month)}
          </p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{group.count} días</p>
        </div>
        <span className="shrink-0 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
          +{formatMoney(group.total, currency)}
        </span>
        <ChevronRight
          className={`h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))] transition-transform ${open ? "rotate-90" : ""}`}
        />
      </button>
      {open && (
        <div className="ml-7 border-l border-[hsl(var(--border))] pl-3">
          {group.items.map((m) => (
            <MovementRow key={m.id} movement={m} currency={currency} onEdit={() => {}} />
          ))}
        </div>
      )}
    </div>
  );
}
