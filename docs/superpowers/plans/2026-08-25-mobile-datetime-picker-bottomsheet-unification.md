# Selector de fecha/hora universal y unificación del bottom-sheet mobile — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate native `<input type="date">`/`<input type="datetime-local">` from `@atlas/ui` (they overflow their container depending on browser/OS) and merge `Dialog.jsx`'s and `Sheet.jsx`'s duplicated mobile bottom-sheet geometry into one shared source of truth.

**Architecture:** Extract two small shared primitives (`useIsMobile` hook, bottom-sheet handle/geometry) consumed by both `Dialog.jsx` and `Sheet.jsx`. Build a scroll-snap `TimeWheel` and a `DateSelectorShell` (renders a `Popover` on desktop, the now-unified `Sheet` on mobile) in a new `date-picker-shared.jsx`, which also houses the existing `Calendar` (moved out of `DatePickerField.jsx`) and date/date-time formatters. Rewrite `DatePickerField`, `DateField`, and `DateTimeField` on top of that shared engine while preserving every existing public prop contract byte-for-byte, so none of the 12 consumer files need to change.

**Tech Stack:** React 18, Tailwind CSS (`cn` = `clsx` + `tailwind-merge`), Radix UI (`@radix-ui/react-dialog`, `@radix-ui/react-popover`), `date-fns` + `date-fns/locale/es`, `lucide-react`, `class-variance-authority`. No test runner exists for these files (`node:test` in this repo only covers `apps/api` services) — verification is `pnpm build` + `pnpm lint` + manual browser QA, exactly as documented in the spec's Section 26.

**Spec:** `docs/superpowers/specs/2026-08-25-mobile-datetime-picker-bottomsheet-unification-design.md`

---

## File Structure Map

- Create `packages/ui/src/hooks/useIsMobile.js` — shared mobile-breakpoint hook.
- Create `packages/ui/src/components/bottom-sheet-shared.jsx` — shared bottom-sheet surface class, drag style helper, and `BottomSheetHandle`.
- Modify `packages/ui/src/components/Sheet.jsx` — consume the two files above instead of its local copies.
- Modify `packages/ui/src/components/Dialog.jsx` — consume `bottom-sheet-shared.jsx` for its mobile variant.
- Create `packages/ui/src/components/TimeWheel.jsx` — scroll-snap hour/minute/meridiem picker, no native input.
- Create `packages/ui/src/components/date-picker-shared.jsx` — `Calendar` (moved from `DatePickerField.jsx`), date/date-time formatters, date-time value parse/compose helpers, and `DateSelectorShell` (Popover on desktop, unified Sheet on mobile).
- Modify `packages/ui/src/components/DatePickerField.jsx` — use `Calendar` + `DateSelectorShell` from the new shared file instead of a hand-rolled `Popover`.
- Modify `packages/ui/src/components/FormFields.jsx` — rewrite `DateField` and `DateTimeField` to use the shared engine instead of `<input type="date">`/`<input type="datetime-local">`.
- No changes to `packages/ui/src/index.js` (all exported names/paths stay the same) and no changes to any of the 12 consumer screens.

---

### Task 1: Extract `useIsMobile` into a shared hook

**Files:**
- Create: `packages/ui/src/hooks/useIsMobile.js`
- Modify: `packages/ui/src/components/Sheet.jsx:1-20`

- [ ] **Step 1: Create the shared hook**

```js
// packages/ui/src/hooks/useIsMobile.js
import { useEffect, useState } from "react";

export function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches;
  });
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isMobile;
}
```

- [ ] **Step 2: Remove the local copy from `Sheet.jsx` and import the shared one**

In `packages/ui/src/components/Sheet.jsx`, replace lines 1-20 (the imports plus the local `useIsMobile` function) with:

```jsx
import { forwardRef, useRef } from "react";
import * as SheetPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cva } from "class-variance-authority";
import { cn } from "../lib/utils.js";
import { useDragToDismiss } from "../hooks/useDragToDismiss.js";
import { useIsMobile } from "../hooks/useIsMobile.js";
```

This drops the local `function useIsMobile(...) {...}` block and the now-unused `useEffect`/`useState` (only the deleted local hook used them). `X` stays — `SheetContent`'s visible close button still renders `<X className="h-4 w-4" />` further down the file. `forwardRef` and `useRef` stay — `useRef` is used for `contentRef` inside `SheetContent`.

- [ ] **Step 3: Verify the file still builds**

