import {
  FilterBar,
  MobileFiltersSheet,
  SearchInput,
  ViewModeSwitch,
  cn,
} from "@atlas/ui";
import { ChevronUp, ChevronDown } from "lucide-react";

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
        placeholder="Buscar por nombre, c\u00f3digo, correo, puesto..."
        className="flex-1 min-w-0 sm:max-w-sm"
      />

      {/* Desktop filters inline */}
      <div className="hidden md:flex items-center gap-2">
        <FilterBar filters={FILTER_DEFS} value={filters} onChange={onFilters} />
      </div>

      {/* Mobile filters sheet */}
      <MobileFiltersSheet
        activeCount={Object.values(filters).filter(Boolean).length}
        onClear={() => onFilters({})}
      >
        <FilterBar filters={FILTER_DEFS} value={filters} onChange={onFilters} />
      </MobileFiltersSheet>

      <div className="sm:ml-auto flex items-center gap-2">
        {/* sort pill - hidden on mobile */}
        <div className="hidden sm:inline-flex items-center gap-0.5 rounded-xl border border-[hsl(var(--border))] px-1 py-1">
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

        <ViewModeSwitch
          value={viewMode}
          onChange={onViewMode}
          storageKey="hr-employees"
        />
      </div>
    </div>
  );
}
