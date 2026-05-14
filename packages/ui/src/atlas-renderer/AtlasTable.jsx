import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, Pencil, Trash2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Button } from "../components/Button.jsx";
import { Checkbox } from "../components/Checkbox.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import { ActionMenu } from "../components/ActionMenu.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { ErrorState } from "../components/ErrorState.jsx";
import { getStoredViewMode } from "../components/ViewModeSwitch.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/Table.jsx";
import { AtlasCardView } from "./AtlasCardView.jsx";
import { AtlasTableToolbar } from "./AtlasTableToolbar.jsx";
import {
  normalizeToFilterBarFilters,
  normalizeSpanishLabel,
} from "./renderer-adapters.js";

const DEFAULT_PAGE_SIZE = 20;

function getRowId(row, index) {
  return row?.id != null ? String(row.id) : `row-${index}`;
}

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "")
    .trim()
    .replace(/\/+$/, "");
  const path = String(apiPath ?? "").trim();
  if (!path.startsWith("/")) return `${base}/${path}`;
  return `${base}${path}`;
}

function isBlank(value) {
  return value === undefined || value === null || String(value).trim() === "";
}

function getByPath(input, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), input);
}

function normalizeColumns(schema) {
  const rawColumns = Array.isArray(schema?.columns) ? schema.columns : [];
  const primaryFieldName = schema?.primaryField ?? schema?.recordTitleField ?? null;

  const cols = rawColumns
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          key: entry,
          field: entry,
          label: entry,
          component: null,
          sortable: false,
          isLink: primaryFieldName === entry,
        };
      }
      if (!entry || typeof entry !== "object") return null;
      const field = entry.field ?? entry.key ?? entry.name ?? null;
      if (!field) return null;
      const fieldStr = String(field);
      const isLink =
        Boolean(entry.primary) ||
        Boolean(entry.link) ||
        (primaryFieldName !== null && fieldStr === primaryFieldName);
      return {
        key: fieldStr,
        field: fieldStr,
        label: normalizeSpanishLabel(
          entry.label ?? entry.title ?? fieldStr,
        ),
        component: entry.component ?? null,
        sortable: Boolean(entry.sortable),
        isLink,
      };
    })
    .filter(Boolean);

  if (cols.length > 0 && !cols.some((c) => c.isLink)) {
    cols[0] = { ...cols[0], isLink: true };
  }

  return cols;
}

function normalizeFilters(schema) {
  const rawFilters = schema?.filters;
  if (Array.isArray(rawFilters)) {
    return rawFilters
      .map((entry) => {
        if (!entry || typeof entry !== "object") return null;
        const key = entry.field ?? entry.key ?? entry.name ?? null;
        if (!key) return null;
        return {
          key: String(key),
          label: normalizeSpanishLabel(
            entry.label ?? entry.title ?? String(key),
          ),
          type: entry.type === "select" ? "select" : "text",
          options: Array.isArray(entry.options) ? entry.options : [],
        };
      })
      .filter(Boolean);
  }
  if (rawFilters && typeof rawFilters === "object") {
    return Object.entries(rawFilters)
      .map(([key, value]) => {
        if (value && typeof value === "object") {
          return {
            key,
            label: value.label ?? value.title ?? key,
            type: value.type === "select" ? "select" : "text",
            options: Array.isArray(value.options) ? value.options : [],
          };
        }
        return { key, label: key, type: "text", options: [] };
      })
      .filter(Boolean);
  }
  return [];
}

function readPagination(payload, fallbackPage, fallbackPageSize, dataLength) {
  const pagination = payload?.pagination ?? {};
  const page = Number.isFinite(Number(pagination.page))
    ? Number(pagination.page)
    : fallbackPage;
  const pageSize = Number.isFinite(Number(pagination.pageSize))
    ? Number(pagination.pageSize)
    : fallbackPageSize;
  const total = Number.isFinite(Number(pagination.total))
    ? Number(pagination.total)
    : dataLength;
  return {
    page: Math.max(1, page),
    pageSize: Math.max(1, pageSize),
    total: Math.max(0, total),
  };
}

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

