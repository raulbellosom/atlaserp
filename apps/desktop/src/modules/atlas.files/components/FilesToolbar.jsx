import {
  Badge,
  Button,
  FilterBar,
  MobileFiltersSheet,
  SearchInput,
  ViewModeSwitch,
} from "@atlas/ui";
import { Download, Archive, CheckSquare } from "lucide-react";

const FILTERS = [
  {
    key: "enabled",
    label: "Estado",
    options: [
      { value: "true", label: "Activo" },
      { value: "false", label: "Deshabilitado" },
    ],
  },
  {
    key: "kind",
    label: "Tipo",
    options: [
      { value: "image", label: "Imagen" },
      { value: "pdf", label: "PDF" },
      { value: "sheet", label: "Hoja" },
      { value: "doc", label: "Documento" },
      { value: "text", label: "Texto" },
      { value: "generic", label: "Otro" },
    ],
  },
];

export function FilesToolbar({
  search,
  onSearchChange,
  filters,
  onFiltersChange,
  viewMode,
  onViewModeChange,
  selectedCount,
  onSelectVisible,
  onClearSelection,
  onBulkDirect,
  onBulkZip,
  bulkLoading,
  sort,
  onSortChange,
  moduleOptions = [],
}) {
  const resolvedFilters = [
    ...FILTERS,
    {
      key: "moduleKey",
      label: "Modulo",
      options: moduleOptions,
    },
    {
      key: "origin",
      label: "Origen",
      options: [
        { value: "mapped", label: "Navegable" },
        { value: "unmapped", label: "No navegable" },
      ],
    },
  ].filter((filter) => filter.options?.length);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar archivo..."
          className="flex-1 min-w-0 sm:max-w-sm"
        />
        {/* Desktop filters inline */}
        <div className="hidden md:flex items-center gap-2">
          <FilterBar
            filters={resolvedFilters}
            value={filters}
            onChange={onFiltersChange}
          />
        </div>
        {/* Mobile filters sheet */}
        <MobileFiltersSheet
          activeCount={Object.values(filters).filter(Boolean).length}
          onClear={() => onFiltersChange({})}
        >
          <FilterBar
            filters={resolvedFilters}
            value={filters}
            onChange={onFiltersChange}
          />
        </MobileFiltersSheet>
        <ViewModeSwitch
          value={viewMode}
          onChange={onViewModeChange}
          storageKey="files"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">Seleccionados: {selectedCount}</Badge>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSelectVisible}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Seleccionar visibles</span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onBulkDirect}
          disabled={selectedCount === 0 || bulkLoading}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Descargar seleccionados</span>
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={onBulkZip}
          disabled={selectedCount === 0 || bulkLoading}
        >
          <Archive className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Descargar ZIP</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          disabled={selectedCount === 0 || bulkLoading}
        >
          <span className="hidden sm:inline">Limpiar selección</span>
          <span className="sm:hidden">Limpiar</span>
        </Button>
        <div className="sm:ml-auto inline-flex items-center gap-1.5 rounded-xl border border-[hsl(var(--border))] px-1.5 py-1">
          <Button
            type="button"
            variant={sort.by === "createdAt" ? "secondary" : "ghost"}
            size="sm"
            onClick={() =>
              onSortChange({
                by: "createdAt",
                dir:
                  sort.by === "createdAt" && sort.dir === "desc"
                    ? "asc"
                    : "desc",
              })
            }
          >
            Reciente
          </Button>
          <Button
            type="button"
            variant={sort.by === "originalName" ? "secondary" : "ghost"}
            size="sm"
            onClick={() =>
              onSortChange({
                by: "originalName",
                dir:
                  sort.by === "originalName" && sort.dir === "asc"
                    ? "desc"
                    : "asc",
              })
            }
          >
            Nombre
          </Button>
          <Button
            type="button"
            variant={sort.by === "sizeBytes" ? "secondary" : "ghost"}
            size="sm"
            onClick={() =>
              onSortChange({
                by: "sizeBytes",
                dir:
                  sort.by === "sizeBytes" && sort.dir === "asc"
                    ? "desc"
                    : "asc",
              })
            }
          >
            Tamaño
          </Button>
        </div>
      </div>
    </div>
  );
}
