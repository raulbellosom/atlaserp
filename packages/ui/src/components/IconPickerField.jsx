import { useState } from "react";
import { Grid3x3 } from "lucide-react";
import { ICON_CATALOG } from "./icon-catalog.js";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.jsx";
import { Input } from "./Input.jsx";
import { Label } from "./Label.jsx";
import { fieldCls } from "./form-field-base.jsx";
import { cn } from "../lib/utils.js";

const ICONS = ICON_CATALOG;

export function IconPickerField({
  value,
  onChange,
  label,
  placeholder = "Seleccionar icono",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ICONS.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase()),
  );

  const SelectedIcon = ICONS.find((i) => i.name === value)?.component ?? null;

  return (
    <div className="space-y-1.5">
      {label && <Label>{label}</Label>}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={fieldCls(
              false,
              "flex items-center gap-2 text-left hover:bg-[hsl(var(--accent))] transition-colors",
            )}
          >
            {SelectedIcon ? (
              <SelectedIcon
                size={16}
                className="shrink-0 text-[hsl(var(--foreground))]"
              />
            ) : (
              <Grid3x3
                size={16}
                className="shrink-0 text-[hsl(var(--muted-foreground))]"
              />
            )}
            <span
              className={cn(
                "flex-1 truncate",
                value
                  ? "text-[hsl(var(--foreground))]"
                  : "text-[hsl(var(--muted-foreground))]",
              )}
            >
              {value || placeholder}
            </span>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" align="start">
          <Input
            placeholder="Buscar icono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-3 h-8 text-sm"
          />
          <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto">
            {filtered.map(({ name, component: Icon }) => (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => {
                  onChange(name);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex items-center justify-center h-9 w-9 rounded-md transition-colors",
                  "hover:bg-[hsl(var(--accent))]",
                  value === name &&
                    "bg-[hsl(var(--accent))] ring-1 ring-[hsl(var(--ring))]",
                )}
              >
                <Icon size={16} />
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="col-span-6 text-xs text-center text-[hsl(var(--muted-foreground))] py-4">
                Sin resultados
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
