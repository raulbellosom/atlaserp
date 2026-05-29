# Atlas Calendar — Design Spec

**Date:** 2026-05-29
**Module:** `atlas.calendar`
**Status:** Approved

## 1. Context

Atlas ERP necesita un módulo de calendario central que funcione como infraestructura compartida para todos los módulos del sistema. Actualmente no existe ningún módulo de agenda/calendario; los eventos relacionados con entidades (mantenimientos de flota, vacaciones de RRHH, vencimientos de documentos) no tienen un lugar centralizado donde visualizarse ni gestionarse.

`atlas.calendar` es el séptimo módulo core del sistema. Su doble propósito:
1. Ofrecer una experiencia de calendario completa al usuario final (CRUD de calendarios y eventos, vistas Day/Week/Month/Agenda, compartición entre usuarios).
2. Exponer contratos de servicio (`calendar.createEvent`, `calendar.getEvents`) para que otros módulos puedan crear y leer eventos con contexto de entidad origen (`source_module` + `source_entity_id`).

Sigue el mismo patrón arquitectónico que `atlas.hr` y `atlas.contacts`: modelos Prisma, rutas Hono dedicadas, y componentes React a medida — sin usar el blueprint renderer de AME3 porque las vistas de calendario son fundamentalmente diferentes a las vistas CRUD genéricas.

---

## 2. Alcance

### Incluido

- CRUD de calendarios por usuario (nombre, color, calendario por defecto)
- Compartición de calendarios entre usuarios con 3 niveles de rol: `VIEWER`, `EDITOR`, `MANAGER`
- CRUD de eventos con campos completos: título, descripción, inicio/fin, todo el día, ubicación, URL de videollamada, color, recurrencia básica, adjuntos (via `atlas.files`), invitados por evento
- Recurrencia básica: diaria, semanal, mensual — expansión on-the-fly en el API, sin persistir instancias
- Invitados a eventos individuales con estados: `PENDING`, `ACCEPTED`, `DECLINED`
- Recordatorios in-app configurables por evento (N minutos antes)
- Notificaciones in-app — badge en navegación, marcado como leído
- 4 vistas: Día, Semana, Mes, Agenda (scroll infinito semana a semana)
- Sidebar izquierdo: mini calendario + lista de calendarios con filtros por checkbox
- Sidebar derecho colapsable: resumen del día seleccionado
- Contrato `exposes` para que otros módulos creen/lean eventos enlazados a entidades origen
- Polling de notificaciones cada 60 segundos en el frontend
- Creación automática del calendario default al primer acceso del usuario al módulo

### Excluido

- Notificaciones por correo electrónico (se implementará cuando esté disponible SMTP)
- Recurrencia con excepciones por instancia (ej. editar un solo evento de una serie)
- Integración con calendarios externos (Google Calendar, Outlook)
- Vista de múltiples usuarios simultáneos (tipo "agenda de equipo")
- Calendarios de empresa visibles automáticamente para todos los miembros

---

## 3. Arquitectura

### Identidad del módulo

```
key:           atlas.calendar
core:          true
uninstallable: false
kind:          CORE
version:       0.1.0
depends on:    atlas.core, atlas.identity
consumes opt:  atlas.files
exposes:       calendar.createEvent, calendar.getEvents
```

### Estructura de archivos

```
apps/api/src/routes/calendar/
  calendar-routes.js          ← rutas Hono (delgadas)
  calendar-service.js         ← lógica de calendarios y shares
  calendar-event-service.js   ← lógica de eventos, expansión de recurrencia
  calendar-notification-service.js  ← lógica de recordatorios y notificaciones
  __tests__/
    calendar-service.test.js

apps/desktop/src/modules/atlas.calendar/
  CalendarScreen.jsx
  components/
    CalendarToolbar.jsx
    CalendarLeftSidebar.jsx
    CalendarRightSidebar.jsx
    MonthView.jsx
    WeekView.jsx
    DayView.jsx
    AgendaView.jsx
    EventChip.jsx
    EventFormModal.jsx
    EventDetailModal.jsx
    CalendarFormModal.jsx
    CalendarShareModal.jsx

apps/api/src/manifests/official/core-modules.js   ← agregar atlas.calendar
prisma/schema.prisma                               ← agregar 6 modelos
prisma/migrations/YYYYMMDD_add_atlas_calendar/    ← nueva migración forward
```

