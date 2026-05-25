# Spec: Eliminar roles en atlas.identity

**Date:** 2026-05-25
**Status:** Approved

## Problem

The roles screen has no delete option. Disabling a role (soft-delete) already exists, but there is no way to permanently remove a custom role.

## Constraints

- System roles (`system: true`, keys `atlas.admin` / `system.admin`) are never deletable. The option must not appear in the UI and must be blocked in the API.
- Deleting a role is a hard delete (row removal), distinct from the existing "Desactivar" soft-delete.
- The DB schema already handles cascade correctly:
  - `RolePermission` → `onDelete: Cascade` (permissions removed automatically)
  - `Membership.roleId` → `onDelete: SetNull` (users lose their role assignment but remain active)

## Behavior

### When role has 0 active members

Simple confirm dialog:

> **Eliminar rol**
> ¿Confirmas que quieres eliminar "Supervisor de ventas"? Esta accion no se puede deshacer.
> [Cancelar] [Eliminar]

### When role has ≥ 1 active members

Warning confirm dialog:

> **Eliminar rol**
> El rol "Supervisor de ventas" tiene 3 usuarios asignados.
> Al eliminarlo quedaran sin rol y perderan todos los permisos asociados a este rol.
> [Cancelar] [Eliminar de todas formas]

## Implementation scope

### API — GET /identity/roles
Add `_count: { select: { memberships: { where: { enabled: true } } } }` to the Prisma query and expose `memberCount` on each role object. No extra API call needed at delete time.

### API — DELETE /identity/roles/:id (new endpoint)
- Guard: `role.system === true` → 403
- Guard: `role.key` in `ADMIN_ROLE_KEYS` → 403
- Hard delete the role row; DB cascade does the rest.
- Requires permission `identity.roles.delete`.

### SDK — packages/sdk/src/index.js
Add `deleteRole(id, token)` to `atlas.identity`.

### Frontend — RolesScreen.jsx
- Add `Trash2` to lucide imports.
- Add `deleteTarget` state and `deleteRoleMutation`.
- Add `ConfirmDialog` (already available via `@atlas/ui`).
- Add "Eliminar" to `ActionMenu` in all three views (table, card, grid) — only when `!role.system`.
- Single `ConfirmDialog` at component root: inspects `deleteTarget?.memberCount` to pick simple vs. warning message.

## Out of scope

- Role reassignment during delete (users left with null role; reasignment done manually via UsersScreen if needed).
- Bulk role delete.
