# Atlas Activity — Feed de actividad transversal

Date: 2026-05-31
Status: Approved
Author: GitHub Copilot (under user direction)
Spec file: docs/superpowers/specs/2026-05-31-atlas-activity-design.md
Plan file: docs/superpowers/plans/2026-05-31-atlas-activity.md

---

## 1. Feature title

Atlas Activity — módulo core `atlas.activity`: feed de actividad legible, polimórfico y transversal a todos los módulos de Atlas ERP.

## 2. Status

Approved

## 3. Context

Atlas ERP ya cuenta con `AuditLog` (tabla `audit_log`) para registro técnico de cambios campo-a-campo, útil para auditoría/forense pero ilegible para el usuario final. Los módulos actuales (HR, Contacts, Files, Company, Finance, Fleet) emiten audit entries pero no existe ningún mecanismo unificado para:

- mostrar al usuario "qué pasó" en una entidad (timeline en DETAIL view),
- ver una bitácora reciente global accesible desde el shell,
- consumir eventos en tiempo real,
- estandarizar el contrato de publicación de eventos de negocio que próximamente alimentará `atlas.notifications`, `atlas.tasks` y `atlas.approvals`.

## 4. Problem

No existe una capa de **actividad de negocio legible para el usuario** ni un contrato unificado para publicar y consumir eventos de dominio. Los módulos no pueden mostrar timelines coherentes, el shell no expone actividad reciente, y futuros módulos (notifications, tasks) carecen del bus sobre el cual construirse.

## 5. Goals

1. Una sola tabla `Activity` con scoping por `companyId` registra todos los eventos de negocio relevantes de cualquier módulo.
2. Cualquier servicio del API puede publicar actividad explícitamente vía `activityService.publish({...})` con un contrato estable.
3. Un bridge automático traduce entradas relevantes de `AuditLog` a `Activity` mediante un registry de translators (por prefijo de `action`), sin modificar el AuditLog existente.
4. Una API REST autenticada expone `GET /activity`, `GET /activity/recent`, `GET /activity/entity/:entityType/:entityId` y `POST /activity` filtrando por empresa.
5. El `@atlas/ui` ofrece tres componentes reutilizables: `<ActivityTimeline />` (embebible por entidad), `<ActivityDrawer />` (drawer global del shell) y `<ActivityBellTrigger />` (botón de campana con badge).
6. El `AppShell` integra el bell + drawer global de forma persistente para usuarios con permiso `activity.read`.
7. Una página `/activity` muestra el feed completo con filtros (tipo, módulo, usuario, rango de fechas, búsqueda) y paginación.
8. La UI consume actividad en tiempo real vía canal Supabase Realtime cuando hay RLS habilitada; caso contrario, hace polling cada 15s como fallback automático.
9. El módulo `atlas.hr` adopta el helper `logAndPublish` en sus mutaciones principales (employee create/update/setEnabled) como prueba de adopción del patrón.

## 6. Non-goals

1. Reemplazar o modificar el sistema `AuditLog` existente.
2. Notificaciones con fanout, lectura/no-leído por usuario, push o email (será `atlas.notifications`, fase posterior).
3. Tareas, asignaciones, comentarios o reacciones sobre activities.
4. Trigger Postgres `AFTER INSERT ON audit_log` (alternativa diferida; MVP usa helper en JS).
5. Migrar TODOS los servicios existentes (Contacts, Files, Company, Finance, Fleet) al patrón `logAndPublish`. Solo HR en esta fase.
6. Retención automática o purga de activity > N días.
7. Configuración por usuario de qué tipos de actividad ver (filtros UI sí; preferencias persistentes no).
8. Exportación a Excel/PDF del feed.
9. Multi-tenant a nivel de membership (un usuario en varias empresas ve solo la empresa activa actual — no se hace selector cross-company en el drawer).
10. TypeScript / `.d.ts`.

## 7. User stories

