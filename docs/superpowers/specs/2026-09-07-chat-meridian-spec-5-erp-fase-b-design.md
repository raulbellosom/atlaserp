# atlas.chat — MeridIAn Spec 5: ERP reach Fase B (herramientas de lectura por módulo)

- **Estado:** aprobado (self-approved 2026-09-07 por instrucción del usuario)
- **Depende de:** Spec 1 (motor) + Fase A (`search_atlas`, `resolveUserContext` ya cableado).
- **Overview:** `docs/superpowers/specs/2026-09-07-chat-meridian-overview.md`

## 1. Objetivo

Que MeridIAn (chat directo + panel, **no** la mención `@meridIAn`) responda sobre
datos de módulos de Atlas más allá del directorio de personas de la Fase A:

- **Inventario:** "¿cuántas laptops tenemos?", "busca el activo con serie X".
- **Bancos (atlas.ledger):** "¿cuánto tenemos en el banco?", "saldo de la cuenta BBVA".
- **Calendario:** "¿qué tengo esta semana?".
- **Tareas (atlas.projects):** "¿qué tareas tengo pendientes?".

Cada herramienta está **gated por el permiso de lectura del módulo** del usuario
(vía `resolveUserContext`); si no lo tiene, la herramienta responde "no tienes
acceso a eso" y MeridIAn lo explica. No se añade un permiso nuevo: la postura RBAC
de la empresa ya decide qué ve quien usa MeridIAn.

### No-objetivos (v1 de este spec)

- Sin escrituras: solo lectura.
- No finanzas AR/AP / aging: no existe un `finance-service` limpio en el repo
  hoy (solo `atlas.ledger` = cuentas bancarias + movimientos). Se cubre bancos.
- No PFM: ya tiene su propio asistente; coexisten.
- No detalle de nómina/salarios de HR: sensible; `search_atlas` ya da el
  directorio de empleados y con eso basta para v1.
- No en la mención `@meridIAn` (canal público) — solo chat directo y panel.
- No streaming.

## 2. Herramientas nuevas (se añaden a `TOOL_DEFS` / `buildToolRunners`)

Todas reciben `companyId` + `actorAuthUserId` del `ctx`; resuelven el contexto
del usuario con `resolveUserContext(actorAuthUserId)` y comprueban el permiso.

| tool | args del modelo | permiso | service | devuelve |
|---|---|---|---|---|
| `search_inventory` | `{ query, status? }` | `inventory.item.read` | `inventoryService.listItems({ companyId, search, status, limit: 8 })` | `{ items: [{ nombre, etiqueta, serie, estado, categoria, ubicacion, asignadoA }] }` |
| `list_bank_accounts` | `{}` | `ledger.accounts.read` | `ledgerService.listAccounts({ companyId, actorId })` | `{ cuentas: [{ nombre, banco, moneda, saldo }] }` (recortado; sin ids) |
| `list_my_calendar` | `{ days? (<=30, def 7) }` | `calendar.events.read` | `calendarEventService.listEvents({ userId, start: hoy, end: hoy+days })` | `{ eventos: [{ titulo, inicio, fin, calendario }] }` |
| `list_my_tasks` | `{ status? }` | `projects.task.read` | `projectsService.listProjects(companyId, userId)` → por cada uno `tasksService.listTasks(projectId, { assigneeId: <me> })` | `{ tareas: [{ titulo, proyecto, estado, prioridad, vence }] }` (máx 20, ordenadas por `vence`) |

- Resultados recortados antes de mandarse al modelo (sin ids de auditoría, sin
  campos internos). Límite duro ~8 KB por resultado de tool (ya existe
  `clampToolResult`).
- `list_my_tasks` limita a los primeros **8 proyectos** del usuario para acotar
  el fan-out; si hay más, añade `note: "solo revise tus primeros 8 proyectos"`.
- Errores del service → `{ error: "<mensaje corto>" }`, nunca throw (el loop ya
  captura, pero se recorta el mensaje).

## 3. System prompt

`chatSystemPrompt()` y `panelSystemPrompt()`:
- Sustituir la línea "Para datos del ERP que no sean contactos/usuarios/empleados
  (finanzas, tareas, inventario) responde que aun no tienes acceso." por:
  "Para inventario usa search_inventory; para saldos de bancos list_bank_accounts;
  para la agenda del usuario list_my_calendar; para sus tareas list_my_tasks.
  Cada herramienta solo funciona si el usuario tiene permiso; si devuelve
  'sin acceso', dilo. Para OTROS datos (nómina a detalle, AR/AP) responde que
  aun no tienes acceso."

