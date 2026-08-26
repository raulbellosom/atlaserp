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
