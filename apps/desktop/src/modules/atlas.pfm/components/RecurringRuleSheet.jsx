// apps/desktop/src/modules/atlas.pfm/components/RecurringRuleSheet.jsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  TextField,
  SelectField,
  ComboboxField,
  DateField,
  CheckboxField,
} from "@atlas/ui";
import {
  useWallets,
  usePfmCategories,
  useCreateRecurringRule,
  useUpdateRecurringRule,
} from "../hooks/use-pfm-queries";
import { todayIso } from "../lib/format";

const FREQ_OPTIONS = [
  { value: "MONTHLY", label: "Cada mes" },
  { value: "WEEKLY", label: "Cada semana" },
  { value: "YEARLY", label: "Cada ano" },
  { value: "DAILY", label: "Cada dia" },
];

const schema = z
  .object({
    walletId: z.string().uuid("Elige una cartera"),
    label: z.string().min(1, "Ponle un nombre").max(120),
    direction: z.enum(["EXPENSE", "INCOME"]),
    amountMode: z.enum(["FIXED", "VARIABLE"]),
    amount: z.coerce.number().positive().optional(),
    freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
    interval: z.coerce.number().int().min(1).max(60),
    byMonthDay: z.coerce.number().int().min(1).max(31).optional(),
    autoPost: z.boolean(),
    startOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha"),
    endOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .or(z.literal("")),
  })
  .refine((v) => v.amountMode !== "FIXED" || (v.amount ?? 0) > 0, {
    message: "Un cargo de monto fijo requiere un monto.",
    path: ["amount"],
  });

function toDefaults(rule, defaultWalletId) {
  if (!rule) {
    return {
      walletId: defaultWalletId ?? "",
      label: "",
      direction: "EXPENSE",
      amountMode: "FIXED",
      amount: "",
      freq: "MONTHLY",
      interval: 1,
      byMonthDay: new Date().getUTCDate(),
      autoPost: false,
      startOn: todayIso(),
      endOn: "",
    };
  }
  return {
    walletId: rule.walletId,
    label: rule.label,
    direction: rule.direction,
    amountMode: rule.amountMode,
    amount: rule.amount ?? "",
    freq: rule.rrule?.freq ?? "MONTHLY",
    interval: rule.rrule?.interval ?? 1,
    byMonthDay: rule.rrule?.byMonthDay ?? new Date().getUTCDate(),
    autoPost: Boolean(rule.autoPost),
    startOn: String(rule.nextRunAt ?? todayIso()).slice(0, 10),
    endOn: rule.endOn ? String(rule.endOn).slice(0, 10) : "",
  };
}

export function RecurringRuleSheet({ open, onOpenChange, rule, defaultWalletId }) {
  const isEdit = Boolean(rule);
  const { data: wallets = [] } = useWallets();
  const [direction, setDirection] = useState("EXPENSE");
  const { data: categories = [] } = usePfmCategories(direction);
  const createMut = useCreateRecurringRule();
  const updateMut = useUpdateRecurringRule();

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema), defaultValues: toDefaults(null, defaultWalletId) });

  const amountMode = watch("amountMode");
  const freq = watch("freq");

  const [categoryId, setCategoryId] = useState(null);

  useEffect(() => {
    if (!open) return;
    const d = toDefaults(rule, defaultWalletId);
    reset(d);
    setDirection(d.direction);
    setCategoryId(rule?.categoryId ?? null);
  }, [open, rule, defaultWalletId, reset]);

  // VARIABLE can never auto-post.
  useEffect(() => {
    if (amountMode === "VARIABLE") setValue("autoPost", false);
  }, [amountMode, setValue]);

  const walletOptions = wallets.map((w) => ({ value: w.id, label: `${w.name} (${w.currency})` }));
  const categoryOptions = categories.map((c) => ({ value: c.id, label: c.name }));

  async function onSubmit(v) {
    const payload = {
      walletId: v.walletId,
      label: v.label,
      categoryId: categoryId || null,
      direction: v.direction,
      amountMode: v.amountMode,
      amount: v.amountMode === "FIXED" ? Number(v.amount) : v.amount ? Number(v.amount) : null,
      rrule: {
        freq: v.freq,
        interval: Number(v.interval) || 1,
        ...(v.freq === "MONTHLY" ? { byMonthDay: Number(v.byMonthDay) || 1 } : {}),
      },
      autoPost: v.amountMode === "FIXED" ? Boolean(v.autoPost) : false,
      startOn: v.startOn,
      endOn: v.endOn || null,
    };
    if (isEdit) {
      await updateMut.mutateAsync({
        id: rule.id,
        label: payload.label,
        categoryId: payload.categoryId,
        amount: payload.amount,
        rrule: payload.rrule,
        autoPost: payload.autoPost,
        endOn: payload.endOn,
      });
    } else {
      await createMut.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar cargo recurrente" : "Nuevo cargo recurrente"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Nombre"
            placeholder="Netflix, Renta, Luz..."
            error={errors.label?.message}
            {...register("label")}
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
                disabled={isEdit}
              />
            )}
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
                disabled={isEdit}
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
            name="amountMode"
            render={({ field }) => (
              <SelectField
                label="Monto"
                options={[
                  { value: "FIXED", label: "Fijo" },
                  { value: "VARIABLE", label: "Variable (lo confirmo cada vez)" },
                ]}
                value={field.value}
                onChange={field.onChange}
                disabled={isEdit}
              />
            )}
          />
          {amountMode === "FIXED" && (
            <TextField
              label="Cantidad"
              type="number"
              step="0.01"
              inputMode="decimal"
              error={errors.amount?.message}
              {...register("amount")}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="freq"
              render={({ field }) => (
                <SelectField
                  label="Frecuencia"
                  options={FREQ_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
            <TextField label="Cada" type="number" min="1" {...register("interval")} />
          </div>
          {freq === "MONTHLY" && (
            <TextField
              label="Dia del mes"
              type="number"
              min="1"
              max="31"
              {...register("byMonthDay")}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <Controller
              control={control}
              name="startOn"
              render={({ field }) => (
                <DateField
                  label="Empieza"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                  error={errors.startOn?.message}
                  disabled={isEdit}
                />
              )}
            />
            <Controller
              control={control}
              name="endOn"
              render={({ field }) => (
                <DateField
                  label="Termina (opcional)"
                  value={field.value}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </div>
          {amountMode === "FIXED" && (
            <Controller
              control={control}
              name="autoPost"
              render={({ field }) => (
                <CheckboxField
                  label="Registrar automaticamente (sin confirmar)"
                  checked={field.value}
                  onChange={(e) => field.onChange(e.target.checked)}
                />
              )}
            />
          )}
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isEdit ? "Guardar" : "Crear"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
