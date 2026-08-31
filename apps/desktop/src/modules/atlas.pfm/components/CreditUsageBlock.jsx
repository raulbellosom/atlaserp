// apps/desktop/src/modules/atlas.pfm/components/CreditUsageBlock.jsx
import { ProgressMeter } from "@atlas/ui";
import { formatMoney, creditUsage, creditUtilizationTone } from "../lib/format";

// Debt-oriented view of a credit-card wallet: "Ocupado" headline + utilization bar.
export function CreditUsageBlock({ wallet, compact = false }) {
  const { ocupado, limite, disponible, util } = creditUsage(wallet);
  const pct = util == null ? null : Math.round(util * 100);

  return (
    <div className={compact ? "" : "mt-3"}>
      <p className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
        Ocupado
      </p>
      <p className="text-2xl font-bold tracking-tight tabular-nums text-[hsl(var(--foreground))]">
        {formatMoney(ocupado, wallet.currency)}
      </p>
      {limite == null ? (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Configura el límite de crédito
        </p>
      ) : (
        <>
          <ProgressMeter
            className="mt-2"
            value={ocupado}
            max={limite}
            tone={creditUtilizationTone(util)}
          />
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))] tabular-nums">
            Disponible: {formatMoney(disponible, wallet.currency)}
            {pct != null ? ` · ${pct}%` : ""}
          </p>
        </>
      )}
    </div>
  );
}
