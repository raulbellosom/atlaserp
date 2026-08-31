// apps/desktop/src/modules/atlas.pfm/components/WalletFormSheet.jsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
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
};

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
          }
        : EMPTY,
    );
  }, [open, wallet, reset]);

  async function onSubmit(values) {
    if (isEdit) {
      await updateMut.mutateAsync({ id: wallet.id, ...values });
    } else {
      await createMut.mutateAsync(values);
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
          <TextField
            label="Saldo inicial"
            type="number"
            step="0.01"
            error={errors.openingBalance?.message}
            {...register("openingBalance")}
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
