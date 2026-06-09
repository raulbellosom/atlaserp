# Google Calendar Phase 3B Initial Import Design

Fecha: 2026-06-08
Estado: Implementacion lista para ejecucion
Alcance: `atlas.calendar`

## 1. Objetivo

Implementar la importacion inicial de eventos desde Google Calendar hacia Atlas para cada `GoogleCalendarSource` seleccionado, creando eventos internos editables desde el inicio y manteniendo una vinculacion tecnica idempotente con Google.

Esta fase debe funcionar sobre la base ya implementada en Fase 3A:

- una cuenta Google por usuario Atlas
- seleccion persistente de calendarios Google
- un calendario Atlas interno por cada calendario Google seleccionado
- estado de conexion y desconexion

## 2. Alcance de esta fase

### 2.1 Incluye

- importacion inicial automatica al guardar calendarios Google seleccionados
- importacion por `GoogleCalendarSource`, no por usuario completo
- historial completo del calendario Google origen
- soporte desde el inicio para:
  - eventos simples
  - eventos recurrentes
  - instancias canceladas
- creacion de `GoogleCalendarEventLink`
- idempotencia al reintentar o repetir la importacion
- eventos Atlas editables desde el inicio
- preservacion de eventos desacoplados sin sobreescritura remota
- estado visible por source:
  - `PENDING_INITIAL_SYNC`
  - `SYNCING`
  - `ACTIVE`
  - `ERROR`

Checklist implementado:

- importacion inicial automatica al guardar sources
- `GoogleCalendarEventLink`
- idempotencia de reimportacion
- recurrentes e instancias canceladas
- desacople al editar localmente

### 2.2 No incluye

- sync incremental basada en `syncToken`
- job automatico recurrente
- endpoint manual `POST /calendar/google/sync`
- manejo de `410 Gone`
- resincronizacion completa posterior
- refresh token flow mas alla de lo ya implementado
- sync bidireccional Atlas -> Google

## 3. Decision principal

La importacion inicial se dispara automaticamente al guardar las fuentes Google en `POST /calendar/google/sources`.

El guardado de seleccion sigue siendo rapido, pero la importacion corre como trabajo inmediato por source dentro de la misma capacidad backend existente. La UI puede mostrar progreso inicial y despues dejar que el proceso siga en segundo plano consultando estado por source.

La unidad de ejecucion es el `GoogleCalendarSource`. Esto evita que un calendario Google grande bloquee o invalide la importacion de otros calendarios del mismo usuario.

## 4. Arquitectura

### 4.1 Capas nuevas o extendidas

- **Cliente Google de eventos**
  - responsable de listar eventos de un calendario Google con paginacion
- **Servicio de importacion inicial**
  - orquesta la importacion de un source
  - actualiza `syncStatus`, errores y timestamps
- **Servicio de persistencia idempotente**
  - transforma evento Google -> `CalendarEvent` + `GoogleCalendarEventLink`
  - evita duplicados
- **Extension del flujo de actualizacion local**
  - marca `isDetached = true` cuando un evento importado se modifica localmente

### 4.2 Integracion con Fase 3A

`POST /calendar/google/sources` ya persiste los `GoogleCalendarSource`. En esta fase:

- sources nuevos o reactivados quedan en `PENDING_INITIAL_SYNC`
- al terminar el guardado se dispara la importacion inicial de esos sources
- `GET /calendar/google/sources` expone estado actualizado de importacion

No se agregan nuevos endpoints en esta fase.

## 5. Modelo de datos

### 5.1 `GoogleCalendarSource`

Se reutiliza el modelo existente de Fase 3A.

Campos con uso operativo real en 3B:

- `syncStatus`
- `lastFullSyncAt`
- `lastErrorAt`
- `lastErrorMessage`
- `enabled`

Campo reservado pero no operativo en esta fase:

- `syncToken`

### 5.2 Nuevo modelo `GoogleCalendarEventLink`

Se agrega una entidad tecnica para mapear un evento Google a un evento Atlas.

Campos:

- `id`
- `sourceId`
- `atlasEventId`
- `googleEventId`
- `googleICalUID`
- `googleRecurringEventId`
- `googleOriginalStartAt`
- `googleUpdatedAt`
- `googleStatus`
- `isDetached`
- `detachedAt`
- `cancelledInGoogleAt`
- `lastSeenAt`
- `rawSnapshot`
- `createdAt`
- `updatedAt`

Relaciones:

- `sourceId -> GoogleCalendarSource.id`
- `atlasEventId -> CalendarEvent.id`

Indices y unicidad:

- unico por `sourceId + googleEventId`
- indice por `sourceId`
- indice por `atlasEventId`
- indice compuesto por `sourceId + googleRecurringEventId + googleOriginalStartAt`

La unicidad canonica sigue siendo `sourceId + googleEventId`, pero el indice recurrente soporta busqueda segura de ocurrencias y diagnostico.

## 6. Reglas de identidad

### 6.1 Evento simple

La identidad remota de un evento simple es:

- `sourceId + googleEventId`

### 6.2 Evento recurrente u ocurrencia

Ademas de `googleEventId`, se persiste:

- `googleRecurringEventId`
- `googleOriginalStartAt`

Esto permite conservar suficiente metadata para:

- distinguir ocurrencias
- preservar instancias canceladas
- preparar la futura fase incremental

## 7. Flujo de importacion inicial

### 7.1 Disparo

Cuando el usuario guarda la seleccion de Google calendars:

1. se persisten/actualizan `GoogleCalendarSource`
2. cada source nuevo o reactivado queda en `PENDING_INITIAL_SYNC`
3. se dispara importacion inicial para esos sources

Sources ya activos y sin cambios no vuelven a disparar importacion completa en esta fase.

### 7.2 Proceso por source

Para cada source:

1. cambiar `syncStatus` a `SYNCING`
2. limpiar `lastErrorAt` y `lastErrorMessage`
3. leer eventos del calendario Google con paginacion completa
4. procesar cada evento con persistencia idempotente
5. al completar:
   - `syncStatus = ACTIVE`
   - `lastFullSyncAt = now()`
6. si falla:
   - `syncStatus = ERROR`
   - guardar `lastErrorAt`
   - guardar `lastErrorMessage`

Si un source falla, los demas no deben revertirse ni bloquearse.

### 7.3 Paginacion

La lectura de eventos desde Google debe consumir todas las paginas del calendario origen durante la importacion inicial.

No se introduce `syncToken` en este flujo. Toda la importacion es full scan del historial disponible para ese calendario.

## 8. Persistencia idempotente

### 8.1 Si el link no existe

Si no existe `GoogleCalendarEventLink`:

- crear `CalendarEvent`
- crear `GoogleCalendarEventLink`

### 8.2 Si el link existe y no esta desacoplado

Si existe el link y `isDetached = false`:

- actualizar el mismo `CalendarEvent`
- actualizar metadata del link

### 8.3 Si el link existe y esta desacoplado

Si existe el link y `isDetached = true`:

- no sobrescribir el `CalendarEvent`
- actualizar solo metadata tecnica minima del link si aplica
- preservar la version local Atlas

### 8.4 Repeticion segura

Ejecutar dos veces la misma importacion no debe crear duplicados. La fuente de verdad para saber si un evento ya fue importado es `GoogleCalendarEventLink`, no comparaciones por titulo o fechas.

## 9. Mapeo Google -> Atlas

### 9.1 Creacion de eventos Atlas

Los eventos importados se crean como `CalendarEvent` normales del calendario Atlas asociado al source.

Deben quedar editables desde el inicio.

Campos funcionales minimos a mapear:

- titulo
- descripcion
- ubicacion
- fecha/hora inicio
- fecha/hora fin
- `allDay`
- estado si el modelo actual ya lo soporta de forma compatible

### 9.2 Eventos cancelados

Los eventos o instancias canceladas en Google no se borran del historial Atlas.

Regla:

- conservar link tecnico
- marcar `cancelledInGoogleAt`
- conservar suficiente metadata para que futuras syncs no los recreen mal