- Como administrador de empresa, quiero abrir un drawer en el shell y ver los últimos 20 eventos de mi empresa, para tener visibilidad operativa inmediata.
- Como gerente de RRHH, quiero abrir la ficha de un colaborador y ver una pestaña "Actividad" con su historial legible, para entender qué pasó con su expediente.
- Como auditor interno, quiero ir a la página `/activity` y filtrar por usuario y rango de fechas, para investigar acciones específicas sin leer JSON técnico.
- Como desarrollador de un nuevo módulo, quiero invocar `activityService.publish({ type, summary, entityType, entityId })` desde mi servicio, para que mis eventos aparezcan en el feed sin trabajo de UI adicional.
- Como usuario sin permiso `activity.read`, no debo ver el bell, el drawer, la ruta `/activity` ni recibir actividad alguna.
- Como usuario activo en la app, quiero ver eventos nuevos aparecer automáticamente sin recargar la página.

## 8. UX requirements

Todos los textos visibles en español. Diseño con tokens semánticos (sin colores literales), responsive con unidades `dvh`, breakpoints estándar Atlas.

**ActivityBellTrigger:** Botón ícono `Activity` (lucide-react) en la topbar del `AppShell`. Muestra un punto pequeño cuando hay actividad publicada después del último `lastSeenAt` del usuario (persistido en `UserPreference` con key `activity.lastSeenAt`). Click abre el drawer y actualiza `lastSeenAt`.

**ActivityDrawer:** Drawer derecho de ancho `min(420px, 92vw)` con header "Actividad reciente", lista vertical agrupada por día (`Hoy`, `Ayer`, `<fecha>`), cada ítem muestra: ícono de severity, summary, actor (avatar pequeño o iniciales + nombre), tiempo relativo (`hace 5 min`). Click en un ítem con `link` navega a esa URL. Footer con link "Ver todo →" que lleva a `/activity`.

**ActivityTimeline:** Variante embebible. Props `{ entityType, entityId, limit?, height? }`. Mismo render que el drawer pero filtrado a una entidad. Estado vacío: "Sin actividad registrada." Estado de error: "No se pudo cargar la actividad." con botón "Reintentar".

**Página `/activity`:** Layout principal con filtros sticky arriba (búsqueda global, select de tipo de evento, select de usuario, date range, select de severidad), lista paginada (pageSize 25), pagination en footer. Estado vacío: ilustración + "Aún no hay actividad para tu empresa.".

**Severities:** `info` (azul), `success` (verde), `warning` (ámbar), `critical` (rojo). Mapeo de colores vía tokens semánticos (`bg-emerald-50 text-emerald-700`, etc.). Default `info`.

## 9. Routes/screens

| Route       | Screen               | Module           | Description               |
| ----------- | -------------------- | ---------------- | ------------------------- |
| `/activity` | `ActivityFeedScreen` | `atlas.activity` | Feed completo con filtros |

## 10. Data model

### New models

**Activity** — bitácora de eventos de negocio legibles.

- `id`: UUID v7 (PK, default DB).
- `companyId`: UUID, requerido, FK lógico a `Company`.
- `actorId`: UUID, opcional, FK a `UserProfile` (onDelete: SetNull).
- `type`: String requerido — formato dot.case (`hr.employee.update`, `contacts.contact.create`, `core.module.install`).
- `entityType`: String opcional — el nombre del modelo (`HrEmployee`, `Contact`, `Invoice`, etc.).
- `entityId`: UUID opcional.
- `summary`: String requerido — texto legible en español.
- `payload`: Json opcional — datos adicionales, limitado a 4KB serializado.
- `link`: String opcional — URL relativa o absoluta para navegar al recurso.
- `severity`: String requerido, default `info`, enum `info|success|warning|critical`.
- `source`: String requerido, default `explicit`, enum `explicit|audit_bridge`.
- `createdAt`: DateTime default now().

**Índices:**

- `(companyId, createdAt DESC)` para feed global por empresa.
- `(companyId, entityType, entityId, createdAt DESC)` para timeline por entidad.
- `(companyId, type, createdAt DESC)` para filtros por tipo.
- `(companyId, actorId, createdAt DESC)` para filtros por usuario.

### Modified models

