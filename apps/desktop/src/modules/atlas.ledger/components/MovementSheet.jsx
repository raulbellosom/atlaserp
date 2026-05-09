import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CurrencyField,
  DatePickerField,
  SelectField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextField,
  TextareaField,
} from "@atlas/ui";
import { AlignLeft, ArrowDownUp, BookOpen, Hash, Tag, User } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import { DIRECTION_OPTIONS, defaultMovementForm, parseApiError } from "../lib/ledger-utils";

export function MovementSheet({ open, onOpenChange, account, token }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultMovementForm);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  // When no account prop, fetch available accounts for picker
  const accountsQuery = useQuery({
    queryKey: ["ledger-accounts"],
    queryFn: () => atlas.ledger.listAccounts(token, { enabled: true }),
    enabled: Boolean(token && !account && open),
  });

  const activeAccount = account ?? accountsQuery.data?.data?.find((a) => a.id === selectedAccountId) ?? null;

  const createMutation = useMutation({
    mutationFn: (payload) => atlas.ledger.createMovement(activeAccount?.id, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-account-movements", activeAccount?.id] });
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-summary"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-movements"] });
      onOpenChange(false);
      toast.success("Movimiento registrado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo registrar el movimiento."));
    },
  });

  function handleOpen(isOpen) {
    if (createMutation.isPending) return;
    if (!isOpen) {
      setForm(defaultMovementForm());
      setSelectedAccountId("");
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!activeAccount) {
      toast.error("Selecciona una cuenta.");
      return;
    }
    const amount = Number(form.amount);
    if (!form.concept.trim()) {
      toast.error("El concepto es obligatorio.");
      return;
    }
    if (!amount || amount <= 0) {
      toast.error("El monto debe ser mayor a cero.");
      return;
    }
    createMutation.mutate({
      occurredAt: form.occurredAt ? new Date(`${form.occurredAt}T12:00:00`).toISOString() : new Date().toISOString(),
      direction: form.direction,
      movementType: form.movementType.trim() || undefined,
      number: form.number.trim() || undefined,
      name: form.name.trim() || undefined,
      reference: form.reference.trim() || undefined,
      concept: form.concept.trim(),
      amount,
    });
  }

  const accountOptions = (accountsQuery.data?.data ?? []).map((a) => ({ value: a.id, label: a.name }));

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            Nuevo movimiento{activeAccount ? ` — ${activeAccount.name}` : ""}
          </SheetTitle>
        </SheetHeader>
        <form id="ledger-movement-form" className="space-y-3 py-4" onSubmit={handleSubmit}>
          {/* Account picker when used from global view */}
          {!account && (
            <SelectField
              label="Cuenta"
              icon={BookOpen}
              value={selectedAccountId}
              onValueChange={setSelectedAccountId}
              options={accountOptions}
              placeholder="Seleccionar cuenta..."
              required
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            <DatePickerField
              label="Fecha"
              value={form.occurredAt}
              onChange={(v) => setForm((p) => ({ ...p, occurredAt: v ?? new Date().toISOString().slice(0, 10) }))}
              required
            />
            <SelectField
              label="Tipo"
              icon={ArrowDownUp}
              value={form.direction}
              onValueChange={(v) => setForm((p) => ({ ...p, direction: v }))}
              options={DIRECTION_OPTIONS}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Numero"
              icon={Hash}
              value={form.number}
              onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
              placeholder="Folio / No. doc."
            />
            <TextField
              label="Nombre"
              icon={User}
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="Proveedor / cliente"
            />
          </div>
          <TextField
            label="Referencia"
            icon={Tag}
            value={form.reference}
            onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
            placeholder="No. cheque, transferencia..."
          />
          <TextareaField
            label="Concepto"
            icon={AlignLeft}
            value={form.concept}
            onChange={(e) => setForm((p) => ({ ...p, concept: e.target.value }))}
            placeholder="Descripcion del movimiento"
            rows={2}
            required
          />
          <CurrencyField
            label="Monto"
            value={form.amount}
            onChange={(v) => setForm((p) => ({ ...p, amount: v }))}
            currency={activeAccount?.currency || "MXN"}
            allowDecimal
            fractionDigits={2}
          />
        </form>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="ledger-movement-form" loading={createMutation.isPending}>
            Registrar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
