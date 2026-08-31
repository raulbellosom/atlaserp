// apps/desktop/src/modules/atlas.pfm/components/InvestmentPanel.jsx
import { Card, Button } from "@atlas/ui";
import { Settings2 } from "lucide-react";
import { formatMoney, formatRatePct } from "../lib/format";

export function InvestmentPanel({ wallet, onEdit }) {
  if (!wallet || wallet.kind !== "INVESTMENT") return null;
  const accrued = Number(wallet.accruedThisMonth ?? 0);
  return (
    <Card variant="solid" className="mb-4 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[hsl(var(--foreground))]">Cuenta de rendimiento</p>
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Settings2 className="mr-1.5 h-3.5 w-3.5" /> Ajustes
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-center">
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Tasa esperada
          </dt>
          <dd className="mt-0.5 text-base font-bold text-[hsl(var(--foreground))]">
            {wallet.expectedRate != null
              ? `${formatRatePct(wallet.expectedRate)} anual`
              : "Sin configurar"}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
            Rendimiento este mes
          </dt>
          <dd className="mt-0.5 text-base font-bold text-emerald-600 dark:text-emerald-400">
            +{formatMoney(accrued, wallet.currency)}
          </dd>
        </div>
      </dl>
    </Card>
  );
}
