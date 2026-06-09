import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { TextField } from "@atlas/ui";
import { useCreateCalendar, useUpdateCalendar } from "../hooks/useCalendarData";
import { CALENDAR_ICONS } from "../calendarIcons";
import { toast } from "sonner";

const COLORS = [
  "#6366F1",
  "#2563EB",
  "#0EA5E9",
  "#0891B2",
  "#14B8A6",
  "#16A34A",
  "#84CC16",
  "#D97706",
  "#F97316",
  "#DC2626",
  "#EC4899",
  "#DB2777",
  "#A855F7",
  "#7C3AED",
  "#6B46C1",
  "#64748B",
];

const ICON_ENTRIES = Object.entries(CALENDAR_ICONS);

export default function CalendarFormModal({ calendar, onClose }) {
  const isEdit = Boolean(calendar?.id);
  const createCalendar = useCreateCalendar();
  const updateCalendar = useUpdateCalendar();
  const [name, setName] = useState(calendar?.name ?? "");
  const [color, setColor] = useState(calendar?.color ?? COLORS[0]);
  const [icon, setIcon] = useState(calendar?.icon ?? null);

  useEffect(() => {
    if (calendar) {
      setName(calendar.name);
      setColor(calendar.color);
      setIcon(calendar.icon ?? null);
    }
  }, [calendar?.id]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }
    try {
      if (isEdit) {
        await updateCalendar.mutateAsync({
          id: calendar.id,
          name: name.trim(),
          color,
          icon,
        });
        toast.success("Calendario actualizado");
      } else {
        await createCalendar.mutateAsync({ name: name.trim(), color, icon });
        toast.success("Calendario creado");
      }
      onClose();
    } catch (err) {
      toast.error(err.message || "Error al guardar");
    }
  }

  const isPending = createCalendar.isPending || updateCalendar.isPending;

  const iconBtnCls = (selected) =>
    [
      "w-10 h-10 rounded-lg flex items-center justify-center transition-all focus-visible:outline-none",
      selected
        ? "ring-2 ring-violet-500"
        : "hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]",
    ].join(" ");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[hsl(var(--surface-1))] rounded-xl shadow-xl w-full max-w-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[hsl(var(--border))]">
          <h2 className="text-base font-semibold text-[hsl(var(--foreground))]">
            {isEdit ? "Editar calendario" : "Nuevo calendario"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-[hsl(var(--muted))]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <TextField
            label="Nombre"
            required
            placeholder="Mi calendario"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          {/* Color picker */}
          <div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
              Color
            </div>
            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-8 h-8 rounded-full transition-all focus-visible:outline-none"
                  style={{
                    backgroundColor: c,
                    border:
                      color === c ? "2px solid white" : "2px solid transparent",
                    transform: color === c ? "scale(1.18)" : "scale(1)",
                    boxShadow: color === c ? `0 0 0 2px ${c}` : "none",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Icon picker */}
          <div>
            <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">
              Icono
            </div>
            <div className="grid grid-cols-9 gap-1 max-h-52 overflow-y-auto pr-0.5">
              {/* No icon option */}
              <button
                type="button"
                onClick={() => setIcon(null)}
                className={iconBtnCls(!icon)}
                title="Sin icono"
                style={!icon ? { backgroundColor: color + "22", color } : {}}
              >
                <span className="text-xs font-bold leading-none">—</span>
              </button>

              {ICON_ENTRIES.map(([iconName, Icon]) => (
                <button
                  key={iconName}
                  type="button"
                  onClick={() => setIcon(iconName)}
                  className={iconBtnCls(icon === iconName)}
                  title={iconName}
                  style={
                    icon === iconName
                      ? { backgroundColor: color + "22", color }
                      : {}
                  }
                >
                  <Icon size={18} />
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-lg hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="px-4 py-1.5 text-sm rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-medium disabled:opacity-50"
          >
            {isPending ? "Guardando..." : isEdit ? "Actualizar" : "Crear"}
          </button>
        </div>
      </form>
    </div>
  );
}
