// resolveUserProfileId is unused until createChatPermissionsService (added next)
// starts calling it — imported here because that addition lands in this same file.
import { resolveUserProfileId } from "./chat-service.js";

export class ChatPermissionsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatPermissionsError";
    this.status = status;
  }
}

export const CHAT_PERMISSIONS = Object.freeze({
  CHANNEL_MANAGE: "channel.manage",
  MEMBERS_MANAGE: "members.manage",
  ROLES_MANAGE: "roles.manage",
  MESSAGES_SEND: "messages.send",
  MESSAGES_PIN: "messages.pin",
  MESSAGES_DELETE_OTHERS: "messages.delete_others",
  MENTIONS_EVERYONE: "mentions.everyone",
  MENTIONS_HERE: "mentions.here",
});

const ALL_PERMISSIONS_TRUE = Object.freeze(
  Object.fromEntries(Object.values(CHAT_PERMISSIONS).map((key) => [key, true])),
);

// Deep-freeze: DEFAULT_CHANNEL_ROLES is a process-wide shared singleton (ES module
// export). A shallow Object.freeze only locks the array itself — each role's nested
// `permissions` object would otherwise still be mutable, and a single accidental
// write from any future caller would silently corrupt the default for every
// channel/group created afterward in this process.
function deepFreezeRole(role) {
  Object.freeze(role.permissions);
  return Object.freeze(role);
}

export const DEFAULT_CHANNEL_ROLES = Object.freeze([
  deepFreezeRole({ name: "Owner", position: 100, isSystem: true, permissions: ALL_PERMISSIONS_TRUE }),
  deepFreezeRole({
    name: "Admin",
    position: 75,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.CHANNEL_MANAGE]: true,
      [CHAT_PERMISSIONS.MEMBERS_MANAGE]: true,
      [CHAT_PERMISSIONS.ROLES_MANAGE]: true,
      [CHAT_PERMISSIONS.MESSAGES_PIN]: true,
      [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: true,
      [CHAT_PERMISSIONS.MENTIONS_EVERYONE]: true,
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  }),
  deepFreezeRole({
    name: "Moderator",
    position: 50,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_PIN]: true,
      [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: true,
      [CHAT_PERMISSIONS.MENTIONS_HERE]: true,
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  }),
  deepFreezeRole({
    name: "Member",
    position: 0,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  }),
]);

export function roleHasPermission(role, permissionKey) {
  if (!role) return false;
  // isSystem (Owner) is the actual enforcement gate — always allowed, regardless
  // of its permissions object. Owner's permissions object still lists every key
  // explicitly (see ALL_PERMISSIONS_TRUE) so persisted/displayed role data stays
  // self-describing for any future read path that doesn't special-case isSystem.
  if (role.isSystem) return true;
  return role.permissions?.[permissionKey] === true;
}

export function assertHigherPosition(actorPosition, targetPosition, message = "No tienes rango suficiente para esta accion.") {
  if (!(actorPosition > targetPosition)) {
    throw new ChatPermissionsError(message, 403);
  }
}

