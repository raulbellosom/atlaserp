import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  PageHeader,
  SelectField,
  Skeleton,
} from "@atlas/ui";
import {
  ArrowRightLeft,
  CalendarDays,
  Component,
  Edit3,
  HandCoins,
  NotebookPen,
  Plus,
  Power,
  PowerOff,
} from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  APPLY_SOURCE_DOC_TYPES,
  DOCUMENT_STATUS_LABELS,
  SECTION_META,
  formatDate,
  formatDocumentTypeLabel,
  formatMoney,
  matchesDueFilter,
  parseApiError,
  resolveDocumentOperationalStatus,
  toNumber,
} from "../lib/finance-utils";
import { DocumentSheet } from "../components/DocumentSheet";
import { ApplySheet } from "../components/ApplySheet";
import { JournalLinksSheet } from "../components/JournalLinksSheet";
import { ReminderSheet } from "../components/ReminderSheet";

export function FinanceAr({ token }) {
  const queryClient = useQueryClient();
  const [arStatusFilter, setArStatusFilter] = useState("all");
  const [arDueFilter, setArDueFilter] = useState("all");
  const [documentSheetOpen, setDocumentSheetOpen] = useState(false);
  const [applySheetOpen, setApplySheetOpen] = useState(false);
  const [applySourceDocument, setApplySourceDocument] = useState(null);
  const [journalSheetOpen, setJournalSheetOpen] = useState(false);
  const [journalSourceDocument, setJournalSourceDocument] = useState(null);
  const [reminderSheetOpen, setReminderSheetOpen] = useState(false);
  const [reminderDocument, setReminderDocument] = useState(null);
  const [bulkReminderSheetOpen, setBulkReminderSheetOpen] = useState(false);
  const [bulkReminderIds, setBulkReminderIds] = useState([]);
  const [pendingDocumentId, setPendingDocumentId] = useState(null);
  const [pendingApplyDocumentId, setPendingApplyDocumentId] = useState(null);

  const arDocumentsQuery = useQuery({
    queryKey: ["finance-documents", "AR"],
    queryFn: () =>
      atlas.finance.listDocuments(token, { direction: "AR", limit: 200 }),
    enabled: Boolean(token),
  });

  const toggleDocumentMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setDocumentEnabled(id, enabled, token),
    onMutate: ({ id }) => setPendingDocumentId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-documents-applications"],
      });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-applications-history"],
      });
      toast.success("Estado de documento actualizado");
    },
    onSettled: () => setPendingDocumentId(null),
    onError: (error) => {
      toast.error(
        parseApiError(error, "No se pudo actualizar el estado del documento."),
      );
    },
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

  const arDocuments = arDocumentsQuery.data?.data ?? [];
  const arFilteredDocuments = useMemo(() => {
    return arDocuments.filter((doc) => {
      const status = resolveDocumentOperationalStatus(doc);
      const statusMatch =
        arStatusFilter === "all" ? true : status === arStatusFilter;
      const dueMatch = matchesDueFilter(doc, arDueFilter);
      return statusMatch && dueMatch;
    });
  }, [arDocuments, arStatusFilter, arDueFilter]);

  async function applyAutomaticFifo(doc) {
    try {
      const preview = await atlas.finance.previewApplication(
        doc.id,
        { allocationMode: "fifo" },
        token,
      );
      const lines = (preview?.data?.lines ?? [])
        .map((line) => ({
          targetDocumentId: line.targetDocumentId,
          amount: toNumber(line.amount),
        }))
        .filter((line) => line.amount > 0);
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

  const pageMeta = SECTION_META.ar;

  const headerActions = (
    <Button onClick={() => setDocumentSheetOpen(true)}>
      <Plus className="h-4 w-4" />
      Nuevo documento
    </Button>
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
              <CardTitle className="text-base">Documentos por cobrar</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                <SelectField
                  label="Estado"
                  icon={Component}
                  value={arStatusFilter}
                  onValueChange={setArStatusFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "OVERDUE", label: "Vencidos" },
                    { value: "OPEN", label: "Abiertos" },
                    { value: "PARTIAL", label: "Parciales" },
                    { value: "PAID", label: "Pagados" },
                    { value: "VOID", label: "Anulados" },
                  ]}
                />
                <SelectField
                  label="Vencimiento"
                  icon={CalendarDays}
                  value={arDueFilter}
                  onValueChange={setArDueFilter}
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "today", label: "Vence hoy" },
                    { value: "week", label: "Esta semana" },
                  ]}
                />
                <div className="md:col-span-2 flex items-end justify-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      const ids = arFilteredDocuments
                        .filter((d) => d.enabled && toNumber(d.openAmount) > 0)
                        .map((d) => d.id);
                      if (!ids.length) {
                        toast.error(
                          "No hay documentos visibles con saldo abierto.",
                        );
                        return;
                      }
                      setBulkReminderIds(ids);
                      setBulkReminderSheetOpen(true);
                    }}
                  >
                    Recordar visibles
                  </Button>
                </div>
              </div>
              {arDocumentsQuery.isLoading ? (
                <Skeleton className="h-40 w-full rounded-xl" />
              ) : arFilteredDocuments.length === 0 ? (
                <EmptyState
                  title="Sin documentos AR"
                  description="Registra facturas, pagos o anticipos de clientes."
                  icon={HandCoins}
                  action={{
                    label: "Nuevo documento",
                    onClick: () => setDocumentSheetOpen(true),
                  }}
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
                  <table className="min-w-full text-sm">
                    <thead className="bg-[hsl(var(--muted))/0.35]">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium">
                          Tipo
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Contacto
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Referencia
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Emision
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Total
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Abierto
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Estado
                        </th>
                        <th className="px-3 py-2 text-left font-medium">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {arFilteredDocuments.map((doc) => {
                        const operationalStatus =
                          resolveDocumentOperationalStatus(doc);
                        return (
                          <tr
                            key={doc.id}
                            className="border-t border-[hsl(var(--border))]"
                          >
                            <td className="px-3 py-2">
                              {formatDocumentTypeLabel(doc.docType)}
                            </td>
                            <td className="px-3 py-2">
                              {doc.contact?.name || "Sin contacto"}
                            </td>
                            <td className="px-3 py-2">
                              {doc.reference || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {formatDate(doc.issueDate)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.totalAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              {formatMoney(doc.openAmount, doc.currency)}
                            </td>
                            <td className="px-3 py-2">
                              <Badge
                                variant={
                                  operationalStatus === "PAID"
                                    ? "success"
                                    : operationalStatus === "PARTIAL"
                                      ? "glass"
                                      : operationalStatus === "OVERDUE"
                                        ? "destructive"
                                        : "secondary"
                                }
                              >
                                {DOCUMENT_STATUS_LABELS[operationalStatus] ||
                                  operationalStatus}
                              </Badge>
                            </td>
                            <td className="px-3 py-2">
                              <ActionMenu
                                items={[
                                  {
                                    label: "Ver pólizas",
                                    icon: NotebookPen,
                                    onClick: () => {
                                      setJournalSourceDocument(doc);
                                      setJournalSheetOpen(true);
                                    },
                                  },
                                  ...(doc.enabled &&
                                  APPLY_SOURCE_DOC_TYPES.has(doc.docType) &&
                                  toNumber(doc.openAmount) > 0
                                    ? [
                                        {
                                          label: "Aplicar FIFO",
                                          icon: ArrowRightLeft,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () =>
                                            applyAutomaticFifo(doc),
                                        },
                                        {
                                          label: "Aplicar manual",
                                          icon: Edit3,
                                          disabled:
                                            pendingApplyDocumentId === doc.id,
                                          onClick: () => {
                                            setApplySourceDocument(doc);
                                            setApplySheetOpen(true);
                                          },
                                        },
                                      ]
                                    : []),
                                  ...(doc.enabled &&
                                  toNumber(doc.openAmount) > 0
                                    ? [
                                        {
                                          label: "Recordatorio",
                                          icon: CalendarDays,
                                          onClick: () => {
                                            setReminderDocument(doc);
                                            setReminderSheetOpen(true);
                                          },
                                        },
                                      ]
                                    : []),
                                  doc.enabled
                                    ? {
                                        label: "Deshabilitar",
                                        icon: PowerOff,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
                                            enabled: false,
                                          }),
                                      }
                                    : {
                                        label: "Habilitar",
                                        icon: Power,
                                        disabled: pendingDocumentId === doc.id,
                                        onClick: () =>
                                          toggleDocumentMutation.mutate({
                                            id: doc.id,
                                            enabled: true,
                                          }),
                                      },
                                ]}
                              />
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

      <DocumentSheet
        open={documentSheetOpen}
        onOpenChange={setDocumentSheetOpen}
        direction="AR"
        token={token}
      />
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
      <ReminderSheet
        open={reminderSheetOpen}
        onOpenChange={setReminderSheetOpen}
        document={reminderDocument}
        token={token}
      />
      <ReminderSheet
        open={bulkReminderSheetOpen}
        onOpenChange={setBulkReminderSheetOpen}
        documentIds={bulkReminderIds}
        label="CxC"
        token={token}
      />
    </div>
  );
}
