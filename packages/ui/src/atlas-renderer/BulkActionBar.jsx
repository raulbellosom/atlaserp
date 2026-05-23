import { Download, X } from "lucide-react";
import { Button } from "../components/button";

function getByPath(input, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .filter(Boolean)
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), input);
}

function exportCsv(rows, columns) {
  const headers = columns.map((c) => c.label);
  const body = rows.map((row) =>
    columns
      .map((col) => {
        const v = getByPath(row, col.field) ?? "";
        return `"${String(v).replace(/"/g, '""')}"`;
      })
      .join(","),
  );
  const csv = [headers.join(","), ...body].join("\r\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function BulkActionBar({
  selectedCount,
  selectedRows,
  visibleColumns,
  onClear,
  bulkActions = [],
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2 shadow-lg">
        <span className="mr-2 text-sm font-medium text-foreground">
          {selectedCount} {selectedCount === 1 ? "seleccionado" : "seleccionados"}
        </span>

        <div className="mr-1 h-4 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs"
          onClick={() => exportCsv(selectedRows, visibleColumns)}
        >
          <Download className="h-3.5 w-3.5" />
          Exportar CSV
        </Button>

        {bulkActions.map((action, i) => {
          const Icon = action.icon ?? null;
          return (
            <Button
              key={i}
              variant={action.variant === "destructive" ? "destructive" : "ghost"}
              size="sm"
              className="h-7 gap-1.5 px-2 text-xs"
              onClick={() => action.onClick(selectedRows)}
            >
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {action.label}
            </Button>
          );
        })}

        <div className="ml-1 h-4 w-px bg-border" />

        <button
          type="button"
          className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground"
          onClick={onClear}
          aria-label="Limpiar seleccion"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