## 4. Cambios de código

### `apps/api/src/routes/chat/meridian-tools.js`
- Imports: nada nuevo de servicios (se inyectan). Reusa `SEARCH_PROVIDERS` de Fase A.
- `TOOL_DEFS` += 4 defs.
- `buildToolRunners({ ... , inventoryService, ledgerService, calendarEventService, projectsService, tasksService })` — nuevas deps opcionales; si falta una, su runner devuelve `{ error: "no disponible" }`.
- 4 runners nuevos + añadirlos al objeto devuelto.
- Helper `requirePerm(uctx, key)` chico y compartido con `search_atlas` (extraer).

### `apps/api/src/routes/chat/meridian-service.js`
- `createMeridianService` acepta `inventoryService`, `ledgerService`,
  `calendarEventService`, `projectsService`, `tasksService` y los pasa a
  `buildToolRunners`.
- Prompts (§3).
- `MAX_TOOL_ITERATIONS` 6 → **8** (una pregunta ERP puede encadenar 2-3 tools).
  Ajustar el mensaje/const del tope y el test del cap.

### `apps/api/src/routes/chat/index.js`
- Ya construye `createLedgerService`, `createProjectsService`, `createTasksService`,
  `createCalendarEventService` para `entityReferencesService`. Reusar esas
  instancias (o crearlas una vez y compartir). Añadir `createInventoryService`
  (ver cómo lo instancia `apps/api/src/routes/inventory/`).
- Pasarlas a `createMeridianService`.

### Sin migración, sin permiso nuevo, sin SDK.

## 5. Seguridad

| Riesgo | Mitigación |
|---|---|
| Fuga de datos de un módulo a quien no debe | Cada tool exige el permiso de lectura del módulo vía `resolveUserContext`; sin permiso → `{ error }`, no datos |
| Fuga entre empresas | `companyId` del `ctx` (de la request), nunca del modelo; los services ya filtran por `companyId` |
| `list_my_tasks` / `list_my_calendar` de otro usuario | `userId` = el `actorProfileId`/`profile.id` del contexto; el modelo no puede pedir otro |
| Prompt-injection | Todo lectura; cláusula anti-inyección ya en el prompt; sin acciones |
| Coste (más tools, más iteraciones) | Tope 8, `clampToolResult` 8 KB, `list_my_tasks` acota a 8 proyectos, `chat_meridian_run` para vigilar |

## 6. Pruebas (`node --test`)

En `meridian-tools.test.js` (o `meridian-erp.test.js` nuevo):
1. `TOOL_DEFS` ahora lista las 10 (6 base + `search_atlas` + 4 nuevas).
2. `search_inventory` con permiso `inventory.item.read` → llama `listItems` con
   `{ companyId, search }` y recorta; sin permiso → `{ error: /permiso|acceso/ }`.
3. `list_bank_accounts` sin `ledger.accounts.read` → `{ error }`; con permiso →
   mapea a `{ cuentas: [...] }` sin ids.
4. `list_my_calendar` usa `userId` del ctx y `days` acotado a 30.
5. `list_my_tasks` itera sobre los proyectos del usuario, filtra por `assigneeId`,
   corta a 8 proyectos con `note`.
6. Un service ausente (dep no inyectada) → `{ error: "no disponible" }`, sin throw.

Regresión: `meridian-service.test.js` (cap de iteraciones ahora 8), 266+ tests de
chat siguen verdes; `pnpm lint` verde.

## 7. Verificación en vivo

Script de diagnóstico temporal (borrado después): con `resolveUserContext` real y
los services reales, ejercitar `search_inventory("laptop")`, `list_bank_accounts()`,
`list_my_calendar({days:7})`, `list_my_tasks()` contra la BD en vivo con el usuario
de pruebas; confirmar que respetan permisos (probar con un permiso quitado
manualmente del set).

## 8. Alcance de implementación — un plan

`meridian-tools.js` + `meridian-service.js` + wiring en `chat/index.js` + tests.
**Un Plan A.** Sin UI, sin migración.

## 9. Fuera de alcance (v3)

- Finanzas AR/AP / aging (cuando exista un service).
- Herramientas de escritura confirmables (crear tarea desde el chat, etc.).
- HR a detalle (contratos, nómina).
- POS, storefront, website, growth.
- Un permiso `chat.meridian.erp` si se decide que el gate por módulo no basta.
