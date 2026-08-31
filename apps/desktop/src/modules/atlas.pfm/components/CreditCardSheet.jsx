// apps/desktop/src/modules/atlas.pfm/components/CreditCardSheet.jsx
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Button,
  TextField,
} from "@atlas/ui";
import { useUpdateWalletCredit } from "../hooks/use-pfm-queries";

export function CreditCardSheet({ open, onOpenChange, wallet }) {
  const mut = useUpdateWalletCredit();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { creditLimit: "", statementDay: "", paymentDueDay: "" } });

  useEffect(() => {
    if (!open || !wallet) return;
    reset({
      creditLimit: wallet.creditLimit ?? "",
      statementDay: wallet.statementDay ?? "",
      paymentDueDay: wallet.paymentDueDay ?? "",
    });
  }, [open, wallet, reset]);

  async function onSubmit(v) {
    await mut.mutateAsync({
      id: wallet.id,
      creditLimit: v.creditLimit ? Number(v.creditLimit) : null,
      statementDay: v.statementDay ? Number(v.statementDay) : null,
      paymentDueDay: v.paymentDueDay ? Number(v.paymentDueDay) : null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Tarjeta de credito</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Limite de credito"
            type="number"
            step="0.01"
            inputMode="decimal"
            {...register("creditLimit")}
          />
          <TextField
            label="Dia de corte"
            type="number"
            min="1"
            max="31"
            error={errors.statementDay?.message}
            {...register("statementDay", {
              min: { value: 1, message: "Entre 1 y 31" },
              max: { value: 31, message: "Entre 1 y 31" },
            })}
          />
          <TextField
            label="Dia limite de pago"
            type="number"
            min="1"
            max="31"
            error={errors.paymentDueDay?.message}
            {...register("paymentDueDay", {
              min: { value: 1, message: "Entre 1 y 31" },
              max: { value: 31, message: "Entre 1 y 31" },
            })}
          />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
