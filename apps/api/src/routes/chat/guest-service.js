import crypto from "node:crypto";
import { Prisma } from "@prisma/client";

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

// ------------------------------------------------------------------
// Auto-assign conversation to least-loaded available operator
// ------------------------------------------------------------------
async function autoAssign(prisma, conversationId, companyId) {
  const candidates = await prisma.$queryRaw`
    SELECT up.id AS user_id, COUNT(cc.id)::int AS open_count
    FROM "UserProfile" up
    LEFT JOIN chat_conversations cc
      ON cc.assigned_user_id = up.id
      AND cc.status IN ('open', 'pending')
      AND cc.type = 'external_support'
      AND cc.deleted_at IS NULL
    WHERE up."companyId" = ${companyId}::uuid
      AND up."availableForChat" = true
    GROUP BY up.id
    ORDER BY open_count ASC, RANDOM()
    LIMIT 1
  `;
  if (!candidates[0]) return null;
  const userId = candidates[0].user_id;
  await prisma.$executeRaw`
    UPDATE chat_conversations SET assigned_user_id = ${userId}::uuid WHERE id = ${conversationId}::uuid
  `;
  await prisma.$executeRaw`
    INSERT INTO chat_conversation_members (conversation_id, user_id, role)
    VALUES (${conversationId}::uuid, ${userId}::uuid, 'operator')
    ON CONFLICT DO NOTHING
  `;
  return userId;
}

// ------------------------------------------------------------------
// Non-blocking lead capture in atlas.growth
// ------------------------------------------------------------------
async function captureGrowthLead(prisma, { companyId, email, name }) {
  try {
    const sites = await prisma.$queryRaw`
      SELECT id FROM website_site WHERE company_id = ${companyId}::uuid AND enabled = true LIMIT 1
    `;
    if (!sites[0]) return;
    const existing = await prisma.$queryRaw`
      SELECT id FROM growth_lead
      WHERE company_id = ${companyId}::uuid
        AND email_normalized = lower(${email})
        AND created_at > NOW() - INTERVAL '7 days'
      LIMIT 1
    `;
    if (existing[0]) return;
    await prisma.growthLead.create({
      data: {
        companyId,
        siteId: sites[0].id,
        status: "new",
        source: "chat_widget",
        email,
        emailNormalized: email.toLowerCase().trim(),
        name: name ?? null,
        message: "Lead generado desde el chat de la web.",
        firstSubmissionAt: new Date(),
        lastSubmissionAt: new Date(),
        firstSeenAt: new Date(),
        lastSeenAt: new Date(),
      },
    });
  } catch {
    // Non-fatal
  }
}

