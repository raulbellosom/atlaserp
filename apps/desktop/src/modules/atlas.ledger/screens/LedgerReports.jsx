import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  PageHeader,
  Skeleton,
  StatCard,
} from "@atlas/ui";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { LedgerFiltersBar } from "../components/LedgerFiltersBar";
import { downloadBlob, formatMoney, parseApiError } from "../lib/ledger-utils";

const DEFAULT_FILTERS = {};

export function LedgerReports({ token }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const summaryQuery = useQuery({
    queryKey: ["ledger-report-summary", filters],
    queryFn: () => atlas.ledger.getReportSummary(token, filters),
    enabled: Boolean(token),
  });

  const summary = summaryQuery.data?.data ?? {};

  function handleFiltersChange(partial) {
    setFilters((prev) => ({ ...prev, ...partial }));
  }

  function handleFiltersReset() {
    setFilters(DEFAULT_FILTERS);
  }

  async function handleExportExcel() {
    setExportingExcel(true);
    try {
      const blob = await atlas.ledger.exportMovementsExcel(token, filters);
      downloadBlob(blob, `movimientos-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast.error(parseApiError(e, "No se pudo generar el Excel."));
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleExportPdf() {
    setExportingPdf(true);
    try {
      const blob = await atlas.ledger.exportMovementsPdf(token, filters);
      downloadBlob(blob, `movimientos-${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (e) {
      toast.error(parseApiError(e, "No se pudo generar el PDF."));
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Ledger"
          title="Reportes"
          description="Resumen y exportacion del libro auxiliar de cuentas."
          actions={
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleExportExcel}
                loading={exportingExcel}
              >
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel
              </Button>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                loading={exportingPdf}
              >
                <FileText className="h-4 w-4" />
                Exportar PDF
              </Button>
            </div>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros del reporte</CardTitle>
          </CardHeader>
          <CardContent>
            <LedgerFiltersBar
              filters={filters}
              onChange={handleFiltersChange}
              onReset={handleFiltersReset}
            />
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {summaryQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                label="Total abonos"
                value={formatMoney(summary.totalIncome)}
              />
              <StatCard
                label="Total cargos"
                value={formatMoney(summary.totalExpense)}
              />
              <StatCard
                label="Movimientos activos"
                value={String(summary.activeCount ?? 0)}
              />
              <StatCard
                label="Movimientos cancelados"
                value={String(summary.cancelledCount ?? 0)}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
