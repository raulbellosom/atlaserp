import { useState, useId, useCallback } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.jsx";
import { FieldWrapper } from "./FormFields.jsx";
import { cn } from "../lib/utils.js";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const DAYS_HEADER = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

function parseDate(value) {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function formatDisplay(value) {
  const d = parseDate(value);
  if (!d) return "";
  return format(d, "d 'de' MMMM, yyyy", { locale: es });
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // Monday = 0 offset
  const startDow = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function Calendar({ value, onChange, onClose }) {
  const today = new Date();
  const selected = parseDate(value);

  const [viewYear, setViewYear] = useState(selected?.getFullYear() ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? today.getMonth());

  const cells = buildCalendarGrid(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(day) {
    if (!day) return;
    onChange(toISO(viewYear, viewMonth, day));
    onClose();
  }

  const isToday = useCallback((day) => {
    return day &&
      today.getFullYear() === viewYear &&
      today.getMonth() === viewMonth &&
      today.getDate() === day;
  }, [viewYear, viewMonth]);

  const isSelected = useCallback((day) => {
    return day &&
      selected?.getFullYear() === viewYear &&
      selected?.getMonth() === viewMonth &&
      selected?.getDate() === day;
  }, [selected, viewYear, viewMonth]);

  return (
    <div className="select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={prevMonth}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Mes anterior"
        >
          <ChevronLeft size={14} />
        </button>
        <span className="text-sm font-semibold">
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <button
          type="button"
          onClick={nextMonth}
          className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-[hsl(var(--muted))] transition-colors"
          aria-label="Mes siguiente"
        >
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Day header */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS_HEADER.map((d) => (
          <div key={d} className="text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, i) => {
          const sel = isSelected(day);
          const tod = isToday(day);
          return (
            <button
              key={i}
              type="button"
              disabled={!day}
              onClick={() => selectDay(day)}
              className={cn(
                "h-8 w-full rounded-md text-sm transition-colors",
                !day && "invisible",
                day && !sel && !tod && "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
                tod && !sel && "font-semibold text-[hsl(var(--primary))]",
                sel && "bg-[hsl(var(--primary))] text-white font-semibold hover:bg-[hsl(var(--primary))]/90",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── DatePickerField ────────────────────────────────────────────────────────────

export function DatePickerField({
  label,
  value,
  onChange,
  required,
  error,
  hint,
  placeholder = "Seleccionar fecha",
  className,
  disabled,
  id: externalId,
}) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const [open, setOpen] = useState(false);

  const displayValue = formatDisplay(value);

  return (
    <FieldWrapper label={label} labelFor={id} required={required} error={error} hint={hint} className={className}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            id={id}
            type="button"
            disabled={disabled}
            aria-label={label ?? "Seleccionar fecha"}
            className={cn(
              "h-11 w-full rounded-lg border px-3.5 text-sm glass-subtle text-left",
              "bg-card transition-all duration-150 outline-none flex items-center justify-between gap-2",
              "focus:ring-2 focus:ring-primary/20 focus:border-primary",
              "disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                : "border-border",
            )}
          >
            <span className={cn(!displayValue && "text-muted-foreground/70")}>
              {displayValue || placeholder}
            </span>
            <CalendarDays size={14} className="text-muted-foreground/70 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 p-3">
          <Calendar
            value={value}
            onChange={onChange}
            onClose={() => setOpen(false)}
          />
          {value && (
            <div className="mt-2 pt-2 border-t border-[hsl(var(--border))]">
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false); }}
                className="w-full text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors py-1"
              >
                Limpiar fecha
              </button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </FieldWrapper>
  );
}
