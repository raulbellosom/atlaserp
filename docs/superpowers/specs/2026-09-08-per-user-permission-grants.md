# Spec — Permisos adicionales por usuario (grants ALLOW-only)

Estado: **aprobado** (Raul, 2026-09-08). Origen: reporte de chat 2026-09-08 —
necesidad de conceder `chat.meridian.use` (y en general cualquier permiso) a una
persona concreta sin moverla de rol ni ampliar el rol compartido.

## Objetivo

Permitir que un administrador **sume** permisos puntuales a un usuario, por
encima de los que ya hereda de su rol. Los roles siguen siendo el mecanismo
principal; esto es solo para excepciones.

## Decisiones de diseño (cerradas)

1. **Solo ALLOW (aditivo).** No hay DENY. El conjunto efectivo es
   `permisos_del_rol  ∪  grants_del_usuario`. Nunca se resta.
2. **Scope por empresa.** Igual que `Membership` (`company_id`). Un grant aplica
   en el contexto de esa empresa.
3. **Solo permisos activos.** Un grant sobre un `Permission.active = false` se
   guarda pero no entra al `permissionSet` efectivo (mismo criterio que los
   role permissions).
4. **Admin sigue haciendo bypass total** — no se toca esa rama.
5. **Sin UI de "quitar del rol".** Si alguien no debe tener un permiso del rol,
   se cambia de rol o se ajusta el rol. Fuera de alcance.

## Modelo de datos

Nuevo modelo Prisma `UserPermissionGrant` (tabla `user_permission_grant`):

| campo | tipo | notas |
|---|---|---|
| id | `String @id @default(uuid(7)) @db.Uuid` | |
| userId | `String @db.Uuid @map("user_id")` | FK `UserProfile`, `onDelete: Cascade` |
| companyId | `String @db.Uuid @map("company_id")` | FK `Company`, `onDelete: Cascade` |
| permissionId | `String @db.Uuid @map("permission_id")` | FK `Permission`, `onDelete: Cascade` |
| grantedById | `String? @db.Uuid @map("granted_by_id")` | FK `UserProfile`, `onDelete: SetNull` — auditoría |
| createdAt | `DateTime @default(now()) @map("created_at")` | |
| updatedAt | `DateTime @updatedAt @map("updated_at")` | |

- `@@unique([userId, companyId, permissionId])`
- `@@index([userId, companyId])`
- `@@map("user_permission_grant")`

Relaciones inversas: `UserProfile.permissionGrants`,
`UserProfile.grantsAuthored` (para `grantedById`), `Company.permissionGrants`,
`Permission.userGrants`.

Migración **forward nueva** (nunca editar migraciones aplicadas). Nombre:
`<timestamp>_user_permission_grants`.

## Resolución de permisos

En `_loadUserContext` (`apps/api/src/index.js`), después del bucle de
`activeMemberships` y **antes** del bloque `if (isAdmin)`:

```js
// Grants ALLOW por usuario — se SUMAN a los permisos del rol. Scope: las
// empresas de las membresías activas. Solo permisos activos.
const companyIds = activeMemberships.map((m) => m.companyId);
if (companyIds.length) {
  const grants = await prisma.userPermissionGrant.findMany({
    where: {
      userId: profile.id,
      companyId: { in: companyIds },
      permission: { active: true },
    },
    include: { permission: { select: { key: true } } },
  });
  for (const g of grants) if (g.permission?.key) permissionSet.add(g.permission.key);
}
```

- Cache: `user_ctx:<authUserId>` (TTL 300s). Al escribir grants se invalida de
  inmediato (`del("user_ctx:" + authUserId)` del usuario afectado) para que
  aplique sin esperar el TTL. Requiere resolver `authUserId` desde `userId`
  (`UserProfile.authUserId`).

## API

Bajo el mismo router de identity (`apps/api/src/index.js`), permiso requerido
`identity.permissions.update` **y** `identity.users.update` (ambos), o admin.

- `GET /identity/users/:id/permission-grants`
  - Respuesta: `{ data: { grantedKeys: string[], roleKeys: string[] } }`
    (`roleKeys` = lo que ya hereda del rol, para que la UI lo muestre bloqueado).
- `PUT /identity/users/:id/permission-grants`
  - Body: `{ permissionKeys: string[] }` (set completo, ALLOW).
  - Server: resuelve `companyId` de la membresía activa del usuario objetivo
    (si tiene varias, la misma que usa `_loadUserContext` — la admin o la
    primera). Filtra a `Permission.active = true`. `deleteMany` + `createMany`
    en transacción. `grantedById` = perfil del actor.
  - Ignora silenciosamente claves que ya vienen del rol (no crea grant
    redundante) — o las guarda igual; decisión de implementación, no afecta el
    resultado efectivo. Preferencia: **no** guardar redundantes.
  - Invalida el cache del usuario objetivo.
  - `AuditLog`: entrada `user.permission_grants.updated` con el diff.
- SDK (`packages/sdk/src/index.js` dominio `identity`):
  `getUserPermissionGrants(userId, token)`, `setUserPermissionGrants(userId, { permissionKeys }, token)`.

Validación Zod en `packages/validators` si aplica el patrón del resto de
identity; si identity valida inline, seguir ese estilo.

## UI

`apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx`: nueva
sección **"Permisos adicionales"** debajo del selector de rol, visible solo con
`identity.permissions.update` (y `identity.users.update`).

- Reutiliza `PermissionFeatureTree` con una variante:
  - `baselineKeys` / `pendingKeys` = los grants del usuario.
  - Filas cuyo permiso **ya viene del rol**: se muestran marcadas + `disabled`
    con un badge "Del rol" (nuevo prop opcional `lockedKeys` en
    `PermissionFeatureTree` → fila `disabled` + etiqueta). Togglear solo afecta
    a las filas no bloqueadas.
- Barra flotante de guardado igual que `RoleEditorScreen` (patrón ya existente).
- Al guardar: `setUserPermissionGrants`, invalidar queries
  `["identity-user", id]` y toast.
- Empty/error states estándar (`EmptyState` / `ErrorState`).

## Fuera de alcance

- DENY / revocar permisos del rol.
- Segundo rol por usuario, grupos de usuarios, herencia jerárquica de roles.
- Grants con expiración.

## Verificación

- `node --test` API: nuevo archivo de tests para la resolución (rol ∪ grants,
  permiso inactivo ignorado, scope por empresa, admin sin cambios) y para el
  endpoint PUT/GET (permisos requeridos, filtrado de inactivos, invalidación).
- `pnpm lint`, `pnpm build`.
- QA manual: conceder `chat.meridian.use` a un usuario no-admin y confirmar que
  (a) aparece el candidato `@MeridIAn` en el compositor y (b) MeridIAn responde
  a su mención en un canal.
