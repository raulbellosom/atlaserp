// apps/desktop/src/modules/atlas.pfm/screens/CategoriesScreen.jsx
import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import {
  PageHeader,
  Button,
  SectionCard,
  Badge,
  EmptyState,
  ErrorState,
  LoadingState,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  TextField,
  SelectField,
  SwatchField,
} from "@atlas/ui";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import {
  usePfmCategories,
  useCreatePfmCategory,
  useUpdatePfmCategory,
  useSetPfmCategoryEnabled,
} from "../hooks/use-pfm-queries";

const KIND_OPTIONS = [
  { value: "EXPENSE", label: "Gasto" },
  { value: "INCOME", label: "Ingreso" },
];

function CategoryFormDialog({ open, onOpenChange, category }) {
  const isEdit = Boolean(category);
  const createMut = useCreatePfmCategory();
  const updateMut = useUpdatePfmCategory();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { name: "", kind: "EXPENSE", color: "#0ea5e9" } });

  useEffect(() => {
    if (!open) return;
    reset({
      name: category?.name ?? "",
      kind: category?.kind ?? "EXPENSE",
      color: category?.color ?? "#0ea5e9",
    });
  }, [open, category, reset]);

  async function onSubmit(v) {
    if (isEdit) {
      await updateMut.mutateAsync({ id: category.id, name: v.name, color: v.color });
    } else {
      await createMut.mutateAsync({ name: v.name, kind: v.kind, color: v.color });
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar categoria" : "Nueva categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <TextField
            label="Nombre"
            placeholder="Comida, Transporte, Salario..."
            error={errors.name?.message}
            {...register("name", { required: "Ponle un nombre" })}
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
                disabled={isEdit}
              />
            )}
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

function CategoryRow({ category, onEdit, onDisable }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[hsl(var(--border))] px-3 py-2">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: category.color ?? "#9ca3af" }}
        />
        <span className="truncate text-sm font-medium">{category.name}</span>
        {category.isSystem && (
          <Badge variant="outline" className="shrink-0">
            Del sistema
          </Badge>
        )}
      </div>
      {category.isMine && (
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" aria-label="Editar" onClick={() => onEdit(category)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Desactivar"
            onClick={() => onDisable(category)}
          >
            <Trash2 className="h-4 w-4 text-[hsl(var(--destructive))]" />
          </Button>
        </div>
      )}
    </div>
  );
}

export default function CategoriesScreen() {
  const { data: categories = [], isLoading, isError, refetch } = usePfmCategories();
  const setEnabled = useSetPfmCategoryEnabled();

  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState(null);
  const [disableTarget, setDisableTarget] = useState(null);

  const expenses = categories.filter((c) => c.kind === "EXPENSE");
  const incomes = categories.filter((c) => c.kind === "INCOME");

  function openCreate() {
    setEditCategory(null);
    setFormOpen(true);
  }
  function openEdit(category) {
    setEditCategory(category);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <PageHeader
        title="Categorias"
        description="Tus categorias personales de gastos e ingresos"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-1.5 h-4 w-4" /> Nueva categoria
          </Button>
        }
      />

      {isLoading && <LoadingState />}
      {isError && <ErrorState title="No se pudieron cargar las categorias" onRetry={refetch} />}

      {!isLoading && !isError && categories.length === 0 && (
        <EmptyState
          icon={Tag}
          title="Sin categorias"
          description="Crea tu primera categoria para clasificar tus movimientos."
          action={{ label: "Nueva categoria", onClick: openCreate }}
        />
      )}

      {!isLoading && !isError && categories.length > 0 && (
        <div className="space-y-6">
          <SectionCard title="Gastos">
            {expenses.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin categorias de gasto.</p>
            ) : (
              <div className="space-y-2">
                {expenses.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    onEdit={openEdit}
                    onDisable={setDisableTarget}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Ingresos">
            {incomes.length === 0 ? (
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin categorias de ingreso.</p>
            ) : (
              <div className="space-y-2">
                {incomes.map((c) => (
                  <CategoryRow
                    key={c.id}
                    category={c}
                    onEdit={openEdit}
                    onDisable={setDisableTarget}
                  />
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}

      <CategoryFormDialog open={formOpen} onOpenChange={setFormOpen} category={editCategory} />

      <ConfirmDialog
        open={Boolean(disableTarget)}
        onOpenChange={(v) => !v && setDisableTarget(null)}
        title="Desactivar categoria"
        description={`"${disableTarget?.name ?? ""}" dejara de aparecer al registrar movimientos. Los movimientos ya registrados no se ven afectados.`}
        confirmLabel="Desactivar"
        onConfirm={async () => {
          await setEnabled.mutateAsync({ id: disableTarget.id, enabled: false });
          setDisableTarget(null);
        }}
      />
    </div>
  );
}
