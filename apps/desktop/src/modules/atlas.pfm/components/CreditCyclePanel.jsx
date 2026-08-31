// apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx
import { Card, Button, cn } from "@atlas/ui";
import { CreditCard, Settings2 } from "lucide-react";
import { formatMoney, creditUtilizationTone } from "../lib/format";

const TONE_BG = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export function CreditCyclePanel({ wallet, onEdit }) {
  if (!wallet || wallet.kind !== "CREDIT") return null;
  const c = wallet.creditCycle;

  if (!c) {
    return (
      <Card variant="solid" className="mb-4 flex items-center gap-3 p-4">
        <CreditCard className="h-5 w-5 text-[hsl(var(--muted-foreground))]" />
        <p className="flex-1 text-sm text-[hsl(var(--muted-foreground))]">
          Configura el corte y la fecha limite de pago de esta tarjeta.
        </p>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Configurar
        </Button>
      </Card>
    );
  }

  // Split the occupied balance into what was carried over vs. spent this period.
  const period = Math.max(0, Math.min(c.periodSpend ?? 0, c.totalOwed));
  const carried = Math.max(0, c.totalOwed - period);
  const tone = creditUtilizationTone(c.utilization);
  const toneBg = TONE_BG[tone] ?? TONE_BG.success;
  const pctOf = (v) =>
    c.creditLimit > 0 ? Math.min(100, Math.max(0, (v / c.creditLimit) * 100)) : 0;

  return (
    <Card variant="solid" className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Tarjeta de credito</p>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Ajustes
        </Button>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Saldo del periodo
          </dt>
          <dd className="mt-0.5 text-base font-bold text-[hsl(var(--foreground))]">
            {formatMoney(c.periodSpend, wallet.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Ocupado
          </dt>
          <dd className="mt-0.5 text-base font-bold text-red-500">
            {formatMoney(c.totalOwed, wallet.currency)}
          </dd>
        </div>
        {c.availableCredit != null && (
          <div>
            <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
              Credito disponible
            </dt>
            <dd className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
              {formatMoney(c.availableCredit, wallet.currency)}
            </dd>
          </div>
        )}
      </dl>

      {c.creditLimit != null && (
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-[hsl(var(--foreground))]">Ocupacion</span>
            <span className="tabular-nums text-[hsl(var(--muted-foreground))]">
              {c.utilization != null ? `${Math.round(c.utilization * 100)}%` : ""}
            </span>
          </div>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-[hsl(var(--muted))]">
            <div
              className={cn("h-full transition-[width] duration-300", toneBg)}
              style={{ width: `${pctOf(carried)}%` }}
            />
            <div
              className={cn("h-full opacity-45 transition-[width] duration-300", toneBg)}
              style={{ width: `${pctOf(period)}%` }}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[hsl(var(--muted-foreground))]">
            <span className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-sm", toneBg)} />
              Arrastrado {formatMoney(carried, wallet.currency)}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={cn("h-2 w-2 rounded-sm opacity-45", toneBg)} />
              Periodo {formatMoney(period, wallet.currency)}
            </span>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
        Corte dia {c.statementDay}
        {c.paymentDueDay ? ` · pago dia ${c.paymentDueDay}` : ""}
      </p>
    </Card>
  );
}
