# Calendar Grid Overflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estabilizar las vistas `semana`, `día` y `agenda` del calendario con truncado consistente y overflow `+N más` integrado al panel derecho.

**Architecture:** Extraer la lógica de overflow a helpers puros probables de testear, extender el store del calendario con foco horario opcional y actualizar las vistas para usar una capacidad visible fija por bloque. El panel derecho leerá ese foco para mostrar el bloque horario cuando aplique.

**Tech Stack:** React, Zustand persist, `node:test`, Tailwind CSS, `@tanstack/react-query`

---

### Task 1: Definir y probar la lógica de overflow

**Files:**
- Create: `apps/desktop/src/modules/atlas.calendar/lib/calendar-overflow.js`
- Create: `apps/desktop/src/modules/atlas.calendar/lib/__tests__/calendar-overflow.test.js`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  splitVisibleEvents,
  filterEventsForHour,
} from "../calendar-overflow.js";

test("splitVisibleEvents limits visible events and reports hidden count", () => {
  const events = [{ id: "1" }, { id: "2" }, { id: "3" }];
  const result = splitVisibleEvents(events, 2);
  assert.equal(result.visible.length, 2);
  assert.equal(result.hiddenCount, 1);
});

test("filterEventsForHour keeps only timed events for one local hour", () => {
  const events = [
    { id: "a", allDay: false, startAt: "2026-06-08T12:15:00.000Z" },
    { id: "b", allDay: true, startAt: "2026-06-08T00:00:00.000Z" },
  ];
  const result = filterEventsForHour(events, 12);
  assert.deepEqual(result.map((event) => event.id), ["a"]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/desktop/src/modules/atlas.calendar/lib/__tests__/calendar-overflow.test.js`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`

- [ ] **Step 3: Write minimal implementation**

```js
export function splitVisibleEvents(events, maxVisible = 2) {
  const safeEvents = Array.isArray(events) ? events : [];
  const limit = Math.max(0, Number(maxVisible) || 0);
  return {
    visible: safeEvents.slice(0, limit),
    hidden: safeEvents.slice(limit),
    hiddenCount: Math.max(0, safeEvents.length - limit),
  };
}

export function filterEventsForHour(events, hour) {
  return (Array.isArray(events) ? events : []).filter((event) => {
    if (event?.allDay) return false;
    return new Date(event.startAt).getHours() === hour;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.calendar/lib/__tests__/calendar-overflow.test.js`
Expected: PASS

---

### Task 2: Extender estado del calendario con foco horario

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js`

- [ ] **Step 1: Add focused slot state and actions**

Implement:
- `selectedSlotHour`
- `setSelectedDate(date)` limpiando `selectedSlotHour`
- `focusTimeSlot(date, hour)` seteando fecha, hora y `rightSidebarOpen: true`
- `clearSelectedSlot()`
- Navegación `prev/next/today` limpiando foco horario

- [ ] **Step 2: Keep persisted shape compatible**

Do not persist `selectedSlotHour`; keep it transient.

- [ ] **Step 3: Verify no syntax regressions**

Run: `node --check apps/desktop/src/modules/atlas.calendar/stores/useCalendarStore.js`
Expected: sin errores

---

### Task 3: Aplicar overflow estable a semana y día

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/DayView.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx`

- [ ] **Step 1: Consume overflow helpers**

Use `splitVisibleEvents()` y `filterEventsForHour()` en cada celda/bloque horario.

- [ ] **Step 2: Fix row heights**

Change:
- `WeekView` rows from variable minimum height to fixed height
- `DayView` rows from variable minimum height to fixed height

- [ ] **Step 3: Add +N more affordance**

Each overflow button must call `focusTimeSlot(dateKey, hour)`.

- [ ] **Step 4: Make compact EventChip truly compact**

Compact mode:
- one line only
- no reminder icon
- no repeated hour label

- [ ] **Step 5: Verify syntax**

Run:
- `node --check apps/desktop/src/modules/atlas.calendar/components/WeekView.jsx`
- `node --check apps/desktop/src/modules/atlas.calendar/components/DayView.jsx`
- `node --check apps/desktop/src/modules/atlas.calendar/components/EventChip.jsx`

Expected: sin errores

---

### Task 4: Sincronizar panel derecho y agenda

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarRightSidebar.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx`

- [ ] **Step 1: Right sidebar reads optional slot focus**

When `selectedSlotHour !== null`, filter day events to that hour and render subtitle `HH:00 - HH:59`.

- [ ] **Step 2: Agenda uses consistent truncation**

Keep list layout but ensure event rows stay compact and readable with long titles.

- [ ] **Step 3: Verify syntax**

Run:
- `node --check apps/desktop/src/modules/atlas.calendar/components/CalendarRightSidebar.jsx`
- `node --check apps/desktop/src/modules/atlas.calendar/components/AgendaView.jsx`

Expected: sin errores

---

### Task 5: Final verification

**Files:**
- Validate all changed files above

- [ ] **Step 1: Run focused tests**

Run: `node --test apps/desktop/src/modules/atlas.calendar/lib/__tests__/calendar-overflow.test.js`
Expected: PASS

- [ ] **Step 2: Run React review**

Run: `cmd /c npx -y react-doctor@latest . --verbose --diff`
Expected: puede reportar issues preexistentes, pero no introducir errores nuevos atribuibles al cambio

- [ ] **Step 3: Review diff**

Run: `git diff -- apps/desktop/src/modules/atlas.calendar`
Expected: solo cambios enfocados al overflow, panel derecho y helpers relacionados

---

**Execution note:** Este plan se ejecuta inline en la sesión actual. No incluye commits automáticos porque no fueron solicitados explícitamente.
