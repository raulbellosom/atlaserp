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

const ALL_PERMISSIONS_TRUE = Object.fromEntries(
  Object.values(CHAT_PERMISSIONS).map((key) => [key, true]),
);

export const DEFAULT_CHANNEL_ROLES = Object.freeze([
  { name: "Owner", position: 100, isSystem: true, permissions: ALL_PERMISSIONS_TRUE },
  {
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
  },
  {
    name: "Moderator",
    position: 50,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_PIN]: true,
      [CHAT_PERMISSIONS.MESSAGES_DELETE_OTHERS]: true,
      [CHAT_PERMISSIONS.MENTIONS_HERE]: true,
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  },
  {
    name: "Member",
    position: 0,
    isSystem: false,
    permissions: {
      [CHAT_PERMISSIONS.MESSAGES_SEND]: true,
    },
  },
]);

export function roleHasPermission(role, permissionKey) {
  if (!role) return false;
  if (role.isSystem) return true;
  return role.permissions?.[permissionKey] === true;
}

export function assertHigherPosition(actorPosition, targetPosition, message = "No tienes rango suficiente para esta accion.") {
  if (!(actorPosition > targetPosition)) {
    throw new ChatPermissionsError(message, 403);
  }
}
