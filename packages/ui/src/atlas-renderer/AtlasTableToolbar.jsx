import { Columns3, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { Button } from "../components/Button.jsx";
import { Badge } from "../components/Badge.jsx";
import { SearchInput } from "../components/SearchInput.jsx";
import { FilterBar } from "../components/FilterBar.jsx";
import { MobileFiltersSheet } from "../components/MobileFiltersSheet.jsx";
import { ViewModeSwitch } from "../components/ViewModeSwitch.jsx";
import { cn } from "../lib/utils.js";

export function AtlasTableToolbar({
  storageKey,
  search = "",
  onSearchChange,
  searchPlaceholder = "Buscar...",
  filterBarFilters = [],
  filterValues = {},
  onFilterChange,
  filtersActiveCount = 0,
  onFiltersClear,
  sortableColumns = [],
  sortBy = "",
  sortDir = "asc",
  onSortChange,
  views = ["table", "cards", "grid"],
  view,
  onViewChange,
  selectedCount = 0,
  onClearSelection,
  totalCount = 0,
  loading = false,
  onReload,
  hiddenColumnCount = 0,
  onOpenColumnConfig,
}) {
  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: Controls — search + filters + sort + view mode switch */}
      <div className="flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <SearchInput
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="flex-1 min-w-0"
          />
        )}

        {filterBarFilters.length > 0 && (
          <>
            <div className="hidden md:flex items-center gap-2">
              <FilterBar
                filters={filterBarFilters}
                value={filterValues}
                onChange={onFilterChange}
              />
            </div>
            <MobileFiltersSheet
              activeCount={filtersActiveCount}
              onClear={onFiltersClear}
            >
              <FilterBar
                filters={filterBarFilters}
                value={filterValues}
                onChange={onFilterChange}
              />
            </MobileFiltersSheet>
          </>
        )}

        {sortableColumns.length > 0 && (
          <div className="hidden sm:inline-flex items-center gap-0.5 rounded-xl border border-[hsl(var(--border))] px-1 py-1">
            {sortableColumns.map((col) => {
              const isActive = sortBy === col.field;
              const handlePillClick = () => {
                if (isActive) {
                  onSortChange({
                    sortBy: col.field,
                    sortDir: sortDir === "asc" ? "desc" : "asc",
                  });
                } else {
                  onSortChange({ sortBy: col.field, sortDir: "asc" });
                }
              };
              return (
                <button
                  key={col.key}
                  type="button"
                  onClick={handlePillClick}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors",
                    isActive
                      ? "bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                      : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]",
                  )}
                >
                  {col.label}
                  {isActive &&
                    (sortDir === "asc" ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    ))}
                </button>
              );
            })}
          </div>
        )}

        {views.length > 1 && (
          <ViewModeSwitch
            modes={views}
            value={view}
            onChange={onViewChange}
            storageKey={storageKey}
          />
        )}

        {onOpenColumnConfig && (
          <Button
            variant="outline"
            size="sm"
            className="relative h-9 gap-1.5 px-3 text-xs"
            onClick={onOpenColumnConfig}
            title="Configurar columnas"
          >
            <Columns3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Columnas</span>
            {hiddenColumnCount > 0 && (
              <Badge
                variant="secondary"
                className="absolute -right-1.5 -top-1.5 h-4 min-w-4 px-1 text-[10px] leading-none"
              >
                {hiddenColumnCount}
              </Badge>
            )}
          </Button>
        )}
      </div>

      {/* Row 2: Actions — count/selection left, reload + Agregar right */}
      <div className="flex items-center gap-2">
        {selectedCount > 0 ? (
          <>
            <span className="text-xs font-medium tabular-nums text-[hsl(var(--foreground))]">
              {selectedCount} seleccionados
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={onClearSelection}
            >
              Limpiar selección
            </Button>
          </>
        ) : (
          !loading &&
          totalCount > 0 && (
            <span className="text-xs tabular-nums text-[hsl(var(--muted-foreground))]">
              {totalCount} registros
            </span>
          )
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0"
            onClick={onReload}
            title="Recargar"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
