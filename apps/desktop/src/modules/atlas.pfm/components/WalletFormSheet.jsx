// apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
import { useEffect } from "react";
import { useForm, Controller, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
  SelectField,
  SwatchField,
} from "@atlas/ui";
import { useCreateWallet, useUpdateWallet } from "../hooks/use-pfm-queries";
import { WALLET_KIND_LABEL } from "../lib/format";

const schema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(120),
  kind: z.enum(["CASH", "DEBIT", "CREDIT"]),
  currency: z.enum(["MXN", "USD"]),
  openingBalance: z.coerce.number().default(0),
  color: z.string().max(32).optional().nullable(),
  reference: z.string().max(40).optional().nullable(),
  creditLimit: z.coerce.number().optional().nullable(),
  statementDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  paymentDueDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  openingUsed: z.coerce.number().min(0).optional().nullable(),
});

const KIND_OPTIONS = Object.entries(WALLET_KIND_LABEL).map(([value, label]) => ({ value, label }));
const CURRENCY_OPTIONS = [
  { value: "MXN", label: "Pesos (MXN)" },
  { value: "USD", label: "Dolares (USD)" },
];

const EMPTY = {
  name: "",
  kind: "CASH",
  currency: "MXN",
  openingBalance: 0,
  color: "#0ea5e9",
  reference: "",
  creditLimit: "",
  statementDay: "",
  paymentDueDay: "",
  openingUsed: "",
};

function numOrNull(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function WalletFormSheet({ open, onOpenChange, wallet }) {
  const isEdit = Boolean(wallet);
  const createMut = useCreateWallet();
  const updateMut = useUpdateWallet();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  const kind = useWatch({ control, name: "kind" });
  const isCredit = kind === "CREDIT";

  useEffect(() => {
    if (!open) return;
    reset(
      wallet
        ? {
            name: wallet.name,
            kind: wallet.kind,
            currency: wallet.currency,
            openingBalance: wallet.openingBalance ?? 0,
            color: wallet.color ?? "#0ea5e9",
            reference: wallet.reference ?? "",
            creditLimit: wallet.creditLimit ?? "",
            statementDay: wallet.statementDay ?? "",
            paymentDueDay: wallet.paymentDueDay ?? "",
            openingUsed: "",
          }
        : EMPTY,
    );
  }, [open, wallet, reset]);

  async function onSubmit(values) {
    const base = {
      name: values.name,
      kind: values.kind,
      currency: values.currency,
      color: values.color ?? null,
      reference: values.reference?.trim() || null,
    };
    if (values.kind === "CREDIT") {
      const creditFields = {
        creditLimit: numOrNull(values.creditLimit),
        statementDay: numOrNull(values.statementDay),
        paymentDueDay: numOrNull(values.paymentDueDay),
      };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...base, ...creditFields });
      } else {
        await createMut.mutateAsync({
          ...base,
          ...creditFields,
          openingUsed: numOrNull(values.openingUsed) ?? 0,
        });
      }
    } else {
      const payload = { ...base, openingBalance: Number(values.openingBalance) || 0 };
      if (isEdit) {
        await updateMut.mutateAsync({ id: wallet.id, ...payload });
      } else {
        await createMut.mutateAsync(payload);
      }
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar cartera" : "Nueva cartera"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Nombre"
            placeholder="Efectivo, BBVA debito..."
            error={errors.name?.message}
            {...register("name")}
          />
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={KIND_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <SelectField
                label="Moneda"
                options={CURRENCY_OPTIONS}
                value={field.value}
                onChange={field.onChange}
              />
            )}
          />

          {!isCredit && (
            <TextField
              label="Saldo inicial"
              type="number"
              step="0.01"
              error={errors.openingBalance?.message}
              {...register("openingBalance")}
            />
          )}

          {isCredit && (
            <div className="space-y-4 rounded-lg border border-[hsl(var(--border))] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Tarjeta de credito
              </p>
              <TextField
                label="Limite de credito"
                type="number"
                step="0.01"
                inputMode="decimal"
                error={errors.creditLimit?.message}
                {...register("creditLimit")}
              />
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Dia de corte"
                  type="number"
                  min="1"
                  max="31"
                  error={errors.statementDay?.message}
                  {...register("statementDay")}
                />
                <TextField
                  label="Dia limite de pago"
                  type="number"
                  min="1"
                  max="31"
                  error={errors.paymentDueDay?.message}
                  {...register("paymentDueDay")}
                />
              </div>
              {!isEdit && (
                <TextField
                  label="Saldo ocupado actual"
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  hint="Cuanto debes hoy en esta tarjeta"
                  error={errors.openingUsed?.message}
                  {...register("openingUsed")}
                />
              )}
            </div>
          )}

          <TextField
            label="Referencia (opcional)"
            placeholder="4821 o un apodo"
            hint="Ultimos digitos de la tarjeta o una nota para reconocerla"
            error={errors.reference?.message}
            {...register("reference")}
          />
          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <SwatchField label="Color" value={field.value} onChange={field.onChange} />
            )}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
