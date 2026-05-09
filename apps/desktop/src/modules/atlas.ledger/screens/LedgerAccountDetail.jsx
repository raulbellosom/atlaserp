import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
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
import { ArrowLeft, Download, FileSpreadsheet, FileText, Plus, XCircle } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { LedgerFiltersBar } from "../components/LedgerFiltersBar";
import { MovementCancelModal } from "../components/MovementCancelModal";
import { MovementSheet } from "../components/MovementSheet";
import {
  directionLabel,
  downloadBlob,
  fmtDate,
  formatMoney,
  parseApiError,
  statusLabel,
} from "../lib/ledger-utils";

const DEFAULT_FILTERS = { page: 1, pageSize: 50 };

export function LedgerAccountDetail({ token }) {
  const { "*": wildcard } = useParams();
  const accountId = wildcard?.replace("ledger/accounts/", "") ?? "";
  const navigate = useNavigate();

  const [movementSheetOpen, setMovementSheetOpen] = useState(false);
  const [cancelModal, setCancelModal] = useState({ open: false, movement: null });
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const accountQuery = useQuery({
    queryKey: ["ledger-account", accountId],
    queryFn: () => atlas.ledger.getAccount(accountId, token),
    enabled: Boolean(token && accountId),
  });

  const movementsQuery = useQuery({
    queryKey: ["ledger-account-movements", accountId, filters],
    queryFn: () => atlas.ledger.listAccountMovements(accountId, token, filters),
    enabled: Boolean(token && accountId),
  });

  const account = accountQuery.data?.data ?? null;
  const movements = movementsQuery.data?.data?.items ?? [];
  const summary = movementsQuery.data?.data?.summary ?? {};

  function handleFiltersChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial, page: 1 }));
  }

  function handleFiltersReset() {
    setFilters(DEFAULT_FILTERS);
  }

  async function handleExportExcel() {
    try {
      const blob = await atlas.ledger.exportAccountExcel(accountId, token, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        direction: filters.direction,
        status: filters.status,
      });
      const name = account?.name ?? "cuenta";
      downloadBlob(blob, `cuenta-${name}-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error(parseApiError(e, "No se pudo generar el Excel."));
    }
  }

  async function handleExportPdf() {
    try {
      const blob = await atlas.ledger.exportAccountPdf(accountId, token, {
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        direction: filters.direction,
        status: filters.status,
      });
      const name = account?.name ?? "cuenta";
      downloadBlob(blob, `cuenta-${name}-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(parseApiError(e, "No se pudo generar el PDF."));
    }
  }

  if (accountQuery.isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (!account) {
    return (
      <div className="p-4 md:p-6">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cuenta no encontrada.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow={
            <button
              className="flex items-center gap-1 text-xs hover:underline cursor-pointer"
              style={{ color: "var(--module-accent)" }}
              onClick={() => navigate("/app/m/atlas.ledger/ledger/accounts")}
            >
              <ArrowLeft className="h-3 w-3" />
              Cuentas
            </button>
          }
          title={account.name}
          description={`${account.currency} — ${accountQuery.data?.data?.type ?? ""}`}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4" />
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handleExportPdf}>
                <FileText className="h-4 w-4" />
                PDF
              </Button>
              <Button onClick={() => setMovementSheetOpen(true)}>
                <Plus className="h-4 w-4" />
                Movimiento
              </Button>
            </div>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard
            label="Saldo actual"
            value={formatMoney(account.currentBalance, account.currency)}
          />
          <StatCard
            label="Total abonos"
            value={formatMoney(summary.totalIncome, account.currency)}
          />
          <StatCard
            label="Total cargos"
            value={formatMoney(summary.totalExpense, account.currency)}
          />
          <StatCard label="Movimientos" value={String(summary.totalCount ?? 0)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Movimientos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <LedgerFiltersBar
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleFiltersReset}
            />
            {movementsQuery.isLoading ? (
              <Skeleton className="h-40 w-full rounded-xl" />
            ) : movements.length === 0 ? (
              <EmptyState
                title="Sin movimientos"
                description="Registra el primer movimiento para esta cuenta."
                icon={Download}
                action={{ label: "Nuevo movimiento", onClick: () => setMovementSheetOpen(true) }}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                <table className="min-w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))/0.35]">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium w-10">No.</th>
                      <th className="px-3 py-2 text-left font-medium">Fecha</th>
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-left font-medium">Numero</th>
                      <th className="px-3 py-2 text-left font-medium">Nombre</th>
                      <th className="px-3 py-2 text-left font-medium">Concepto</th>
                      <th className="px-3 py-2 text-right font-medium">Cargo</th>
                      <th className="px-3 py-2 text-right font-medium">Abono</th>
                      <th className="px-3 py-2 text-right font-medium">Saldo</th>
                      <th className="px-3 py-2 text-left font-medium">Estado</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((mv) => {
                      const isCancelled = mv.status === "CANCELLED";
                      return (
                        <tr
                          key={mv.id}
                          className={`border-t border-[hsl(var(--border))] ${isCancelled ? "opacity-50" : ""}`}
                        >
                          <td className="px-3 py-2 text-[hsl(var(--muted-foreground))]">
                            {mv.sequenceNumber}
                          </td>
                          <td className="px-3 py-2 tabular-nums">{fmtDate(mv.occurredAt)}</td>
                          <td className="px-3 py-2">{directionLabel(mv.direction)}</td>
                          <td className="px-3 py-2 font-mono text-xs">{mv.number ?? ""}</td>
                          <td className="px-3 py-2 max-w-[120px] truncate">{mv.name ?? ""}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate">{mv.concept}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {mv.direction === "EXPENSE" && !isCancelled
                              ? formatMoney(mv.amount, account.currency)
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {mv.direction === "INCOME" && !isCancelled
                              ? formatMoney(mv.amount, account.currency)
                              : ""}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums font-medium">
                            {!isCancelled ? formatMoney(mv.balanceAfter, account.currency) : ""}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant={isCancelled ? "secondary" : "success"}>
                              {statusLabel(mv.status)}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            {!isCancelled && (
                              <button
                                className="text-[hsl(var(--muted-foreground))] hover:text-red-500 transition-colors"
                                title="Cancelar movimiento"
                                onClick={() => setCancelModal({ open: true, movement: mv })}
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            )}
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

      <MovementSheet
        open={movementSheetOpen}
        onOpenChange={setMovementSheetOpen}
        account={account}
        token={token}
      />
      <MovementCancelModal
        open={cancelModal.open}
        onOpenChange={(isOpen) => setCancelModal((s) => ({ ...s, open: isOpen }))}
        movement={cancelModal.movement}
        accountId={accountId}
        token={token}
      />
    </div>
  );
}
