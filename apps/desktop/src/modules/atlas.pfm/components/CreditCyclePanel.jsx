// apps/desktop/src/modules/atlas.pfm/components/CreditCyclePanel.jsx
import { Card, Button, ProgressMeter } from "@atlas/ui";
import { CreditCard, Settings2 } from "lucide-react";
import { formatMoney, creditUtilizationTone } from "../lib/format";

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
            Total adeudado
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
        <ProgressMeter
          className="mt-3"
          value={c.totalOwed}
          max={c.creditLimit}
          tone={creditUtilizationTone(c.utilization)}
          valueLabel={c.utilization != null ? `${Math.round(c.utilization * 100)}%` : undefined}
          label="Ocupacion"
        />
      )}
      <p className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
        Corte dia {c.statementDay}
        {c.paymentDueDay ? ` · pago dia ${c.paymentDueDay}` : ""}
      </p>
    </Card>
  );
}
