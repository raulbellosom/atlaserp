export async function expireStaleGuestSessions(prisma) {
  const closedConversations = await prisma.$executeRaw`
    UPDATE chat_conversations
    SET status = 'closed', updated_at = NOW()
    WHERE type = 'external_support'
      AND status IN ('open', 'pending')
      AND deleted_at IS NULL
      AND created_by_guest_id IN (
        SELECT id FROM chat_guest_sessions
        WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
          AND closed_at IS NULL
      )
  `;

  const closedSessions = await prisma.$executeRaw`
    UPDATE chat_guest_sessions
    SET closed_at = NOW()
    WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
      AND closed_at IS NULL
  `;

  return { closedConversations, closedSessions };
}
