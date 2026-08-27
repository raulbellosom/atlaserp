# Conectores de Chat: Proyectos y Calendario — Design Spec

**Date:** 2026-08-27
**Módulo:** `atlas.chat` (extensión — consume `atlas.projects` y `atlas.calendar`)
**Status:** Approved

## 1. Context

`atlas.chat` ya soporta un patrón de "conector" a nivel de mensaje: `entityRefs`, una lista de hasta 5 referencias `{ entityType, recordId }` adjuntas a un mensaje, resueltas en el backend a `{ title, subtitle, url, ... }` y renderizadas como tarjetas clicables. Hoy soporta 4 tipos: `contact`, `file`, `ledger_account`, `hr_employee`.

`atlas.projects` (Kanban/List/Timeline de proyectos y tareas) y `atlas.calendar` (calendario + sync Google) están **completos y en producción** — no son manifiestos vacíos, tienen rutas, servicios y pantallas propias. Este spec no crea ninguno de los dos módulos: extiende el conector de chat para que ambos participen en él, en dos frentes:

1. **Menciones por mensaje** — añadir `project`, `task` y `calendar_event` al enum `entityType` existente, siguiendo exactamente el mismo patrón que los 4 tipos actuales.
2. **Vínculo a nivel de canal** (nuevo, no existe hoy) — un canal de chat puede generarse desde un proyecto, o vincularse a uno ya existente; y un canal puede tener reuniones de `atlas.calendar` agendadas directamente desde él.

Este es el **Spec A** de dos specs relacionados. El **Spec B** (`2026-08-27-atlas-calls-livekit-design.md`) diseña la infraestructura de llamadas de voz/video que en el futuro se disparará desde una reunión agendada aquí — pero ese spec es de implementación diferida. Este spec (A) es 100% implementable ahora y **no añade ninguna UI de llamadas** (ni botones deshabilitados ni placeholders "próximamente"), para no dejar trabajo a medio terminar.

---

## 2. Alcance

### Incluido

- 3 nuevos `entityType`: `project`, `task`, `calendar_event` — picker, tarjeta, resolución backend.
- Vínculo 1:1 canal↔proyecto vía columnas genéricas `linked_module`/`linked_entity_id` en `chat_conversations`.
- Crear canal desde el detalle de un proyecto (snapshot de `ProjectMember` como miembros iniciales).
- Vincular/desvincular un canal existente a un proyecto desde la configuración del canal.
- Agendar una reunión desde una conversación (reusa `EventFormModal` de `atlas.calendar`, pre-rellena asistentes con los miembros de la conversación, guarda `sourceModule: "atlas.chat"` + `sourceEntityId: conversationId` en `CalendarEvent` — campos que **ya existen** y que `atlas.projects` ya usa para el mismo propósito).
- Panel "Próximos eventos" dentro de un canal, listando `CalendarEvent` filtrados por ese mismo origen.

### Excluido (explícito)

- Sincronización continua de miembros proyecto→canal (solo snapshot al vincular).
- Múltiples canales por proyecto (limitado a 1:1 por diseño).
- Cualquier UI o lógica de llamadas de voz/video — ver Spec B.
- Acciones rápidas sobre tareas desde el mensaje (ej. marcar completada) — la mención solo navega al detalle, igual que hoy hacen `contact`/`file`/`hr_employee`.
- Añadir asistentes del evento que no sean miembros del canal a la conversación automáticamente (si se necesita, es un spec aparte).

---

## 3. Arquitectura

### Principio de diseño

Reutilizar mecanismos ya existentes en vez de inventar nuevos:

- `CalendarEvent.sourceModule` / `sourceEntityId` (con índice `@@index([sourceModule, sourceEntityId])`) ya existen y `atlas.projects` (`projects-calendar-bridge.js`) ya los usa para vincular tareas a eventos. El conector de Calendario los reutiliza tal cual con `sourceModule: "atlas.chat"`.
- `calendar-event-service.js` (`listEvents`, `createEvent`) ya acepta `sourceModule`/`sourceEntityId` end-to-end — no requiere cambios de servicio, solo de UI/wiring.
- El vínculo canal↔proyecto es la única pieza genuinamente nueva: `chat_conversations` es una tabla raw-SQL (no modelada en Prisma; todo el módulo chat accede vía `prisma.$queryRaw`), así que necesita su propia migración SQL — se diseña con el mismo patrón genérico `linked_module`/`linked_entity_id` en vez de una columna `project_id` específica, para poder soportar futuros conectores de canal sin otra migración.