Run: `pnpm --filter @atlas/ui build` (or `pnpm build` from repo root if the package has no standalone build script — check `packages/ui/package.json` first with `Read`).
Expected: no syntax/import errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/hooks/useIsMobile.js packages/ui/src/components/Sheet.jsx
git commit -m "refactor(ui): extract useIsMobile into a shared hook"
```

---

### Task 2: Extract shared bottom-sheet geometry and wire it into `Sheet.jsx`

**Files:**
- Create: `packages/ui/src/components/bottom-sheet-shared.jsx`
- Modify: `packages/ui/src/components/Sheet.jsx` (the `sheetVariants` bottom-side extra classes, the drag `style`, and the handle markup)

- [ ] **Step 1: Create the shared geometry file**

This is the canonical bottom-sheet geometry — the exact values `Sheet.jsx` already uses today (`p-6` container padding, handle with `-mt-1 mb-3`), extracted so `Dialog.jsx` can adopt the same numbers in Task 3.

```jsx
// packages/ui/src/components/bottom-sheet-shared.jsx
import * as DialogPrimitive from "@radix-ui/react-dialog";

// Canonical mobile bottom-sheet geometry shared by Dialog.jsx (its mobile
// variant) and Sheet.jsx (side="bottom"). Keeping this in one file means the
// handle spacing, corner radius, scroll behavior, and drag-to-dismiss feel
// can never drift apart between the two components again.
export const BOTTOM_SHEET_SURFACE_CLASS =
  "rounded-t-2xl p-6 max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y";

export function bottomSheetDragStyle({ dragY, dragging, style }) {
  return {
    paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
    transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
    transition: dragging
      ? "none"
      : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
    ...style,
  };
}

export function BottomSheetHandle({
  closeRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}) {
  return (
    <>
      <div
        className="mx-auto -mt-1 mb-3 h-1.5 w-16 shrink-0 rounded-full bg-foreground/25 cursor-grab active:cursor-grabbing touch-none"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {/* Hidden close button for programmatic swipe-to-dismiss. Both Dialog
          and Sheet are built on @radix-ui/react-dialog, so this Close works
          inside either one's Content tree. */}
      <DialogPrimitive.Close
        ref={closeRef}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />
    </>
  );
}
```

- [ ] **Step 2: Wire it into `Sheet.jsx`**

In `packages/ui/src/components/Sheet.jsx`:

1. Add the import (alongside the other local imports from Task 1):

```jsx
import {
  BOTTOM_SHEET_SURFACE_CLASS,
  bottomSheetDragStyle,
  BottomSheetHandle,
} from "./bottom-sheet-shared.jsx";
```

2. In the `sheetVariants` `cva` call, replace the `bottom` variant string. Before:

```jsx
bottom:
  "inset-x-0 bottom-0 rounded-t-2xl sm:mx-auto sm:max-w-lg data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
```

After (drop `rounded-t-2xl` here since it now comes from `BOTTOM_SHEET_SURFACE_CLASS`):

```jsx
bottom:
  "inset-x-0 bottom-0 sm:mx-auto sm:max-w-lg data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
```

3. Where `SheetContent`'s `className` is built, replace:

```jsx
className={cn(
  sheetVariants({ side: effectiveSide }),
  effectiveSide === "bottom" && "max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y",
  effectiveSide !== "bottom" && "overflow-hidden",
  className,
)}
```

with:

```jsx
className={cn(
  sheetVariants({ side: effectiveSide }),
  effectiveSide === "bottom" && BOTTOM_SHEET_SURFACE_CLASS,
  effectiveSide !== "bottom" && "overflow-hidden",
  className,
)}
```

4. Where the bottom-side inline `style` is built, replace:

```jsx
style={
  effectiveSide === "bottom"
    ? {
        paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))",
        transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
        transition: dragging ? "none" : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
        ...style,
      }
    : ...
