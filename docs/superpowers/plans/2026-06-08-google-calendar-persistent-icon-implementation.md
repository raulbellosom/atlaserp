# Google Calendar Persistent Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hacer que los calendarios internos creados desde Google Calendar persistan el icono `Google` y se rendericen con el logo de Google en `Mis calendarios`.

**Architecture:** El backend asignara `icon: 'Google'` solo en la creacion inicial del `calendar_calendar` interno desde `google-source-service`. El frontend seguira el flujo actual basado en `cal.icon`, agregando soporte visual para `Google` en el renderer de iconos del modulo calendario sin alterar calendarios no-Google.

**Tech Stack:** Node.js, Prisma, Hono, React, Lucide, node:test

---

## File Map

- `apps/api/src/routes/calendar/google/google-source-service.js` — crea o reutiliza calendarios internos derivados de Google.
- `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js` — cubre el comportamiento de creacion y reseleccion de sources Google.
- `apps/desktop/src/modules/atlas.calendar/calendarIcons.jsx` — resuelve iconos renderizables para calendarios del modulo.
- `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx` — ya consume `CalendarIcon`; no requiere cambios si el renderer soporta `Google`.

### Task 1: Persistir icono Google al crear calendarios internos

**Files:**
- Modify: `apps/api/src/routes/calendar/google/google-source-service.js`
- Test: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`

- [ ] **Step 1: Write the failing backend tests**

Agregar o ajustar asserts para cubrir dos comportamientos:

```js
assert.equal(createPayload.icon, 'Google')
assert.equal(result.items[0].atlasCalendarId, 'cal-existing')
```

Y para proteger iconos existentes en reseleccion:

```js
assert.equal(createCalls, 0)
assert.equal(result.items[0].syncStatus, 'ACTIVE')
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`
Expected: FAIL porque hoy el servicio crea el calendario con `icon: 'calendar'`.

- [ ] **Step 3: Write minimal backend implementation**

Cambiar la creacion del calendario interno en `saveSelectedSources` a:

```js
const atlasCalendar = await tx.calendarCalendar.create({
  data: {
    ownerId,
    name: normalizeCalendarName(calendar),
    color: calendar.backgroundColor ?? '#1a73e8',
    icon: 'Google',
  },
})
```

Mantener la regla actual: si `atlasCalendarId` ya existe, no recrear ni sobrescribir icono.

- [ ] **Step 4: Run backend test to verify it passes**

Run: `node --test apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`
Expected: PASS

### Task 2: Renderizar el icono Google en el sidebar

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/calendarIcons.jsx`

- [ ] **Step 1: Inspect current icon registry and add Google entry**

Agregar una entrada que renderice un logo simple de Google, por ejemplo:

```jsx
function GoogleCalendarMark({ size = 14, className }) {
  return (
    <svg viewBox="0 0 18 18" width={size} height={size} className={className} aria-hidden="true">
      <path d="M16.27 9.2c0-.58-.05-1.13-.15-1.66H9v3.14h4.08a3.5 3.5 0 0 1-1.52 2.3v1.91h2.46c1.44-1.33 2.25-3.3 2.25-5.69Z" fill="#4285F4" />
      <path d="M9 16.58c2.04 0 3.75-.67 5-1.82l-2.46-1.91c-.68.46-1.55.73-2.54.73-1.96 0-3.62-1.32-4.2-3.08H2.26v1.97A7.55 7.55 0 0 0 9 16.58Z" fill="#34A853" />
      <path d="M4.8 10.5A4.54 4.54 0 0 1 4.57 9c0-.52.08-1.01.23-1.5V5.53H2.26A7.57 7.57 0 0 0 1.42 9c0 1.2.29 2.33.84 3.47L4.8 10.5Z" fill="#FBBC05" />
      <path d="M9 4.42c1.1 0 2.09.38 2.87 1.12l2.15-2.15C12.74 2.18 11.04 1.42 9 1.42A7.55 7.55 0 0 0 2.26 5.53L4.8 7.5C5.38 5.74 7.04 4.42 9 4.42Z" fill="#EA4335" />
    </svg>
  )
}
```

Y resolverla cuando `name === 'Google'`.

- [ ] **Step 2: Verify no sidebar call sites need changes**

Confirmar que `CalendarLeftSidebar.jsx` ya hace:

```jsx
{cal.icon && (
  <CalendarIcon name={cal.icon} size={11} color={calColor} className="shrink-0" />
)}
```

No modificar el sidebar si el renderer ya soporta `Google`.

- [ ] **Step 3: Do a quick runtime sanity check**

Expected visual result: calendarios Google en `Mis calendarios` muestran logo Google en lugar del icono normal.

### Task 3: Verify end-to-end behavior

**Files:**
- Verify: `apps/api/src/routes/calendar/google/google-source-service.js`
- Verify: `apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js`
- Verify: `apps/desktop/src/modules/atlas.calendar/calendarIcons.jsx`

- [ ] **Step 1: Run focused backend tests**

Run: `node --test apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js apps/api/src/routes/calendar/__tests__/calendar-google-routes.test.js`
Expected: PASS

- [ ] **Step 2: Review diff for scope control**

Run: `git diff -- apps/api/src/routes/calendar/google/google-source-service.js apps/api/src/routes/calendar/__tests__/calendar-google-source-service.test.js apps/desktop/src/modules/atlas.calendar/calendarIcons.jsx`
Expected: solo cambios del icono persistente Google.

## Self-Review

- **Spec coverage:** backend persiste `Google`, frontend renderiza `Google`, reseleccion no pisa calendarios existentes.
- **Placeholder scan:** no hay TODOs ni pasos vagos.
- **Type consistency:** el valor persistido y renderizado es exactamente `Google`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-08-google-calendar-persistent-icon-implementation.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
