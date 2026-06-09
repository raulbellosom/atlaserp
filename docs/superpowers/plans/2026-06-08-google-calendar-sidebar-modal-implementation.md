# Google Calendar Sidebar Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir la integración de Google Calendar en un trigger compacto del sidebar que abra un modal único para conectar, administrar calendarios, revisar estados y desvincular la cuenta.

**Architecture:** El sidebar solo mostrará un trigger compacto con estado resumido. El diálogo actual se convertirá en un modal maestro que centraliza conexión OAuth, explicación funcional, selección de calendarios Google y acciones de administración. Los hooks existentes de React Query se reutilizan sin cambios backend.

**Tech Stack:** React, React Query, `@atlas/ui`, Lucide, Tailwind CSS

---

### Task 1: Compactar el trigger del sidebar

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`

- [ ] Mover la integración Google a la sección inferior `Integraciones`.
- [ ] Convertir `GoogleCalendarConnectionCard` en trigger compacto.
- [ ] Hacer que el botón principal abra el modal, no el flujo OAuth directo.

### Task 2: Convertir el diálogo actual en modal maestro

**Files:**
- Modify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`

- [ ] Añadir resumen de conexión y copy corto de capacidades.
- [ ] Mostrar acción `Conectar con Google` cuando no exista conexión.
- [ ] Mantener selección de calendarios, estados por source y guardado cuando exista conexión.
- [ ] Añadir acción de desconectar dentro del modal.

### Task 3: Verificación

**Files:**
- Verify: `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`
- Verify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarConnectionCard.jsx`
- Verify: `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`

- [ ] Ejecutar `cmd /c npx -y react-doctor@latest . --verbose --diff`
- [ ] Confirmar que no aparezcan hallazgos nuevos atribuibles a `atlas.calendar`