`UserProfile` — agregar relación inversa `activities Activity[]` (no breaking).

## 11. Prisma impact

New models: `Activity`
Modified models: `UserProfile` (relación inversa)
New migration required: **Sí** — `add_activity_table`.
Migration safety notes: Tabla nueva, sin riesgo. Indices `CREATE INDEX` estándar. La relación a `UserProfile` usa `ON DELETE SET NULL`. No requiere backfill.

## 12. API contract

**Atlas response convention:** éxito `{ data: ... }`, error `{ error: string }`.

### GET /activity

Auth: required
Permission: `activity.read`
Query: `?page=1&pageSize=25&entityType=&entityId=&type=&actorId=&severity=&from=&to=&q=`
Response: `{ data: Activity[], pagination: { page, pageSize, total } }`

### GET /activity/recent

Auth: required
Permission: `activity.read`
Query: `?limit=20`
Response: `{ data: Activity[] }`

### GET /activity/entity/:entityType/:entityId

Auth: required
Permission: `activity.read`
Query: `?limit=50`
Response: `{ data: Activity[] }`

### POST /activity

Auth: required
Permission: `activity.publish`
Body: `{ type, summary, entityType?, entityId?, severity?, payload?, link? }`
Response: `{ data: Activity }` — 201
Errores: 400 (payload > 4KB, schema inválido), 403 (sin permiso).

### POST /activity/subscribe-token

Auth: required
Permission: `activity.read`
Response: `{ data: { channel: 'activity:company:<companyId>', token: <accessToken> } }`
**MVP:** retorna el access_token del usuario y delega autorización a RLS de Supabase. Sin RLS, el cliente cae a polling 15s.

## 13. SDK contract

Domain: `activity`

- `list(query, token)` → `{ data, pagination }`
- `recent(token, limit=20)` → `{ data }`
- `listForEntity(entityType, entityId, token, limit=50)` → `{ data }`
- `publish(payload, token)` → `{ data }`
- `getRealtimeChannel({ supabase, companyId })` → instancia de `RealtimeChannel` configurada para `postgres_changes` sobre `activity` con filtro `company_id=eq.<companyId>`.

## 14. Validator contract

En `packages/validators/src/index.js`:

- `activityPublishSchema` — `{ type: string min 1 max 100, summary: string min 1 max 500, entityType: string max 100 optional, entityId: uuid optional, severity: enum optional, payload: record(any) optional, link: string max 500 optional }`. Refinement: tamaño JSON del payload ≤ 4096 bytes.
- `activityListQuerySchema` — coerciones de query: page/pageSize como ints positivos, severity enum opcional, from/to ISO datetime opcional, q string max 200, entityType/type strings.

## 15. Module manifest impact

Nuevo manifest core en `apps/api/src/manifests/official/feature-modules.js` exportado como `activityMap` e incluido en `listOfficialModuleManifests`.

```
key: atlas.activity
name: Actividad
kind: CORE
core: true
uninstallable: false
dependencies: [atlas.core, atlas.identity]
```

**Permissions:**

- `activity.access` — Acceder al módulo de actividad
- `activity.read` — Ver actividad
- `activity.publish` — Publicar actividad (uso interno/admin)
- `activity.manage` — Administrar actividad (futuro: purga, configuración)

**ACL:**

- `acl.module: activity.access`
- `acl.actions: { 'activity.read': 'activity.read', 'activity.publish': 'activity.publish', 'activity.manage': 'activity.manage' }`
- `acl.models: { Activity: { read: 'activity.read', create: 'activity.publish', update: 'activity.manage', delete: 'activity.manage' } }`

## 16. Navigation impact

| Label     | Path        | Icon       | Layout | permissionKey   |
| --------- | ----------- | ---------- | ------ | --------------- |
| Actividad | `/activity` | `Activity` | main   | `activity.read` |

## 17. Blueprint impact

N/A — no se declaran blueprints. La página y los componentes son nativos del shell (módulo core, no AME3).

## 18. RBAC/permissions

