import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  Skeleton,
  StatCard,
} from "@atlas/ui";
import {
  HandCoins,
  Landmark,
  ListTree,
  NotebookPen,
  Plus,
  Scale,
  Wallet,
} from "lucide-react";
import { atlas } from "../../../lib/atlas";
import { formatMoney, SECTION_META } from "../lib/finance-utils";
import { AccountSheet } from "../components/AccountSheet";
import { EntrySheet } from "../components/EntrySheet";
import { GuidedEntrySheet } from "../components/GuidedEntrySheet";

export function FinanceSummary({ token }) {
  const queryClient = useQueryClient();
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [entryInitialForm, setEntryInitialForm] = useState(null);
  const [guidedSheetOpen, setGuidedSheetOpen] = useState(false);

  const accountsQuery = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => atlas.finance.listAccounts(token, { limit: 200 }),
    enabled: Boolean(token),
  });
  const balancesQuery = useQuery({
    queryKey: ["finance-balances"],
    queryFn: () => atlas.finance.getBalances(token),
    enabled: Boolean(token),
  });
  const dashboardQuery = useQuery({
    queryKey: ["finance-dashboard"],
    queryFn: () => atlas.finance.getDashboard(token),
    enabled: Boolean(token),
  });

  const accounts = accountsQuery.data?.data ?? [];
  const balances = balancesQuery.data?.data;
  const dashboard = dashboardQuery.data?.data;
  const dashboardTrend = dashboard?.trend ?? [];
  const dashboardVariance = dashboard?.variance;
  const balanceTotalsBase = balances?.totalsBase ?? {
    debit: "0.00",
    credit: "0.00",
    net: "0.00",
    currency: "MXN",
  };
  const dashboardCurrency =
    dashboard?.currency ?? balanceTotalsBase.currency ?? "MXN";

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.enabled),
    [accounts],
  );
  const canCreateMoves = activeAccounts.length >= 2;

  const accountTypeStats = useMemo(() => {
    const map = new Map();
    for (const account of accounts) {
      const key = String(account.type || "SIN_TIPO");
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return [...map.entries()].map(([type, total]) => ({ type, total }));
  }, [accounts]);

  const pageMeta = SECTION_META.summary;
  const isLoading =
    accountsQuery.isLoading ||
    balancesQuery.isLoading ||
    dashboardQuery.isLoading;

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        onClick={() => {
          setEditingAccount(null);
          setAccountSheetOpen(true);
        }}
      >
        <Plus className="h-4 w-4" />
        Nueva cuenta
      </Button>
      <Button
        variant="outline"
        onClick={() => setGuidedSheetOpen(true)}
        disabled={!canCreateMoves}
      >
        <HandCoins className="h-4 w-4" />
        Captura guiada
      </Button>
      <Button
        onClick={() => {
          setEntryInitialForm(null);
          setEntrySheetOpen(true);
        }}
        disabled={!canCreateMoves}
      >
        <NotebookPen className="h-4 w-4" />
        Nueva póliza
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Finance"
          title={pageMeta.title}
          description={pageMeta.description}
          actions={headerActions}
        />

        <div className="space-y-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-28 w-full rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard
                label="Cuentas activas"
                value={String(activeAccounts.length)}
                icon={ListTree}
              />
              <StatCard
                label={`Debitos acumulados (${balanceTotalsBase.currency})`}
                value={formatMoney(
                  balanceTotalsBase.debit,
                  balanceTotalsBase.currency,
                )}
                icon={Scale}
              />
              <StatCard
                label={`Balance neto (${balanceTotalsBase.currency})`}
                value={formatMoney(
                  balanceTotalsBase.net,
                  balanceTotalsBase.currency,
                )}
                icon={Landmark}
              />
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Ingresos del periodo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xl font-semibold">
                  {formatMoney(
                    dashboard?.kpi?.income ?? "0",
                    dashboardCurrency,
                  )}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Variacion: {dashboardVariance?.income?.percent ?? 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Egresos del periodo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xl font-semibold">
                  {formatMoney(
                    dashboard?.kpi?.expense ?? "0",
                    dashboardCurrency,
                  )}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Variacion: {dashboardVariance?.expense?.percent ?? 0}%
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">
                  Resultado neto del periodo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <p className="text-xl font-semibold">
                  {formatMoney(
                    dashboard?.kpi?.netIncome ?? "0",
                    dashboardCurrency,
                  )}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Variacion: {dashboardVariance?.netIncome?.percent ?? 0}%
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tendencia del periodo</CardTitle>
            </CardHeader>
            <CardContent>
              {dashboardTrend.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Sin movimientos en el rango actual.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Fecha
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Ingresos
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Egresos
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Neto
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardTrend.slice(-14).map((point) => (
                        <tr
                          key={point.date}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">{point.date}</td>
                          <td className="px-3 py-2">
                            {formatMoney(point.income, dashboardCurrency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(point.expense, dashboardCurrency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(point.net, dashboardCurrency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {accountTypeStats.length === 0 ? (
            <EmptyState
              title="Sin cuentas contables"
              description="Crea tu primera cuenta para iniciar el libro mayor."
              icon={Wallet}
              action={{
                label: "Nueva cuenta",
                onClick: () => {
                  setEditingAccount(null);
                  setAccountSheetOpen(true);
                },
              }}
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Distribucion por tipo de cuenta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {accountTypeStats.map((item) => (
                    <Badge key={item.type} variant="glass">
                      {item.type}: {item.total}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Saldos convertidos a {balanceTotalsBase.currency}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {balancesQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : (balances?.data ?? []).length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Aún no hay saldos para mostrar.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Cuenta
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Neto original
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Neto convertido ({balanceTotalsBase.currency})
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(balances?.data ?? []).map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {row.code} - {row.name}
                              </span>
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {row.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.totals?.net)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              row.totalsBase?.net ?? "0",
                              row.totalsBase?.currency ??
                                balanceTotalsBase.currency,
                            )}
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

      <AccountSheet
        open={accountSheetOpen}
        onOpenChange={setAccountSheetOpen}
        editingAccount={editingAccount}
        token={token}
      />
      <EntrySheet
        open={entrySheetOpen}
        onOpenChange={setEntrySheetOpen}
        token={token}
        accounts={accounts}
        initialForm={entryInitialForm}
      />
      <GuidedEntrySheet
        open={guidedSheetOpen}
        onOpenChange={setGuidedSheetOpen}
        token={token}
        accounts={accounts}
        onOpenAdvanced={(draft) => {
          setEntryInitialForm(draft);
          setEntrySheetOpen(true);
        }}
      />
    </div>
  );
}