### Archivos afectados

```
packages/validators/src/chat.js
  chatSendMessageSchema.entityRefs.entityType — añadir 'project' | 'task' | 'calendar_event'

apps/desktop/src/modules/atlas.chat/components/
  EntityReferencePicker.jsx   — ENTITY_TYPES + fetchOptions (3 casos nuevos)
  EntityReferenceCard.jsx     — render por tipo (3 casos nuevos)
  ChannelGeneralTab.jsx       — campo "Vincular a proyecto" + acción "Agendar reunión"
  ChannelDirectorySheet.jsx   — opción "Vincular a proyecto" al crear canal
  (nuevo) ChannelEventsTab.jsx — panel "Próximos eventos" del canal

apps/desktop/src/modules/atlas.chat/hooks/useChannels.js
  — soporte para linkedModule/linkedEntityId en creación/edición de canal

apps/desktop/src/modules/atlas.projects/screens/ProjectsScreen.jsx (o su detalle)
  — botón "Crear canal de chat" / "Ir al canal"

apps/api/src/routes/chat/
  chat-entity-references-service.js  — resolvers para project/task/calendar_event
  chat-service.js (o sibling nuevo, ver nota de tamaño abajo) — linkedModule/linkedEntityId en createConversation + endpoint de link/unlink
  channel-directory-service.js       — exponer linkedModule/linkedEntityId en las respuestas de canal

prisma/migrations/YYYYMMDD_add_chat_conversation_link/
  — ALTER TABLE chat_conversations ADD COLUMN linked_module ..., linked_entity_id ...
```

**Nota de tamaño de archivo:** `chat-service.js` está a 31 líneas del límite duro de 1500 (ver CLAUDE.md). Esta spec **no** añade la lógica de link/unlink a `chat-service.js` directamente — va en un servicio nuevo, `chat-channel-links-service.js`, siguiendo el mismo patrón de extracción ya usado para moderación/reacciones/menciones/permisos.

---

## 4. Modelo de datos

### Migración nueva sobre `chat_conversations` (tabla raw-SQL, no Prisma)

```sql
ALTER TABLE chat_conversations
  ADD COLUMN linked_module VARCHAR(64) NULL,
  ADD COLUMN linked_entity_id UUID NULL;

CREATE UNIQUE INDEX chat_conversations_linked_entity_unique
  ON chat_conversations (linked_module, linked_entity_id)
  WHERE linked_module IS NOT NULL;
```

El índice único parcial impone "como máximo un canal por (módulo, entidad)" a nivel de BD — cubre la regla de negocio "1 canal por proyecto" y generaliza a futuros conectores de canal sin otra migración.

### `CalendarEvent` — sin cambios

`sourceModule`/`sourceEntityId` ya existen (línea 1798-1799 de `prisma/schema.prisma`). El conector de Calendario los usa con `sourceModule = 'atlas.chat'`, `sourceEntityId = <conversationId>`.

---

## 5. Contrato API

### Menciones (extensión de lo existente)

- `POST /chat/conversations/:id/messages` — `entityRefs[].entityType` ahora acepta `project | task | calendar_event` además de los 4 actuales. Resolución server-side vía `projectsService.getById`, `tasksService.getById`, `calendarEventService.getById` (permisos ya aplicados por cada servicio; si el usuario no tiene acceso, la referencia se descarta silenciosamente — mismo comportamiento que hoy con `contact`/`file`).

### Vínculo canal↔proyecto (nuevo)

- `POST /chat/conversations` — acepta `linkedModule?`, `linkedEntityId?` opcionales. Si se envían, valida unicidad (409 `PROJECT_ALREADY_LINKED` si el proyecto ya tiene canal) y siembra los miembros iniciales desde `ProjectMember` cuando `linkedModule === 'atlas.projects'`.
- `PATCH /chat/conversations/:id/link` — `{ linkedModule, linkedEntityId }` o `{ linkedModule: null, linkedEntityId: null }` para desvincular. Requiere permiso de gestión de canal (el mismo que ya protege renombrar/archivar).
- `POST /projects/:id/chat-channel` (en `atlas.projects`, no en `atlas.chat`) — atajo desde Proyectos: crea el canal (delegando al endpoint de arriba) o devuelve el existente si ya hay uno vinculado.

### Calendario (sin nuevos endpoints — solo nuevo uso de los existentes)

- `POST /calendar/events` con `sourceModule: 'atlas.chat'`, `sourceEntityId: <conversationId>` — ya soportado.
- `GET /calendar/events?sourceModule=atlas.chat&sourceEntityId=<id>` — ya soportado, usado por `ChannelEventsTab.jsx`.

