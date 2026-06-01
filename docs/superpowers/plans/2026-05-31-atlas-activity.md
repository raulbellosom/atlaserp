# Atlas Activity — Implementation Plan

Date: 2026-05-31
Spec: docs/superpowers/specs/2026-05-31-atlas-activity-design.md
Status: Approved

> **Mode: IMPLEMENTATION** — el spec está aprobado. Marcar cada subtask con `[x]` solo después de ejecutar y verificar el comando de validación.

## Goal

Entregar el módulo core `atlas.activity`: tabla `Activity`, servicio + bridge desde `AuditLog`, API REST, validators, SDK, componentes UI (`<ActivityTimeline />`, `<ActivityDrawer />`, `<ActivityBellTrigger />`), integración en `AppShell`, página `/activity`, tab "Actividad" en `HrEmployeeDetail`, y adopción de `logAndPublish` en `hr-service`. Realtime con polling fallback. Tests con `node:test`. Documentación en `docs/TASKS.md`.

## Architecture summary

Módulo CORE (no AME3): la tabla `Activity` vive en `prisma/schema.prisma` y se crea vía migración estándar. El manifest se declara en `apps/api/src/manifests/official/feature-modules.js`. El servicio expone un factory `createActivityService({ prisma })`. El bridge expone `createActivityBridge({ activityService, prisma })` con un registry estático de translators (HR, Contacts, Files, Company, Core) y un helper `logAndPublish(auditEntry)` que escribe `AuditLog` y publica activity dentro del mismo flujo. Las rutas se montan vía router Hono `createActivityRouter({ prisma, requirePermission })` agregado con UNA línea en `apps/api/src/index.js` cerca de los otros mounts. UI usa `@atlas/ui` + integración en `AppShell`. Realtime: canal Supabase `postgres_changes` con fallback de polling 15s automático si falla la suscripción.

---

## File Structure Map

### Create

- `prisma/migrations/<ts>_add_activity_table/migration.sql`
- `apps/api/src/services/activity-service.js`
- `apps/api/src/services/activity-bridge.js`
- `apps/api/src/services/__tests__/activity-service.test.js`
- `apps/api/src/services/__tests__/activity-bridge.test.js`
- `apps/api/src/routes/activity.js`
- `packages/sdk/src/activity.js`
- `packages/ui/src/ActivityTimeline.jsx`
- `packages/ui/src/ActivityDrawer.jsx`
- `packages/ui/src/ActivityBellTrigger.jsx`
- `apps/desktop/src/modules/activity/ActivityFeedScreen.jsx`
- `apps/desktop/src/modules/hr/HrEmployeeActivityTab.jsx`

### Modify

- `prisma/schema.prisma` — nuevo modelo `Activity` + relación inversa en `UserProfile`
- `apps/api/src/manifests/official/feature-modules.js` — agregar `activityMap`
- `apps/api/src/permission-catalog.js` — 4 permisos
- `apps/api/src/index.js` — 1 import + 1 mount
- `apps/api/src/services/hr-service.js` — usar `logAndPublish` en create/update/setEnabled
- `packages/validators/src/index.js` — `activityPublishSchema`, `activityListQuerySchema`
- `packages/sdk/src/index.js` — exportar dominio `activity`
- `packages/ui/src/index.js` — exportar componentes nuevos
- `packages/ui/src/AppShell.jsx` — montar bell + drawer
- `apps/desktop/src/App.jsx` (o router central) — registrar ruta `/activity`
- `apps/desktop/src/modules/hr/HrEmployeeDetail.jsx` — agregar tab "Actividad" (import del componente externo)
- `docs/TASKS.md` — entrada de fase

---

## Task 1 — Esquema y migración

**Files:**

- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<ts>_add_activity_table/migration.sql`

**Changes:**
Agregar modelo `Activity` con todos los campos del spec §10. Generar migración con `pnpm prisma migrate dev --name add_activity_table --create-only`, revisar SQL (índices, FK SET NULL), aplicar.

- [ ] Step 1: Agregar `model Activity` y relación inversa en `UserProfile`.
- [ ] Step 2: `pnpm db:generate` (cliente Prisma con nuevo modelo).
- [ ] Step 3: `pnpm prisma migrate dev --name add_activity_table` (genera + aplica).
- [ ] Step 4: Verificar índices `(companyId, createdAt)`, `(companyId, entityType, entityId, createdAt)`, `(companyId, type, createdAt)`, `(companyId, actorId, createdAt)` en migration.sql.

**Validation:**

```bash
pnpm db:generate
pnpm db:migrate
node -e "import('@prisma/client').then(({PrismaClient})=>new PrismaClient().activity.count().then(c=>console.log('OK',c)))"
```

---

## Task 2 — Manifest core + permisos

**Files:**

- Modify: `apps/api/src/manifests/official/feature-modules.js`, `apps/api/src/permission-catalog.js`

**Changes:** declarar `activityMap` con kind CORE, core true, uninstallable false, dependencias `[atlas.core, atlas.identity]`, 4 permisos, navigation, ACL. Sembrar via `pnpm db:seed`.

- [ ] Step 1: Importar `MODULE_KINDS` y declarar manifest.
- [ ] Step 2: Exportar en `listOfficialModuleManifests`.
- [ ] Step 3: Agregar 4 entradas a permission-catalog con metadata UI.
- [ ] Step 4: `pnpm db:seed` para sembrar módulo + permisos.

**Validation:**

```bash
node --check apps/api/src/manifests/official/feature-modules.js
pnpm db:seed
```

---

## Task 3 — Validators

**Files:**

- Modify: `packages/validators/src/index.js`

- [ ] Step 1: `activityPublishSchema` con refinement de tamaño JSON ≤ 4096 bytes.
- [ ] Step 2: `activityListQuerySchema` con coerciones y enums.

**Validation:**

```bash
node --check packages/validators/src/index.js
```

---

## Task 4 — Activity service

**Files:**

- Create: `apps/api/src/services/activity-service.js`

Factory `createActivityService({ prisma })` con funciones internas: `publish`, `list`, `listForEntity`, `recent`, dedupe 2s, truncado de summary, validación de payload, manejo de errores (`ActivityServiceError` con `code` y `status`).

- [ ] Step 1: Implementar factory + funciones.
- [ ] Step 2: Validar todos los `prisma.$queryRaw`/`prisma.activity` calls.

**Validation:**

```bash
node --check apps/api/src/services/activity-service.js
```

---

## Task 5 — Activity bridge

**Files:**

- Create: `apps/api/src/services/activity-bridge.js`

Factory `createActivityBridge({ activityService })` con registry de translators (`hr.employee.*`, `contacts.contact.*`, `files.assets.*`, `company.profile.update`, `core.module.install`) y helper exportado `logAndPublish({ prisma, auditEntry, activityHint? })` que escribe AuditLog y publica activity, envolviendo activity en try/catch.

- [ ] Step 1: Implementar translators y registry.
- [ ] Step 2: Implementar `logAndPublish` (best-effort para activity).

**Validation:**

```bash
node --check apps/api/src/services/activity-bridge.js
```

---

## Task 6 — Activity routes

**Files:**

- Create: `apps/api/src/routes/activity.js`
- Modify: `apps/api/src/index.js`

Router Hono `createActivityRouter({ prisma, requirePermission })` con los 5 endpoints. Montar con `mountWithAuth(app, createActivityRouter({ prisma, requirePermission }))` en `index.js`.

- [ ] Step 1: Implementar router con guards de permiso.
- [ ] Step 2: Agregar 1 import + 1 línea de mount en index.js.

**Validation:**

```bash
node --check apps/api/src/routes/activity.js
node --check apps/api/src/index.js
pnpm dev:api &  # arrancar
sleep 3
curl -s http://localhost:4010/health
# luego smoke endpoints con TOKEN
```

---

## Task 7 — Adopción en HR service

**Files:**

- Modify: `apps/api/src/services/hr-service.js`

Reemplazar las llamadas `auditLog.create(...)` (en create/update/setEnabled de employee) por `logAndPublish({ prisma, auditEntry, activityHint: { summary, severity, link } })`. NO añadir activities en queries de solo lectura.

- [ ] Step 1: Identificar puntos de AuditLog en hr-service.
- [ ] Step 2: Refactorizar 3 sitios.
- [ ] Step 3: Asegurar que un fallo de activity no rompe la mutación (cubierto por bridge).

**Validation:**

```bash
node --check apps/api/src/services/hr-service.js
node --test apps/api/src/services/__tests__/hr-service.test.js  # si existe
```

---

## Task 8 — Tests

**Files:**

- Create: `apps/api/src/services/__tests__/activity-service.test.js`
- Create: `apps/api/src/services/__tests__/activity-bridge.test.js`

Cubrir: publish básico, dedupe 2s, payload > 4KB rechazado, listForEntity filtra correctamente, bridge translator HR genera summary correcto, bridge sin translator no publica, `logAndPublish` no rompe mutación si activity falla.

- [ ] Step 1: Tests del servicio.
- [ ] Step 2: Tests del bridge.

**Validation:**

```bash
node --test apps/api/src/services/__tests__/activity-service.test.js
node --test apps/api/src/services/__tests__/activity-bridge.test.js
```

---

## Task 9 — SDK

**Files:**

- Create: `packages/sdk/src/activity.js`
- Modify: `packages/sdk/src/index.js`

Exportar dominio `activity` con `list`, `recent`, `listForEntity`, `publish`, `getRealtimeChannel`.

- [ ] Step 1: Implementar archivo + export.

**Validation:**

```bash
node --check packages/sdk/src/activity.js
node --check packages/sdk/src/index.js
```

---

## Task 10 — UI components

**Files:**

- Create: `packages/ui/src/ActivityTimeline.jsx`, `ActivityDrawer.jsx`, `ActivityBellTrigger.jsx`
- Modify: `packages/ui/src/index.js`

`ActivityTimeline` con props `{ entityType, entityId, limit, height }`, manejo de estados (loading/empty/error). `ActivityDrawer` con SideSheet derecho. `ActivityBellTrigger` con badge basado en `lastSeenAt` (almacenado en localStorage como fallback si no hay UserPreference endpoint).

- [ ] Step 1: ActivityTimeline (base reutilizable).
- [ ] Step 2: ActivityDrawer (usa ActivityTimeline sin filtro de entidad).
- [ ] Step 3: ActivityBellTrigger (badge + abre drawer).
- [ ] Step 4: Exportar en barrel.

**Validation:**

```bash
node --check packages/ui/src/ActivityTimeline.jsx
node --check packages/ui/src/ActivityDrawer.jsx
node --check packages/ui/src/ActivityBellTrigger.jsx
pnpm --filter @atlas/ui build  # si existe
```

---

## Task 11 — AppShell integration

**Files:**

- Modify: `packages/ui/src/AppShell.jsx`

Montar `<ActivityBellTrigger />` en topbar (con check de permiso) y `<ActivityDrawer />` controlado por estado local. Render condicional si `userContext.permissions.includes('activity.read')`.

- [ ] Step 1: Importar componentes y agregar al render.

**Validation:**

```bash
node --check packages/ui/src/AppShell.jsx
```

---

## Task 12 — Página /activity + ruta

**Files:**

- Create: `apps/desktop/src/modules/activity/ActivityFeedScreen.jsx`
- Modify: `apps/desktop/src/App.jsx` (o el router que use el shell)

Pantalla con filtros sticky, lista paginada, integración SDK + TanStack Query + Realtime channel.

- [ ] Step 1: Implementar pantalla.
- [ ] Step 2: Registrar ruta `/activity` con guard de permiso.

**Validation:**

```bash
node --check apps/desktop/src/modules/activity/ActivityFeedScreen.jsx
pnpm dev:frontend
# manual: navegar a /activity
```

---

## Task 13 — Tab en HrEmployeeDetail

**Files:**

- Create: `apps/desktop/src/modules/hr/HrEmployeeActivityTab.jsx`
- Modify: `apps/desktop/src/modules/hr/HrEmployeeDetail.jsx`

Componente externo para NO inflar `HrEmployeeDetail` (1704 líneas). En `HrEmployeeDetail` solo se agrega el tab y el import — máximo +15 líneas netas.

- [ ] Step 1: Crear `HrEmployeeActivityTab` que use `<ActivityTimeline entityType="HrEmployee" entityId={employeeId} />`.
- [ ] Step 2: Agregar tab "Actividad" en HrEmployeeDetail (verificar líneas finales < 1500 idealmente, máximo absoluto 1750).

**Validation:**

```bash
node --check apps/desktop/src/modules/hr/HrEmployeeActivityTab.jsx
node --check apps/desktop/src/modules/hr/HrEmployeeDetail.jsx
wc -l apps/desktop/src/modules/hr/HrEmployeeDetail.jsx  # <= 1750
```

---

## Task 14 — Verificación + docs

**Files:**

- Modify: `docs/TASKS.md`

- [ ] Step 1: Ejecutar todas las validaciones del spec §26.
- [ ] Step 2: Manual UI: bell, drawer, /activity, tab HR, evento desde otra pestaña.
- [ ] Step 3: Verificar isolation multi-tenant (segundo usuario empresa B no ve datos de A).
- [ ] Step 4: Llenar `docs/superpowers/templates/verification-checklist-template.md` y guardar como `docs/superpowers/verifications/2026-05-31-atlas-activity-verification.md`.
- [ ] Step 5: Actualizar `docs/TASKS.md` con entrada `Verified: 2026-05-31 (...)`.

**Validation:**

```bash
# todos los comandos anteriores ejecutados sin error
```

---

## Rollback Notes

- Si se aborta antes del Task 1: nada que revertir.
- Si se aborta después del Task 1 (migración aplicada): crear nueva migración forward `drop_activity_table` con `DROP TABLE IF EXISTS activity CASCADE;`. NO editar la migración aplicada.
- Si se aborta después del Task 2 (seed corrido): opcional, eliminar permisos `activity.*` y módulo `atlas.activity` de la DB (`prisma.permission.deleteMany`, `prisma.atlasModule.delete`).
- Cualquier archivo creado/modificado en `apps/api`, `packages/`, `apps/desktop` puede revertirse con git.

---

## Verification Gate

Antes de marcar la fase completa en `docs/TASKS.md`:

- [ ] Todas las validaciones de cada task se ejecutaron sin error.
- [ ] `node --test` de los 2 archivos de test pasó.
- [ ] Smoke curl de los 4 endpoints retornó 200/201 esperado.
- [ ] UI manual: bell + drawer + /activity + tab HR verificados.
- [ ] Multi-tenant isolation verificado con dos usuarios de empresas distintas.
- [ ] `HrEmployeeDetail.jsx` ≤ 1750 líneas.
- [ ] Verificación checklist completada y guardada.
- [ ] `docs/TASKS.md` actualizado con `Verified: 2026-05-31 (...)`.
