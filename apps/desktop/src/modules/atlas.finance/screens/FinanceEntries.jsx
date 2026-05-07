import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
} from "@atlas/ui";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  SECTION_META,
  formatDate,
  formatMoney,
  parseApiError,
} from "../lib/finance-utils";
import { EntrySheet } from "../components/EntrySheet";
import { GuidedEntrySheet } from "../components/GuidedEntrySheet";

export function FinanceEntries({ token }) {
  const queryClient = useQueryClient();
  const [entrySheetOpen, setEntrySheetOpen] = useState(false);
  const [guidedSheetOpen, setGuidedSheetOpen] = useState(false);
  const [entryInitialForm, setEntryInitialForm] = useState(null);

  const entriesQuery = useQuery({
    queryKey: ["finance-entries"],
    queryFn: () => atlas.finance.listEntries(token, { limit: 150 }),
    enabled: Boolean(token),
  });

  const accountsQuery = useQuery({
    queryKey: ["finance-accounts"],
    queryFn: () => atlas.finance.listAccounts(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const accounts = accountsQuery.data?.data ?? [];
  const activeAccounts = accounts.filter((a) => a.enabled);
  const entries = entriesQuery.data?.data ?? [];
  const pageMeta = SECTION_META.entries;

  // Flatten all lines for the ledger view
  const ledgerLines = entries.flatMap((entry) =>
    (entry.lines || []).map((line) => ({
      ...line,
      entryRef: entry.reference || entry.id,
      entryDate: entry.entryDate,
      entryNotes: entry.notes,
    })),
  );

  function handleGuidedOpenAdvanced(draft) {
    setGuidedSheetOpen(false);
    setEntryInitialForm(draft);
    setEntrySheetOpen(true);
  }

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        onClick={() => {
          setEntryInitialForm(null);
          setGuidedSheetOpen(true);
        }}
      >
        Captura guiada
      </Button>
      <Button
        onClick={() => {
          setEntryInitialForm(null);
          setEntrySheetOpen(true);
        }}
        disabled={activeAccounts.length < 2}
        title={
          activeAccounts.length < 2
            ? "Se requieren al menos 2 cuentas activas para crear una poliza."
            : undefined
        }
      >
        <Plus className="h-4 w-4" />
        Nueva poliza
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
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Polizas</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : entries.length === 0 ? (
                <EmptyState
                  title="Sin polizas"
                  description="Registra movimientos contables con polizas de diario."
                  icon={BookOpen}
                  action={{
                    label: "Nueva poliza",
                    onClick: () => {
                      setEntryInitialForm(null);
                      setEntrySheetOpen(true);
                    },
                  }}
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Fecha
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Referencia
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Notas
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Lineas
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Estado
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr
                          key={entry.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">
                            {formatDate(entry.entryDate)}
                          </td>
                          <td className="px-3 py-2 font-mono">
                            {entry.reference || "-"}
                          </td>
                          <td className="px-3 py-2">{entry.notes || "-"}</td>
                          <td className="px-3 py-2">
                            {(entry.lines || []).length}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                entry.enabled !== false
                                  ? "success"
                                  : "secondary"
                              }
                            >
                              {entry.enabled !== false ? "Activa" : "Inactiva"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Libro mayor (lineas)</CardTitle>
            </CardHeader>
            <CardContent>
              {entriesQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : ledgerLines.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Sin movimientos.
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
                          Poliza
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Cuenta
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Descripcion
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Debe
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Haber
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ledgerLines.map((line, idx) => {
                        const account = accounts.find(
                          (a) => a.id === line.accountId,
                        );
                        return (
                          <tr
                            key={line.id || idx}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2">
                              {formatDate(line.entryDate)}
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {line.entryRef}
                            </td>
                            <td className="px-3 py-2">
                              {account
                                ? `${account.code || ""} ${account.name}`.trim()
                                : line.accountId}
                            </td>
                            <td className="px-3 py-2">
                              {line.description || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {parseFloat(line.debit) > 0
                                ? formatMoney(line.debit)
                                : "-"}
                            </td>
                            <td className="px-3 py-2">
                              {parseFloat(line.credit) > 0
                                ? formatMoney(line.credit)
                                : "-"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <EntrySheet
        open={entrySheetOpen}
        onOpenChange={(open) => {
          setEntrySheetOpen(open);
          if (!open) setEntryInitialForm(null);
        }}
        token={token}
        accounts={activeAccounts}
        initialForm={entryInitialForm}
      />
      <GuidedEntrySheet
        open={guidedSheetOpen}
        onOpenChange={setGuidedSheetOpen}
        token={token}
        accounts={activeAccounts}
        onOpenAdvanced={handleGuidedOpenAdvanced}
      />
    </div>
  );
}