| Permiso            | Endpoint                                                                                     | Nav         |
| ------------------ | -------------------------------------------------------------------------------------------- | ----------- |
| `activity.access`  | (módulo base)                                                                                | —           |
| `activity.read`    | GET /activity, GET /activity/recent, GET /activity/entity/\*, POST /activity/subscribe-token | `/activity` |
| `activity.publish` | POST /activity                                                                               | —           |
| `activity.manage`  | (reservado, sin endpoints en MVP)                                                            | —           |

Los 4 permisos se siembran via `prisma/seed.js` automáticamente al estar incluidos en el manifest core (patrón existente).

## 19. Multi-company behavior

Todas las queries filtran por `companyId` derivado de `userContext.memberships[0].companyId`. El POST también valida que el `companyId` del payload (si se especifica) coincida con el del usuario. La suscripción Realtime usa filtro `company_id=eq.<companyId>` a nivel Supabase.

## 20. Files/storage impact

Ninguno. Activity no maneja archivos.

## 21. Export/import requirements

Ninguno en MVP.

## 22. Audit log requirements

El propio módulo Activity NO registra en AuditLog (sería recursivo y ruidoso). Las acciones administrativas futuras (`activity.manage`) sí lo harán.

## 23. Edge cases

1. **Actor borrado:** `actorId` queda NULL (FK SET NULL). UI muestra "Sistema" como autor.
2. **Entidad sin tipo:** `entityType` y `entityId` nullables — eventos globales del sistema (`core.module.install`).
3. **Payload > 4KB:** rechazado en POST con 400 "Payload demasiado grande, usa el campo `link` para referenciar el recurso completo".
4. **Dedupe básico:** antes de insertar, query `EXISTS` por `(companyId, type, entityId, actorId) AND createdAt > now() - interval '2 seconds'`. Si existe, no se inserta.
5. **Módulo desinstalado:** activities históricas permanecen visibles (no se purgan al desinstalar; FK lógico).
6. **Realtime sin RLS:** cliente intenta `subscribe()`, si no recibe heartbeat en 3s cae a polling 15s.
7. **lastSeenAt en usuario nuevo:** si no existe `UserPreference`, badge se muestra hasta el primer click; luego se persiste.
8. **Translator no encontrado en bridge:** se publica activity genérica con `summary = '<actor> realizó la acción <action>'` y severity `info`. Nunca falla silenciosamente, siempre publica algo.
9. **Bridge falla:** el helper `logAndPublish` envuelve la publicación en try/catch — un fallo en activity NUNCA debe romper la mutación de negocio (audit + activity son best-effort, el dato del negocio es la verdad).
10. **CompanyId nulo en mutación core:** algunos eventos (`core.module.install`) no tienen company asociada — se publican con el companyId del actor (su empresa activa).

## 24. Risks

1. **Volumen explosivo de activities** — sin retención, la tabla puede crecer. _Mitigación:_ índices compuestos + paginación obligatoria; ticket aparte para job de purga > 365 días.
2. **Realtime sin RLS expone datos cross-company** — _Mitigación:_ validar que `RLS` existe sobre `activity` antes de habilitar Realtime; fallback polling como red de seguridad; documentar en TASKS.md.
3. **Bridge spammy** — traducir TODOS los audit entries podría generar ruido. _Mitigación:_ registry explícito, solo traduce acciones con translator registrado; resto se ignora.
4. **Acoplamiento progresivo a `logAndPublish`** — adoptarlo en muchos servicios es esfuerzo grande. _Mitigación:_ MVP solo HR; resto se migra cuando aporte valor.
5. **Tamaño de `HrEmployeeDetail.jsx` (1704 líneas)** — agregar tab no debe exceder 1500. _Mitigación:_ tab se implementa con un componente externo `<HrEmployeeActivityTab />` importado, no inline.
6. **Conflicto con permisos sin seed** — si `prisma/seed.js` no corre, los permisos no existirán. _Mitigación:_ la fase incluye paso explícito de `pnpm db:seed` en verificación.

## 25. Acceptance criteria

