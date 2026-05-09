import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Button,
  CurrencyField,
  SelectField,
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  TextField,
  TextareaField,
} from "@atlas/ui";
import { AlignLeft, BookOpen, Coins, Component, Scale } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  ACCOUNT_TYPE_OPTIONS,
  CURRENCY_OPTIONS,
  defaultAccountForm,
  parseApiError,
} from "../lib/ledger-utils";

export function AccountSheet({ open, onOpenChange, editingAccount, token }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultAccountForm);

  const createMutation = useMutation({
    mutationFn: (payload) => atlas.ledger.createAccount(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-summary"] });
      onOpenChange(false);
      toast.success("Cuenta creada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la cuenta."));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => atlas.ledger.updateAccount(id, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ledger-accounts"] });
      onOpenChange(false);
      toast.success("Cuenta actualizada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar la cuenta."));
    },
  });

  function handleOpen(isOpen) {
    if (createMutation.isPending || updateMutation.isPending) return;
    if (isOpen && editingAccount) {
      setForm({
        name: editingAccount.name ?? "",
        type: editingAccount.type ?? "banco",
        currency: editingAccount.currency ?? "MXN",
        initialBalance: String(editingAccount.initialBalance ?? "0"),
        description: editingAccount.description ?? "",
      });
    } else if (!isOpen) {
      setForm(defaultAccountForm());
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(e) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      type: form.type,
      currency: (form.currency || "MXN").trim().toUpperCase(),
      initialBalance: Number(form.initialBalance) || 0,
      description: form.description.trim() || undefined,
    };
    if (!payload.name) {
      toast.error("El nombre es obligatorio.");
      return;
    }
    if (editingAccount) {
      updateMutation.mutate({ id: editingAccount.id, payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{editingAccount ? "Editar cuenta" : "Nueva cuenta"}</SheetTitle>
        </SheetHeader>
        <form id="ledger-account-form" className="space-y-3 py-4" onSubmit={handleSubmit}>
          <TextField
            label="Nombre"
            icon={BookOpen}
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            placeholder="Banco BBVA, Caja chica..."
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Tipo"
              icon={Component}
              value={form.type}
              onValueChange={(v) => setForm((p) => ({ ...p, type: v }))}
              options={ACCOUNT_TYPE_OPTIONS}
            />
            <SelectField
              label="Moneda"
              icon={Coins}
              value={form.currency}
              onValueChange={(v) => setForm((p) => ({ ...p, currency: v }))}
              options={CURRENCY_OPTIONS}
            />
          </div>
          {!editingAccount && (
            <CurrencyField
              label="Saldo inicial"
              icon={Scale}
              value={form.initialBalance}
              onChange={(v) => setForm((p) => ({ ...p, initialBalance: v }))}
              currency={form.currency || "MXN"}
              allowNegative
              allowDecimal
              fractionDigits={2}
            />
          )}
          <TextareaField
            label="Descripcion"
            icon={AlignLeft}
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            placeholder="Notas opcionales..."
            rows={2}
          />
        </form>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="ledger-account-form" loading={isPending}>
            {editingAccount ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