export function AtlasTable({
  blueprint,
  token,
  apiBaseUrl,
  componentRegistry = null,
  accentColor = null,
  onCreate,
  onView,
  onEdit,
  onDelete,
  refreshSignal = 0,
}) {
  const schema = blueprint?.schema ?? {};
  const apiPath =
    typeof schema.apiPath === "string" ? schema.apiPath.trim() : "";
  const columns = useMemo(() => normalizeColumns(schema), [schema]);
  const filters = useMemo(() => normalizeFilters(schema), [schema]);
  const filterBarFilters = useMemo(
    () => normalizeToFilterBarFilters(filters),
    [filters],
  );
  const sortableColumns = useMemo(
    () => columns.filter((c) => c.sortable),
    [columns],
  );
  const searchable = schema.searchable !== false && columns.length > 0;
  const defaultPageSize = Number.isFinite(
    Number(schema?.pagination?.defaultPageSize),
  )
    ? Math.max(1, Number(schema.pagination.defaultPageSize))
    : DEFAULT_PAGE_SIZE;

  const [page, setPage] = useState(1);
  const [pageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);
  const storageKey = `atlas.renderer.${apiPath.replace(/\//g, ".")}`;
  const [view, setView] = useState(() =>
    getStoredViewMode(storageKey, "table"),
  );
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    if (!apiPath) return;
    const controller = new AbortController();
    const run = async () => {
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("pageSize", String(pageSize));
        if (searchable && !isBlank(search))
          params.set("search", String(search).trim());
        for (const [key, value] of Object.entries(filterValues)) {
          if (isBlank(value)) continue;
          params.set(key, String(value).trim());
        }
        if (sortBy) {
          params.set("sortBy", sortBy);
          params.set("sortDir", sortDir);
        }
        const endpoint = `${joinUrl(apiBaseUrl, apiPath)}?${params.toString()}`;
        const response = await fetch(endpoint, {
          method: "GET",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "No se pudo cargar la información.");
        }
        const payload = await response.json();
        const nextRows = Array.isArray(payload?.data) ? payload.data : [];
        const nextPagination = readPagination(
          payload,
          page,
          pageSize,
          nextRows.length,
        );
        setRows(nextRows);
        setPagination(nextPagination);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRows([]);
        setPagination((prev) => ({ ...prev, total: 0 }));
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar la información.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    run();
    return () => controller.abort();
  }, [
    apiBaseUrl,
    apiPath,
    filterValues,
    page,
    pageSize,
    reloadTick,
    refreshSignal,
    search,
    searchable,
    sortBy,
    sortDir,
    token,
  ]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [rows]);

  const filtersActiveCount = Object.values(filterValues).filter(Boolean).length;

  if (!apiPath) {
    return (
      <Alert variant="warning">
        <AlertTitle>Vista sin configuración</AlertTitle>
        <AlertDescription>
          Esta vista no tiene <code>schema.apiPath</code>. No se puede cargar la
          información.
        </AlertDescription>
      </Alert>
    );
  }

  const rowActions = Array.isArray(schema.rowActions) ? schema.rowActions : [];
  const viewActionLabel = rowActions[0]?.label ?? "Ver";
  const editActionLabel =
    rowActions.length >= 2 ? (rowActions[1]?.label ?? "Editar") : "Editar";
  const deleteActionLabel =
    rowActions.length >= 2
      ? (rowActions[rowActions.length - 1]?.label ?? "Eliminar")
      : "Eliminar";

  const rowMenuItems = (row) =>
    [
      onView && {
        label: viewActionLabel,
        icon: Eye,
        onClick: () => onView(row),
      },
      onEdit && {
        label: editActionLabel,
        icon: Pencil,
        onClick: () => onEdit(row),
      },
      onDelete && {
        label: deleteActionLabel,
        icon: Trash2,
        variant: "destructive",
        onClick: () => onDelete(row),
      },
    ].filter(Boolean);

  const handleSortChange = ({ sortBy: nextField, sortDir: nextDir }) => {
    setPage(1);
    setSortBy(nextField);
    setSortDir(nextDir);
  };

  const handleToggleRow = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = () => {
    if (selectedIds.size === rows.length && rows.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(rows.map((row, i) => getRowId(row, i))));
    }
  };

  // ── Table view ────────────────────────────────────────────────────────────

  const renderTableView = () => {
    const allSelected = rows.length > 0 && selectedIds.size === rows.length;
    const someSelected = selectedIds.size > 0 && selectedIds.size < rows.length;

    if (loading) {
      return (
        <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-[hsl(var(--muted))]/40 hover:bg-[hsl(var(--muted))]/40">
                <TableHead className="w-10" />
                {columns.map((col) => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 7 }).map((_, i) => (
                <TableRow key={`sk-${i}`}>
                  <TableCell>
                    <Skeleton className="h-4 w-4 rounded" />
                  </TableCell>
                  {columns.map((col) => (
                    <TableCell key={`sk-${col.key}-${i}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  <TableCell>
                    <Skeleton className="h-7 w-7 rounded-md" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      );
    }

    if (error) {
      return (
        <ErrorState
          description={error}
          onRetry={() => setReloadTick((c) => c + 1)}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          title="Sin registros"
          description={
            normalizeSpanishLabel(schema?.emptyState?.message ?? "No hay registros para mostrar.")
          }
          action={
            onCreate ? { label: "Agregar", onClick: onCreate } : undefined
          }
        />
      );
    }

    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-[hsl(var(--muted))]/40 hover:bg-[hsl(var(--muted))]/40">
              <TableHead className="w-10">
                <Checkbox
                  checked={
                    allSelected ? true : someSelected ? "indeterminate" : false
                  }
                  onCheckedChange={handleToggleAll}
                  aria-label="Seleccionar todos"
                />
              </TableHead>
              {columns.map((col) => (
                <TableHead key={col.key}>{col.label}</TableHead>
              ))}
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, rowIndex) => {
              const id = getRowId(row, rowIndex);
              const isSelected = selectedIds.has(id);
              const zebraClass =
                !isSelected && rowIndex % 2 === 1
                  ? "bg-[hsl(var(--muted))]/20"
                  : undefined;
              return (
                <TableRow
                  key={id}
                  data-selected={isSelected || undefined}
                  className={zebraClass}
                >
                  <TableCell>
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggleRow(id)}
                      aria-label="Seleccionar fila"
                    />
                  </TableCell>
                  {columns.map((col) => {
                    const value = getByPath(row, col.field);
                    let cellContent;
                    if (col.component && componentRegistry) {
                      const Comp = componentRegistry.resolve(col.component);
                      cellContent = Comp ? (
                        <Comp {...{ [col.field]: value, value, row }} />
                      ) : (
                        renderValue(value)
                      );
                    } else if (col.isLink && onView && !col.component) {
                      cellContent = (
                        <button
                          type="button"
                          onClick={() => onView(row)}
                          className="text-left font-medium hover:underline focus:outline-none focus-visible:underline"
                        >
                          {renderValue(value)}
                        </button>
                      );
                    } else {
                      cellContent = renderValue(value);
                    }
                    return (
                      <TableCell key={`${col.key}-${rowIndex}`}>
                        {cellContent}
                      </TableCell>
                    );
                  })}
                  <TableCell>
                    <ActionMenu
                      items={rowMenuItems(row)}
                      label="Acciones del registro"
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    );
  };

  // ── List view (stacked rows) ───────────────────────────────────────────────

  const renderListView = () => {
    const primaryCol = columns[0] ?? null;
    const statusCol =
      columns.find((c) => /^(status|estado)$/i.test(c.field)) ?? null;
    const subtitleCols = columns
      .filter((c) => c !== primaryCol && c !== statusCol)
      .slice(0, 2);
    const badgeCol = statusCol ?? columns[3] ?? null;

    if (loading) {
      return (
        <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={`sk-list-${i}`}
              className="flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] last:border-0"
            >
              <Skeleton className="h-4 w-4 rounded shrink-0" />
              <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-7 w-7 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <ErrorState
          description={error}
          onRetry={() => setReloadTick((c) => c + 1)}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          title="Sin registros"
          description={
            normalizeSpanishLabel(schema?.emptyState?.message ?? "No hay registros para mostrar.")
          }
          action={
            onCreate ? { label: "Agregar", onClick: onCreate } : undefined
          }
        />
      );
    }

    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] overflow-hidden">
        {rows.map((row, rowIndex) => {
          const id = getRowId(row, rowIndex);
          const isSelected = selectedIds.has(id);
          const titleVal = primaryCol
            ? renderValue(getByPath(row, primaryCol.field))
            : `Registro ${rowIndex + 1}`;
          const initials =
            titleVal !== "—" && titleVal.length > 0
              ? titleVal.charAt(0).toUpperCase()
              : "#";
          const menuItems = rowMenuItems(row);

          return (
            <div
              key={id}
              className={`flex items-center gap-3 px-4 py-3 border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--muted))]/30 transition-colors${isSelected ? " bg-indigo-500/5" : ""}`}
            >
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => handleToggleRow(id)}
                aria-label="Seleccionar"
                className="shrink-0"
              />
              <div
                className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0"
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
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[hsl(var(--foreground))]">
                  {titleVal}
                </p>
                {subtitleCols.length > 0 && (
                  <p className="truncate text-xs text-[hsl(var(--muted-foreground))]">
                    {subtitleCols.map((col, idx) => (
                      <span key={col.key}>
                        {idx > 0 && <span className="mx-1 opacity-40">·</span>}
                        {col.label}: {renderValue(getByPath(row, col.field))}
                      </span>
                    ))}
                  </p>
                )}
              </div>
              {badgeCol && (
                <span
                  className={
                    statusCol && badgeCol === statusCol
                      ? "hidden shrink-0 text-xs font-medium text-[hsl(var(--foreground))] bg-[hsl(var(--muted))] rounded-full px-2.5 py-0.5 sm:inline-block"
                      : "hidden shrink-0 text-xs text-[hsl(var(--muted-foreground))] sm:block"
                  }
                >
                  {renderValue(getByPath(row, badgeCol.field))}
                </span>
              )}
              {menuItems.length > 0 && (
                <ActionMenu items={menuItems} label="Acciones del registro" />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ── Card grid view ────────────────────────────────────────────────────────

  const renderCardGridView = () => {
    if (loading) {
      return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`sk-card-${i}`}
              className="rounded-2xl border border-[hsl(var(--border))] p-4 space-y-3"
            >
              <div className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 rounded-xl shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <div className="border-t border-[hsl(var(--border))]/50 pt-2.5 space-y-1.5">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      );
    }

    if (error) {
      return (
        <ErrorState
          description={error}
          onRetry={() => setReloadTick((c) => c + 1)}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          title="Sin registros"
          description={
            normalizeSpanishLabel(schema?.emptyState?.message ?? "No hay registros para mostrar.")
          }
          action={
            onCreate ? { label: "Agregar", onClick: onCreate } : undefined
          }
        />
      );
    }

    return (
      <AtlasCardView
        columns={columns}
        rows={rows}
        selectedIds={selectedIds}
        onToggleSelect={handleToggleRow}
        getRowId={getRowId}
        viewActionLabel={viewActionLabel}
        editActionLabel={editActionLabel}
        deleteActionLabel={deleteActionLabel}
        accentColor={accentColor}
        onView={onView}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    );
  };

  // ── Pagination ─────────────────────────────────────────────────────────────

  const hasPagination = pagination.total > pagination.pageSize;
  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  const renderPagination = () => {
    if (!hasPagination) return null;
    return (
      <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
        <span className="tabular-nums">
          {(page - 1) * pagination.pageSize + 1}–
          {Math.min(page * pagination.pageSize, pagination.total)} de{" "}
          {pagination.total}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Página anterior"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="tabular-nums px-1">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            aria-label="Página siguiente"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <AtlasTableToolbar
        storageKey={storageKey}
        search={searchable ? search : ""}
        onSearchChange={
          searchable
            ? (val) => {
                setPage(1);
                setSearch(val);
              }
            : undefined
        }
        searchPlaceholder={schema?.searchPlaceholder ?? "Buscar..."}
        filterBarFilters={filterBarFilters}
        filterValues={filterValues}
        onFilterChange={(next) => {
          setPage(1);
          setFilterValues(next);
        }}
        filtersActiveCount={filtersActiveCount}
        onFiltersClear={() => {
          setPage(1);
          setFilterValues({});
        }}
        sortableColumns={sortableColumns}
        sortBy={sortBy}
        sortDir={sortDir}
        onSortChange={handleSortChange}
        views={["table", "cards", "grid"]}
        view={view}
        onViewChange={setView}
        selectedCount={selectedIds.size}
        onClearSelection={() => setSelectedIds(new Set())}
        totalCount={pagination.total}
        loading={loading}
        onReload={() => setReloadTick((c) => c + 1)}
      />
      {view === "cards"
        ? renderListView()
        : view === "grid"
          ? renderCardGridView()
          : renderTableView()}
      {renderPagination()}
    </div>
  );
}
