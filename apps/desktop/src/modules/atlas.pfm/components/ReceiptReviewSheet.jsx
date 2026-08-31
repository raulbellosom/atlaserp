// apps/desktop/src/modules/atlas.pfm/components/ReceiptReviewSheet.jsx
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
  useConfirmReceipt,
  useReceiptImageUrl,
} from "../hooks/use-pfm-queries";
import { todayIso } from "../lib/format";

const schema = z.object({
  walletId: z.string().uuid("Elige una cartera"),
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.coerce.number().positive("Ingresa el monto"),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha"),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

export function ReceiptReviewSheet({ open, onOpenChange, receipt }) {
  const parsed = receipt?.parsed ?? {};
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const confirmMut = useConfirmReceipt();
  const { data: imageUrl } = useReceiptImageUrl(receipt?.fileId);
  const [categoryId, setCategoryId] = useState(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      walletId: "",
      direction: "EXPENSE",
      amount: "",
      occurredOn: todayIso(),
      merchant: "",
      note: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    reset({
      walletId: wallets[0]?.id ?? "",
      direction: "EXPENSE",
      amount: parsed.total ?? "",
      occurredOn: parsed.date ?? todayIso(),
      merchant: parsed.merchant ?? "",
      note: "",
    });
    setDirection("EXPENSE");
    setCategoryId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, receipt?.id]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(v) {
    await confirmMut.mutateAsync({
      id: receipt.id,
      walletId: v.walletId,
      direction: v.direction,
      amount: Number(v.amount),
      occurredOn: v.occurredOn,
      categoryId: categoryId || null,
      merchant: v.merchant || null,
      note: v.note || null,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Revisar ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Ticket"
              className="max-h-48 w-full rounded-xl bg-[hsl(var(--muted))] object-contain"
            />
          )}
          <TextField
            label="Monto"
            type="number"
            step="0.01"
            inputMode="decimal"
            className="text-2xl font-bold"
            error={errors.amount?.message}
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
                  setCategoryId(null);
                }}
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
              />
            )}
          />
          <ComboboxField
            label="Categoria"
            placeholder="Buscar..."
            options={categoryOptions}
            value={categoryId ?? ""}
            onChange={setCategoryId}
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
              />
            )}
          />
          <TextField label="Comercio" {...register("merchant")} />
          <TextField label="Nota" {...register("note")} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Registrar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
