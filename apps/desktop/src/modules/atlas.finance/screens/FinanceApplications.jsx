import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DateField,
  PageHeader,
  SelectField,
  Skeleton,
} from "@atlas/ui";
import {
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  Component,
  HandCoins,
  NotebookPen,
  Edit3,
} from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  APPLICATION_STATUS_LABELS,
  APPLY_SOURCE_DOC_TYPES,
  SECTION_META,
  formatDate,
  formatDateInputValue,
  formatDocumentTypeLabel,
  formatMoney,
  parseApiError,
  toCsvCell,
  toNumber,
} from "../lib/finance-utils";
import { ApplySheet } from "../components/ApplySheet";
import { JournalLinksSheet } from "../components/JournalLinksSheet";
import { ReverseApplicationSheet } from "../components/ReverseApplicationSheet";

export function FinanceApplications({ token }) {
  const queryClient = useQueryClient();
  const [applicationsDirectionFilter, setApplicationsDirectionFilter] =
    useState("all");
  const [applicationsStatusFilter, setApplicationsStatusFilter] =
    useState("all");
  const [applicationsContactFilter, setApplicationsContactFilter] =
    useState("all");
  const [applicationsFromDate, setApplicationsFromDate] = useState("");
  const [applicationsToDate, setApplicationsToDate] = useState("");
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applySourceDocument, setApplySourceDocument] = useState(null);
  const [journalSheetOpen, setJournalSheetOpen] = useState(false);
  const [journalSourceDocument, setJournalSourceDocument] = useState(null);
  const [reverseSheetOpen, setReverseSheetOpen] = useState(false);
  const [reverseApplication, setReverseApplication] = useState(null);
  const [pendingApplyDocumentId, setPendingApplyDocumentId] = useState(null);

  const applicationDocumentsQuery = useQuery({
    queryKey: ["finance-documents-applications"],
    queryFn: () =>
      atlas.finance.listDocuments(token, { status: "OPEN", limit: 250 }),
    enabled: Boolean(token),
  });

  const applicationsHistoryQuery = useQuery({
    queryKey: [
      "finance-applications-history",
      applicationsDirectionFilter,
      applicationsStatusFilter,
      applicationsContactFilter,
      applicationsFromDate,
      applicationsToDate,
    ],
    queryFn: () =>
      atlas.finance.listApplications(token, {
        direction:
          applicationsDirectionFilter !== "all"
            ? applicationsDirectionFilter
            : undefined,
        status:
          applicationsStatusFilter !== "all"
            ? applicationsStatusFilter
            : undefined,
        contactId:
          applicationsContactFilter !== "all"
            ? applicationsContactFilter
            : undefined,
        from: applicationsFromDate || undefined,
        to: applicationsToDate || undefined,
        limit: 200,
      }),
    enabled: Boolean(token),
  });

  const contactsQuery = useQuery({
    queryKey: ["finance-contacts-options"],
    queryFn: () => atlas.contacts.list(token, { limit: 200 }),
    enabled: Boolean(token),
  });

  const applyFifoMutation = useMutation({
    mutationFn: ({ documentId, lines, note }) =>
      atlas.finance.applyDocument(
        documentId,
        { lines, note: note ?? null },
        token,
      ),
    onMutate: ({ documentId }) => setPendingApplyDocumentId(documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-documents-applications"],
      });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-applications-history"],
      });
      toast.success("Aplicación registrada");
    },
    onSettled: () => setPendingApplyDocumentId(null),
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo aplicar el documento."));
    },
  });

  const applicationDocuments = applicationDocumentsQuery.data?.data ?? [];
  const applicationsHistory = applicationsHistoryQuery.data?.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];

  const openSourceDocuments = useMemo(
    () =>
      applicationDocuments.filter(
        (doc) =>
          doc.enabled &&
          APPLY_SOURCE_DOC_TYPES.has(doc.docType) &&
          toNumber(doc.openAmount) > 0,
      ),
    [applicationDocuments],
  );

  async function applyAutomaticFifo(doc) {
    try {
      const preview = await atlas.finance.previewApplication(
        doc.id,
        { allocationMode: "fifo" },
        token,
      );
      const lines = (preview?.data?.lines ?? [])
        .map((l) => ({
          targetDocumentId: l.targetDocumentId,
          amount: toNumber(l.amount),
        }))
        .filter((l) => l.amount > 0);
      if (!lines.length) {
        toast.error("No hay documentos abiertos compatibles para aplicar.");
        return;
      }
      applyFifoMutation.mutate({
        documentId: doc.id,
        lines,
        note: "Aplicación FIFO automática",
      });
    } catch (error) {
      toast.error(parseApiError(error, "No se pudo preparar la aplicación."));
    }
  }

  function exportApplicationsHistoryCsv() {
    if (!applicationsHistory.length) {
      toast.error("No hay registros para exportar.");
      return;
    }
    const headers = [
      "Fecha",
      "Estado",
      "Direccion",
      "Tipo origen",
      "Referencia origen",
      "Contacto origen",
      "Tipo destino",
      "Referencia destino",
      "Contacto destino",
      "Monto origen",
      "Moneda origen",
      "Monto destino",
      "Moneda destino",
      "FX efectiva",
      "Revertida en",
      "Motivo reversa",
    ];
    const rows = applicationsHistory.map((row) => [
      formatDateInputValue(row.appliedAt),
      APPLICATION_STATUS_LABELS[row.status] || row.status || "",
      row.sourceDocument?.direction || "",
      formatDocumentTypeLabel(row.sourceDocument?.docType),
      row.sourceDocument?.reference || row.sourceDocumentId || "",
      row.sourceDocument?.contact?.name || "",
      formatDocumentTypeLabel(row.targetDocument?.docType),
      row.targetDocument?.reference || row.targetDocumentId || "",
      row.targetDocument?.contact?.name || "",
      toNumber(row.sourceAmount ?? row.appliedAmount).toFixed(2),
      row.sourceDocument?.currency || row.targetDocument?.currency || "MXN",
      toNumber(row.targetAmount ?? row.appliedAmount).toFixed(2),
      row.targetDocument?.currency || row.sourceDocument?.currency || "MXN",
      toNumber(row.effectiveFxRate || 0) > 0
        ? toNumber(row.effectiveFxRate).toFixed(6)
        : "",
      formatDateInputValue(row.reversedAt),
      row.reversalReason || "",
    ]);
    const csv = [headers, ...rows]
      .map((line) => line.map(toCsvCell).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `historial-aplicaciones-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    toast.success("CSV generado");
  }

  const pageMeta = SECTION_META.applications;

  return (
    <div className="flex flex-col min-h-full">
      <div className="flex-1 p-4 md:p-6 space-y-6">
        <PageHeader
          eyebrow="Atlas Finance"
          title={pageMeta.title}
          description={pageMeta.description}
        />

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Pagos y anticipos pendientes de aplicar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {applicationDocumentsQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : openSourceDocuments.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  No hay documentos abiertos para aplicar.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Direccion
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Contacto
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Abierto
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {openSourceDocuments.map((doc) => (
                        <tr
                          key={doc.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">{doc.direction}</td>
                          <td className="px-3 py-2">
                            {formatDocumentTypeLabel(doc.docType)}
                          </td>
                          <td className="px-3 py-2">
                            {doc.contact?.name || "Sin contacto"}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(doc.openAmount, doc.currency)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => applyAutomaticFifo(doc)}
                                loading={pendingApplyDocumentId === doc.id}
                              >
                                Aplicar FIFO
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setApplySourceDocument(doc);
                                  setApplySheetOpen(true);
                                }}
                                disabled={pendingApplyDocumentId === doc.id}
                              >
                                Aplicar manual
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setJournalSourceDocument(doc);
                                  setJournalSheetOpen(true);
                                }}
                              >
                                Ver pólizas
                              </Button>
                            </div>
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
              <CardTitle className="text-base">
                Historial de aplicaciones
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-6 gap-3">
                <SelectField
                  label="Direccion"
                  icon={ArrowRightLeft}
                  value={applicationsDirectionFilter}
                  onValueChange={setApplicationsDirectionFilter}
                  options={[
                    { value: "all", label: "Todas" },
                    { value: "AR", label: "AR (CxC)" },
                    { value: "AP", label: "AP (CxP)" },
                  ]}
                />
                <SelectField
                  label="Estado"
                  icon={Component}
                  value={applicationsStatusFilter}
                  onValueChange={setApplicationsStatusFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "APPLIED", label: "Aplicadas" },
                    { value: "REVERSED", label: "Revertidas" },
                  ]}
                />
                <SelectField
                  label="Contacto"
                  icon={HandCoins}
                  value={applicationsContactFilter}
                  onValueChange={setApplicationsContactFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    ...contacts.map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <DateField
                  label="Desde"
                  icon={Calendar}
                  value={applicationsFromDate}
                  onChange={(e) => setApplicationsFromDate(e.target.value)}
                />
                <DateField
                  label="Hasta"
                  icon={CalendarDays}
                  value={applicationsToDate}
                  onChange={(e) => setApplicationsToDate(e.target.value)}
                />
                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setApplicationsDirectionFilter("all");
                      setApplicationsStatusFilter("all");
                      setApplicationsContactFilter("all");
                      setApplicationsFromDate("");
                      setApplicationsToDate("");
                    }}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
              <div className="mb-4 flex items-center justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={exportApplicationsHistoryCsv}
                  disabled={
                    applicationsHistoryQuery.isLoading ||
                    applicationsHistory.length === 0
                  }
                >
                  Exportar CSV
                </Button>
              </div>

              {applicationsHistoryQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : applicationsHistory.length === 0 ? (
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Aún no hay aplicaciones registradas.
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
                          Estado
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Origen
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Destino
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Monto origen
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Monto destino
                        </th>
                        <th className="px-3 py-2 text-left font-medium">FX</th>
                        <th className="px-3 py-2 text-left font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {applicationsHistory.map((row) => (
                        <tr
                          key={row.id}
                          className="border-t border-[hsl(var(--border))]"
                        >
                          <td className="px-3 py-2">
                            {formatDate(row.appliedAt)}
                          </td>
                          <td className="px-3 py-2">
                            <Badge
                              variant={
                                row.status === "REVERSED"
                                  ? "secondary"
                                  : "success"
                              }
                            >
                              {APPLICATION_STATUS_LABELS[row.status] ||
                                row.status ||
                                "-"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {formatDocumentTypeLabel(
                                  row.sourceDocument?.docType,
                                )}{" "}
                                -{" "}
                                {row.sourceDocument?.reference ||
                                  row.sourceDocument?.contact?.name ||
                                  row.sourceDocumentId}
                              </span>
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {row.sourceDocument?.direction || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">
                                {formatDocumentTypeLabel(
                                  row.targetDocument?.docType,
                                )}{" "}
                                -{" "}
                                {row.targetDocument?.reference ||
                                  row.targetDocument?.contact?.name ||
                                  row.targetDocumentId}
                              </span>
                              <span className="text-xs text-[hsl(var(--muted-foreground))]">
                                {row.targetDocument?.direction || "-"}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              row.sourceAmount ?? row.appliedAmount,
                              row.sourceDocument?.currency ||
                                row.targetDocument?.currency ||
                                "MXN",
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {formatMoney(
                              row.targetAmount ?? row.appliedAmount,
                              row.targetDocument?.currency ||
                                row.sourceDocument?.currency ||
                                "MXN",
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {toNumber(row.effectiveFxRate) > 0
                              ? `${toNumber(row.effectiveFxRate).toFixed(6)}`
                              : "-"}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setJournalSourceDocument(
                                    row.sourceDocument || {
                                      id: row.sourceDocumentId,
                                      reference: row.sourceDocument?.reference,
                                    },
                                  );
                                  setJournalSheetOpen(true);
                                }}
                              >
                                Póliza origen
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setJournalSourceDocument(
                                    row.targetDocument || {
                                      id: row.targetDocumentId,
                                      reference: row.targetDocument?.reference,
                                    },
                                  );
                                  setJournalSheetOpen(true);
                                }}
                              >
                                Póliza destino
                              </Button>
                              {row.status !== "REVERSED" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setReverseApplication(row);
                                    setReverseSheetOpen(true);
                                  }}
                                >
                                  Anular
                                </Button>
                              )}
                            </div>
                            {row.reversedAt && (
                              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                                Revertida: {formatDate(row.reversedAt)}
                              </p>
                            )}
                            {row.reversalReason && (
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                Motivo: {row.reversalReason}
                              </p>
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

      <ApplySheet
        open={applySheetOpen}
        onOpenChange={setApplySheetOpen}
        sourceDocument={applySourceDocument}
        token={token}
      />
      <JournalLinksSheet
        open={journalSheetOpen}
        onOpenChange={setJournalSheetOpen}
        sourceDocument={journalSourceDocument}
        token={token}
      />
      <ReverseApplicationSheet
        open={reverseSheetOpen}
        onOpenChange={setReverseSheetOpen}
        application={reverseApplication}
        token={token}
      />
    </div>
  );
}