1. Dado un usuario admin autenticado, cuando hace `GET /activity?pageSize=5`, entonces recibe `200` con `data` (array) y `pagination`.
2. Dado un usuario sin `activity.read`, cuando hace `GET /activity`, entonces recibe `403`.
3. Dado un servicio interno, cuando llama `activityService.publish({ type: 'test.event', summary: 'Prueba', companyId })`, entonces se inserta una fila en `activity` con `source: 'explicit'`.
4. Dado dos publish idénticos en < 2s, cuando se ejecuta el segundo, entonces NO se inserta una nueva fila (dedupe).
5. Dado un payload > 4KB, cuando se hace `POST /activity`, entonces se recibe `400`.
6. Dado un usuario edita un colaborador, cuando se ejecuta la mutación, entonces se inserta una fila en `audit_log` Y una fila en `activity` con `summary` legible (ej. "Juan actualizó el colaborador María López") y `source: 'audit_bridge'` o `explicit` según el camino.
7. Dado el `AppShell` con usuario que tiene `activity.read`, cuando se renderiza, entonces aparece `<ActivityBellTrigger />` en la topbar.
8. Dado el drawer abierto y un evento publicado en otra pestaña/cliente, cuando llega vía Realtime (o polling 15s en fallback), entonces aparece en el listado sin recargar.
9. Dado un usuario abre `HrEmployeeDetail` y va al tab "Actividad", entonces ve sólo eventos cuyo `(entityType='HrEmployee', entityId=<thisId>)`.
10. Dado un usuario de empresa A consulta `GET /activity`, entonces nunca ve registros con `companyId` distinto.
11. Dado un actor borrado, cuando se renderiza su activity histórica, entonces UI muestra "Sistema" como autor sin romper.
12. Dado un translator no encontrado, cuando el bridge procesa un audit entry desconocido, entonces NO publica nada (no spam) — solo publica cuando hay translator registrado o cuando se invoca `publish` directamente.

## 26. Verification plan

```bash
# Sintaxis
node --check apps/api/src/services/activity-service.js
node --check apps/api/src/services/activity-bridge.js
node --check apps/api/src/routes/activity.js

# DB
pnpm db:migrate
pnpm db:generate
pnpm db:seed

# Tests
node --test apps/api/src/services/__tests__/activity-service.test.js
node --test apps/api/src/services/__tests__/activity-bridge.test.js

# Boot
pnpm dev:api

# Smoke
TOKEN=$ATLAS_TOKEN
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4010/activity?pageSize=5" | jq .
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"type":"smoke.test","summary":"Prueba manual","severity":"info"}' \
  http://localhost:4010/activity | jq .
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:4010/activity/recent?limit=5" | jq .

# UI manual
# 1. Login → ver bell con badge si hay activities nuevas
# 2. Click bell → drawer abre, lista cargada
# 3. Navegar a /activity → filtros funcionan
# 4. Abrir HrEmployeeDetail → tab "Actividad" muestra solo activity de ese empleado
# 5. Editar empleado en pestaña B → drawer en pestaña A muestra el evento en <30s
```

## 27. Rollback plan

1. Revertir el merge.
2. Crear migración forward `drop_activity_table` que ejecute `DROP TABLE IF EXISTS activity CASCADE;` (NO editar la migración aplicada).
3. Si el seed ya creó permisos `activity.*`, ejecutar limpieza opcional vía `prisma.permission.deleteMany({ where: { key: { startsWith: 'activity.' } } })`.

## 28. Future enhancements

1. `atlas.notifications` consumirá activity con `recipients[]` para fanout.
2. `atlas.tasks` publicará activities al asignar/completar.
3. Job programado de retención (purga > 365 días).
4. Trigger Postgres `AFTER INSERT ON audit_log` para reemplazar el bridge JS.
5. Translators registrados por cada módulo vía `exposes` (descubrimiento dinámico).
6. Reacciones, comentarios, replies en activities.
7. Preferencias de usuario: filtros guardados, mute por tipo.
8. Exportación CSV/Excel del feed.
9. Tokens efímeros firmados para suscripción Realtime más estricta.
10. RLS estricta en `activity` con políticas por membership.
