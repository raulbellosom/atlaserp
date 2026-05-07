import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Badge,
  Button,
  Checkbox,
  CurrencyField,
  DateField,
  SelectField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  Skeleton,
  TextField,
} from "@atlas/ui";
import {
  ArrowRightLeft,
  Calendar,
  CalendarDays,
  Coins,
  FileText,
  HandCoins,
  Hash,
  Notebook,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  defaultDocumentForm,
  formatMoney,
  normalizeCurrencyCode,
  parseApiError,
  resolveCurrencyOptions,
  toNumber,
} from "../lib/finance-utils";

export function DocumentSheet({ open, onOpenChange, direction, token }) {
  const queryClient = useQueryClient();
  const [documentForm, setDocumentForm] = useState(() =>
    defaultDocumentForm(direction || "AR"),
  );

  const taxRatesQuery = useQuery({
    queryKey: ["finance-tax-rates"],
    queryFn: () => atlas.finance.listTaxRates(token, { limit: 200 }),
    enabled: Boolean(token) && open,
  });

  const contactsQuery = useQuery({
    queryKey: ["finance-contacts-options"],
    queryFn: () => atlas.contacts.list(token, { limit: 200 }),
    enabled: Boolean(token) && open,
  });

  const taxRates = taxRatesQuery.data?.data ?? [];
  const contacts = contactsQuery.data?.data ?? [];
  const activeTaxRates = taxRates.filter((t) => t.enabled);

  const selectedDocumentTaxes = activeTaxRates.filter((tax) =>
    (documentForm.selectedTaxRateIds ?? []).includes(tax.id),
  );

  const documentTaxPreview = (() => {
    const subtotal = toNumber(documentForm.subtotalAmount);
    const totals = selectedDocumentTaxes.reduce(
      (acc, tax) => {
        const rate = toNumber(tax.rate);
        const amount = Number(((subtotal * rate) / 100).toFixed(2));
        if (String(tax.kind) === "WITHHOLDING") acc.withholdings += amount;
        else acc.transfers += amount;
        return acc;
      },
      { transfers: 0, withholdings: 0 },
    );
    const netTaxes = Number(
      (totals.transfers - totals.withholdings).toFixed(2),
    );
    const suggestedTotal = Number((subtotal + netTaxes).toFixed(2));
    return {
      subtotal,
      transfers: Number(totals.transfers.toFixed(2)),
      withholdings: Number(totals.withholdings.toFixed(2)),
      netTaxes,
      suggestedTotal,
    };
  })();

  const createDocumentMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createDocument(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-documents"] });
      queryClient.invalidateQueries({
        queryKey: ["finance-documents-applications"],
      });
      queryClient.invalidateQueries({ queryKey: ["finance-aging"] });
      onOpenChange(false);
      setDocumentForm(defaultDocumentForm(direction || "AR"));
      toast.success("Documento creado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear el documento."));
    },
  });

  function handleOpen(isOpen) {
    if (createDocumentMutation.isPending) return;
    if (isOpen) {
      setDocumentForm(defaultDocumentForm(direction || "AR"));
    }
    onOpenChange(isOpen);
  }

  function toggleDocumentTaxSelection(taxRateId, checked) {
    setDocumentForm((prev) => {
      const current = new Set(prev.selectedTaxRateIds ?? []);
      if (checked) current.add(taxRateId);
      else current.delete(taxRateId);
      const nextSelectedTaxRateIds = [...current];
      const subtotal = toNumber(prev.subtotalAmount);
      let nextTotalAmount = prev.totalAmount;
      if (subtotal > 0) {
        const selected = activeTaxRates.filter((tax) =>
          nextSelectedTaxRateIds.includes(tax.id),
        );
        const totals = selected.reduce(
          (acc, tax) => {
            const amount = Number(
              ((subtotal * toNumber(tax.rate)) / 100).toFixed(2),
            );
            if (String(tax.kind) === "WITHHOLDING") acc.withholdings += amount;
            else acc.transfers += amount;
            return acc;
          },
          { transfers: 0, withholdings: 0 },
        );
        const suggestedTotal = Number(
          (subtotal + totals.transfers - totals.withholdings).toFixed(2),
        );
        nextTotalAmount = String(suggestedTotal);
      }
      return {
        ...prev,
        selectedTaxRateIds: nextSelectedTaxRateIds,
        totalAmount: nextTotalAmount,
      };
    });
  }

  function handleSubmit(event) {
    event.preventDefault();
    const computedTotalAmount = toNumber(documentForm.totalAmount);
    const totalAmount =
      computedTotalAmount > 0
        ? computedTotalAmount
        : documentTaxPreview.suggestedTotal > 0
          ? documentTaxPreview.suggestedTotal
          : 0;
    if (totalAmount <= 0) {
      toast.error("El monto total debe ser mayor a cero.");
      return;
    }
    if (!documentForm.issueDate) {
      toast.error("La fecha de emision es obligatoria.");
      return;
    }
    const payload = {
      direction: documentForm.direction,
      docType: documentForm.docType,
      contactId: documentForm.contactId || null,
      currency: normalizeCurrencyCode(documentForm.currency || "MXN"),
      issueDate: documentForm.issueDate,
      dueDate: documentForm.dueDate || null,
      reference: documentForm.reference.trim() || null,
      notesMarkdown: documentForm.notesMarkdown.trim() || null,
      subtotalAmount:
        toNumber(documentForm.subtotalAmount) > 0
          ? toNumber(documentForm.subtotalAmount)
          : undefined,
      totalAmount,
      taxLines: (documentForm.selectedTaxRateIds ?? []).map((taxRateId) => ({
        taxRateId,
        baseAmount:
          toNumber(documentForm.subtotalAmount) > 0
            ? toNumber(documentForm.subtotalAmount)
            : undefined,
      })),
    };
    createDocumentMutation.mutate(payload);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-3xl lg:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Nuevo documento financiero</SheetTitle>
        </SheetHeader>
        <form
          id="finance-document-form"
          className="space-y-4 py-4"
          onSubmit={handleSubmit}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField
              label="Direccion"
              icon={ArrowRightLeft}
              value={documentForm.direction}
              onValueChange={(v) =>
                setDocumentForm((p) => ({ ...p, direction: v }))
              }
              options={[
                { value: "AR", label: "AR (CxC)" },
                { value: "AP", label: "AP (CxP)" },
              ]}
              required
            />
            <SelectField
              label="Tipo"
              icon={FileText}
              value={documentForm.docType}
              onValueChange={(v) =>
                setDocumentForm((p) => ({ ...p, docType: v }))
              }
              options={[
                { value: "INVOICE", label: "Factura" },
                { value: "DEBIT_NOTE", label: "Nota de débito" },
                { value: "CREDIT_NOTE", label: "Nota de crédito" },
                { value: "PAYMENT", label: "Pago" },
                { value: "ADVANCE", label: "Anticipo" },
              ]}
              required
            />
            <SelectField
              label="Moneda"
              icon={Coins}
              value={documentForm.currency}
              onValueChange={(v) =>
                setDocumentForm((p) => ({
                  ...p,
                  currency: normalizeCurrencyCode(v),
                }))
              }
              options={resolveCurrencyOptions(documentForm.currency)}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <SelectField
              label="Contacto"
              icon={HandCoins}
              value={documentForm.contactId}
              onValueChange={(v) =>
                setDocumentForm((p) => ({ ...p, contactId: v }))
              }
              options={contacts.map((c) => ({
                value: c.id,
                label: `${c.name}${c.type ? ` (${c.type})` : ""}`,
              }))}
              placeholder="Selecciona contacto"
            />
            <CurrencyField
              label="Subtotal"
              icon={Scale}
              value={documentForm.subtotalAmount}
              onChange={(v) =>
                setDocumentForm((p) => ({ ...p, subtotalAmount: v }))
              }
              currency={documentForm.currency || "MXN"}
              allowNegative={false}
              min={0}
            />
            <CurrencyField
              label="Monto total"
              icon={Scale}
              value={documentForm.totalAmount}
              onChange={(v) =>
                setDocumentForm((p) => ({ ...p, totalAmount: v }))
              }
              currency={documentForm.currency || "MXN"}
              allowNegative={false}
              min={0}
              required
            />
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-[hsl(var(--foreground))]">
                Impuestos y retenciones
              </p>
              <Badge variant="glass">
                {selectedDocumentTaxes.length} seleccionados
              </Badge>
            </div>
            {taxRatesQuery.isLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : activeTaxRates.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                No hay impuestos activos. Puedes crearlos en Finanzas &gt;
                Impuestos.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {activeTaxRates
                  .filter(
                    (tax) =>
                      !tax.direction ||
                      tax.direction === documentForm.direction,
                  )
                  .map((tax) => {
                    const checked = (
                      documentForm.selectedTaxRateIds ?? []
                    ).includes(tax.id);
                    return (
                      <label
                        key={tax.id}
                        className="flex items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 py-2 text-sm"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) =>
                            toggleDocumentTaxSelection(tax.id, Boolean(v))
                          }
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {tax.key} - {tax.name}
                          </p>
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">
                            {tax.kind === "WITHHOLDING"
                              ? "Retención"
                              : "Trasladado"}{" "}
                            {Number(tax.rate).toFixed(4)}%
                          </p>
                        </div>
                      </label>
                    );
                  })}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Badge variant="glass">
                Subtotal:{" "}
                {formatMoney(
                  documentTaxPreview.subtotal,
                  documentForm.currency || "MXN",
                )}
              </Badge>
              <Badge variant="success">
                Trasladados:{" "}
                {formatMoney(
                  documentTaxPreview.transfers,
                  documentForm.currency || "MXN",
                )}
              </Badge>
              <Badge variant="secondary">
                Retenciones:{" "}
                {formatMoney(
                  documentTaxPreview.withholdings,
                  documentForm.currency || "MXN",
                )}
              </Badge>
              <Badge variant="glass">
                Sugerido:{" "}
                {formatMoney(
                  documentTaxPreview.suggestedTotal,
                  documentForm.currency || "MXN",
                )}
              </Badge>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <DateField
              label="Emision"
              icon={Calendar}
              value={documentForm.issueDate}
              onChange={(e) =>
                setDocumentForm((p) => ({ ...p, issueDate: e.target.value }))
              }
              required
            />
            <DateField
              label="Vencimiento"
              icon={CalendarDays}
              value={documentForm.dueDate}
              onChange={(e) =>
                setDocumentForm((p) => ({ ...p, dueDate: e.target.value }))
              }
            />
            <TextField
              label="Referencia"
              icon={Hash}
              value={documentForm.reference}
              onChange={(e) =>
                setDocumentForm((p) => ({ ...p, reference: e.target.value }))
              }
              placeholder="FAC-0001"
            />
          </div>
          <TextField
            label="Observaciones"
            icon={Notebook}
            value={documentForm.notesMarkdown}
            onChange={(e) =>
              setDocumentForm((p) => ({ ...p, notesMarkdown: e.target.value }))
            }
            placeholder="Notas del documento"
          />
        </form>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="finance-document-form"
            loading={createDocumentMutation.isPending}
          >
            Guardar documento
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
