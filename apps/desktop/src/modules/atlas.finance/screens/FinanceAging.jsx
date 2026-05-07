import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
  StatCard,
} from "@atlas/ui";
import { Calendar, CalendarDays } from "lucide-react";
import { atlas } from "../../../lib/atlas";
import { formatMoney, SECTION_META } from "../lib/finance-utils";

export function FinanceAging({ token }) {
  const agingQuery = useQuery({
    queryKey: ["finance-aging"],
    queryFn: () => atlas.finance.getAging(token, {}),
    enabled: Boolean(token),
  });

  const agingData = agingQuery.data?.data;
  const pageMeta = SECTION_META.aging;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Finance"
          title={pageMeta.title}
          description={pageMeta.description}
        />

        <div className="space-y-4">
          {agingQuery.isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((item) => (
                <Skeleton key={item} className="h-24 w-full rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <StatCard
                label="0-30 dias"
                value={formatMoney(agingData?.summary?.b0_30 ?? 0)}
                icon={Calendar}
              />
              <StatCard
                label="31-60 dias"
                value={formatMoney(agingData?.summary?.b31_60 ?? 0)}
                icon={CalendarDays}
              />
              <StatCard
                label="61-90 dias"
                value={formatMoney(agingData?.summary?.b61_90 ?? 0)}
                icon={CalendarDays}
              />
              <StatCard
                label="+90 dias"
                value={formatMoney(agingData?.summary?.b90_plus ?? 0)}
                icon={CalendarDays}
              />
            </div>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Aging por contacto</CardTitle>
            </CardHeader>
            <CardContent>
              {agingQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : (agingData?.contacts ?? []).length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Sin saldos abiertos para analizar.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Contacto
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          0-30
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          31-60
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          61-90
                        </th>
                        <th className="px-3 py-2 text-left font-medium">+90</th>
                        <th className="px-3 py-2 text-left font-medium">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(agingData?.contacts ?? []).map((row) => (
                        <tr
                          key={row.contactId || row.contactName}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">{row.contactName}</td>
                          <td className="px-3 py-2">
                            {formatMoney(row.b0_30, row.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.b31_60, row.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.b61_90, row.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.b90_plus, row.currency)}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(row.totalOpen, row.currency)}
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
    </div>
  );
}