En esta fase no se redefine toda la UX de “eliminado en Google”; el minimo obligatorio es conservar consistencia tecnica e historica.

## 10. Desacople local

Cuando un usuario edita localmente un evento importado:

- `GoogleCalendarEventLink.isDetached = true`
- `detachedAt = now()`

Una vez desacoplado:

- futuras reimportaciones no deben sobrescribir el evento Atlas

Esta logica debe aplicarse en los flujos normales de actualizacion del evento, no como proceso aparte.

## 11. UX esperada

### 11.1 Al guardar seleccion

- el usuario guarda la seleccion de calendarios Google
- la importacion arranca automaticamente
- la UI puede esperar el arranque y mostrar estado inicial
- si tarda, el usuario puede continuar y dejar el proceso en segundo plano

### 11.2 Estado visible

`GET /calendar/google/sources` debe devolver suficiente informacion para mostrar:

- `Pendiente`
- `Sincronizando`
- `Sincronizado`
- `Error`

### 11.3 Eventos importados

Los eventos importados deben verse como eventos normales en Atlas y mostrar badge u origen `Google` donde la UI ya tenga soporte para ello o donde sea trivial agregarlo sin desbordar el alcance.

## 12. API

### 12.1 `POST /calendar/google/sources`

Se extiende semanticamente:

- sigue guardando seleccion
- ademas dispara importacion inicial para sources nuevos o reactivados

Respuesta esperada:

- items persistidos
- estado inicial coherente por source

No debe bloquear toda la experiencia por tiempo indefinido. Si algun source sigue procesando, la UI lo resolvera consultando `GET /calendar/google/sources`.

### 12.2 `GET /calendar/google/sources`

Se mantiene y pasa a ser endpoint de observacion del estado de importacion.

Debe devolver por item al menos:

- identificadores
- nombre del calendario Google
- `atlasCalendarId`
- `syncStatus`
- `lastFullSyncAt`
- `lastErrorAt`
- `lastErrorMessage`
- `enabled`

## 13. Testing requerido

### 13.1 Backend

- crea `CalendarEvent` + `GoogleCalendarEventLink` en primera importacion
- reimporta sin duplicados
- actualiza evento ya vinculado cuando `isDetached = false`
- no sobrescribe evento cuando `isDetached = true`
- importa eventos recurrentes
- preserva instancias canceladas
- marca `GoogleCalendarSource` en `ERROR` cuando una importacion falla
- no tumba otros sources si uno falla

### 13.2 Integracion de rutas

- `POST /calendar/google/sources` dispara guardado + importacion inicial
- `GET /calendar/google/sources` refleja estados de sync

### 13.3 Frontend

- el picker/connection card refleja estados de source
- el usuario puede salir mientras la importacion sigue
- los eventos importados aparecen en el calendario Atlas asociado

## 14. Riesgos y decisiones

### 14.1 Tiempo de ejecucion

Riesgo:

- algunos calendarios pueden tener mucho historial

Decision:

- procesar por source
- responder con estado observable
- permitir continuidad de UX en segundo plano

### 14.2 Recurrentes

Riesgo:

- las recurrencias son el punto mas sensible de consistencia

Decision:

- incluir recurrentes e instancias canceladas desde esta fase
- persistir metadata externa suficiente en `GoogleCalendarEventLink`

### 14.3 Alcance

Riesgo:

- intentar resolver incremental sync en la misma fase

Decision:

- 3B pequena se limita a importacion inicial idempotente
- incremental, `syncToken`, `410 Gone` y jobs recurrentes van a la siguiente fase

## 15. Criterios de aceptacion

- Al guardar calendarios Google seleccionados, Atlas dispara importacion inicial automaticamente.
- Cada `GoogleCalendarSource` refleja su estado individual de importacion.
- La importacion completa no duplica eventos si se reintenta.
- Los eventos importados quedan editables desde el inicio.
- Si un evento importado se modifica localmente, queda desacoplado y no se sobreescribe en reimportaciones.
- Recurrentes e instancias canceladas se preservan desde esta fase.
- Si un source falla, queda en `ERROR` sin romper los otros.
