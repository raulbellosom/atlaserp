import { Badge, Checkbox } from "@atlas/ui";
import {
  MoreHorizontal,
  Pencil,
  EyeOff,
  Trash2,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@atlas/ui";
import { TYPE_LABEL, TYPE_VARIANT } from "../constants";
import { cn } from "@atlas/ui";

const COLUMNS = [
  { key: "type", label: "Tipo", width: "w-[120px]" },
  { key: "name", label: "Nombre" },
  { key: "email", label: "Correo electronico", width: "w-[220px]" },
  { key: "phone", label: "Telefono", width: "w-[140px]" },
  { key: "taxId", label: "RFC / ID fiscal", width: "w-[140px]" },
  { key: "status", label: "Estado", width: "w-[100px]" },
];

function SortIndicator({ active, dir }) {
  if (!active) return null;
  return dir === "asc" ? (
    <ChevronUp className="ml-1 h-3 w-3" />
  ) : (
    <ChevronDown className="ml-1 h-3 w-3" />
  );
}

export function ContactsTableView({
  contacts,
  selectedSet,
  sort,
  onToggleSelect,
  onSelectAll,
  onCycleSort,
  onEdit,
  onDisable,
  onDelete,
  allVisibleSelected,
}) {
  const sortableColumns = ["name", "type", "createdAt"];

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[hsl(var(--muted))]/40 border-b border-[hsl(var(--border))]">
              <th className="w-10 px-3 py-3">
                <Checkbox
                  checked={allVisibleSelected && contacts.length > 0}
                  onCheckedChange={onSelectAll}
                  aria-label="Seleccionar todos"
                />
              </th>
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-3 py-3 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wide",
                    col.width,
                    sortableColumns.includes(col.key) &&
                      "cursor-pointer select-none hover:text-[hsl(var(--foreground))] transition-colors",
                  )}
                  onClick={
                    sortableColumns.includes(col.key)
                      ? () =>
                          onCycleSort(
                            col.key === "status" ? "createdAt" : col.key,
                          )
                      : undefined
                  }
                >
                  <span className="inline-flex items-center">
                    {col.label}
                    {sortableColumns.includes(col.key) && (
                      <SortIndicator
                        active={
                          sort.by ===
                          (col.key === "status" ? "createdAt" : col.key)
                        }
                        dir={sort.dir}
                      />
                    )}
                  </span>
                </th>
              ))}
              <th className="w-10 px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {contacts.length === 0 && (
              <tr>
                <td
                  colSpan={COLUMNS.length + 2}
                  className="px-4 py-12 text-center text-sm text-[hsl(var(--muted-foreground))]"
                >
                  Sin resultados para los filtros aplicados.
                </td>
              </tr>
            )}
            {contacts.map((contact) => {
              const isSelected = selectedSet.has(contact.id);
              return (
                <tr
                  key={contact.id}
                  className={cn(
                    "border-b border-[hsl(var(--border))] last:border-0 transition-colors",
                    isSelected
                      ? "bg-(--brand-soft)"
                      : "hover:bg-[hsl(var(--muted))]/20",
                  )}
                >
                  <td className="px-3 py-3">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelect(contact.id)}
                      aria-label={`Seleccionar ${contact.name}`}
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={TYPE_VARIANT[contact.type] ?? "secondary"}
                      className="text-xs"
                    >
                      {TYPE_LABEL[contact.type] ?? contact.type}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <div>
                      <p className="font-medium text-[hsl(var(--foreground))]">
                        {contact.name}
                      </p>
                      {contact.legalName && (
                        <p className="text-xs text-[hsl(var(--muted-foreground))] truncate max-w-65">
                          {contact.legalName}
                        </p>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                    {contact.email ? (
                      <span className="truncate max-w-50 block">
                        {contact.email}
                      </span>
                    ) : (
                      <span className="text-xs opacity-40">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-[hsl(var(--muted-foreground))]">
                    {contact.phone || (
                      <span className="text-xs opacity-40">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    {contact.taxId ? (
                      <span className="font-mono text-xs text-[hsl(var(--foreground))]">
                        {contact.taxId}
                      </span>
                    ) : (
                      <span className="text-xs opacity-40">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <Badge
                      variant={contact.enabled ? "success" : "outline"}
                      className="text-xs"
                    >
                      {contact.enabled ? "Activo" : "Inactivo"}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <RowMenu
                      contact={contact}
                      onEdit={onEdit}
                      onDisable={onDisable}
                      onDelete={onDelete}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowMenu({ contact, onEdit, onDisable, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
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
