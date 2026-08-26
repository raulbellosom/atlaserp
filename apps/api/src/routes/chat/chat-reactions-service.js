import { resolveUserProfileId } from "./chat-service.js";

export class ChatReactionsError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatReactionsError";
    this.status = status;
  }
}

export function createChatReactionsService({ prisma }) {
  async function toggleReaction({ messageId, authUserId, emoji }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatReactionsError("Mensaje no encontrado.", 404);

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_message_reactions
      WHERE message_id = ${messageId} AND user_id = ${profileId} AND emoji = ${emoji}
      LIMIT 1
    `;

    if (existing.length) {
      await prisma.$executeRaw`DELETE FROM chat_message_reactions WHERE id = ${existing[0].id}`;
      return { added: false, emoji };
    }

    await prisma.$queryRaw`
      INSERT INTO chat_message_reactions (message_id, user_id, emoji)
      VALUES (${messageId}, ${profileId}, ${emoji})
      ON CONFLICT (message_id, user_id, emoji) DO NOTHING
      RETURNING id
    `;
    return { added: true, emoji };
  }

  return { toggleReaction };
}
