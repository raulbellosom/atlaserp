//
// Client-side mirror of apps/api/src/routes/chat/chat-permissions-service.js's
// CHAT_PERMISSIONS/roleHasPermission — for UI gating (hiding buttons the user
// can't use) ONLY. The backend re-validates every mutation regardless of what
// this module says; this file existing and drifting out of sync would at worst
// show a wrong button, never grant an unauthorized action. Keep the 8 keys
// below byte-identical to the backend file if it ever changes.

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

// `member` is one entry from a conversation's `members` array (as returned by
// GET /chat/conversations/:id after Plan A) — expects roleIsSystem/rolePermissions
// fields. Both are undefined/null for direct/external_support members, which
// correctly makes every permission resolve to false for them (they have no
// channel-scoped permissions to begin with).
export function roleHasPermission(member, permissionKey) {
  if (!member) return false;
  if (member.roleIsSystem) return true;
  return member.rolePermissions?.[permissionKey] === true;
}

export function findOwnMember(members, currentUserId) {
  if (!members?.length) return null;
  return members.find((m) => m.userId === currentUserId) ?? null;
}

// True when this message's resolved mentions target the current viewer
// (directly by user id, via their role in the conversation, or an @everyone/@here
// broadcast). Shared by ChatMessageBubble (highlighting) and ChatMessageList
// (the "jump to mention" button) so the two never disagree on what counts as
// "mentioning me".
export function isMentioned(message, currentUserId, ownRoleId) {
  const mentions = message?.metadata?.mentions;
  if (!mentions) return false;
  if (mentions.everyone || mentions.here) return true;
  if (currentUserId && mentions.userIds?.includes(currentUserId)) return true;
  if (ownRoleId && mentions.roleIds?.includes(ownRoleId)) return true;
  return false;
}
