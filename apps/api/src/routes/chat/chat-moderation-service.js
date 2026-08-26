import { resolveUserProfileId } from "./chat-service.js";

export class ChatModerationServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatModerationServiceError";
    this.status = status;
  }
}

export function createChatModerationService({ prisma }) {
  async function getUserProfileId(authUserId) {
    return resolveUserProfileId(prisma, authUserId);
  }

  async function muteConversation({ conversationId, authUserId, muted }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET muted_at = ${muted ? new Date() : null}
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
    `;
    return { conversationId, muted };
  }

  async function blockUser({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    if (profileId.toString() === targetUserId) {
      throw new ChatModerationServiceError("No puedes bloquearte a ti mismo.", 400);
    }
    await prisma.$executeRaw`
      INSERT INTO chat_blocks (blocker_user_id, blocked_user_id)
      VALUES (${profileId}, ${targetUserId})
      ON CONFLICT (blocker_user_id, blocked_user_id) DO NOTHING
    `;
    return { blocked: true };
  }

  async function unblockUser({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      DELETE FROM chat_blocks WHERE blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId}
    `;
    return { blocked: false };
  }

  async function getBlockStatus({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    const rows = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId})
         OR (blocker_user_id = ${targetUserId} AND blocked_user_id = ${profileId})
    `;
    const blockedByMe = rows.some((r) => r.blocker_user_id.toString() === profileId.toString());
    const blockedByThem = rows.some((r) => r.blocker_user_id.toString() === targetUserId);
    return { blockedByMe, blockedByThem };
  }

  async function getGroupsInCommon({ authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    const rows = await prisma.$queryRaw`
      SELECT c.id, c.type, c.title, c.avatar_url, c.avatar_emoji
      FROM chat_conversations c
      WHERE c.type IN ('group', 'channel')
        AND c.deleted_at IS NULL
        AND EXISTS (
          SELECT 1 FROM chat_conversation_members
          WHERE conversation_id = c.id AND user_id = ${profileId} AND left_at IS NULL
        )
        AND EXISTS (
          SELECT 1 FROM chat_conversation_members
          WHERE conversation_id = c.id AND user_id = ${targetUserId} AND left_at IS NULL
        )
      ORDER BY c.title ASC
    `;
    return rows.map((r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      avatarUrl: r.avatar_url,
      avatarEmoji: r.avatar_emoji,
    }));
  }

  return {
    muteConversation,
    blockUser,
    unblockUser,
    getBlockStatus,
    getGroupsInCommon,
  };
}
