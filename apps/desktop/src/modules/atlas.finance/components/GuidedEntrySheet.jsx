import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CurrencyField,
  DateTimeField,
  SelectField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextField,
} from "@atlas/ui";
import {
  ArrowRightLeft,
  CalendarDays,
  Coins,
  FileText,
  HandCoins,
  Hash,
  Notebook,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  defaultGuidedForm,
  normalizeCurrencyCode,
  parseApiError,
  resolveCurrencyOptions,
  toNumber,
} from "../lib/finance-utils";

export function GuidedEntrySheet({
  open,
  onOpenChange,
  token,
  accounts,
  onOpenAdvanced,
}) {
  const queryClient = useQueryClient();
  const [guidedForm, setGuidedForm] = useState(defaultGuidedForm);

  const activeAccounts = useMemo(
    () => (accounts ?? []).filter((a) => a.enabled),
    [accounts],
  );

  const createEntryMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createEntry(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-entries"] });
      queryClient.invalidateQueries({ queryKey: ["finance-balances"] });
      queryClient.invalidateQueries({ queryKey: ["finance-dashboard"] });
      onOpenChange(false);
      setGuidedForm(defaultGuidedForm());
      toast.success("Póliza creada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la captura guiada."));
    },
  });

  function handleOpen(isOpen) {
    if (createEntryMutation.isPending) return;
    if (!isOpen) setGuidedForm(defaultGuidedForm());
    onOpenChange(isOpen);
  }

  function guidedPresetMeta(sourceType) {
    if (sourceType === "income") {
      return {
        title: "Ingreso",
        fromLabel: "Cuenta origen / contrapartida",
        toLabel: "Cuenta destino del ingreso",
      };
    }
    if (sourceType === "expense") {
      return {
        title: "Egreso",
        fromLabel: "Cuenta de salida",
        toLabel: "Cuenta destino del gasto",
      };
    }
    return {
      title: "Transferencia",
      fromLabel: "Cuenta origen",
      toLabel: "Cuenta destino",
    };
  }

  const guidedMeta = guidedPresetMeta(guidedForm.sourceType);

  function buildGuidedPayload() {
    const sourceType = guidedForm.sourceType;
    const concept = guidedForm.concept.trim();
    if (!concept) throw new Error("El concepto es obligatorio.");
    const amount = toNumber(guidedForm.amount);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");
    const fromAccountId = guidedForm.fromAccountId;
    const toAccountId = guidedForm.toAccountId;
    if (!fromAccountId || !toAccountId)
      throw new Error("Debes seleccionar cuenta origen y cuenta destino.");
    if (fromAccountId === toAccountId)
      throw new Error("La cuenta origen y destino deben ser diferentes.");
    const currency = (guidedForm.currency || "MXN").trim().toUpperCase();
    const note = guidedForm.note.trim();
    return {
      occurredAt: guidedForm.occurredAt
        ? new Date(guidedForm.occurredAt).toISOString()
        : undefined,
      concept,
      reference: guidedForm.reference.trim() || undefined,
      currency,
      sourceType,
      lines: [
        {
          accountId: toAccountId,
          debit: amount,
          credit: 0,
          note: note || undefined,
          currency,
        },
        {
          accountId: fromAccountId,
          debit: 0,
          credit: amount,
          note: note || undefined,
          currency,
        },
      ],
    };
  }

  function buildGuidedDraftForAdvanced() {
    const sourceType = guidedForm.sourceType;
    const amount = toNumber(guidedForm.amount);
    const currency = (guidedForm.currency || "MXN").trim().toUpperCase();
    const note = guidedForm.note.trim();
    return {
      occurredAt: guidedForm.occurredAt,
      concept: guidedForm.concept.trim(),
      reference: guidedForm.reference.trim(),
      currency,
      sourceType,
      lines: [
        {
          accountId: guidedForm.toAccountId || "",
          debit: amount > 0 ? String(amount) : "",
          credit: "",
          note,
        },
        {
          accountId: guidedForm.fromAccountId || "",
          debit: "",
          credit: amount > 0 ? String(amount) : "",
          note,
        },
      ],
    };
  }

  function submitGuidedEntry(event) {
    event.preventDefault();
    try {
      const payload = buildGuidedPayload();
      createEntryMutation.mutate(payload);
    } catch (error) {
      toast.error(error.message || "No se pudo preparar la captura guiada.");
    }
  }

  function handleOpenAdvanced() {
    const draft = buildGuidedDraftForAdvanced();
    onOpenChange(false);
    setGuidedForm(defaultGuidedForm());
    if (onOpenAdvanced) onOpenAdvanced(draft);
  }

  const accountOptions = activeAccounts.map((a) => ({
    value: a.id,
    label: `${a.code} - ${a.name}`,
  }));

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-2xl lg:max-w-3xl xl:max-w-4xl">
        <SheetHeader>
          <SheetTitle>Captura guiada</SheetTitle>
        </SheetHeader>
        <form
          id="finance-guided-form"
          className="space-y-4 py-4"
          onSubmit={submitGuidedEntry}
        >
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={
                guidedForm.sourceType === "income" ? "default" : "outline"
              }
              onClick={() =>
                setGuidedForm((p) => ({ ...p, sourceType: "income" }))
              }
            >
              <HandCoins className="h-4 w-4" />
              Ingreso
            </Button>
            <Button
              type="button"
              variant={
                guidedForm.sourceType === "expense" ? "default" : "outline"
              }
              onClick={() =>
                setGuidedForm((p) => ({ ...p, sourceType: "expense" }))
              }
            >
              <Receipt className="h-4 w-4" />
              Egreso
            </Button>
            <Button
              type="button"
              variant={
                guidedForm.sourceType === "transfer" ? "default" : "outline"
              }
              onClick={() =>
                setGuidedForm((p) => ({ ...p, sourceType: "transfer" }))
              }
            >
              <ArrowRightLeft className="h-4 w-4" />
              Transferencia
            </Button>
          </div>

          <div className="rounded-xl border border-[hsl(var(--border))] p-3 text-sm text-[hsl(var(--muted-foreground))]">
            Flujo activo:{" "}
            <span className="font-medium text-[hsl(var(--foreground))]">
              {guidedMeta.title}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <TextField
              label="Concepto"
              icon={Notebook}
              value={guidedForm.concept}
              onChange={(e) =>
                setGuidedForm((p) => ({ ...p, concept: e.target.value }))
              }
              placeholder={`${guidedMeta.title} registrado`}
              required
            />
            <TextField
              label="Referencia"
              icon={Hash}
              value={guidedForm.reference}
              onChange={(e) =>
                setGuidedForm((p) => ({ ...p, reference: e.target.value }))
              }
              placeholder="REF-001"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CurrencyField
              label="Monto"
              icon={Scale}
              value={guidedForm.amount}
              onChange={(v) => setGuidedForm((p) => ({ ...p, amount: v }))}
              currency={guidedForm.currency || "MXN"}
              allowNegative={false}
              min={0}
              placeholder="0.00"
              required
            />
            <SelectField
              label="Moneda"
              icon={Coins}
              value={guidedForm.currency}
              onValueChange={(v) =>
                setGuidedForm((p) => ({
                  ...p,
                  currency: normalizeCurrencyCode(v),
                }))
              }
              options={resolveCurrencyOptions(guidedForm.currency)}
              required
            />
            <DateTimeField
              label="Fecha"
              icon={CalendarDays}
              value={guidedForm.occurredAt}
              onChange={(e) =>
                setGuidedForm((p) => ({ ...p, occurredAt: e.target.value }))
              }
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <SelectField
              label={guidedMeta.fromLabel}
              icon={Wallet}
              value={guidedForm.fromAccountId}
              onValueChange={(v) =>
                setGuidedForm((p) => ({ ...p, fromAccountId: v }))
              }
              options={accountOptions}
              placeholder="Selecciona cuenta"
              required
            />
            <SelectField
              label={guidedMeta.toLabel}
              icon={Wallet}
              value={guidedForm.toAccountId}
              onValueChange={(v) =>
                setGuidedForm((p) => ({ ...p, toAccountId: v }))
              }
              options={accountOptions}
              placeholder="Selecciona cuenta"
              required
            />
          </div>
          <TextField
            label="Nota"
            icon={FileText}
            value={guidedForm.note}
            onChange={(e) =>
              setGuidedForm((p) => ({ ...p, note: e.target.value }))
            }
            placeholder="Detalle opcional"
          />
        </form>
        <SheetFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpen(false)}
          >
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={handleOpenAdvanced}>
            Abrir en editor avanzado
          </Button>
          <Button
            type="submit"
            form="finance-guided-form"
            loading={createEntryMutation.isPending}
          >
            Guardar {guidedMeta.title.toLowerCase()}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