---

## 6. Permisos RBAC

No se crean permisos nuevos. Se reutilizan:

- `projects.project.read` — para listar/mencionar proyectos y para el picker de "vincular a proyecto".
- `projects.task.read` — para mencionar tareas.
- `calendar.access` + `calendar.events.create` — para agendar reunión desde el chat.
- El permiso de gestión de canal ya existente en `chatPermissions.js` — para vincular/desvincular proyecto y para renombrar/settings del canal en general.

---

## 7. UI — Pantallas y componentes

- **`EntityReferencePicker.jsx`**: `ENTITY_TYPES` pasa de 4 a 7 entradas; `fetchOptions` gana 3 casos (`atlas.projects` list para `project`/`task`, `atlas.calendar` list para `calendar_event`) — mismo patrón de fetch-once-per-type ya documentado en el archivo.
- **`EntityReferenceCard.jsx`**: 3 variantes nuevas de tarjeta (proyecto: nombre + color + ícono; tarea: título + estado + proyecto padre; evento: título + fecha/hora).
- **`ChannelGeneralTab.jsx`**: nuevo campo `CreatableComboboxField`-sin-crear "Proyecto vinculado" + botón "Agendar reunión" que abre `EventFormModal`.
- **`ChannelDirectorySheet.jsx`**: al crear canal, campo opcional "Vincular a proyecto"; al elegirlo, pre-rellena miembros desde `ProjectMember` (el usuario puede ajustar antes de confirmar).
- **`ChannelEventsTab.jsx`** (nuevo): mismo patrón visual que `ConversationMediaTab.jsx`, lista eventos vía `GET /calendar/events?sourceModule=atlas.chat&sourceEntityId=...`.
- **Proyectos → detalle de proyecto**: botón "Crear canal de chat" (o "Ir al canal" si `project.chatConversationId` ya existe — derivado de la búsqueda inversa por `linked_module`/`linked_entity_id`, no de una columna nueva en `Project`).

---

## 8. Edge cases

- Proyecto ya vinculado a un canal → `POST /projects/:id/chat-channel` devuelve el canal existente (idempotente), no crea uno segundo.
- Usuario intenta vincular un canal a un proyecto que ya tiene otro canal → 409, mensaje claro en el toast.
- Mención a una tarea/proyecto/evento al que el usuario mencionado-por (no el autor) no tiene acceso → la tarjeta no se renderiza para ese lector (mismo comportamiento ya existente para `file`/`ledger_account`).
- Canal se desvincula de un proyecto → el panel de eventos y las menciones de proyecto ya adjuntas a mensajes históricos siguen funcionando (son referencias por mensaje, independientes del vínculo de canal).
- Reunión agendada desde un canal sin `atlas.calendar` habilitado en la instancia → el botón "Agendar reunión" no se muestra (mismo patrón de feature-gating por módulo instalado que ya usa el resto del shell).

---

## 9. Criterios de aceptación

- [ ] Mencionar un proyecto/tarea/evento en un mensaje de chat renderiza una tarjeta clicable que navega al detalle correcto.
- [ ] Crear un canal desde el detalle de un proyecto crea el canal con los miembros del proyecto como snapshot inicial y lo deja vinculado.
- [ ] Vincular un canal existente a un proyecto que ya tiene canal falla con 409 y mensaje claro.
- [ ] Agendar una reunión desde un canal crea un `CalendarEvent` con `sourceModule`/`sourceEntityId` correctos y aparece en el panel de eventos del canal.
- [ ] Ningún archivo tocado supera 1000 líneas (`chat-service.js` se mantiene sin crecer — la lógica de link va en un servicio nuevo).

---

## 10. Dependencias y riesgos

- Depende de que `atlas.projects` y `atlas.calendar` estén instalados y habilitados — las menciones y acciones correspondientes deben ocultarse/gatearse si el módulo no está activo (patrón ya usado en el shell para navegación condicional por módulo).
- Riesgo bajo: toda la superficie tocada reusa servicios y patrones ya probados en producción (`resolveEntityRefs`, `sourceModule`/`sourceEntityId`); el único código genuinamente nuevo es la migración de `chat_conversations` y el servicio de link/unlink.

---

## 11. Fuera de alcance (explícito)

- Arquitectura de llamadas de voz/video (`atlas.calls`) — Spec B, implementación diferida.
- Cualquier botón o affordance de "iniciar llamada" en esta fase.
