// apps/desktop/src/modules/atlas.pfm/components/QuickAddMovementSheet.jsx
import { useEffect, useState } from "react";
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
  ComboboxField,
  DateField,
} from "@atlas/ui";
import {
  useWallets,
  usePfmCategories,
  useCreateMovement,
  useUpdateMovement,
  useEnrichLedgerMovement,
} from "../hooks/use-pfm-queries";
import { todayIso } from "../lib/format";

const schema = z.object({
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.coerce.number().positive("Ingresa un monto mayor a cero"),
  walletId: z.string().uuid("Elige una cartera"),
  categoryId: z.string().uuid().optional().nullable(),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

function emptyDefaults(defaultWalletId) {
  return {
    direction: "EXPENSE",
    amount: "",
    walletId: defaultWalletId ?? "",
    categoryId: null,
    occurredOn: todayIso(),
    merchant: "",
    note: "",
  };
}

export function QuickAddMovementSheet({ open, onOpenChange, defaultWalletId, editingMovement }) {
  const isEdit = Boolean(editingMovement);
  const isLedgerRow = editingMovement?.source === "ledger";
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const createMut = useCreateMovement();
  const updateMut = useUpdateMovement();
  const enrichMut = useEnrichLedgerMovement();

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: emptyDefaults(defaultWalletId) });

  useEffect(() => {
    if (!open) return;
    if (editingMovement) {
      reset({
        direction: editingMovement.direction,
        amount: editingMovement.amount,
        walletId: editingMovement.walletId ?? defaultWalletId ?? "",
        categoryId: editingMovement.categoryId ?? null,
        occurredOn: editingMovement.occurredOn ?? todayIso(),
        merchant: editingMovement.merchant ?? "",
        note: editingMovement.note ?? "",
      });
      setDirection(editingMovement.direction);
    } else {
      reset(emptyDefaults(defaultWalletId));
      setDirection("EXPENSE");
    }
  }, [open, editingMovement, defaultWalletId, reset]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(values) {
    const payload = {
      ...values,
      categoryId: values.categoryId || null,
      merchant: values.merchant || null,
      note: values.note || null,
    };
    if (isEdit && isLedgerRow) {
      await enrichMut.mutateAsync({
        walletId: payload.walletId,
        ltxId: editingMovement.id,
        categoryId: payload.categoryId,
        note: payload.note,
      });
    } else if (isEdit) {
      await updateMut.mutateAsync({
        movementId: editingMovement.id,
        walletId: payload.walletId,
        ...payload,
      });
    } else {
      await createMut.mutateAsync({ ...payload, status: "POSTED" });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            inputMode="decimal"
            autoFocus
            className="text-2xl font-bold"
            error={errors.amount?.message}
            disabled={isLedgerRow}
            {...register("amount")}
          />
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <SelectField
                label="Tipo"
                options={[
                  { value: "EXPENSE", label: "Gasto" },
                  { value: "INCOME", label: "Ingreso" },
                ]}
                value={field.value}
                onChange={(v) => {
                  field.onChange(v);
                  setDirection(v);
                  setValue("categoryId", null);
                }}
                disabled={isLedgerRow}
              />
            )}
          />
          <Controller
            control={control}
            name="walletId"
            render={({ field }) => (
              <SelectField
                label="Cartera"
                options={walletOptions}
                value={field.value}
                onChange={field.onChange}
                error={errors.walletId?.message}
                disabled={isLedgerRow}
              />
            )}
          />
          <Controller
            control={control}
            name="categoryId"
            render={({ field }) => (
              <ComboboxField
                label="Categoria"
                placeholder="Buscar..."
                options={categoryOptions}
                value={field.value ?? ""}
                onChange={field.onChange}
              />
            )}
          />
          <Controller
            control={control}
            name="occurredOn"
            render={({ field }) => (
              <DateField
                label="Fecha"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={errors.occurredOn?.message}
                disabled={isLedgerRow}
              />
            )}
          />
          <TextField label="Comercio" disabled={isLedgerRow} {...register("merchant")} />
          <TextField label="Nota" {...register("note")} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