---

## 4. Modelo de datos (Prisma)

```prisma
model CalendarCalendar {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  owner_id   String   @db.Uuid
  name       String
  color      String   @default("#6B46C1")
  is_default Boolean  @default(false)
  enabled    Boolean  @default(true)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  owner   UserProfile              @relation(fields: [owner_id], references: [id])
  shares  CalendarShare[]
  events  CalendarEvent[]

  @@map("calendar_calendar")
}

model CalendarShare {
  id          String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  calendar_id String   @db.Uuid
  user_id     String   @db.Uuid
  role        CalendarShareRole @default(VIEWER)
  created_at  DateTime @default(now())

  calendar CalendarCalendar @relation(fields: [calendar_id], references: [id], onDelete: Cascade)
  user     UserProfile      @relation(fields: [user_id], references: [id])

  @@unique([calendar_id, user_id])
  @@map("calendar_share")
}

model CalendarEvent {
  id               String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  calendar_id      String    @db.Uuid
  title            String
  description      String?
  start_at         DateTime
  end_at           DateTime?
  all_day          Boolean   @default(false)
  location         String?
  video_url        String?
  color            String?
  recurrence_rule  Json?
  source_module    String?
  source_entity_id String?   @db.Uuid
  enabled          Boolean   @default(true)
  created_at       DateTime  @default(now())
  updated_at       DateTime  @updatedAt

  calendar  CalendarCalendar        @relation(fields: [calendar_id], references: [id], onDelete: Cascade)
  attendees     CalendarEventAttendee[]
  reminders     CalendarReminder[]
  notifications CalendarNotification[]
  files         CalendarEventFile[]

  @@map("calendar_event")
}

model CalendarEventFile {
  id             String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  event_id       String   @db.Uuid
  file_asset_id  String   @db.Uuid
  created_at     DateTime @default(now())

  event      CalendarEvent @relation(fields: [event_id], references: [id], onDelete: Cascade)
  file_asset FileAsset     @relation(fields: [file_asset_id], references: [id])

  @@unique([event_id, file_asset_id])
  @@map("calendar_event_file")
}

model CalendarEventAttendee {
  id         String                @id @default(dbgenerated("uuidv7()")) @db.Uuid
  event_id   String                @db.Uuid
  user_id    String                @db.Uuid
  status     CalendarAttendeeStatus @default(PENDING)
  created_at DateTime              @default(now())

  event CalendarEvent @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  UserProfile   @relation(fields: [user_id], references: [id])

  @@unique([event_id, user_id])
  @@map("calendar_event_attendee")
}

model CalendarReminder {
  id             String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  event_id       String    @db.Uuid
  user_id        String    @db.Uuid
  minutes_before Int
  sent_at        DateTime?
  created_at     DateTime  @default(now())

  event CalendarEvent @relation(fields: [event_id], references: [id], onDelete: Cascade)
  user  UserProfile   @relation(fields: [user_id], references: [id])

  @@unique([event_id, user_id, minutes_before])
  @@map("calendar_reminder")
}

model CalendarNotification {
  id         String    @id @default(dbgenerated("uuidv7()")) @db.Uuid
  user_id    String    @db.Uuid
  event_id   String    @db.Uuid
  type       String    @default("REMINDER")
  read_at    DateTime?
  created_at DateTime  @default(now())

  user  UserProfile   @relation(fields: [user_id], references: [id])
  event CalendarEvent @relation(fields: [event_id], references: [id], onDelete: Cascade)

  @@map("calendar_notification")
}

enum CalendarShareRole {
  VIEWER
  EDITOR
  MANAGER
}

enum CalendarAttendeeStatus {
  PENDING
  ACCEPTED
  DECLINED
}
```

