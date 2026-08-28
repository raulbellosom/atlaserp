import { useEffect, useRef } from "react";
import { cn } from "../lib/utils.js";

const ITEM_HEIGHT = 36;
const PAD_ROWS = 2;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);
const MERIDIEMS = ["a.m.", "p.m."];

function WheelColumn({ items, value, onChange, formatItem, ariaLabel }) {
  const containerRef = useRef(null);
  const scrollTimeout = useRef(null);
  const index = items.indexOf(value);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const targetIndex = items.indexOf(value);
    if (targetIndex < 0) return;
    const target = targetIndex * ITEM_HEIGHT;
    // Only force scrollTop when it's actually out of sync (initial open, or
    // an external reset). If it's already at/near the target — the normal
    // case right after the user's own scroll settles — skip the write so we
    // never fight the browser's native scroll-snap mid-gesture.
    if (Math.abs(el.scrollTop - target) > 1) {
      el.scrollTop = target;
    }
  }, [value, items]);

  useEffect(() => {
    return () => {
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    };
  }, []);

  function handleScroll() {
    if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
    scrollTimeout.current = setTimeout(() => {
      const el = containerRef.current;
      if (!el) return;
      // Read-only: CSS scroll-snap (mandatory, below) already settles the
      // element's scrollTop on an exact item boundary natively. Calling
      // el.scrollTo here on top of that was fighting the native snap and is
      // what made wheel scrolling feel locked — just read where it landed.
      const nearestIndex = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, nearestIndex));
      const next = items[clamped];
      if (next !== value) onChange(next);
    }, 120);
  }

  function handleKeyDown(e) {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    const delta = e.key === "ArrowUp" ? -1 : 1;
    const clamped = Math.max(0, Math.min(items.length - 1, index + delta));
    onChange(items[clamped]);
  }

  return (
    <div
      ref={containerRef}
      role="listbox"
      tabIndex={0}
      aria-label={ariaLabel}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      className="h-45 w-16 overflow-y-auto rounded-md outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      style={{ scrollSnapType: "y mandatory" }}
    >
      <div style={{ height: PAD_ROWS * ITEM_HEIGHT }} aria-hidden="true" />
      {items.map((item) => (
        <div
          key={item}
          role="option"
          aria-selected={item === value}
          className={cn(
            "h-9 flex items-center justify-center text-sm select-none transition-colors",
            item === value
              ? "text-primary font-semibold"
              : "text-muted-foreground/60",
          )}
          style={{ scrollSnapAlign: "center" }}
        >
          {formatItem(item)}
        </div>
      ))}
      <div style={{ height: PAD_ROWS * ITEM_HEIGHT }} aria-hidden="true" />
    </div>
  );
}

// ── TimeWheel ────────────────────────────────────────────────────────────────
// Three scroll-snap columns (hour / minute / meridiem). Never opens the
// device's native keyboard — pure touch/wheel/keyboard-arrow interaction.

export function TimeWheel({ hour, minute, meridiem, onChange }) {
  return (
    <div className="relative flex items-center justify-center gap-1">
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 h-9 -translate-y-1/2 rounded-md bg-primary/10"
        aria-hidden="true"
      />
      <WheelColumn
        items={HOURS}
        value={hour}
        onChange={(h) => onChange({ hour: h, minute, meridiem })}
        formatItem={(h) => String(h)}
        ariaLabel="Hora"
      />
      <span className="text-sm text-muted-foreground">:</span>
      <WheelColumn
        items={MINUTES}
        value={minute}
        onChange={(m) => onChange({ hour, minute: m, meridiem })}
        formatItem={(m) => String(m).padStart(2, "0")}
        ariaLabel="Minutos"
      />
      <WheelColumn
        items={MERIDIEMS}
        value={meridiem}
        onChange={(mer) => onChange({ hour, minute, meridiem: mer })}
        formatItem={(mer) => mer}
        ariaLabel="a.m. o p.m."
      />
    </div>
  );
}
