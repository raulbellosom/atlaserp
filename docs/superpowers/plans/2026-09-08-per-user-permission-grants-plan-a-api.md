# Plan A (API + migración) — Permisos adicionales por usuario

Spec: `docs/superpowers/specs/2026-09-08-per-user-permission-grants.md`.
Trabajar en `main`. ALLOW-only, aditivo.

**Estado: IMPLEMENTADO 2026-09-08** (local, sin commit). Migración
`20260908140000_user_permission_grants` aplicada a la BD en vivo. Merge puro
extraído a `apps/api/src/lib/permission-grants.js` con 9 tests
(`apps/api/src/services/__tests__/permission-grants.test.js`). Endpoints
`GET|PUT /identity/users/:id/permission-grants` + SDK
`getUserPermissionGrants`/`setUserPermissionGrants`. Guard extra
anti-escalada: un no-admin solo concede permisos que su propia cuenta tiene.
849 route tests + suite de services verdes. QA en vivo pendiente.

## Tareas

### 1. Schema Prisma

- `prisma/schema.prisma`: añadir `model UserPermissionGrant` (ver spec § Modelo
  de datos). Añadir relaciones inversas en `UserProfile` (`permissionGrants
  UserPermissionGrant[] @relation("UserGrants")`, `grantsAuthored
  UserPermissionGrant[] @relation("GrantAuthor")`), `Company`
  (`permissionGrants UserPermissionGrant[]`), `Permission`
  (`userGrants UserPermissionGrant[]`).
- Los dos FKs a `UserProfile` (userId, grantedById) necesitan `@relation` con
  nombre para desambiguar.

### 2. Migración

- `pnpm db:migrate` con nombre `user_permission_grants` (genera
  `prisma/migrations/<ts>_user_permission_grants/migration.sql`).
- Revisar el SQL: tabla `user_permission_grant`, unique
  `(user_id, company_id, permission_id)`, index `(user_id, company_id)`, FKs con
  el `onDelete` de la spec.
- `pnpm db:generate`.

### 3. Resolución en `_loadUserContext`

- `apps/api/src/index.js`: tras el bucle de `activeMemberships`, antes de
  `if (isAdmin)`, añadir la carga de `userPermissionGrant` (snippet en la spec).
  Filtrar `permission.active` y scope `companyId IN (membresías activas)`.
- No tocar la rama admin.

### 4. Invalidación de cache

- Helper `invalidateUserContextByProfileId(profileId)`: busca
  `userProfile.authUserId` y hace `del("user_ctx:" + authUserId)` (import `del`
  desde `apps/api/src/lib/cache.js` — hoy solo se importan `get`/`set`, añadir
  `del as cacheDel`).
- Llamarlo desde el PUT de grants.

### 5. Endpoints

En `apps/api/src/index.js` (junto al resto de `/identity/*`):

- `GET /identity/users/:id/permission-grants`
  - guard: `authMiddleware` + (admin ó (`identity.permissions.update` Y
    `identity.users.update`)). Usar `requireAnyPermission` no sirve (es AND) →
    check manual con `getOrLoadUserContext` como en la línea ~2828.
  - Respuesta `{ data: { grantedKeys, roleKeys } }`.
- `PUT /identity/users/:id/permission-grants`
  - mismo guard.
  - body `{ permissionKeys: string[] }`.
  - resolver `companyId` del usuario objetivo (membresía admin ó primera activa,
    misma lógica que `_loadUserContext`).
  - filtrar a `Permission.active = true` y **excluir** las claves que ya vienen
    del rol del usuario objetivo (no guardar redundantes).
  - transacción: `deleteMany({ where: { userId, companyId } })` +
    `createMany(...)`.
  - `grantedById` = `context.profile.id`.
  - `AuditLog` `user.permission_grants.updated` con `{ added, removed }`.
  - invalidar cache del usuario objetivo.
  - responder `{ data: { grantedKeys } }`.

### 6. SDK

- `packages/sdk/src/index.js` dominio `identity`:
  - `getUserPermissionGrants: (userId, token) => request(...)`
  - `setUserPermissionGrants: (userId, data, token) => request(..., { method: "PUT", body })`

### 7. Tests

`apps/api/src/services/__tests__/` (nuevo `user-permission-grants.test.js` con
mocks de `prisma`, estilo de los tests existentes de chat-service):

- resolución: rol ∪ grants; permiso inactivo en grant → NO entra; grant de otra
  empresa → NO entra; admin → sin cambios respecto a hoy.
- PUT: rechaza sin los dos permisos; filtra inactivos; no crea grants para
  claves que ya da el rol; invalida cache (spy sobre `cacheDel`).

Si `_loadUserContext` no es exportable/testeable en aislamiento, extraer la
lógica de merge a una función pura `mergePermissionKeys({ base, roleKeys,
grantKeys })` y testear esa.

### 8. Verificación

- `node --test "apps/api/src/services/__tests__/*.test.js"`
- `node --test "apps/api/src/routes/**/__tests__/*.test.js"` (no regresión)
- `pnpm lint`
- `node --check apps/api/src/index.js`

## Notas / riesgos

- `_loadUserContext` es seguridad-crítico (hubo un bug de auto-escalada en
  identity.users.update). Revisar que el guard del PUT exige AMBOS permisos y que
  un no-admin no pueda concederse a sí mismo permisos que su rol no tiene →
  **regla extra**: si el actor NO es admin, solo puede conceder claves que el
  propio actor ya posee (`context.permissionSet`). Documentar y testear.
- Migración se aplica a la BD en vivo (`pnpm db:migrate`) — confirmar túnel/IP.
