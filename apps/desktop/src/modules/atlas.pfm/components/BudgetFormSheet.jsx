// apps/desktop/src/modules/atlas.pfm/components/BudgetFormSheet.jsx
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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
} from "@atlas/ui";
import { useWallets, usePfmCategories, useCreateBudget, useUpdateBudget } from "../hooks/use-pfm-queries";

const THRESHOLD_OPTIONS = [
  { value: "0.5", label: "50%" },
  { value: "0.7", label: "70%" },
  { value: "0.8", label: "80%" },
  { value: "0.9", label: "90%" },
];

export function BudgetFormSheet({ open, onOpenChange, budget }) {
  const isEdit = Boolean(budget);
  const { data: wallets = [] } = useWallets();
  const { data: categories = [] } = usePfmCategories("EXPENSE");
  const createMut = useCreateBudget();
  const updateMut = useUpdateBudget();

  const [categoryId, setCategoryId] = useState("");
  const [walletId, setWalletId] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { amount: "", alertThreshold: "0.8" } });
  const alertThreshold = watch("alertThreshold");

  useEffect(() => {
    if (!open) return;
    reset({ amount: budget?.amount ?? "", alertThreshold: String(budget?.alertThreshold ?? 0.8) });
    setCategoryId(budget?.categoryId ?? "");
    setWalletId(budget?.walletId ?? "");
  }, [open, budget, reset]);

  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));
  const walletOptions = [
    { value: "", label: "Todas las carteras" },
    ...wallets.map((w) => ({ value: w.id, label: w.name })),
  ];

  async function onSubmit(v) {
    const amount = Number(v.amount);
    if (!(amount > 0)) return;
    if (isEdit) {
      await updateMut.mutateAsync({ id: budget.id, amount, alertThreshold: Number(v.alertThreshold) });
    } else {
      if (!categoryId) return;
      await createMut.mutateAsync({
        categoryId,
        walletId: walletId || null,
        amount,
        alertThreshold: Number(v.alertThreshold),
      });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar presupuesto" : "Nuevo presupuesto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <ComboboxField
            label="Categoria"
            placeholder="Buscar..."
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
          />
          <SelectField
            label="Cartera"
            options={walletOptions}
            value={walletId}
            onChange={setWalletId}
          />
          <TextField
            label="Limite mensual"
            type="number"
            step="0.01"
            inputMode="decimal"
            error={errors.amount?.message}
            {...register("amount", { required: "Ingresa un monto" })}
          />
          <SelectField
            label="Avisarme al"
            options={THRESHOLD_OPTIONS}
            value={alertThreshold}
            onChange={(v) => setValue("alertThreshold", v)}
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
