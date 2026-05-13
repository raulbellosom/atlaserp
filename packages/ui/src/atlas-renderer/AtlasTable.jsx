import { useEffect, useMemo, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "../components/Alert.jsx";
import { Badge } from "../components/Badge.jsx";
import { Button } from "../components/Button.jsx";
import { Input } from "../components/Input.jsx";
import { Skeleton } from "../components/Skeleton.jsx";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/Table.jsx";

const DEFAULT_PAGE_SIZE = 20;

function joinUrl(baseUrl, apiPath) {
  const base = String(baseUrl ?? "").trim().replace(/\/+$/, "");
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
  return rawColumns
    .map((entry) => {
      if (typeof entry === "string") {
        return {
          key: entry,
          field: entry,
          label: entry,
          component: null,
        };
      }
      if (!entry || typeof entry !== "object") return null;
      const field = entry.field ?? entry.key ?? entry.name ?? null;
      if (!field) return null;
      return {
        key: String(field),
        field: String(field),
        label: entry.label ?? entry.title ?? String(field),
        component: entry.component ?? null,
      };
    })
    .filter(Boolean);
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
          label: entry.label ?? entry.title ?? String(key),
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
        return {
          key,
          label: key,
          type: "text",
          options: [],
        };
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

function renderValue(value) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function AtlasTable({
  blueprint,
  token,
  apiBaseUrl,
  onCreate,
  onView,
  onEdit,
  onRowAction,
  refreshSignal = 0,
}) {
  const schema = blueprint?.schema ?? {};
  const apiPath = typeof schema.apiPath === "string" ? schema.apiPath.trim() : "";
  const columns = useMemo(() => normalizeColumns(schema), [schema]);
  const filters = useMemo(() => normalizeFilters(schema), [schema]);
  const searchable = schema.searchable === true;
  const defaultPageSize = Number.isFinite(Number(schema?.pagination?.defaultPageSize))
    ? Math.max(1, Number(schema.pagination.defaultPageSize))
    : DEFAULT_PAGE_SIZE;

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [search, setSearch] = useState("");
  const [filterValues, setFilterValues] = useState({});
  const [rows, setRows] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: defaultPageSize,
    total: 0,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    setPageSize(defaultPageSize);
  }, [defaultPageSize]);

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
        if (searchable && !isBlank(search)) params.set("search", String(search).trim());

        for (const [key, value] of Object.entries(filterValues)) {
          if (isBlank(value)) continue;
          params.set(key, String(value).trim());
        }

        const endpoint = `${joinUrl(apiBaseUrl, apiPath)}?${params.toString()}`;
        const response = await fetch(endpoint, {
          method: "GET",
          headers: token
            ? {
                Authorization: `Bearer ${token}`,
              }
            : {},
          signal: controller.signal,
        });

        if (!response.ok) {
          const body = await response.text();
          throw new Error(body || "No se pudo cargar la informacion.");
        }

        const payload = await response.json();
        const nextRows = Array.isArray(payload?.data) ? payload.data : [];
        const nextPagination = readPagination(payload, page, pageSize, nextRows.length);
        setRows(nextRows);
        setPagination(nextPagination);
      } catch (err) {
        if (controller.signal.aborted) return;
        setRows([]);
        setPagination((prev) => ({ ...prev, total: 0 }));
        setError(err instanceof Error ? err.message : "No se pudo cargar la informacion.");
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    run();
    return () => controller.abort();
  }, [apiBaseUrl, apiPath, filterValues, page, pageSize, reloadTick, refreshSignal, search, searchable, token]);

  const totalPages = Math.max(1, Math.ceil((pagination.total || 0) / Math.max(1, pagination.pageSize)));
  const canPrev = page > 1;
  const canNext = page < totalPages;
  const showRowActions = Boolean(onView || onEdit || onRowAction);

  if (!apiPath) {
    return (
      <Alert variant="warning">
        <AlertTitle>Vista sin configuración</AlertTitle>
        <AlertDescription>
          Esta vista no tiene <code>schema.apiPath</code>. No se puede cargar la información.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-[hsl(var(--foreground))]">
              {blueprint?.title ?? "Listado"}
            </h3>
            <Badge variant="outline">{pagination.total} registros</Badge>
          </div>
          {searchable && (
            <Input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="Buscar..."
              className="w-full sm:w-72"
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setReloadTick((current) => current + 1)}>
            Recargar
          </Button>
          {onCreate && <Button onClick={onCreate}>Agregar</Button>}
        </div>
      </div>

      {filters.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filters.map((filterItem) => {
            if (filterItem.type === "select") {
              return (
                <label key={filterItem.key} className="flex flex-col gap-1 text-sm">
                  <span className="text-[hsl(var(--muted-foreground))]">{filterItem.label}</span>
                  <select
                    value={filterValues[filterItem.key] ?? ""}
                    onChange={(event) => {
                      setPage(1);
                      setFilterValues((prev) => ({
                        ...prev,
                        [filterItem.key]: event.target.value,
                      }));
                    }}
                    className="h-10 rounded-lg border border-[hsl(var(--border))] bg-transparent px-3 text-sm"
                  >
                    <option value="">Todos</option>
                    {filterItem.options.map((option) => {
                      if (option && typeof option === "object") {
                        const value = option.value ?? option.key ?? option.id;
                        const label = option.label ?? option.name ?? value;
                        return (
                          <option key={`${filterItem.key}-${value}`} value={String(value ?? "")}>
                            {String(label ?? value ?? "")}
                          </option>
                        );
                      }
                      return (
                        <option key={`${filterItem.key}-${String(option)}`} value={String(option)}>
                          {String(option)}
                        </option>
                      );
                    })}
                  </select>
                </label>
              );
            }

            return (
              <label key={filterItem.key} className="flex flex-col gap-1 text-sm">
                <span className="text-[hsl(var(--muted-foreground))]">{filterItem.label}</span>
                <Input
                  value={filterValues[filterItem.key] ?? ""}
                  onChange={(event) => {
                    setPage(1);
                    setFilterValues((prev) => ({
                      ...prev,
                      [filterItem.key]: event.target.value,
                    }));
                  }}
                  placeholder={`Filtrar por ${filterItem.label.toLowerCase()}...`}
                />
              </label>
            );
          })}
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error al cargar</AlertTitle>
          <AlertDescription className="space-y-2">
            <p>No se pudo cargar la informacion.</p>
            <Button size="sm" variant="outline" onClick={() => setReloadTick((current) => current + 1)}>
              Reintentar
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-xl border border-[hsl(var(--border))]">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              {showRowActions && <TableHead className="w-[220px]">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading &&
              Array.from({ length: 6 }).map((_, rowIndex) => (
                <TableRow key={`skeleton-${rowIndex}`}>
                  {columns.map((column) => (
                    <TableCell key={`${column.key}-${rowIndex}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                  {showRowActions && (
                    <TableCell>
                      <Skeleton className="h-8 w-40" />
                    </TableCell>
                  )}
                </TableRow>
              ))}

            {!loading && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length + (showRowActions ? 1 : 0)} className="py-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
                  {schema?.emptyState?.message ?? "No hay registros."}
                </TableCell>
              </TableRow>
            )}

            {!loading &&
              rows.map((row, rowIndex) => (
                <TableRow key={row?.id ?? `row-${rowIndex}`}>
                  {columns.map((column) => {
                    const value = getByPath(row, column.field);
                    return <TableCell key={`${column.key}-${rowIndex}`}>{renderValue(value)}</TableCell>;
                  })}
                  {showRowActions && (
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {onView && (
                          <Button size="sm" variant="outline" onClick={() => onView(row)}>
                            Ver
                          </Button>
                        )}
                        {onEdit && (
                          <Button size="sm" variant="outline" onClick={() => onEdit(row)}>
                            Editar
                          </Button>
                        )}
                        {onRowAction && (
                          <Button size="sm" variant="ghost" onClick={() => onRowAction("default", row)}>
                            Acción
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Página {page} de {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-[hsl(var(--muted-foreground))]">
            <span>Filas</span>
            <select
              value={String(pageSize)}
              onChange={(event) => {
                const next = Math.max(1, Number(event.target.value) || DEFAULT_PAGE_SIZE);
                setPage(1);
                setPageSize(next);
              }}
              className="h-9 rounded-lg border border-[hsl(var(--border))] bg-transparent px-2 text-sm"
            >
              {[10, 20, 50, 100].map((option) => (
                <option key={`page-size-${option}`} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <Button size="sm" variant="outline" disabled={!canPrev} onClick={() => setPage((current) => Math.max(1, current - 1))}>
            Anterior
          </Button>
          <Button size="sm" variant="outline" disabled={!canNext} onClick={() => setPage((current) => current + 1)}>
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
