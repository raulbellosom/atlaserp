import { Badge } from "@atlas/ui";
import { Pencil, EyeOff, Trash2 } from "lucide-react";
import { cn } from "@atlas/ui";
import { TYPE_LABEL, TYPE_VARIANT, TYPE_AVATAR_COLORS } from "../constants";

function GridAvatar({ contact }) {
  const initials = contact.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors = TYPE_AVATAR_COLORS[contact.type] ?? TYPE_AVATAR_COLORS.person;

  return (
    <div
      className={cn(
        "mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl text-lg font-bold",
        colors.bg,
        colors.text,
      )}
    >
      {initials}
    </div>
  );
}

export function ContactsGridView({
  contacts,
  selectedSet,
  onToggleSelect,
  onEdit,
  onDisable,
  onDelete,
}) {
  if (contacts.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Sin resultados para los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-6">
      {contacts.map((contact) => {
        const isSelected = selectedSet.has(contact.id);
        return (
          <div
            key={contact.id}
            className={cn(
              "glass group relative flex flex-col items-center rounded-2xl border p-3 text-center transition-all duration-150",
              isSelected
                ? "border-(--brand-primary) bg-(--brand-soft)"
                : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]/30",
            )}
          >
            {/* selection toggle */}
            <button
              type="button"
              aria-label={`Seleccionar ${contact.name}`}
              onClick={() => onToggleSelect(contact.id)}
              className={cn(
                "absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded border transition-all duration-150",
                isSelected
                  ? "border-(--brand-primary) bg-(--brand-primary)"
                  : "border-[hsl(var(--border))] bg-[hsl(var(--background))] opacity-0 group-hover:opacity-100",
              )}
            >
              {isSelected && (
                <svg
                  viewBox="0 0 12 12"
                  fill="none"
                  className="h-3 w-3 text-white"
                >
                  <path
                    d="M2 6l3 3 5-5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>

            {/* hover action buttons */}
            <div className="absolute right-1.5 top-1.5 flex flex-col gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
              <button
                type="button"
                aria-label="Editar"
                onClick={() => onEdit(contact)}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-sm hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {contact.enabled && (
                <button
                  type="button"
                  aria-label="Deshabilitar"
                  onClick={() => onDisable(contact)}
                  className="flex h-6 w-6 items-center justify-center rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))] shadow-sm hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))] transition-colors"
                >
                  <EyeOff className="h-3 w-3" />
                </button>
              )}
              <button
                type="button"
                aria-label="Eliminar"
                onClick={() => onDelete(contact)}
                className="flex h-6 w-6 items-center justify-center rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--destructive))]/80 shadow-sm hover:bg-[hsl(var(--destructive))]/10 hover:text-[hsl(var(--destructive))] transition-colors"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>

            <GridAvatar contact={contact} />

            <p className="line-clamp-1 w-full text-xs font-semibold text-[hsl(var(--foreground))]">
              {contact.name}
            </p>

            <div className="mt-1.5">
              <Badge
                variant={TYPE_VARIANT[contact.type] ?? "secondary"}
                className="text-[10px]"
              >
                {TYPE_LABEL[contact.type] ?? contact.type}
              </Badge>
            </div>

            {!contact.enabled && (
              <span className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))] opacity-60">
                Inactivo
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
