import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from "@atlas/ui";
import { BookOpen } from "lucide-react";
import { atlas } from "../../../lib/atlas";
import { accountTypeLabel, formatMoney } from "../lib/ledger-utils";

export function LedgerSummary({ token }) {
  const navigate = useNavigate();

  const summaryQuery = useQuery({
    queryKey: ["ledger-summary"],
    queryFn: () => atlas.ledger.getSummary(token),
    enabled: Boolean(token),
  });

  const data = summaryQuery.data?.data ?? {};
  const accounts = data.accounts ?? [];

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Ledger"
          title="Libro auxiliar de cuentas"
          description="Resumen de saldos por cuenta."
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {summaryQuery.isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <StatCard label="Cuentas activas" value={String(data.accountCount ?? 0)} />
              <StatCard
                label="Total abonos"
                value={formatMoney(data.totalIncome)}
              />
              <StatCard
                label="Total cargos"
                value={formatMoney(data.totalExpense)}
              />
            </>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuentas</CardTitle>
          </CardHeader>
          <CardContent>
            {summaryQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : accounts.length === 0 ? (
              <EmptyState
                title="Sin cuentas"
                description="Crea cuentas para comenzar a registrar movimientos."
                icon={BookOpen}
                action={{
                  label: "Ir a cuentas",
                  onClick: () => navigate("/app/m/atlas.ledger/ledger/accounts"),
                }}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Cuenta</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">Moneda</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo actual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((account) => (
                      <tr
                        key={account.id}
                        className="border-t border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))/0.2] cursor-pointer"
                        onClick={() =>
                          navigate(`/app/m/atlas.ledger/ledger/accounts/${account.id}`)
                        }
                      >
                        <td className="px-3 py-2 font-medium">{account.name}</td>
                        <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                          {accountTypeLabel(account.type)}
                        </td>
                        <td className="px-3 py-2">{account.currency}</td>
                        <td className="px-3 py-2 text-right tabular-nums font-mono">
                          {formatMoney(account.currentBalance, account.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
