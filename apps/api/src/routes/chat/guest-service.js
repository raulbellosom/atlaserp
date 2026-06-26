import crypto from "node:crypto";

export class GuestChatServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "GuestChatServiceError";
    this.status = status;
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createGuestChatService({ prisma, supabaseAdmin }) {
  // ------------------------------------------------------------------
  // Session management
  // ------------------------------------------------------------------

  async function createGuestSession({ email, name, phone, websiteId, pageUrl, referrer, userAgent, metadata = {} }) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = hashToken(rawToken);

    const sessionRows = await prisma.$queryRaw`
      INSERT INTO chat_guest_sessions
        (session_token_hash, email, name, phone, website_id, page_url, referrer, user_agent, metadata)
      VALUES (
        ${tokenHash},
        ${email ?? null},
        ${name ?? null},
        ${phone ?? null},
        ${websiteId ?? null}::uuid,
        ${pageUrl ?? null},
        ${referrer ?? null},
        ${userAgent ?? null},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING *
    `;
    const session = sessionRows[0];

    // Create a support conversation for this guest
    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations
        (type, title, created_by_guest_id, website_id, status, metadata)
      VALUES (
        'external_support',
        ${name ? `Chat de ${name}` : email ? `Chat de ${email}` : "Chat de visitante"},
        ${session.id},
        ${websiteId ?? null}::uuid,
        'pending',
        ${JSON.stringify({ pageUrl, referrer, userAgent })}::jsonb
      )
      RETURNING *
    `;
    const conv = convRows[0];

    // Add guest as member
    await prisma.$executeRaw`
      INSERT INTO chat_conversation_members (conversation_id, guest_session_id, role)
      VALUES (${conv.id}, ${session.id}, 'guest')
    `;

    return {
      token: rawToken,
      sessionId: session.id,
      conversationId: conv.id,
      expiresAt: session.expires_at,
    };
  }

  async function resolveGuestSession(rawToken) {
    const tokenHash = hashToken(rawToken);
    const rows = await prisma.$queryRaw`
      SELECT * FROM chat_guest_sessions
      WHERE session_token_hash = ${tokenHash}
        AND closed_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `;
    if (!rows.length) throw new GuestChatServiceError("Sesion de invitado invalida o expirada.", 401);

    // Refresh last_seen_at
    await prisma.$executeRaw`
      UPDATE chat_guest_sessions SET last_seen_at = NOW() WHERE id = ${rows[0].id}
    `;

    return rows[0];
  }

  async function getGuestSessionInfo(rawToken) {
    const session = await resolveGuestSession(rawToken);

    const convRows = await prisma.$queryRaw`
      SELECT c.id, c.status, c.title, c.created_at
      FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id AND ccm.guest_session_id = ${session.id}
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 1
    `;

    return {
      sessionId: session.id,
      email: session.email,
      name: session.name,
      conversation: convRows[0] ?? null,
      expiresAt: session.expires_at,
    };
  }

  // ------------------------------------------------------------------
  // Guest messages
  // ------------------------------------------------------------------

  async function sendGuestMessage({ rawToken, body, messageType = "text", metadata = {} }) {
    const session = await resolveGuestSession(rawToken);

    const convRows = await prisma.$queryRaw`
      SELECT c.id FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id AND ccm.guest_session_id = ${session.id}
      WHERE c.deleted_at IS NULL AND c.status != 'closed'
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    if (!convRows.length) throw new GuestChatServiceError("No hay conversacion activa.", 404);
    const conversationId = convRows[0].id;

    const msgRows = await prisma.$queryRaw`
      INSERT INTO chat_messages
        (conversation_id, sender_guest_id, sender_type, body, message_type, metadata)
      VALUES (
        ${conversationId},
        ${session.id},
        'guest',
        ${body},
        ${messageType},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING *
    `;
    const msg = msgRows[0];

    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET last_message_id = ${msg.id},
          last_message_at = ${msg.created_at},
          status = CASE WHEN status = 'pending' THEN 'open' ELSE status END,
          updated_at = NOW()
      WHERE id = ${conversationId}
    `;

    // Notify operators via Supabase Realtime broadcast
    try {
      const channel = supabaseAdmin.channel(`chat:conv:${conversationId}`);
      await channel.send({
        type: "broadcast",
        event: "new_guest_message",
        payload: { conversationId, messageId: msg.id, sessionId: session.id },
      });
    } catch {
      // Non-fatal: realtime notification failure
    }

    return { messageId: msg.id, conversationId, createdAt: msg.created_at };
  }

  async function listGuestMessages({ rawToken, limit = 40, before = null }) {
    const session = await resolveGuestSession(rawToken);

    const convRows = await prisma.$queryRaw`
      SELECT c.id FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id AND ccm.guest_session_id = ${session.id}
      WHERE c.deleted_at IS NULL
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    if (!convRows.length) return { data: [] };
    const conversationId = convRows[0].id;

    const rows = await prisma.$queryRaw`
      SELECT
        m.id,
        m.body,
        m.sender_type,
        m.message_type,
        m.attachment_count,
        m.metadata,
        m.created_at,
        m.edited_at,
        m.deleted_at,
        CASE
          WHEN m.sender_type = 'user' THEN
            json_build_object('displayName', up.display_name, 'avatarUrl', up.avatar_url)
          ELSE NULL
        END AS sender,
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'fileName', a.file_name,
            'mimeType', a.mime_type,
            'sizeBytes', a.size_bytes,
            'objectKey', a.object_key
          ))
          FROM chat_attachments a WHERE a.message_id = m.id
        ) AS attachments
      FROM chat_messages m
      LEFT JOIN "UserProfile" up ON up.id = m.sender_user_id
      WHERE m.conversation_id = ${conversationId}
        AND m.deleted_at IS NULL
        ${before ? prisma.$queryRaw`AND m.created_at < ${new Date(before)}` : prisma.$queryRaw``}
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;

    return { data: rows.reverse(), conversationId };
  }

  async function closeGuestSession({ rawToken }) {
    const session = await resolveGuestSession(rawToken);
    await prisma.$executeRaw`
      UPDATE chat_guest_sessions SET closed_at = NOW() WHERE id = ${session.id}
    `;
    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET status = 'closed', updated_at = NOW()
      FROM chat_conversation_members ccm
      WHERE chat_conversations.id = ccm.conversation_id
        AND ccm.guest_session_id = ${session.id}
    `;
    return { ok: true };
  }

  return {
    createGuestSession,
    resolveGuestSession,
    getGuestSessionInfo,
    sendGuestMessage,
    listGuestMessages,
    closeGuestSession,
  };
}
