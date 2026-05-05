import { Badge } from "@atlas/ui";
import {
  Mail,
  Phone,
  FileText,
  MoreHorizontal,
  Pencil,
  EyeOff,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@atlas/ui";
import { cn } from "@atlas/ui";
import { TYPE_LABEL, TYPE_VARIANT, TYPE_AVATAR_COLORS } from "../constants";

function ContactAvatar({ contact }) {
  const initials = contact.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  const colors = TYPE_AVATAR_COLORS[contact.type] ?? TYPE_AVATAR_COLORS.person;

  return (
    <div
      className={cn(
        "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-bold",
        colors.bg,
        colors.text,
      )}
    >
      {initials}
    </div>
  );
}

export function ContactsCardView({
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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {contacts.map((contact) => {
        const isSelected = selectedSet.has(contact.id);
        return (
          <div
            key={contact.id}
            className={cn(
              "glass group relative flex flex-col gap-3 rounded-2xl border p-4 transition-all duration-150",
              isSelected
                ? "border-(--brand-primary) bg-(--brand-soft)"
                : "border-[hsl(var(--border))] hover:border-[hsl(var(--border))]/70 hover:bg-[hsl(var(--muted))]/20",
            )}
          >
            {/* selection checkbox */}
            <button
              type="button"
              aria-label={`Seleccionar ${contact.name}`}
              onClick={() => onToggleSelect(contact.id)}
              className={cn(
                "absolute left-3 top-3 flex h-5 w-5 items-center justify-center rounded border transition-all duration-150",
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

            {/* header row */}
            <div className="flex items-start justify-between gap-2 pl-6">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <ContactAvatar contact={contact} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[hsl(var(--foreground))]">
                    {contact.name}
                  </p>
                  {contact.legalName && (
                    <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {contact.legalName}
                    </p>
                  )}
                </div>
              </div>
              <CardMenu
                contact={contact}
                onEdit={onEdit}
                onDisable={onDisable}
                onDelete={onDelete}
              />
            </div>

            {/* badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge
                variant={TYPE_VARIANT[contact.type] ?? "secondary"}
                className="text-xs"
              >
                {TYPE_LABEL[contact.type] ?? contact.type}
              </Badge>
              {!contact.enabled && (
                <Badge variant="outline" className="text-xs opacity-60">
                  Inactivo
                </Badge>
              )}
            </div>

            {/* contact fields */}
            <div className="space-y-1.5">
              {contact.email ? (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Mail className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact.email}</span>
                </div>
              ) : null}
              {contact.phone ? (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <Phone className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{contact.phone}</span>
                </div>
              ) : null}
              {contact.taxId ? (
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate font-mono">{contact.taxId}</span>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CardMenu({ contact, onEdit, onDisable, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
          aria-label="Acciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onEdit(contact)}>
          <Pencil className="mr-2 h-3.5 w-3.5" />
          Editar
        </DropdownMenuItem>
        {contact.enabled && (
          <DropdownMenuItem onClick={() => onDisable(contact)}>
            <EyeOff className="mr-2 h-3.5 w-3.5" />
            Deshabilitar
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => onDelete(contact)}
          className="text-[hsl(var(--destructive))] focus:text-[hsl(var(--destructive))]"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
