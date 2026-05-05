import { Button, FilterBar, SearchInput, cn } from "@atlas/ui";
import {
  Rows3,
  LayoutList,
  Grid3X3,
  ChevronUp,
  ChevronDown,
} from "lucide-react";

const FILTER_DEFS = [
  {
    key: "status",
    label: "Estado",
    options: [
      { value: "active", label: "Activo" },
      { value: "inactive", label: "Inactivo" },
      { value: "vacation", label: "Vacaciones" },
      { value: "terminated", label: "Baja" },
    ],
  },
  {
    key: "employmentType",
    label: "Tipo de empleo",
    options: [
      { value: "full_time", label: "Tiempo completo" },
      { value: "part_time", label: "Medio tiempo" },
      { value: "contractor", label: "Contratista" },
      { value: "intern", label: "Practicante" },
    ],
  },
];

const SORT_OPTIONS = [
  { key: "createdAt", label: "Reciente" },
  { key: "name", label: "Nombre" },
  { key: "hireDate", label: "Ingreso" },
];

export function HrToolbar({
  viewMode,
  search,
  filters,
  sort,
  onViewMode,
  onSearch,
  onFilters,
  onCycleSort,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        onClear={() => onSearch("")}
        placeholder="Buscar por nombre, código, correo, puesto..."
        className="w-72"
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

        {/* view mode toggle */}
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
  );
}
