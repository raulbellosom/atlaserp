# Google Calendar Persistent Icon Design

**Date:** 2026-06-08  
**Status:** Draft for review

## Goal

Distinguir visualmente en `Mis calendarios` los calendarios internos creados desde Google Calendar usando el logo de Google como icono persistente.

## Decision

Se adopta la **opcion A**:

- al crear un calendario interno desde un calendario de Google, Atlas guardara `icon: 'Google'` en el registro de `calendar_calendar`
- el icono quedara persistido en base de datos
- el sidebar seguira renderizando `cal.icon` mediante `CalendarIcon`
- `CalendarIcon` debera soportar el nombre `Google`

## Expected Behavior

1. Cuando el usuario selecciona un calendario Google nuevo para vincularlo, Atlas crea el calendario interno con:
   - `name` derivado del calendario Google
   - `color` derivado del calendario Google
   - `icon: 'Google'`
2. Ese calendario aparece en `Mis calendarios` con el logo de Google.
3. Si el calendario ya estaba vinculado previamente, Atlas reutiliza el calendario interno existente y no crea duplicados.
4. Si el usuario cambia manualmente el icono del calendario despues, Atlas no debe volver a imponer `Google` en reimportaciones posteriores.

## Technical Design

### Backend

Ajustar el servicio que guarda calendarios Google seleccionados para que, al crear un `calendar_calendar` interno nuevo, asigne `icon: 'Google'`.

Reglas:

- aplicar solo en creacion inicial del calendario interno
- no sobrescribir `icon` si el calendario interno ya existia
- no cambiar iconos en resincronizaciones o reselecciones posteriores

### Frontend

Agregar soporte visual para `Google` en el renderer de iconos del modulo calendario.

Reglas:

- `CalendarIcon` debe resolver `Google` a un logo simple de Google
- el icono debe convivir con el color del calendario sin romper el layout existente del sidebar
- no cambiar el comportamiento de calendarios no-Google

## Files Likely Affected

- `apps/api/src/routes/calendar/google/google-source-service.js`
- `apps/desktop/src/modules/atlas.calendar/calendarIcons.js`
- `apps/desktop/src/modules/atlas.calendar/components/CalendarLeftSidebar.jsx`

## Constraints

- no cambiar la semantica actual de vinculacion Google
- no introducir migraciones nuevas; el campo `icon` ya existe
- mantener compatibilidad con cualquier instancia desplegada por Docker que configure Google OAuth

## Testing

- backend: cubrir que calendarios internos creados desde Google reciben `icon: 'Google'`
- backend: cubrir que una reseleccion no sobrescribe el icono de un calendario ya existente
- frontend: validar render del icono `Google` en `Mis calendarios`

## Acceptance Criteria

- un calendario creado desde Google aparece con logo de Google en `Mis calendarios`
- calendarios no Google no cambian
- reseleccionar un calendario Google existente no duplica ni pisa un icono ya personalizado
