import { Badge, Button } from "@atlas/ui";
import { FilterBar } from "@atlas/ui";
import { SearchInput } from "@atlas/ui";
import {
  Rows3,
  LayoutList,
  Grid3X3,
  ChevronUp,
  ChevronDown,
  EyeOff,
  Trash2,
  Download,
  X,
} from "lucide-react";
import { cn } from "@atlas/ui";
import { TYPE_OPTIONS } from "../constants";

const FILTER_DEFS = [
  {
    key: "type",
    label: "Tipo",
    options: TYPE_OPTIONS,
  },
  {
    key: "status",
    label: "Estado",
    options: [
      { value: "enabled", label: "Activo" },
      { value: "disabled", label: "Inactivo" },
    ],
  },
  {
    key: "hasEmail",
    label: "Correo",
    options: [
      { value: "yes", label: "Con correo" },
      { value: "no", label: "Sin correo" },
    ],
  },
  {
    key: "hasPhone",
    label: "Telefono",
    options: [
      { value: "yes", label: "Con telefono" },
      { value: "no", label: "Sin telefono" },
    ],
  },
];

const SORT_OPTIONS = [
  { key: "createdAt", label: "Reciente" },
  { key: "name", label: "Nombre" },
  { key: "type", label: "Tipo" },
];

export function ContactsToolbar({
  viewMode,
  search,
  filters,
  sort,
  selectedCount,
  onViewMode,
  onSearch,
  onFilters,
  onCycleSort,
  onSelectVisible,
  onSelectAll,
  onClearSelection,
  onBulkDisable,
  onBulkExport,
  onBulkDelete,
  totalFiltered,
}) {
  return (
    <div className="space-y-2">
      {/* row 1: search + filters + view toggle + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          onClear={() => onSearch("")}
          placeholder="Buscar contacto..."
          className="w-64"
        />

        <FilterBar filters={FILTER_DEFS} value={filters} onChange={onFilters} />

        <div className="ml-auto flex items-center gap-2">
          {/* sort pill */}
          <div className="inline-flex items-center gap-0.5 rounded-xl border border-[hsl(var(--border))] px-1 py-1">
            {SORT_OPTIONS.map((opt) => {
              const isActive = sort.by === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => onCycleSort(opt.key)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                  )}
                >
                  {opt.label}
                  {isActive &&
                    (sort.dir === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
              );
            })}
          </div>

          {/* view toggle pill */}
          <div className="inline-flex overflow-hidden rounded-xl border border-[hsl(var(--border))]">
            <Button
              variant={viewMode === "table" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => onViewMode("table")}
              aria-label="Vista tabla"
            >
              <Rows3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "cards" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => onViewMode("cards")}
              aria-label="Vista tarjetas"
            >
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "default" : "ghost"}
              size="sm"
              className="rounded-none"
              onClick={() => onViewMode("grid")}
              aria-label="Vista cuadricula"
            >
              <Grid3X3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* row 2: selection actions (shown only when selection is active) */}
      {selectedCount > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/30 px-3 py-2">
          <Badge variant="outline" className="text-xs tabular-nums">
            {selectedCount} seleccionado{selectedCount !== 1 ? "s" : ""}
          </Badge>

          <button
            type="button"
            onClick={onSelectVisible}
            className="text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            Seleccionar visibles ({Math.min(totalFiltered, 20)})
          </button>

          <button
            type="button"
            onClick={onSelectAll}
            className="text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
          >
            Todos ({totalFiltered})
          </button>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDisable}
              className="h-7 text-xs"
            >
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              Deshabilitar
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkExport}
              className="h-7 text-xs"
            >
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Exportar CSV
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={onBulkDelete}
              className="h-7 text-xs text-[hsl(var(--destructive))] hover:text-[hsl(var(--destructive))] hover:border-[hsl(var(--destructive))]/50"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Eliminar
            </Button>

            <button
              type="button"
              onClick={onClearSelection}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] transition-colors hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"
              aria-label="Limpiar seleccion"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
