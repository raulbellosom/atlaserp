import { useMemo } from "react";
import { DataTable } from "./DataTable.jsx";
import { formatTableDate } from "../lib/utils.js";

function getFieldList(blueprint) {
  return blueprint?.schema?.fields ?? [];
}

function resolveColumns(blueprint) {
  const explicit = blueprint?.schema?.table?.columns;
  if (Array.isArray(explicit) && explicit.length > 0) return explicit;
  return getFieldList(blueprint).map((field) => field.name);
}

function renderDefaultCell(value, field) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-xs text-[hsl(var(--muted-foreground))]">—</span>;
  }
  if (field?.type === "boolean") {
    return value ? "Sí" : "No";
  }
  if (field?.type === "date") {
    return formatTableDate(value, false);
  }
  if (field?.type === "datetime") {
    return formatTableDate(value, true);
  }
  if (field?.type === "email") {
    return (
      <a
        href={`mailto:${value}`}
        className="text-sm text-(--brand-primary) hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        {value}
      </a>
    );
  }
  return String(value);
}

export function DynamicTable({
  blueprint,
  data = [],
  filters,
  isLoading = false,
  isError = false,
  onRetry,
  searchPlaceholder = "Buscar...",
  emptyTitle = "Sin resultados",
  emptyDescription = "No hay registros para mostrar.",
  emptyIcon,
  emptyAction,
  fieldRenderers = {},
  rowActions,
  columnSizes = {},
}) {
  const fields = getFieldList(blueprint);
  const fieldMap = useMemo(
    () => new Map(fields.map((field) => [field.name, field])),
    [fields],
  );

  const columns = useMemo(() => {
    const baseColumns = resolveColumns(blueprint).map((fieldName) => {
      const field = fieldMap.get(fieldName);
      return {
        accessorKey: fieldName,
        header: field?.label ?? fieldName,
        size: columnSizes[fieldName],
        cell: ({ row }) => {
          const value = row.original[fieldName];
          const customRenderer = fieldRenderers[fieldName];
          if (customRenderer) {
            return customRenderer({
              value,
              row: row.original,
              field,
            });
          }
          return renderDefaultCell(value, field);
        },
      };
    });

    if (typeof rowActions === "function") {
      baseColumns.push({
        id: "actions",
        header: "",
        size: 48,
        cell: ({ row }) => rowActions(row.original),
      });
    }

    return baseColumns;
  }, [blueprint, columnSizes, fieldMap, fieldRenderers, rowActions]);

  return (
    <DataTable
      columns={columns}
      data={data}
      filters={filters}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      searchPlaceholder={searchPlaceholder}
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
      emptyIcon={emptyIcon}
      emptyAction={emptyAction}
    />
  );
}
