import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Input,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  TextField,
} from "@atlas/ui";
import { Notebook } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  computeApplyTotals,
  formatMoney,
  parseApiError,
  toNumber,
} from "../lib/finance-utils";

export function ApplySheet({ open, onOpenChange, sourceDocument, token }) {
  const queryClient = useQueryClient();
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyTargets, setApplyTargets] = useState([]);
  const [applyLines, setApplyLines] = useState([]);
  const [applyTotals, setApplyTotals] = useState({ applied: 0, unapplied: 0 });
  const [applyNote, setApplyNote] = useState("");

  const applyTargetById = useMemo(
    () =>
      new Map(
        applyTargets.map((target) => [
          target.id,
          {
            openAmount: toNumber(target.openAmount),
            currency: target.currency || "MXN",
            label:
              target.reference ||
              target.contact?.name ||
              target.contact?.legalName ||
              target.id,
          },
        ]),
      ),
    [applyTargets],
  );

  const applyFifoMutation = useMutation({
    mutationFn: ({ documentId, lines, note }) =>
      atlas.finance.applyDocument(
        documentId,
        { lines, note: note ?? null },
        token,
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-documents-applications"],
      });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-applications-history"],
      });
      onOpenChange(false);
      toast.success("Aplicación registrada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo aplicar el documento."));
    },
  });

  async function loadPreview(doc) {
    setApplyLines([]);
    setApplyTargets([]);
    setApplyTotals({ applied: 0, unapplied: toNumber(doc?.openAmount) });
    setApplyNote("");
    setApplyLoading(true);
    try {
      const preview = await atlas.finance.previewApplication(
        doc.id,
        { allocationMode: "fifo" },
        token,
      );
      const previewData = preview?.data ?? {};
      const targets = previewData.targets ?? [];
      const lineByTarget = new Map(
        (previewData.lines ?? []).map((line) => [
          line.targetDocumentId,
          {
            amount: toNumber(line.amount),
            targetAmount: toNumber(line.targetAmount ?? line.amount),
            sourceAmount: toNumber(line.sourceAmount ?? line.amount),
            effectiveFxRate: toNumber(line.effectiveFxRate || 1),
          },
        ]),
      );
      const draftLines = targets.map((target) => {
        const fxRate = previewData.fxByTarget?.[target.id];
        return {
          targetDocumentId: target.id,
          amount: lineByTarget.get(target.id)?.amount ?? 0,
          targetAmount: lineByTarget.get(target.id)?.targetAmount ?? 0,
          sourceAmount: lineByTarget.get(target.id)?.sourceAmount ?? 0,
          effectiveFxRate:
            lineByTarget.get(target.id)?.effectiveFxRate ??
            toNumber(fxRate?.effectiveFxRate || 0),
          targetCurrency: target.currency || "MXN",
          sourceCurrency: doc?.currency || "MXN",
        };
      });
      setApplyTargets(targets);
      setApplyLines(draftLines);
      setApplyTotals(
        computeApplyTotals(
          draftLines,
          doc?.openAmount ?? previewData.source?.openAmount,
        ),
      );
    } catch (error) {
      toast.error(
        parseApiError(error, "No se pudo cargar la propuesta de aplicación."),
      );
      onOpenChange(false);
    } finally {
      setApplyLoading(false);
    }
  }

  function handleOpen(isOpen) {
    if (applyFifoMutation.isPending) return;
    if (isOpen && sourceDocument) {
      loadPreview(sourceDocument);
    } else if (!isOpen) {
      setApplyTargets([]);
      setApplyLines([]);
      setApplyNote("");
    }
    onOpenChange(isOpen);
  }

  function updateApplyLine(targetDocumentId, amountValue) {
    setApplyLines((prev) => {
      const next = prev.map((line) =>
        line.targetDocumentId === targetDocumentId
          ? (() => {
              const targetAmount = toNumber(amountValue);
              const fxRate = toNumber(line.effectiveFxRate || 0);
              const sourceAmount =
                fxRate > 0
                  ? Number((targetAmount / fxRate).toFixed(2))
                  : targetAmount;
              return {
                ...line,
                amount: targetAmount,
                targetAmount,
                sourceAmount,
              };
            })()
          : line,
      );
      setApplyTotals(computeApplyTotals(next, sourceDocument?.openAmount));
      return next;
    });
  }

  function resetApplyToFifo() {
    if (!applyTargets.length) return;
    const next = applyTargets.map((target) => ({
      targetDocumentId: target.id,
      amount: 0,
      targetAmount: 0,
      sourceAmount: 0,
      effectiveFxRate: target.currency === sourceDocument?.currency ? 1 : 0,
      targetCurrency: target.currency || "MXN",
      sourceCurrency: sourceDocument?.currency || "MXN",
    }));
    setApplyLines(next);
    setApplyTotals(computeApplyTotals(next, sourceDocument?.openAmount));
  }

  function submitManualApply(event) {
    event.preventDefault();
    if (!sourceDocument?.id) {
      toast.error("No hay documento origen para aplicar.");
      return;
    }
    const lines = applyLines
      .map((line) => ({
        targetDocumentId: line.targetDocumentId,
        amount: toNumber(line.amount),
        effectiveFxRate: toNumber(line.effectiveFxRate || 0),
        sourceCurrency: line.sourceCurrency,
        targetCurrency: line.targetCurrency,
      }))
      .filter((line) => line.amount > 0);
    if (!lines.length) {
      toast.error("Debes asignar al menos un monto mayor a cero.");
      return;
    }
    const missingFxLine = lines.find(
      (line) =>
        String(line.sourceCurrency || "") !==
          String(line.targetCurrency || "") && line.effectiveFxRate <= 0,
    );
    if (missingFxLine) {
      toast.error(
        "Falta tipo de cambio para uno o mas documentos destino en la fecha actual.",
      );
      return;
    }
    applyFifoMutation.mutate({
      documentId: sourceDocument.id,
      lines: lines.map(({ targetDocumentId, amount }) => ({
        targetDocumentId,
        amount,
      })),
      note: applyNote.trim() || null,
    });
  }

  const currency = sourceDocument?.currency || "MXN";

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-4xl lg:max-w-5xl">
        <SheetHeader>
          <SheetTitle>Aplicación manual de documento</SheetTitle>
        </SheetHeader>
        <form className="space-y-4 py-4" onSubmit={submitManualApply}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Badge variant="glass">
              Documento:{" "}
              {sourceDocument?.reference || sourceDocument?.id || "-"}
            </Badge>
            <Badge variant="glass">
              Tipo: {sourceDocument?.docType || "-"}
            </Badge>
            <Badge variant="glass">
              Abierto: {formatMoney(sourceDocument?.openAmount ?? 0, currency)}
            </Badge>
          </div>

          {applyLoading ? (
            <Skeleton className="h-40 w-full rounded-xl" />
          ) : applyTargets.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No hay documentos destino disponibles para aplicar.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[hsl(var(--border))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[hsl(var(--muted))/0.35]">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Destino</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Abierto destino
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Aplicar destino
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Equivalente origen
                    </th>
                    <th className="px-3 py-2 text-left font-medium">FX</th>
                  </tr>
                </thead>
                <tbody>
                  {applyLines.map((line) => {
                    const target = applyTargetById.get(line.targetDocumentId);
                    return (
                      <tr
                        key={line.targetDocumentId}
                        className="border-t border-[hsl(var(--border))]"
                      >
                        <td className="px-3 py-2">
                          {target?.label || line.targetDocumentId}
                        </td>
                        <td className="px-3 py-2">
                          {formatMoney(
                            target?.openAmount ?? 0,
                            target?.currency || "MXN",
                          )}
                        </td>
                        <td className="px-3 py-2 w-48">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.amount}
                            onChange={(e) =>
                              updateApplyLine(
                                line.targetDocumentId,
                                e.target.value,
                              )
                            }
                            className="h-10"
                          />
                        </td>
                        <td className="px-3 py-2">
                          {formatMoney(
                            line.sourceAmount ?? line.amount ?? 0,
                            currency,
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {toNumber(line.effectiveFxRate) > 0
                            ? `${toNumber(line.effectiveFxRate).toFixed(6)}`
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Badge variant="glass">
              Aplicado: {formatMoney(applyTotals.applied, currency)}
            </Badge>
            <Badge
              variant={applyTotals.unapplied > 0 ? "secondary" : "success"}
            >
              Pendiente: {formatMoney(applyTotals.unapplied, currency)}
            </Badge>
            <Badge
              variant={
                applyTotals.applied > toNumber(sourceDocument?.openAmount)
                  ? "destructive"
                  : "glass"
              }
            >
              Límite: {formatMoney(sourceDocument?.openAmount ?? 0, currency)}
            </Badge>
          </div>

          <TextField
            label="Nota de aplicación"
            icon={Notebook}
            value={applyNote}
            onChange={(e) => setApplyNote(e.target.value)}
            placeholder="Observación interna opcional"
          />

          <SheetFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={resetApplyToFifo}
              disabled={applyLoading || applyFifoMutation.isPending}
            >
              Limpiar
            </Button>
            <Button
              type="submit"
              loading={applyFifoMutation.isPending}
              disabled={
                applyLoading ||
                applyTotals.applied <= 0 ||
                applyTotals.applied > toNumber(sourceDocument?.openAmount)
              }
            >
              Confirmar aplicación
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
