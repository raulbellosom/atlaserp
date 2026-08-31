// apps/desktop/src/modules/atlas.pfm/screens/OverviewScreen.jsx
import { useState } from "react";
import { PageHeader, StatCard, Card, SelectField, LoadingState, ErrorState } from "@atlas/ui";
import { Wallet, TrendingDown, TrendingUp } from "lucide-react";
import { usePfmSummary } from "../hooks/use-pfm-queries";
import { CategoryDonut } from "../components/CategoryDonut";
import { SpendTrendBar } from "../components/SpendTrendBar";
import {
  formatMoney,
  currentMonthKey,
  shiftMonth,
  formatMonthLabel,
  percentDelta,
} from "../lib/format";

export default function OverviewScreen() {
  const [month, setMonth] = useState(currentMonthKey());
  const { data: summary, isLoading, isError, refetch } = usePfmSummary(month);

  const monthOptions = [0, -1, -2, -3, -4, -5].map((d) => {
    const key = shiftMonth(currentMonthKey(), d);
    return { value: key, label: formatMonthLabel(key) };
  });

  const delta = summary ? percentDelta(summary.monthExpense, summary.prevMonthExpense) : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <PageHeader
        title="Resumen"
        description="Tus finanzas del mes"
        actions={<SelectField options={monthOptions} value={month} onChange={setMonth} />}
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudo cargar el resumen" onRetry={refetch} />}

      {summary && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Saldo total" value={formatMoney(summary.totalBalance)} icon={Wallet} />
            <StatCard
              label="Ingresos del mes"
              value={formatMoney(summary.monthIncome)}
              icon={TrendingUp}
            />
            <StatCard
              label="Gastos del mes"
              value={formatMoney(summary.monthExpense)}
              icon={TrendingDown}
              trend={delta == null ? undefined : -delta}
            />
            <StatCard
              label="Mes anterior"
              value={formatMoney(summary.prevMonthExpense)}
              icon={TrendingDown}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card variant="solid" className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
                Gasto por categoria
              </h3>
              <CategoryDonut data={summary.byCategory} currency="MXN" />
              <ul className="mt-3 space-y-1">
                {summary.byCategory.map((c) => (
                  <li
                    key={c.categoryId ?? c.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: c.color }}
                      />
                      {c.name}
                    </span>
                    <span className="font-medium">{formatMoney(c.total)}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card variant="solid" className="p-5">
              <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--foreground))]">
                Tendencia (6 meses)
              </h3>
              <SpendTrendBar data={summary.trend} currency="MXN" />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
