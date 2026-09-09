# Plan B (UI) — Permisos adicionales por usuario

Spec: `docs/superpowers/specs/2026-09-08-per-user-permission-grants.md`.
Depende de Plan A (endpoints + SDK). Trabajar en `main`.

**Estado: IMPLEMENTADO 2026-09-08** (local, sin commit). `PermissionFeatureTree`
gana prop `lockedKeys` (filas del rol → marcadas + disabled + badge "Del rol",
excluidas de bulk y contadas como asignadas). Nuevo
`components/UserPermissionGrantsCard.jsx` (catálogo + grants + barra flotante de
guardado). `UserEditorScreen` lo monta cuando el actor tiene
`identity.permissions.update` + `identity.users.update`. Lint verde. QA
navegador 390/1440 pendiente.

## Tareas

### 1. `PermissionFeatureTree` — soporte `lockedKeys`

`apps/desktop/src/modules/atlas.identity/components/PermissionFeatureTree.jsx`:

- Nuevo prop opcional `lockedKeys` (Set). Una fila cuya `item.key` está en
  `lockedKeys`:
  - `checked` forzado a `true`.
  - `disabled` (además del `disabled` global).
  - badge pequeño "Del rol" a la derecha del label (o junto al switch).
- Bulk toggles (módulo/feature): al calcular `allModKeys`/`allFeatKeys` para el
  `onBulkToggle`, **excluir** las locked (no se pueden desmarcar).
- `totalAssigned` / contadores: las locked cuentan como asignadas visualmente
  pero no forman parte de `pendingKeys` (son del rol, no un grant).
- Si `lockedKeys` no se pasa → comportamiento idéntico al actual (no romper
  `RoleEditorScreen`).

### 2. Hook de datos

`apps/desktop/src/modules/atlas.identity/hooks/` (o inline en la screen si no hay
carpeta hooks): 
- `useUserPermissionGrants(userId)` → `useQuery(["identity-user-grants", userId])`
  → `atlas.identity.getUserPermissionGrants`.
- `useSetUserPermissionGrants(userId)` → `useMutation` →
  `atlas.identity.setUserPermissionGrants`; onSuccess invalida
  `["identity-user-grants", userId]` y `["identity-user", userId]`.

### 3. Sección en `UserEditorScreen`

`apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx`:

- Bajo el bloque del rol, tarjeta **"Permisos adicionales"**.
- Visible solo si `hasPermission("identity.permissions.update") &&
  hasPermission("identity.users.update")` (o `isAdmin`).
- Carga: `listPermissions` (catálogo, ya se usa en RoleEditor) + grants del
  usuario + `roleKeys` (vienen del GET de grants).
- Render `PermissionFeatureTree`:
  - `allPermissions` = catálogo.
  - `baselineKeys` = `new Set(grantedKeys)`.
  - `pendingKeys` = estado local editable.
  - `lockedKeys` = `new Set(roleKeys)`.
  - `disabled` = `!canManage || saving`.
- Barra flotante "Cambios sin guardar" + Descartar / Guardar (copiar patrón de
  `RoleEditorScreen`, líneas de la floating save bar).
- Guardar → `setUserPermissionGrants({ permissionKeys: [...pendingKeys] })`,
  toast "Permisos actualizados".
- `EmptyState` si no hay catálogo; `ErrorState` con retry si falla la carga.

### 4. Copy / textos

- Título: "Permisos adicionales".
- Subtítulo: "Permisos extra para esta persona, además de los que ya da su rol.
  No se pueden quitar aquí los permisos del rol."
- Badge de fila bloqueada: "Del rol".

### 5. Verificación

- `pnpm lint`
- `pnpm --filter @atlas/desktop build` (o `pnpm build`)
- Tests desktop si hay suite para identity (`node --test` en la carpeta
  correspondiente); si no, no bloquea.
- QA manual 390 / 1440:
  - editar un usuario no-admin, activar `Chat → MeridIAn → Usar`, guardar.
  - confirmar que a ese usuario le aparece `@MeridIAn` y que MeridIAn responde a
    su mención en un canal.
  - confirmar que las filas "Del rol" salen marcadas y no se pueden desmarcar.
  - `RoleEditorScreen` sigue funcionando igual (regresión de
    `PermissionFeatureTree`).

## Fuera de alcance

- Mostrar en la tabla de usuarios quién tiene grants.
- Historial de cambios de grants en la UI (queda en `AuditLog`).