```

with:

```jsx
style={
  effectiveSide === "bottom"
    ? bottomSheetDragStyle({ dragY, dragging, style })
    : ...
```

(Keep the rest of the ternary — the `right`/`left`/`top` branches — exactly as-is; only the `bottom` branch's object literal is replaced by the function call.)

5. Replace the inline handle + hidden close button markup:

```jsx
{effectiveSide === "bottom" && (
  <div
    className="mx-auto -mt-1 mb-3 h-1.5 w-16 shrink-0 rounded-full bg-foreground/25 cursor-grab active:cursor-grabbing touch-none"
    aria-hidden="true"
    onPointerDown={handleDragPointerDown}
    onPointerMove={handleDragPointerMove}
    onPointerUp={handleDragPointerUp}
    onPointerCancel={handleDragPointerUp}
  />
)}
{effectiveSide === "bottom" && (
  <SheetPrimitive.Close
    ref={closeRef}
    className="sr-only"
    tabIndex={-1}
    aria-hidden="true"
  />
)}
```

with:

```jsx
{effectiveSide === "bottom" && (
  <BottomSheetHandle
    closeRef={closeRef}
    onPointerDown={handleDragPointerDown}
    onPointerMove={handleDragPointerMove}
    onPointerUp={handleDragPointerUp}
  />
)}
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: no errors in `packages/ui` or `apps/desktop`.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/bottom-sheet-shared.jsx packages/ui/src/components/Sheet.jsx
git commit -m "refactor(ui): extract shared bottom-sheet geometry, wire into Sheet"
```

---

### Task 3: Adopt the shared bottom-sheet geometry in `Dialog.jsx`

**Files:**
- Modify: `packages/ui/src/components/Dialog.jsx`

This changes Dialog's mobile bottom-sheet variant from its own hand-computed padding (`px-5 pt-5 pb-8`, `calc(2rem + safe-area)`, handle `mb-4`) to the canonical geometry from Task 2 (`p-6`, `calc(1.5rem + safe-area)`, handle `-mt-1 mb-3`) — the numbers the user preferred.

- [ ] **Step 1: Add the import**

At the top of `packages/ui/src/components/Dialog.jsx`, alongside the existing imports:

```jsx
import {
  BOTTOM_SHEET_SURFACE_CLASS,
  bottomSheetDragStyle,
  BottomSheetHandle,
} from "./bottom-sheet-shared.jsx";
```

- [ ] **Step 2: Replace the inline `style` object**

Before:

```jsx
style={{
  paddingBottom: "calc(2rem + env(safe-area-inset-bottom, 0px))",
  transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
  transition: dragging ? "none" : "transform 280ms cubic-bezier(0.32, 0.72, 0, 1)",
  ...style,
}}
```

After:

```jsx
style={bottomSheetDragStyle({ dragY, dragging, style })}
```

- [ ] **Step 3: Replace the mobile surface classes**

Before (inside the big `cn(...)` call building `className`):

```jsx
// ── Mobile: full-width bottom sheet ──────────────────────────────
"inset-x-0 bottom-0 w-full min-h-[30dvh] max-h-[85dvh] overflow-y-auto overscroll-contain touch-pan-y",
"rounded-t-2xl px-5 pt-5 pb-8",
"data-[state=open]:slide-in-from-bottom-full",
```

After:

```jsx
// ── Mobile: full-width bottom sheet ──────────────────────────────
"inset-x-0 bottom-0 w-full min-h-[30dvh]",
BOTTOM_SHEET_SURFACE_CLASS,
"data-[state=open]:slide-in-from-bottom-full",
```

- [ ] **Step 4: Replace the handle markup**

Before:

```jsx
{/* Drag handle — mobile only; handles swipe-to-dismiss */}
<div
  className="mx-auto mb-4 h-1.5 w-16 shrink-0 rounded-full bg-foreground/25 md:hidden cursor-grab active:cursor-grabbing touch-none"
  aria-hidden="true"
  onPointerDown={handleDragPointerDown}
  onPointerMove={handleDragPointerMove}
  onPointerUp={handleDragPointerUp}
  onPointerCancel={handleDragPointerUp}
/>
{/* Hidden close button for programmatic swipe-to-dismiss */}
<DialogPrimitive.Close
  ref={closeRef}
  className="sr-only"
  tabIndex={-1}
  aria-hidden="true"
/>
```

After:

```jsx
{/* Drag handle — mobile only; handles swipe-to-dismiss. md:hidden because
    the desktop variant is a centered modal with no handle. */}
<div className="md:hidden">
  <BottomSheetHandle
    closeRef={closeRef}
    onPointerDown={handleDragPointerDown}
    onPointerMove={handleDragPointerMove}
    onPointerUp={handleDragPointerUp}
  />
</div>
```

Note: on desktop (`md:` breakpoint) this whole wrapper is hidden via `md:hidden`, but the hidden `DialogPrimitive.Close` that `BottomSheetHandle` renders is `sr-only` regardless — hiding its wrapper with `md:hidden` on desktop is fine because desktop dismiss goes through the visible `X` button / Escape / backdrop, not the mobile drag gesture.

- [ ] **Step 5: Build check**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Dialog.jsx
git commit -m "refactor(ui): adopt shared bottom-sheet geometry in Dialog's mobile variant"
```

---

### Task 4: Manual checkpoint — bottom-sheet unification

**Status:** Waived by explicit user decision — see `docs/superpowers/decisions/2026-08-25-mobile-datetime-picker-bottomsheet-unification-decision.md`. Verification closed on `pnpm build` + zero-diff check on consumer files instead of live browser QA.

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Run: `pnpm dev:frontend` (leave running)

- [ ] **Step 2: Compare a `Dialog` bottom-sheet and a `Sheet` bottom-sheet side by side**

In a browser at 390px width (DevTools responsive mode), light theme:
- Open any screen that uses `Dialog` on mobile (e.g. `atlas.projects` → open a task via `TaskFormModal`).
- Open any screen that uses `Sheet`/`MobileFiltersSheet` (any list screen's mobile filter button).
- Confirm: handle position/size, corner radius, and open/close animation feel identical between the two.
- Repeat in dark theme.

- [ ] **Step 3: Note any visual regression**

If anything looks broken (not just "different from before" — actually broken/overlapping), stop and fix before proceeding to Task 5. This is a shared, high-traffic component; do not proceed with a known regression.

- [ ] **Step 4: No commit** (verification-only task)

---

### Task 5: Build the `TimeWheel` component

**Files:**
- Create: `packages/ui/src/components/TimeWheel.jsx`

- [ ] **Step 1: Write the component**

```jsx
// packages/ui/src/components/TimeWheel.jsx
import { useEffect, useRef } from "react";
import { cn } from "../lib/utils.js";

const ITEM_HEIGHT = 36;
const PAD_ROWS = 2;

const HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);
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
    el.scrollTop = targetIndex * ITEM_HEIGHT;
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
      const nearestIndex = Math.round(el.scrollTop / ITEM_HEIGHT);
      const clamped = Math.max(0, Math.min(items.length - 1, nearestIndex));
      el.scrollTo({ top: clamped * ITEM_HEIGHT, behavior: "smooth" });
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
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: no errors (this file isn't imported anywhere yet, so this just checks syntax via Vite's transform if the build pipeline processes all files, otherwise skip to Task 7 where it's actually wired in and will surface any error).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/TimeWheel.jsx
git commit -m "feat(ui): add TimeWheel scroll-snap time picker"
```

---

### Task 6: Build the shared date-picker engine (`Calendar`, formatters, `DateSelectorShell`)

**Files:**
- Create: `packages/ui/src/components/date-picker-shared.jsx`
- Modify: `packages/ui/src/components/DatePickerField.jsx` (only to stop exporting `Calendar` locally — full rewrite happens in Task 7, this task just creates the new shared file)

- [ ] **Step 1: Write the shared file**

This moves `Calendar` and its helpers verbatim from `DatePickerField.jsx` (same logic, same behavior), renames `formatDisplay` to `formatDateDisplay` for clarity now that a `formatDateTimeDisplay` sibling exists, and adds the new date-time helpers plus `DateSelectorShell`.

```jsx
// packages/ui/src/components/date-picker-shared.jsx
import { useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Popover, PopoverTrigger, PopoverContent } from "./Popover.jsx";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./Sheet.jsx";
import { useIsMobile } from "../hooks/useIsMobile.js";
import { cn } from "../lib/utils.js";

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const DAYS_HEADER = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sa", "Do"];

export function parseDate(value) {
  if (!value) return null;
  const str = String(value);
  const datePart = str.includes("T") ? str.slice(0, 10) : str;
  const d = new Date(`${datePart}T12:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function toISO(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function formatDateDisplay(value) {
  const d = parseDate(value);
  if (!d) return "";
  return format(d, "d 'de' MMMM, yyyy", { locale: es });
}

// ── Date-time value helpers ────────────────────────────────────────────────
// DateTimeField's on-the-wire value format is "YYYY-MM-DDTHH:mm" (the same
// format <input type="datetime-local"> produced), so existing consumers
// (e.g. EventFormModal's toLocalDatetime) need no changes.

export function parseDateTimeValue(value) {
  if (!value) return { date: undefined, hour: 9, minute: 0, meridiem: "a.m." };
  const str = String(value);
  const datePart = str.slice(0, 10);
  const timePart = str.includes("T") ? str.slice(11, 16) : "00:00";
  const [hStr, mStr] = timePart.split(":");
  const h = Number(hStr) || 0;
  const minuteRaw = Number(mStr) || 0;
  const meridiem = h >= 12 ? "p.m." : "a.m.";
  let hour = h % 12;
  if (hour === 0) hour = 12;
  const minute = Math.round(minuteRaw / 5) * 5 % 60;
  return { date: datePart, hour, minute, meridiem };
}

export function composeDateTimeValue(datePart, hour, minute, meridiem) {
  if (!datePart) return "";
  let h24 = hour % 12;
  if (meridiem === "p.m.") h24 += 12;
  const hh = String(h24).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return `${datePart}T${hh}:${mm}`;
}

export function formatDateTimeDisplay(value) {
  const d = parseDate(value);
  if (!d) return "";
  const str = String(value);
  const timePart = str.includes("T") ? str.slice(11, 16) : "00:00";
  const [hStr, mStr] = timePart.split(":");
  const h = Number(hStr) || 0;
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  const meridiem = h >= 12 ? "p.m." : "a.m.";
  const datePart = format(d, "d MMM yyyy", { locale: es });
  return `${datePart}, ${displayHour}:${String(mStr ?? "00").padStart(2, "0")} ${meridiem}`;
}

function buildCalendarGrid(year, month) {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startDow = (firstDay.getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Calendar ─────────────────────────────────────────────────────────────────

export function Calendar({ value, onChange, onClose }) {
  const today = new Date();
  const selected = parseDate(value);

  const [viewYear, setViewYear] = useState(
    selected?.getFullYear() ?? today.getFullYear(),
  );
  const [viewMonth, setViewMonth] = useState(
    selected?.getMonth() ?? today.getMonth(),
  );

  const cells = buildCalendarGrid(viewYear, viewMonth);

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  }

  function selectDay(day) {
    if (!day) return;
    onChange(toISO(viewYear, viewMonth, day));
    onClose();
  }

  const isToday = useCallback(
    (day) => {
      return (
        day &&
        today.getFullYear() === viewYear &&
        today.getMonth() === viewMonth &&
        today.getDate() === day
      );
    },
    [viewYear, viewMonth],
  );

  const isSelected = useCallback(
    (day) => {
      return (
        day &&
        selected?.getFullYear() === viewYear &&
        selected?.getMonth() === viewMonth &&
        selected?.getDate() === day
      );
    },
    [selected, viewYear, viewMonth],
  );

  return (
    <div className="select-none w-full">
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

      <div className="grid grid-cols-7 mb-1">
        {DAYS_HEADER.map((d) => (
          <div
            key={d}
            className="text-center text-[10px] font-medium text-[hsl(var(--muted-foreground))] py-1"
          >
            {d}
          </div>
        ))}
      </div>

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
                day &&
                  !sel &&
                  !tod &&
                  "hover:bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]",
                tod && !sel && "font-semibold text-[hsl(var(--primary))]",
                sel &&
                  "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-semibold hover:bg-[hsl(var(--primary))]/90",
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

// ── DateSelectorShell ──────────────────────────────────────────────────────
// Desktop: Popover anchored to the trigger (unchanged from DatePickerField's
// original behavior). Mobile: the unified bottom Sheet, so every date/time
// field in the app opens with the same handle/drag-to-dismiss/safe-area
// behavior established in Tasks 1-3.

export function DateSelectorShell({
  open,
  onOpenChange,
  trigger,
  title,
  children,
  footer,
}) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom">
          {title && (
            <SheetHeader>
              <SheetTitle>{title}</SheetTitle>
            </SheetHeader>
          )}
          <div className="flex flex-col items-center gap-4 w-full">
            {children}
          </div>
          {footer}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-3">
        {children}
        {footer}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: no errors (nothing imports this file yet — this just confirms the syntax is valid; real integration checks happen in Tasks 7-9).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/date-picker-shared.jsx
git commit -m "feat(ui): add shared Calendar, date-time helpers, and DateSelectorShell"
```

---

### Task 7: Refactor `DatePickerField` to use the shared engine

**Files:**
- Modify: `packages/ui/src/components/DatePickerField.jsx` (full rewrite — this file currently contains the `Calendar` component that moved to `date-picker-shared.jsx` in Task 6)

- [ ] **Step 1: Replace the entire file content**

```jsx
// packages/ui/src/components/DatePickerField.jsx
import { useState, useId } from "react";
import { CalendarDays } from "lucide-react";
import { FieldWrapper, fieldCls } from "./form-field-base.jsx";
import { cn } from "../lib/utils.js";
import { Calendar, DateSelectorShell, formatDateDisplay } from "./date-picker-shared.jsx";

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
  compact = false,
  id: externalId,
}) {
  const autoId = useId();
  const id = externalId ?? autoId;
  const [open, setOpen] = useState(false);

  const displayValue = formatDateDisplay(value);

  const trigger = (
    <button
      id={compact ? undefined : id}
      type="button"
      disabled={disabled}
      aria-label={label ?? "Seleccionar fecha"}
      className={
        compact
          ? cn(
              "h-7 rounded-md border px-2 text-xs text-left flex items-center gap-1.5 bg-[hsl(var(--background))] transition-colors",
              "outline-none justify-between gap-2 disabled:cursor-not-allowed disabled:opacity-50",
              error
                ? "border-destructive focus:ring-destructive/20 focus:border-destructive"
                : "border-border",
            )
          : fieldCls(
              error,
              "text-left flex items-center justify-between gap-2",
            )
      }
    >
      <span className={cn(!displayValue && "text-muted-foreground/70")}>
        {displayValue || placeholder}
      </span>
      <CalendarDays
        size={compact ? 12 : 14}
        className="text-muted-foreground/70 shrink-0"
      />
    </button>
  );

  const picker = (
    <DateSelectorShell
      open={open}
      onOpenChange={setOpen}
      trigger={trigger}
      title={typeof label === "string" ? label : "Seleccionar fecha"}
    >
      <Calendar
        value={value}
        onChange={onChange}
        onClose={() => setOpen(false)}
      />
      {value && (
        <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] w-full">
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className="w-full text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors py-1"
          >
            Limpiar fecha
          </button>
        </div>
      )}
    </DateSelectorShell>
  );

  if (compact) return picker;

  return (
    <FieldWrapper
      label={label}
      labelFor={id}
      required={required}
      error={error}
      hint={hint}
      className={className}
    >
      {picker}
    </FieldWrapper>
  );
}
```

(Note the `typeof label === "string" ? label : ...` guard for `title` — `label` in this codebase is sometimes a JSX element, e.g. `label={<IL icon={Calendar}>Fecha de ingreso</IL>}` in `HrEmployeeForm.jsx`. `SheetTitle` can render a JSX node fine, but a plain fallback string avoids passing something unexpectedly empty when `label` is `undefined`. Since `SheetTitle` can actually render any ReactNode, this guard is a minor safety net, not a hard requirement — passing `label ?? "Seleccionar fecha"` directly also works. Keep the `typeof` guard for clarity.)

- [ ] **Step 2: Build check**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 3: Manual regression check**

With `pnpm dev:frontend` running: open `atlas.hr` → an employee → "Fecha de ingreso" `DatePickerField` (`HrEmployeeForm.jsx`). Confirm:
- Desktop (≥768px): opens as a popover, day selection works, "Limpiar fecha" clears it.
- Mobile (390px): opens as the bottom sheet, same interactions work, drag-to-dismiss works.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/DatePickerField.jsx
git commit -m "refactor(ui): rebuild DatePickerField on the shared date-selector engine"
```

---

### Task 8: Rewrite `DateField` in `FormFields.jsx`

**Files:**
- Modify: `packages/ui/src/components/FormFields.jsx` (imports at the top, and the `DateField` block at lines ~573-628 from the pre-refactor file)

- [ ] **Step 1: Add the new imports**

At the top of `packages/ui/src/components/FormFields.jsx`, the React import currently reads:

```jsx
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useMemo,
} from "react";
```

Change it to add `useId`:

```jsx
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  forwardRef,
  useMemo,
  useId,
} from "react";
```

The `lucide-react` import currently reads:

```jsx
import {
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Tag,
  Search,
  Plus,
} from "lucide-react";
```

Add `CalendarDays`:

```jsx
import {
  Eye,
  EyeOff,
  AlertCircle,
  Upload,
  X,
  Check,
  ChevronDown,
  ChevronUp,
  Phone,
  Tag,
  Search,
  Plus,
  CalendarDays,
} from "lucide-react";
```

Add a new import block (near the other local imports, e.g. right after the `form-field-base.jsx` import):

```jsx
import {
  Calendar,
  DateSelectorShell,
  formatDateDisplay,
  formatDateTimeDisplay,
  parseDateTimeValue,
  composeDateTimeValue,
} from "./date-picker-shared.jsx";
import { Button } from "./Button.jsx";
```

- [ ] **Step 2: Replace the `DateField` block**

Find the section starting at `// ─── DateField ─...` and ending right before `// ─── DateTimeField ─...`. Replace the entire `DateField` definition with:

```jsx
// ─── DateField ────────────────────────────────────────────────────────────────

export const DateField = forwardRef(function DateField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    onChange,
    value,
    id,
    icon,
    className,
    disabled,
    name,
    placeholder = "Seleccionar fecha",
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [localError, setLocalError] = useState("");
  const [open, setOpen] = useState(false);
  const error = externalError || localError;

  function emitChange(nextValue) {
    const next = nextValue ?? "";
    if (validate) setLocalError(validate(next) || "");
    onChange?.({ target: { name, value: next } });
  }

  const displayValue = formatDateDisplay(value);

  const trigger = (
    <button
      ref={ref}
      id={fieldId}
      name={name}
      type="button"
      disabled={disabled}
      className={fieldCls(
        error,
        cn(
          icon && "pl-9",
          "text-left flex items-center justify-between gap-2",
          className,
        ),
      )}
    >
      <span
        className={cn(
          "flex-1 truncate",
          !displayValue && "text-muted-foreground/70",
        )}
      >
        {displayValue || placeholder}
      </span>
      <CalendarDays size={14} className="text-muted-foreground/70 shrink-0" />
    </button>
  );

  return (
    <FieldWrapper
      label={label}
      labelFor={fieldId}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={icon} />
        <DateSelectorShell
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) onBlur?.();
          }}
          trigger={trigger}
          title={typeof label === "string" ? label : "Seleccionar fecha"}
        >
          <Calendar
            value={value}
            onChange={emitChange}
            onClose={() => setOpen(false)}
          />
          {value && (
            <div className="mt-2 pt-2 border-t border-[hsl(var(--border))] w-full">
              <button
                type="button"
                onClick={() => {
                  emitChange(undefined);
                  setOpen(false);
                }}
                className="w-full text-xs text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors py-1"
              >
                Limpiar fecha
              </button>
            </div>
          )}
        </DateSelectorShell>
      </div>
    </FieldWrapper>
  );
});
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: no errors. (`DateTimeField` below still references the old native `<input>` at this point — that's fine, it's rewritten in Task 9.)

- [ ] **Step 4: Manual regression check**

With `pnpm dev:frontend` running: open the app's Profile screen (`ProfileScreen.jsx`), "Fecha de nacimiento" field. Confirm:
- The `Mail`-icon-style leading icon (here `CalendarDays`, passed via the `icon` prop) still renders on the left.
- Desktop: opens as popover; selecting a day updates the field and closes.
- Mobile (390px): opens as the unified bottom sheet; no overflow; selecting a day updates the field and closes.
- No `<input type="date">` element exists in the DOM for this field (check via DevTools Elements panel).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/FormFields.jsx
git commit -m "feat(ui): rebuild DateField on the shared date-selector engine"
```

---

### Task 9: Rewrite `DateTimeField` in `FormFields.jsx`

**Files:**
- Modify: `packages/ui/src/components/FormFields.jsx` (the `DateTimeField` block)

- [ ] **Step 1: Replace the `DateTimeField` block**

Find the section starting at `// ─── DateTimeField ─...` and ending right before `// ─── YearField ─...`. Replace the entire `DateTimeField` definition with:

```jsx
// ─── DateTimeField ────────────────────────────────────────────────────────────

export const DateTimeField = forwardRef(function DateTimeField(
  {
    label,
    error: externalError,
    hint,
    required,
    validate,
    onBlur,
    onChange,
    value,
    id,
    icon,
    className,
    disabled,
    name,
    placeholder = "Seleccionar fecha y hora",
  },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const [localError, setLocalError] = useState("");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseDateTimeValue(value));
  const error = externalError || localError;

  function handleOpenChange(next) {
    setOpen(next);
    if (next) {
      setDraft(parseDateTimeValue(value));
    } else {
      onBlur?.();
    }
  }

  function commit() {
    const next = composeDateTimeValue(
      draft.date,
      draft.hour,
      draft.minute,
      draft.meridiem,
    );
    if (validate) setLocalError(validate(next) || "");
    onChange?.({ target: { name, value: next } });
    setOpen(false);
  }

  const displayValue = formatDateTimeDisplay(value);

  const trigger = (
    <button
      ref={ref}
      id={fieldId}
      name={name}
      type="button"
      disabled={disabled}
      className={fieldCls(
        error,
        cn(
          icon && "pl-9",
          "min-w-0 text-left flex items-center justify-between gap-2",
          className,
        ),
      )}
    >
      <span
        className={cn(
          "flex-1 truncate",
          !displayValue && "text-muted-foreground/70",
        )}
      >
        {displayValue || placeholder}
      </span>
      <CalendarDays size={14} className="text-muted-foreground/70 shrink-0" />
    </button>
  );

  return (
    <FieldWrapper
      label={label}
      labelFor={fieldId}
      error={error}
      hint={hint}
      required={required}
    >
      <div className="relative">
        <InputIcon icon={icon} />
        <DateSelectorShell
          open={open}
          onOpenChange={handleOpenChange}
          trigger={trigger}
          title={typeof label === "string" ? label : "Seleccionar fecha y hora"}
          footer={
            <Button
              type="button"
              size="sm"
              className="w-full mt-3"
              onClick={commit}
            >
              Aceptar
            </Button>
          }
        >
          <Calendar
            value={draft.date}
            onChange={(nextDate) =>
              setDraft((d) => ({ ...d, date: nextDate }))
            }
            onClose={() => {}}
          />
          <TimeWheel
            hour={draft.hour}
            minute={draft.minute}
            meridiem={draft.meridiem}
            onChange={(next) => setDraft((d) => ({ ...d, ...next }))}
          />
        </DateSelectorShell>
      </div>
    </FieldWrapper>
  );
});
```

- [ ] **Step 2: Add the `TimeWheel` import**

In the same import block added in Task 8 Step 1 (or as its own line), add:

```jsx
import { TimeWheel } from "./TimeWheel.jsx";
```

- [ ] **Step 3: Build check**

Run: `pnpm build`
Expected: no errors.

- [ ] **Step 4: Manual regression check**

With `pnpm dev:frontend` running: open `atlas.calendar` → "Nuevo evento" (`EventFormModal.jsx`), "Inicio"/"Fin" fields. Confirm:
- Desktop: opens as popover with `Calendar` + `TimeWheel` stacked, "Aceptar" applies the value and closes.
- Mobile (390px, DevTools responsive): opens as the unified bottom sheet, no horizontal overflow anywhere, `TimeWheel` columns scroll/snap by touch drag, and — critically — tapping/scrolling the `TimeWheel` never triggers the on-screen keyboard.
- Edit an existing event (open one from the calendar grid, not "Nuevo evento"): confirm `startAt`/`endAt` show the correct preselected date and time when the field is opened.
- Tapping a day in the calendar updates the displayed date but does **not** close the sheet/popover; only "Aceptar" (or backdrop/Escape, which discards) closes it.
- Changing only the day (not touching `TimeWheel`) and hitting "Aceptar" preserves the previously-set time.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/FormFields.jsx
git commit -m "feat(ui): rebuild DateTimeField on Calendar + TimeWheel, drop native datetime-local input"
```

---

### Task 10: Full build, lint, and diff-scope verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

Run: `pnpm build`
Expected: no errors across all packages/apps.

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new lint errors in the files touched by this plan (`Sheet.jsx`, `Dialog.jsx`, `DatePickerField.jsx`, `FormFields.jsx`, `bottom-sheet-shared.jsx`, `date-picker-shared.jsx`, `TimeWheel.jsx`, `useIsMobile.js`).

- [ ] **Step 3: Confirm zero-diff on the 5 `DateField`/`DateTimeField` consumer files**

Run: `git diff --stat main -- apps/desktop/src/app/ProfileScreen.jsx apps/desktop/src/modules/atlas.calendar/components/EventFormModal.jsx apps/desktop/src/modules/atlas.inventory/screens/InventoryItemForm.jsx apps/desktop/src/modules/atlas.inventory/components/InventoryCustomFieldsForm.jsx apps/desktop/src/modules/atlas.pos/screens/PosOrdersScreen.jsx`

Expected: empty output (no changes to any of these 5 files) — this is Acceptance Criterion 5 from the spec. If any of them show a diff, stop and investigate why (Section 24 Risk 1 in the spec).

- [ ] **Step 4: No commit** (verification-only task)

---

### Task 11: Full manual QA pass against the spec's acceptance criteria

**Status:** Steps 1–2 (live browser QA) waived by explicit user decision — see `docs/superpowers/decisions/2026-08-25-mobile-datetime-picker-bottomsheet-unification-decision.md`. Step 3 (docs/TASKS.md) checked: no matching tracked entry exists for this work, so it was correctly skipped per the plan's own instruction.

**Files:** none (verification only)

- [ ] **Step 1: Run through the spec's Section 26 verification plan**

With `pnpm dev:frontend` running, using DevTools responsive mode:

1. **390px, dark theme:** Open "Nuevo evento" (`atlas.calendar`). Tap "Inicio" and "Fin". Confirm the bottom-sheet doesn't overflow horizontally and `TimeWheel` never opens the keyboard.
2. **390px, light theme:** Repeat step 1.
3. **1440px:** Same fields — confirm the `Popover` anchors correctly with no overflow.
4. **Visual comparison at 390px:** A `Dialog` bottom-sheet (e.g. "Nuevo evento") vs a `Sheet` bottom-sheet (e.g. `MobileFiltersSheet` on any list screen) — handle, padding, corner radius, and animation should look identical.
5. **Regression — `DatePickerField`:** `atlas.hr` → employee → "Fecha de ingreso"/"Fecha de baja". Confirm unchanged behavior (Task 7 already checked this; re-confirm after all subsequent changes).
6. **Regression — icon prop:** `ProfileScreen.jsx` "Fecha de nacimiento" — icon still renders (Task 8 already checked this; re-confirm).
7. **DOM check:** Search the DOM (any of the screens above) for `input[type="date"]` and `input[type="datetime-local"]` — zero matches anywhere in `@atlas/ui` components (Acceptance Criterion 2).

- [ ] **Step 2: Run the 14-aspect UI checklist on "Nuevo evento" mobile**

Open `docs/ai-context/ui-screen-audit-checklist.md`, run through its aspects against the "Nuevo evento" modal at 390px — this is the screen that originated the user's report, called out explicitly in the spec's Section 26.

- [ ] **Step 3: Update `docs/TASKS.md` if this work maps to a tracked phase entry**

Read `docs/TASKS.md` to check whether AME3/UI-polish work like this has a tracked entry to update. If yes, add:

```
Verified: 2026-08-25 (pnpm build, pnpm lint, manual QA at 390px/1440px light+dark themes per docs/superpowers/specs/2026-08-25-mobile-datetime-picker-bottomsheet-unification-design.md Section 26)
```

If no matching entry exists, skip this step — do not invent a new roadmap entry that isn't part of this spec's scope.

- [ ] **Step 4: No commit unless `docs/TASKS.md` was updated**

```bash
git add docs/TASKS.md
git commit -m "docs: mark datetime-picker/bottom-sheet unification verified"
```

(Only run this if Step 3 actually made a change.)

---

## Summary of Acceptance Criteria Coverage

| Spec Acceptance Criterion | Covered by |
|---|---|
| 1. No overflow at 390px on "Nuevo evento" | Task 9 Step 4, Task 11 Step 1.1 |
| 2. No native date/datetime-local input in DOM | Task 8 Step 4, Task 9 Step 4, Task 11 Step 1.7 |
| 3. TimeWheel never opens native keyboard | Task 9 Step 4, Task 11 Step 1.1 |
| 4. Dialog vs Sheet bottom-sheet identical | Task 4, Task 11 Step 1.4 |
| 5. Zero diff on the 5 consumer files | Task 10 Step 3 |
| 6. EventFormModal edit mode preselects correctly | Task 9 Step 4 |
| 7. `pnpm build` passes | Task 10 Step 1 |