export function createChatPermissionsService({ prisma }) {
  async function assertConversationMember(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id = ${userProfileId} AND left_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatPermissionsError("Conversacion no encontrada.", 404);
  }

  async function getMemberRole(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT r.id, r.name, r.position, r.is_system AS "isSystem", r.permissions
      FROM chat_conversation_members m
      JOIN chat_channel_roles r ON r.id = m.role_id
      WHERE m.conversation_id = ${conversationId} AND m.user_id = ${userProfileId} AND m.left_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function assertChannelPermission(conversationId, userProfileId, permissionKey) {
    await assertConversationMember(conversationId, userProfileId);
    const role = await getMemberRole(conversationId, userProfileId);
    if (!roleHasPermission(role, permissionKey)) {
      throw new ChatPermissionsError("No tienes permiso para realizar esta accion.", 403);
    }
    return role;
  }

  // Accepts an optional `client` override (a prisma.$transaction `tx` handle) so
  // callers that also need to assign the seeded role ids to members can do the
  // whole seed-then-assign sequence atomically instead of as separate statements.
  async function seedDefaultRoles(conversationId, client = prisma) {
    const roleIds = {};
    for (const def of DEFAULT_CHANNEL_ROLES) {
      const rows = await client.$queryRaw`
        INSERT INTO chat_channel_roles (conversation_id, name, position, is_system, permissions)
        VALUES (${conversationId}, ${def.name}, ${def.position}, ${def.isSystem}, ${JSON.stringify(def.permissions)}::jsonb)
        RETURNING id, name
      `;
      roleIds[rows[0].name] = rows[0].id;
    }
    return roleIds;
  }

  async function isLastOwner(conversationId, userProfileId) {
    const role = await getMemberRole(conversationId, userProfileId);
    if (!role || !role.isSystem) return false;
    const rows = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS count
      FROM chat_conversation_members m
      JOIN chat_channel_roles r ON r.id = m.role_id
      WHERE m.conversation_id = ${conversationId} AND r.is_system = true AND m.left_at IS NULL
    `;
    return (rows[0]?.count ?? 0) <= 1;
  }

  async function listRoles({ conversationId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    await assertConversationMember(conversationId, profileId);
    return prisma.$queryRaw`
      SELECT id, conversation_id AS "conversationId", name, color, position,
             is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
      FROM chat_channel_roles
      WHERE conversation_id = ${conversationId}
      ORDER BY position DESC, created_at ASC
    `;
  }

  async function createRole({ conversationId, authUserId, name, color = null, position, permissions }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);
    assertHigherPosition(actorRole.position, position, "No puedes crear un rol con rango igual o mayor al tuyo.");

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = ${name} LIMIT 1
    `;
    if (existing.length) throw new ChatPermissionsError("Ya existe un rol con ese nombre en esta conversacion.", 400);

    const rows = await prisma.$queryRaw`
      INSERT INTO chat_channel_roles (conversation_id, name, color, position, is_system, permissions)
      VALUES (${conversationId}, ${name}, ${color}, ${position}, false, ${JSON.stringify(permissions)}::jsonb)
      RETURNING id, conversation_id AS "conversationId", name, color, position,
                is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return rows[0];
  }

  async function updateRole({ conversationId, roleId, authUserId, updates }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetRows = await prisma.$queryRaw`
      SELECT * FROM chat_channel_roles WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const target = targetRows[0];
    if (!target) throw new ChatPermissionsError("Rol no encontrado.", 404);
    if (target.is_system) throw new ChatPermissionsError("El rol Owner no se puede modificar.", 403);
    assertHigherPosition(actorRole.position, target.position, "No puedes modificar un rol de rango igual o mayor al tuyo.");
    if (updates.position !== undefined) {
      assertHigherPosition(actorRole.position, updates.position, "No puedes asignar un rango igual o mayor al tuyo.");
    }
    if (updates.name !== undefined && updates.name !== target.name) {
      const dupe = await prisma.$queryRaw`
        SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = ${updates.name} AND id != ${roleId} LIMIT 1
      `;
      if (dupe.length) throw new ChatPermissionsError("Ya existe un rol con ese nombre en esta conversacion.", 400);
    }

    const rows = await prisma.$queryRaw`
      UPDATE chat_channel_roles
      SET name = COALESCE(${updates.name ?? null}, name),
          color = COALESCE(${updates.color ?? null}, color),
          position = COALESCE(${updates.position ?? null}, position),
          permissions = COALESCE(${updates.permissions ? JSON.stringify(updates.permissions) : null}::jsonb, permissions),
          updated_at = NOW()
      WHERE id = ${roleId}
      RETURNING id, conversation_id AS "conversationId", name, color, position,
                is_system AS "isSystem", permissions, created_at AS "createdAt", updated_at AS "updatedAt"
    `;
    return rows[0];
  }

  async function deleteRole({ conversationId, roleId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetRows = await prisma.$queryRaw`
      SELECT * FROM chat_channel_roles WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const target = targetRows[0];
    if (!target) throw new ChatPermissionsError("Rol no encontrado.", 404);
    if (target.is_system) throw new ChatPermissionsError("El rol Owner no se puede eliminar.", 403);
    assertHigherPosition(actorRole.position, target.position, "No puedes eliminar un rol de rango igual o mayor al tuyo.");

    const fallbackRows = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' AND id != ${roleId} LIMIT 1
    `;
    const fallbackRoleId = fallbackRows[0]?.id ?? null;

    // Reassignment + delete must be atomic: never leave role_id dangling on a
    // deleted role (spec 2026-08-25-chat-channels-roles-phase-a-design.md, section 23, edge case 4).
    const reassignedMemberCount = await prisma.$transaction(async (tx) => {
      const reassigned = await tx.$queryRaw`
        UPDATE chat_conversation_members
        SET role_id = ${fallbackRoleId}
        WHERE conversation_id = ${conversationId} AND role_id = ${roleId}
        RETURNING id
      `;

      await tx.$executeRaw`DELETE FROM chat_channel_roles WHERE id = ${roleId}`;

      return reassigned.length;
    });

    return { id: roleId, reassignedMemberCount };
  }

  async function assignMemberRole({ conversationId, memberUserId, roleId, authUserId }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);
    const actorRole = await assertChannelPermission(conversationId, profileId, CHAT_PERMISSIONS.ROLES_MANAGE);

    const targetCurrentRole = await getMemberRole(conversationId, memberUserId);
    if (!targetCurrentRole) throw new ChatPermissionsError("Miembro no encontrado en esta conversacion.", 404);

    const isSelfTarget = memberUserId === profileId;
    if (!isSelfTarget) {
      assertHigherPosition(actorRole.position, targetCurrentRole.position, "No puedes gestionar a un miembro de rango igual o mayor al tuyo.");
    }

    const newRoleRows = await prisma.$queryRaw`
      SELECT id, name, position, is_system AS "isSystem" FROM chat_channel_roles
      WHERE id = ${roleId} AND conversation_id = ${conversationId} LIMIT 1
    `;
    const newRole = newRoleRows[0];
    if (!newRole) throw new ChatPermissionsError("Rol no encontrado.", 404);

    if (newRole.isSystem) {
      if (!actorRole.isSystem) {
        throw new ChatPermissionsError("Solo un Owner puede asignar el rol Owner.", 403);
      }
    } else {
      assertHigherPosition(actorRole.position, newRole.position, "No puedes asignar un rol de rango igual o mayor al tuyo.");
    }

    if (targetCurrentRole.isSystem && !newRole.isSystem) {
      const isLast = await isLastOwner(conversationId, memberUserId);
      if (isLast) {
        throw new ChatPermissionsError("No puedes quitar el rol Owner al unico Owner de la conversacion. Asigna otro Owner primero.", 400);
      }
    }

    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET role_id = ${roleId}
      WHERE conversation_id = ${conversationId} AND user_id = ${memberUserId} AND left_at IS NULL
    `;

    return { conversationId, userId: memberUserId, roleId };
  }

  return {
    seedDefaultRoles,
    isLastOwner,
    listRoles,
    createRole,
    updateRole,
    deleteRole,
    assignMemberRole,
  };
}
