import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "lucide-react";
import { Button } from "../components/Button.jsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/DropdownMenu.jsx";

export function AtlasSortMenu({ columns = [], sortBy = "", sortDir = "asc", onSortChange }) {
  const current = columns.find((c) => c.field === sortBy);
  const label = current ? current.label : "Ordenar";
  const isActive = Boolean(sortBy);

  const handleColumn = (field) => onSortChange({ sortBy: field, sortDir });
  const handleDir = () => onSortChange({ sortBy, sortDir: sortDir === "asc" ? "desc" : "asc" });
  const handleClear = () => onSortChange({ sortBy: "", sortDir: "asc" });

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={`h-8 gap-1.5 text-xs ${isActive ? "border-indigo-500/50 text-indigo-600 dark:text-indigo-400" : ""}`}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[10rem]">
          <DropdownMenuLabel>Ordenar por</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {columns.map((col) => (
            <DropdownMenuItem key={col.key} onSelect={() => handleColumn(col.field)} className="gap-2">
              {sortBy === col.field ? (
                <Check className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0" />
              )}
              {col.label}
            </DropdownMenuItem>
          ))}
          {isActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={handleClear}
                className="text-xs text-[hsl(var(--muted-foreground))]"
              >
                Quitar orden
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {isActive && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-8 p-0 border-indigo-500/50"
          onClick={handleDir}
          title={sortDir === "asc" ? "Ascendente — clic para invertir" : "Descendente — clic para invertir"}
        >
          {sortDir === "asc" ? (
            <ArrowUp className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          ) : (
            <ArrowDown className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
          )}
        </Button>
      )}
    </div>
  );
}