---

## 5. Contrato API

Todas las rutas requieren autenticación. El `user_id` se extrae del JWT.

### Calendarios

```
GET    /calendar/calendars
       → calendarios propios + compartidos conmigo (con rol)

POST   /calendar/calendars
       body: { name, color? }
       → calendario creado

PATCH  /calendar/calendars/:id
       body: { name?, color? }
       → solo el propietario puede editar

DELETE /calendar/calendars/:id
       → soft delete (enabled=false), cascada en eventos/shares/reminders/notifications

POST   /calendar/calendars/:id/share
       body: { user_id, role: VIEWER|EDITOR|MANAGER }
       → solo el propietario puede invitar

PATCH  /calendar/calendars/:id/share/:shareId
       body: { role }
       → cambiar rol de un invitado

DELETE /calendar/calendars/:id/share/:shareId
       → revocar acceso
```

### Eventos

```
GET    /calendar/events
       query: start (ISO), end (ISO), calendar_ids[] (opcional, filtra)
       → eventos del rango; incluye instancias expandidas de recurrentes

POST   /calendar/events
       body: { calendar_id, title, description?, start_at, end_at?,
               all_day?, location?, video_url?, color?,
               recurrence_rule?, source_module?, source_entity_id?,
               attendee_ids[]?, reminder_minutes[]? }

GET    /calendar/events/:id
       → evento completo con attendees y reminders

PATCH  /calendar/events/:id
       body: campos editables (mismo contrato que POST, todos opcionales)
       → requiere ser propietario del calendario o tener rol EDITOR/MANAGER

DELETE /calendar/events/:id
       → soft delete; requiere propietario del calendario o MANAGER

POST   /calendar/events/:id/attendees
       body: { user_id }
       → solo el creador del evento o MANAGER del calendario

PATCH  /calendar/events/:id/attendees/:attendeeId
       body: { status: ACCEPTED|DECLINED }
       → solo el propio attendee puede cambiar su estado

POST   /calendar/events/:id/reminders
       body: { minutes_before }
       → recordatorio personal para el usuario autenticado

DELETE /calendar/events/:id/reminders/:reminderId
```

### Notificaciones

```
GET    /calendar/notifications
       query: unread_only? (default true)
       → notificaciones del usuario autenticado

PATCH  /calendar/notifications/:id/read
       → marcar leída

PATCH  /calendar/notifications/read-all
       → marcar todas como leídas
```

### Contrato de módulos externos

Otros módulos consumen el API estándar de eventos con campos extra:

```
POST /calendar/events
{
  "calendar_id": "<calendar del usuario o uno compartido con MANAGER>",
  "title": "Mantenimiento preventivo - ABC123",
  "start_at": "2026-06-15T09:00:00Z",
  "end_at": "2026-06-15T11:00:00Z",
  "source_module": "custom.fleet",
  "source_entity_id": "<vehicle_id>"
}

GET /calendar/events?source_module=custom.fleet&source_entity_id=<vehicle_id>
→ todos los eventos enlazados a esa entidad
```

---

## 6. Permisos RBAC

```js
permissions: [
  { key: 'calendar.access',             name: 'Acceso al calendario' },
  { key: 'calendar.calendars.read',     name: 'Ver calendarios' },
  { key: 'calendar.calendars.create',   name: 'Crear calendarios' },
  { key: 'calendar.calendars.update',   name: 'Editar calendarios' },
  { key: 'calendar.calendars.delete',   name: 'Eliminar calendarios' },
  { key: 'calendar.events.read',        name: 'Ver eventos' },
  { key: 'calendar.events.create',      name: 'Crear eventos' },
  { key: 'calendar.events.update',      name: 'Editar eventos' },
  { key: 'calendar.events.delete',      name: 'Eliminar eventos' },
  { key: 'calendar.share.manage',       name: 'Gestionar accesos compartidos' },
]
```

**Dos capas de control de acceso:**

