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
} from "@atlas/ui";
import { Coins, Component, Hash, Power, PowerOff, Scale, Wallet } from "lucide-react";
import { toast } from "sonner";
import { atlas } from "../../../lib/atlas";
import {
  ACCOUNT_TYPE_OPTIONS,
  defaultAccountForm,
  normalizeCurrencyCode,
  parseApiError,
  resolveCurrencyOptions,
  toNumber,
} from "../lib/finance-utils";

export function AccountSheet({ open, onOpenChange, editingAccount, token }) {
  const queryClient = useQueryClient();
  const [accountForm, setAccountForm] = useState(defaultAccountForm);

  const toggleAccountMutation = useMutation({
    mutationFn: ({ id, enabled }) =>
      atlas.finance.setAccountEnabled(id, enabled, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      onOpenChange(false);
      toast.success("Estado de cuenta actualizado");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar el estado."));
    },
  });

  const createAccountMutation = useMutation({
    mutationFn: (payload) => atlas.finance.createAccount(payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      onOpenChange(false);
      setAccountForm(defaultAccountForm());
      toast.success("Cuenta creada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo crear la cuenta."));
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ id, payload }) =>
      atlas.finance.updateAccount(id, payload, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance-accounts"] });
      onOpenChange(false);
      toast.success("Cuenta actualizada");
    },
    onError: (error) => {
      toast.error(parseApiError(error, "No se pudo actualizar la cuenta."));
    },
  });

  function handleOpen(isOpen) {
    if (createAccountMutation.isPending || updateAccountMutation.isPending)
      return;
    if (isOpen && editingAccount) {
      setAccountForm({
        code: editingAccount.code ?? "",
        name: editingAccount.name ?? "",
        type: editingAccount.accountType ?? editingAccount.type ?? ACCOUNT_TYPE_OPTIONS[0],
        currency: editingAccount.currency ?? "MXN",
        initialBalance: String(editingAccount.openingBalance ?? editingAccount.initialBalance ?? "0"),
      });
    } else if (!isOpen) {
      setAccountForm(defaultAccountForm());
    }
    onOpenChange(isOpen);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const payload = {
      code: accountForm.code.trim(),
      name: accountForm.name.trim(),
      type: accountForm.type,
      currency: accountForm.currency.trim().toUpperCase() || "MXN",
      initialBalance: toNumber(accountForm.initialBalance),
    };
    if (!payload.code || !payload.name) {
      toast.error("Código y nombre son obligatorios.");
      return;
    }
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, payload });
      return;
    }
    createAccountMutation.mutate(payload);
  }

  const isPending =
    createAccountMutation.isPending ||
    updateAccountMutation.isPending ||
    toggleAccountMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetContent className="sm:max-w-md lg:max-w-xl xl:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            {editingAccount ? "Editar cuenta" : "Nueva cuenta"}
          </SheetTitle>
        </SheetHeader>
        <form
          id="finance-account-form"
          className="space-y-3 py-4"
          onSubmit={handleSubmit}
        >
          <TextField
            label="Código"
            icon={Hash}
            value={accountForm.code}
            onChange={(e) =>
              setAccountForm((p) => ({ ...p, code: e.target.value }))
            }
            placeholder="1101"
            required
          />
          <TextField
            label="Nombre"
            icon={Wallet}
            value={accountForm.name}
            onChange={(e) =>
              setAccountForm((p) => ({ ...p, name: e.target.value }))
            }
            placeholder="Caja general"
            required
          />
          <SelectField
            label="Tipo"
            icon={Component}
            value={accountForm.type}
            onValueChange={(value) =>
              setAccountForm((p) => ({ ...p, type: value }))
            }
            options={ACCOUNT_TYPE_OPTIONS.map((o) => ({ value: o, label: o }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <SelectField
              label="Moneda"
              icon={Coins}
              value={accountForm.currency}
              onValueChange={(value) =>
                setAccountForm((p) => ({
                  ...p,
                  currency: normalizeCurrencyCode(value),
                }))
              }
              options={resolveCurrencyOptions(accountForm.currency)}
              required
            />
            <CurrencyField
              label="Saldo inicial"
              icon={Scale}
              value={accountForm.initialBalance}
              onChange={(value) =>
                setAccountForm((p) => ({ ...p, initialBalance: value }))
              }
              currency={accountForm.currency || "MXN"}
              allowNegative
              allowDecimal
              fractionDigits={2}
            />
          </div>
        </form>
        <SheetFooter className="gap-2">
          {editingAccount && (
            <Button
              variant="outline"
              className="mr-auto"
              disabled={isPending}
              onClick={() =>
                toggleAccountMutation.mutate({
                  id: editingAccount.id,
                  enabled: !editingAccount.enabled,
                })
              }
            >
              {editingAccount.enabled ? (
                <>
                  <PowerOff className="h-4 w-4 mr-2" />
                  Deshabilitar
                </>
              ) : (
                <>
                  <Power className="h-4 w-4 mr-2" />
                  Habilitar
                </>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpen(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="finance-account-form" loading={isPending}>
            {editingAccount ? "Guardar cambios" : "Crear cuenta"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
