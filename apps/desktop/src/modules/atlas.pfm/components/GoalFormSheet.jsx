// apps/desktop/src/modules/atlas.pfm/components/GoalFormSheet.jsx
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  Button,
  TextField,
  DateField,
} from "@atlas/ui";
import { useCreateGoal, useUpdateGoal } from "../hooks/use-pfm-queries";

export function GoalFormSheet({ open, onOpenChange, goal }) {
  const isEdit = Boolean(goal);
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: "", targetAmount: "", targetDate: "", color: "#22c55e" } });

  useEffect(() => {
    if (!open) return;
    reset({
      name: goal?.name ?? "",
      targetAmount: goal?.targetAmount ?? "",
      targetDate: goal?.targetDate ?? "",
      color: goal?.color ?? "#22c55e",
    });
  }, [open, goal, reset]);

  async function onSubmit(v) {
    const payload = {
      name: v.name,
      targetAmount: Number(v.targetAmount),
      targetDate: v.targetDate || null,
      color: v.color || null,
    };
    if (isEdit) {
      await updateMut.mutateAsync({ id: goal.id, ...payload });
    } else {
      await createMut.mutateAsync(payload);
    }
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar meta" : "Nueva meta de ahorro"}</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Nombre"
            placeholder="Vacaciones, Fondo de emergencia..."
            error={errors.name?.message}
            {...register("name", { required: "Ponle un nombre" })}
          />
          <TextField
            label="Meta"
            type="number"
            step="0.01"
            inputMode="decimal"
            error={errors.targetAmount?.message}
            {...register("targetAmount", { required: "Ingresa el monto objetivo" })}
          />
          <Controller
            control={control}
            name="targetDate"
            render={({ field }) => (
              <DateField
                label="Fecha objetivo (opcional)"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
          <TextField label="Color" type="color" {...register("color")} />
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