1. **RBAC de módulo** — controla si el usuario puede entrar al módulo y usar cada operación (gestionado por roles del sistema).
2. **Rol de calendario** — controla qué puede hacer el usuario dentro de un calendario ajeno:
   - `VIEWER` — solo leer eventos
   - `EDITOR` — leer + editar eventos existentes
   - `MANAGER` — leer + crear + editar + eliminar eventos

El propietario del calendario siempre tiene control total. Un usuario con rol `MANAGER` en un calendario ajeno no puede invitar a otros ni cambiar roles — eso es exclusivo del propietario.

---

## 7. UI — Pantallas y componentes

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [≡] Sidebar   Mayo 2026 ▾   [Hoy] [Día] [Semana] [Mes] [Agenda]  [+ Nuevo] │
├────────────┬────────────────────────────────────┬────────────┤
│            │                                    │            │
│ Left       │                                    │ Right      │
│ Sidebar    │        Vista principal              │ Sidebar    │
│ (colaps.)  │    (MonthView / WeekView /          │ (colaps.)  │
│            │     DayView / AgendaView)           │            │
│ MiniCal    │                                    │ Resumen    │
│ ────────── │                                    │ día sel.   │
│ Mis cals   │                                    │            │
│ ☑ Cal 1   │                                    │ Lista de   │
│ ☑ Cal 2   │                                    │ eventos    │
│ ────────── │                                    │ del día    │
│ Compartidos│                                    │            │
│ ☑ Cal X   │                                    │ [+ Crear   │
│            │                                    │  evento]   │
└────────────┴────────────────────────────────────┴────────────┘
```

### Componentes

| Componente | Responsabilidad |
|---|---|
| `CalendarScreen.jsx` | Layout root. Estado: vista activa, día seleccionado, sidebars open/close, calendarios activos (filtros). |
| `CalendarToolbar.jsx` | Navegación de fecha (prev/next/hoy), selector de vista, botón "+ Nuevo". |
| `CalendarLeftSidebar.jsx` | Mini calendario (mes). Lista de calendarios propios y compartidos con checkbox de visibilidad. Botón "Nuevo calendario". |
| `CalendarRightSidebar.jsx` | Fecha y hora actual. Lista de eventos del día seleccionado. Botón "+ Crear evento". |
| `MonthView.jsx` | Grid 7×6. Cada celda muestra hasta 3 eventos como `EventChip`; si hay más, muestra "+ N más" que abre detalle. |
| `WeekView.jsx` | Grid 7 columnas × 24 filas horarias. Eventos posicionados por hora. Franja superior para eventos de todo el día. |
| `DayView.jsx` | Una columna × 24 filas horarias. Misma lógica que WeekView. |
| `AgendaView.jsx` | Lista cronológica agrupada por día. Scroll infinito: carga la semana siguiente al llegar al final. Sin eventos = muestra mensaje "Sin eventos esta semana". |
| `EventChip.jsx` | Píldora de evento reutilizable: color del calendario, título truncado. Clic → abre `EventDetailModal`. |
| `EventFormModal.jsx` | Modal crear/editar. Campos: título*, descripción, inicio*, fin, todo el día, calendario*, color, ubicación, URL videollamada, recurrencia (selector freq+interval+until), invitados (picker de usuarios), recordatorios (agregar N minutos antes), adjuntos (atlas.files picker). |
| `EventDetailModal.jsx` | Modal lectura de evento. Muestra todos los campos + estado de invitados. Acciones: editar (si tiene permiso), eliminar (si tiene permiso), cambiar mi estado RSVP. |
| `CalendarFormModal.jsx` | Modal crear/editar calendario: nombre + color picker. |
| `CalendarShareModal.jsx` | Modal gestión de accesos: lista de invitados actuales con su rol, cambiar rol, revocar, agregar nuevo invitado via picker de usuarios. |

### Estado

- **TanStack Query**: `useCalendars`, `useCalendarEvents({ start, end, calendarIds })`, `useCalendarNotifications`
- **Zustand store** (`useCalendarStore`): `activeView`, `selectedDate`, `leftSidebarOpen`, `rightSidebarOpen`, `activeCalendarIds` (IDs de calendarios visibles)

---

## 8. Recurrencia

### Estructura de `recurrence_rule` (JSON)

```json
{
  "freq": "DAILY" | "WEEKLY" | "MONTHLY",
  "interval": 1,
  "until": "2026-12-31",
  "count": 10
}
```

`until` y `count` son mutuamente excluyentes. Si ninguno está presente, la recurrencia es indefinida (el API limita la expansión al rango solicitado).

### Algoritmo de expansión (en `calendar-event-service.js`)

```
Para cada evento recurrente en DB:
  Si start_at <= rangeEnd Y (until >= rangeStart OR count no agotado):
    Calcular instancias en [rangeStart, rangeEnd]
    Para cada instancia: retornar objeto virtual con id = "<event_id>_<YYYYMMDD>"