export function createGuestChatService({ prisma, supabaseAdmin, notificationService }) {
  // ------------------------------------------------------------------
  // Session management
  // ------------------------------------------------------------------

  async function createGuestSession({ email, name, phone, websiteId, pageUrl, referrer, userAgent, metadata = {}, companyId }) {
    // Session continuation: if same email has an active session, issue a resume token
    if (email && companyId) {
      const existing = await prisma.$queryRaw`
        SELECT cgs.id, cgs.session_token_hash, cc.id AS conversation_id
        FROM chat_guest_sessions cgs
        JOIN chat_conversations cc ON cc.created_by_guest_id = cgs.id
        WHERE lower(cgs.email) = lower(${email})
          AND cgs.closed_at IS NULL
          AND cgs.idle_expires_at > NOW()
          AND cgs.absolute_expires_at > NOW()
          AND cc.status != 'closed'
          AND cc.deleted_at IS NULL
        ORDER BY cgs.created_at DESC
        LIMIT 1
      `;
      if (existing[0]) {
        const resumeToken = crypto.randomBytes(32).toString("hex");
        const resumeHash = hashToken(resumeToken);
        await prisma.$executeRaw`
          UPDATE chat_guest_sessions
          SET resume_token_hash = ${resumeHash},
              idle_expires_at = NOW() + INTERVAL '30 minutes',
              last_seen_at = NOW()
          WHERE id = ${existing[0].id}::uuid
        `;
        return {
          token: resumeToken,
          sessionId: existing[0].id,
          conversationId: existing[0].conversation_id,
          resumed: true,
        };
      }
    }

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
        (type, title, created_by_guest_id, website_id, company_id, status, metadata)
      VALUES (
        'external_support',
        ${name ? `Chat de ${name}` : email ? `Chat de ${email}` : "Chat de visitante"},
        ${session.id},
        ${websiteId ?? null}::uuid,
        ${companyId ?? null}::uuid,
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

    // Auto-assign to an available operator
    let assignedUserId = null;
    if (companyId) {
      assignedUserId = await autoAssign(prisma, conv.id, companyId);
    }

    // Non-blocking: capture lead in atlas.growth
    if (email && companyId) {
      setImmediate(() => captureGrowthLead(prisma, { companyId, email, name }));
    }

    return {
      token: rawToken,
      sessionId: session.id,
      conversationId: conv.id,
      assignedUserId,
      resumed: false,
    };
  }

  async function resolveGuestSession(rawToken) {
    const tokenHash = hashToken(rawToken);

    // Check primary token
    let rows = await prisma.$queryRaw`
      SELECT * FROM chat_guest_sessions
      WHERE session_token_hash = ${tokenHash}
        AND closed_at IS NULL
        AND idle_expires_at > NOW()
        AND absolute_expires_at > NOW()
      LIMIT 1
    `;

    // Check resume token (single-use)
    if (!rows.length) {
      rows = await prisma.$queryRaw`
        SELECT * FROM chat_guest_sessions
        WHERE resume_token_hash = ${tokenHash}
          AND closed_at IS NULL
          AND idle_expires_at > NOW()
          AND absolute_expires_at > NOW()
        LIMIT 1
      `;
      if (rows.length) {
        // Consume the resume token immediately
        await prisma.$executeRaw`
          UPDATE chat_guest_sessions SET resume_token_hash = NULL WHERE id = ${rows[0].id}
        `;
      }
    }

    if (!rows.length) throw new GuestChatServiceError("Sesion de invitado invalida o expirada.", 401);
    return rows[0];
  }

  async function getGuestSessionInfo(rawToken) {
    const session = await resolveGuestSession(rawToken);

    const convRows = await prisma.$queryRaw`
      SELECT c.id, c.status, c.title, c.created_at,
             c.assigned_user_id AS "assignedUserId",
             c.idle_expires_at AS "idleExpiresAt",
             c.absolute_expires_at AS "absoluteExpiresAt"
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
      idleExpiresAt: session.idle_expires_at,
      absoluteExpiresAt: session.absolute_expires_at,
    };
  }

  // ------------------------------------------------------------------
  // Guest messages
  // ------------------------------------------------------------------

  async function sendGuestMessage({ rawToken, body, messageType = "text", metadata = {} }) {
    const session = await resolveGuestSession(rawToken);

    const convRows = await prisma.$queryRaw`
      SELECT c.id, c.company_id, c.assigned_user_id
      FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id AND ccm.guest_session_id = ${session.id}
      WHERE c.deleted_at IS NULL AND c.status != 'closed'
      ORDER BY c.created_at DESC
      LIMIT 1
    `;
    if (!convRows.length) throw new GuestChatServiceError("No hay conversacion activa.", 404);
    const { id: conversationId, company_id: companyId, assigned_user_id: assignedUserId } = convRows[0];

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

    // Update conversation + bump idle expiry on the session
    await Promise.all([
      prisma.$executeRaw`
        UPDATE chat_conversations
        SET last_message_id = ${msg.id},
            last_message_at = ${msg.created_at},
            status = CASE WHEN status = 'pending' THEN 'open' ELSE status END,
            updated_at = NOW()
        WHERE id = ${conversationId}
      `,
      prisma.$executeRaw`
        UPDATE chat_guest_sessions
        SET idle_expires_at = NOW() + INTERVAL '30 minutes',
            last_seen_at = NOW()
        WHERE id = ${session.id}
      `,
    ]);

    // Broadcast to operators via Supabase Realtime
    try {
      await supabaseAdmin.channel(`chat:conv:${conversationId}`).send({
        type: "broadcast",
        event: "new_guest_message",
        payload: {
          conversationId,
          messageId: msg.id,
          sessionId: session.id,
          senderType: "guest",
          senderName: session.name ?? session.email ?? "Visitante",
          body,
          messageType,
          createdAt: msg.created_at,
        },
      });
    } catch {
      // Non-fatal
    }

    // In-app notification to assigned operator (or broadcast to all available)
    if (notificationService && companyId) {
      setImmediate(async () => {
        try {
          if (assignedUserId) {
            await notificationService.createNotification({
              companyId,
              userId: assignedUserId,
              channels: ["in_app"],
              type: "chat.new_guest_message",
              title: "Nuevo mensaje de visitante",
              body: body.slice(0, 100),
              sourceType: "ChatConversation",
              sourceId: conversationId,
              actionUrl: `/app/chat/external/${conversationId}`,
            });
          } else {
            // No assigned operator: notify all available operators
            const operators = await prisma.$queryRaw`
              SELECT id FROM "UserProfile"
              WHERE "companyId" = ${companyId}::uuid AND "availableForChat" = true
            `;
            await Promise.all(
              operators.map((op) =>
                notificationService.createNotification({
                  companyId,
                  userId: op.id,
                  channels: ["in_app"],
                  type: "chat.new_guest_message",
                  title: "Nuevo mensaje de visitante sin asignar",
                  body: body.slice(0, 100),
                  sourceType: "ChatConversation",
                  sourceId: conversationId,
                  actionUrl: `/app/chat/external/${conversationId}`,
                }).catch(() => {})
              )
            );
          }
        } catch {
          // Non-fatal
        }
      });
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
        m.sender_type AS "senderType",
        m.message_type AS "messageType",
        m.attachment_count AS "attachmentCount",
        m.metadata,
        m.created_at AS "createdAt",
        m.edited_at AS "editedAt",
        m.deleted_at AS "deletedAt",
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
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.conversation_id = ${conversationId}
        AND m.deleted_at IS NULL
        ${before ? Prisma.sql`AND m.created_at < ${new Date(before)}` : Prisma.empty}
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
