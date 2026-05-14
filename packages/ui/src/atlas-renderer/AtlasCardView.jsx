import { Eye, Pencil, Trash2 } from "lucide-react";
import { Checkbox } from "../components/Checkbox.jsx";
import { ActionMenu } from "../components/ActionMenu.jsx";

const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
  maintenance: "En mantenimiento",
  retired: "Retirado",
  pending: "Pendiente",
  disabled: "Desactivado",
};

function renderValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  const str = String(value);
  return STATUS_LABELS[str.toLowerCase()] ?? str;
}

export function AtlasCardView({
  columns = [],
  rows = [],
  selectedIds = new Set(),
  onToggleSelect,
  getRowId,
  viewActionLabel = "Ver",
  editActionLabel = "Editar",
  deleteActionLabel = "Eliminar",
  accentColor = null,
  onView,
  onEdit,
  onDelete,
}) {
  const primaryColumn = columns[0] ?? null;
  const statusColumn = columns.find((c) => /^(status|estado)$/i.test(c.field)) ?? null;
  const secondaryColumns = columns
    .filter((c) => c !== primaryColumn && c !== statusColumn)
    .slice(0, 4);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map((row, rowIndex) => {
        const id = getRowId ? getRowId(row, rowIndex) : (row?.id != null ? String(row.id) : `card-${rowIndex}`);
        const isSelected = selectedIds.has(id);

        const titleVal = primaryColumn
          ? renderValue(row[primaryColumn.field])
          : `Registro ${rowIndex + 1}`;
        const initials =
          titleVal !== "—" && titleVal.length > 0 ? titleVal.charAt(0).toUpperCase() : "#";

        const menuItems = [
          onView && { label: viewActionLabel, icon: Eye, onClick: () => onView(row) },
          onEdit && { label: editActionLabel, icon: Pencil, onClick: () => onEdit(row) },
          onDelete && { label: deleteActionLabel, icon: Trash2, variant: "destructive", onClick: () => onDelete(row) },
        ].filter(Boolean);

        return (
          <div
            key={id}
            className={`glass group flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-150 hover:bg-[hsl(var(--muted))]/20${
              isSelected
                ? " border-indigo-500/60 bg-indigo-500/5"
                : " border-[hsl(var(--border))] hover:border-[hsl(var(--border))]/60"
            }`}
          >
            <div className="flex items-start gap-3">
              {onToggleSelect && (
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleSelect(id)}
                  aria-label="Seleccionar"
                  className="mt-0.5 shrink-0"
                />
              )}
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: accentColor ? `${accentColor}26` : "hsl(var(--muted))",
                }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: accentColor ?? "hsl(var(--muted-foreground))" }}
                >
                  {initials}
                </span>
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                  {titleVal}
                </p>
                {statusColumn && !renderValue(row[statusColumn.field]).startsWith("—") && (
                  <div className="mt-1">
                    <span className="inline-block text-xs font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--muted))] rounded-full px-2.5 py-0.5">
                      {renderValue(row[statusColumn.field])}
                    </span>
                  </div>
                )}
                {secondaryColumns[0] && (
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {renderValue(row[secondaryColumns[0].field])}
                  </p>
                )}
              </div>
              {menuItems.length > 0 && (
                <ActionMenu items={menuItems} label="Acciones del registro" />
              )}
            </div>

            {secondaryColumns.length > 1 && (
              <div className="space-y-1.5 border-t border-[hsl(var(--border))]/50 pt-2.5">
                {secondaryColumns.slice(1).map((col) => (
                  <div
                    key={col.key}
                    className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"
                  >
                    <span className="shrink-0 font-medium">{col.label}:</span>
                    <span className="truncate">{renderValue(row[col.field])}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