```

Las instancias virtuales no se persisten. La edición de un evento recurrente edita la regla del evento base (no hay "editar solo esta instancia" en esta versión).

---

## 9. Notificaciones in-app

### Flujo

1. Al crear/editar un evento con `reminder_minutes`, se crea un `CalendarReminder` por cada valor con `sent_at = null`.
2. Un cron en el worker (o endpoint interno del API) se ejecuta cada minuto: `GET /calendar/internal/process-reminders`.
3. El procesador busca reminders donde `event.start_at - minutes_before <= NOW() AND sent_at IS NULL`.
4. Por cada reminder: crea `CalendarNotification`, actualiza `sent_at`.
5. El frontend hace polling a `GET /calendar/notifications?unread_only=true` cada 60 segundos.
6. Si hay notificaciones no leídas, muestra un badge numérico en el ítem de navegación del calendario.

### Estructura de notificación mostrada

```
[Icono calendario] "Evento próximo: {event.title}"
                   "En {minutes_before} minutos — {event.start_at formatted}"
                   [Marcar como leída] [Ver evento]
```

---

## 10. Integración con atlas.files

Los adjuntos de eventos usan el mismo sistema de `FileAsset` que el resto del sistema:

- `EventFormModal` incluye un componente picker/uploader de archivos
- Los archivos se suben a través del endpoint existente `POST /files`
- La relación se almacena en la tabla `CalendarEventFile` (join table entre `CalendarEvent` y `FileAsset`) — mismo patrón que otras entidades del sistema
- Solo el creador del evento o usuarios con rol MANAGER en el calendario pueden agregar/quitar adjuntos
- Los IDs de archivos adjuntos se retornan en `GET /calendar/events/:id` como array `files: [{ id, name, url }]`

---

## 11. Manifesto oficial

```js
// apps/api/src/manifests/official/core-modules.js
{
  key: 'atlas.calendar',
  name: 'Calendario',
  version: '0.1.0',
  kind: 'CORE',
  core: true,
  uninstallable: false,
  dependencies: ['atlas.core', 'atlas.identity'],
  navigation: [
    {
      path: '/calendar',
      label: 'Calendario',
      icon: 'Calendar',
      permissionKey: 'calendar.access',
    }
  ],
  permissions: [
    { key: 'calendar.access',           name: 'Acceso al calendario' },
    { key: 'calendar.calendars.read',   name: 'Ver calendarios' },
    { key: 'calendar.calendars.create', name: 'Crear calendarios' },
    { key: 'calendar.calendars.update', name: 'Editar calendarios' },
    { key: 'calendar.calendars.delete', name: 'Eliminar calendarios' },
    { key: 'calendar.events.read',      name: 'Ver eventos' },
    { key: 'calendar.events.create',    name: 'Crear eventos' },
    { key: 'calendar.events.update',    name: 'Editar eventos' },
    { key: 'calendar.events.delete',    name: 'Eliminar eventos' },
    { key: 'calendar.share.manage',     name: 'Gestionar accesos compartidos' },
  ],
  exposes: ['calendar.createEvent', 'calendar.getEvents'],
  consumes: ['atlas.files'],
}
```

---

## 12. Edge cases

| Caso | Comportamiento |
|---|---|
| Primer acceso del usuario al módulo | Se crea automáticamente un `CalendarCalendar` con `is_default=true` y nombre "Mi calendario" |
| Evento sin `end_at` | Se trata como evento de 1 hora de duración |
| `all_day: true` | `end_at` se ignora para visualización; el evento aparece en la franja "todo el día" de Week/Day, y ocupa toda la celda en Month |
| Eliminar calendario con eventos | Cascade: eventos → attendees, reminders, notifications se eliminan en cascada |
| Usuario invitado a calendario del usuario inactivo | El calendario sigue visible para los invitados existentes |
| `MANAGER` de calendario ajeno intenta invitar a otro usuario | API retorna 403 — solo el propietario puede gestionar shares |
| Recurrencia sin `until` ni `count` | El API expande hasta el `end` del rango solicitado, máximo 365 instancias por request |
| Dos recordatorios iguales en el mismo evento/usuario | Constraint unique `[event_id, user_id, minutes_before]` retorna 409 |
| Evento de módulo externo con `source_entity_id` inexistente | El API acepta el evento sin validar la existencia de la entidad origen — validación es responsabilidad del módulo consumidor |

---

## 13. Criterios de aceptación

1. Usuario puede crear, editar y eliminar calendarios propios con nombre y color.
2. Usuario puede invitar a otro usuario a su calendario con rol VIEWER, EDITOR o MANAGER; los permisos se aplican correctamente.
3. Los 4 modos de vista (Día, Semana, Mes, Agenda) muestran los eventos correctamente.
4. La vista Agenda carga semana por semana al hacer scroll (scroll infinito).
5. Sidebars izquierdo y derecho son colapsables de forma independiente.
6. Filtrar calendarios por checkbox en el sidebar oculta/muestra sus eventos en todas las vistas.
7. Eventos con `recurrence_rule` aparecen en múltiples fechas; no se crean registros duplicados en DB.
8. Un recordatorio in-app llega dentro de los 60 segundos del umbral configurado (`minutes_before`).
9. El badge de notificaciones en la navegación se actualiza con el conteo de no leídas.
10. Un módulo externo (`custom.fleet` u otro) puede crear un evento con `source_module` + `source_entity_id` y ese evento aparece en el calendario del usuario.
11. `GET /calendar/events?source_module=custom.fleet&source_entity_id=<id>` retorna solo los eventos enlazados.
12. Adjuntos de eventos funcionan vía `atlas.files`.
13. El calendario por defecto se crea automáticamente en el primer acceso del usuario.
14. La navegación principal muestra "Calendario" con el ícono correcto para usuarios con `calendar.access`.

---

## 14. Dependencias y riesgos

| Item | Detalle |
|---|---|
| `prisma/schema.prisma` | Requiere agregar 6 modelos + 2 enums + nueva migración forward |
| `UserProfile` relation | Los modelos referencian `UserProfile.id` — verificar que el campo es `@db.Uuid` y existe en el esquema actual |
| Worker/cron para reminders | Requiere endpoint interno o integración con `apps/worker/` para el procesado periódico de reminders |
| Tamaño de `CalendarScreen.jsx` | Pantalla compleja — debe dividirse en sub-componentes desde el inicio para no violar el límite de 1000 líneas |
| `atlas.files` adjuntos | Requiere verificar patrón de relación usado por `atlas.hr` para archivos de empleados antes de implementar |

---

## 15. Fuera de alcance (explícito)

- Notificaciones por email (SMTP pendiente)
- Edición de una sola instancia de evento recurrente
- Integración con Google Calendar / Outlook / CalDAV
- Vista de agenda de equipo (múltiples usuarios en paralelo)
- Calendarios de empresa automáticos para todos los miembros
- Campos de video integrados (Zoom/Meet embedding) — solo campo de URL
