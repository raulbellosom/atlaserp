import crypto from "node:crypto";

export class ChatServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
  }
}

export function createChatService({ prisma, supabaseAdmin, notificationService = null }) {
  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  async function getUserProfileId(authUserId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Usuario no encontrado.", 404);
    return rows[0].id;
  }

  async function assertMember(conversationId, userProfileId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId}
        AND user_id = ${userProfileId}
        AND left_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) {
      throw new ChatServiceError("No eres miembro de esta conversacion.", 403);
    }
  }

  async function updateConversationLastMessage(conversationId, messageId, createdAt) {
    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET last_message_id = ${messageId},
          last_message_at = ${createdAt},
          updated_at = NOW()
      WHERE id = ${conversationId}
    `;
  }

  // ------------------------------------------------------------------
  // Conversations
  // ------------------------------------------------------------------

  async function listConversations({ authUserId, limit = 50, cursor = null }) {
    const profileId = await getUserProfileId(authUserId);

    let cursorClause = prisma.$queryRaw``;
    const params = [profileId, limit + 1];

    const rows = await prisma.$queryRaw`
      SELECT
        c.id,
        c.type,
        c.title,
        c.avatar_url,
        c.status,
        c.last_message_at,
        c.last_message_id,
        c.website_id,
        c.company_id,
        c.metadata,
        c.created_at,
        -- unread count
        (
          SELECT COUNT(*)::int FROM chat_messages m
          WHERE m.conversation_id = c.id
            AND m.deleted_at IS NULL
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM chat_conversation_members
               WHERE conversation_id = c.id AND user_id = ${profileId}),
              '1970-01-01'::timestamptz
            )
            AND m.sender_user_id != ${profileId}
        ) AS unread_count,
        -- last message preview
        (
          SELECT json_build_object(
            'id', m.id,
            'body', m.body,
            'senderType', m.sender_type,
            'messageType', m.message_type,
            'createdAt', m.created_at,
            'senderUserId', m.sender_user_id
          )
          FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,
        -- members preview (up to 5)
        (
          SELECT json_agg(json_build_object(
            'userId', cm.user_id,
            'role', cm.role,
            'displayName', up.display_name,
            'avatarUrl', up.avatar_url
          ) ORDER BY cm.joined_at)
          FROM (
            SELECT * FROM chat_conversation_members
            WHERE conversation_id = c.id AND user_id IS NOT NULL AND left_at IS NULL
            LIMIT 5
          ) cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
        ) AS members
      FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id
        AND ccm.user_id = ${profileId}
        AND ccm.left_at IS NULL
      WHERE c.deleted_at IS NULL
        ${cursor ? prisma.$queryRaw`AND c.last_message_at < ${new Date(cursor)}` : prisma.$queryRaw``}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].last_message_at?.toISOString() : null,
    };
  }

  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {} }) {
    const creatorProfileId = await getUserProfileId(authUserId);

    // For direct conversations, enforce uniqueness (find existing)
    if (type === "direct" && memberUserIds.length === 1) {
      const otherId = memberUserIds[0];
      const existing = await prisma.$queryRaw`
        SELECT c.id FROM chat_conversations c
        WHERE c.type = 'direct'
          AND c.deleted_at IS NULL
          AND EXISTS (
            SELECT 1 FROM chat_conversation_members WHERE conversation_id = c.id AND user_id = ${creatorProfileId} AND left_at IS NULL
          )
          AND EXISTS (
            SELECT 1 FROM chat_conversation_members WHERE conversation_id = c.id AND user_id = ${otherId} AND left_at IS NULL
          )
        LIMIT 1
      `;
      if (existing.length) {
        return getConversation({ conversationId: existing[0].id, authUserId });
      }
    }

    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, metadata)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${JSON.stringify(metadata)}::jsonb)
      RETURNING *
    `;
    const conv = convRows[0];

    // Add creator as owner
    const allMembers = [creatorProfileId, ...memberUserIds.filter(id => id !== creatorProfileId)];
    for (const uid of allMembers) {
      const role = uid === creatorProfileId ? "owner" : "member";
      await prisma.$executeRaw`
        INSERT INTO chat_conversation_members (conversation_id, user_id, role)
        VALUES (${conv.id}, ${uid}, ${role})
        ON CONFLICT DO NOTHING
      `;
    }

    // System message: group created
    if (type === "group") {
      const [creatorUser] = await prisma.$queryRaw`
        SELECT display_name FROM user_profile WHERE id = ${creatorProfileId} LIMIT 1
      `;
      const systemBody = `${creatorUser?.display_name ?? "Un usuario"} creó el grupo`;
      await prisma.$executeRaw`
        INSERT INTO chat_messages (conversation_id, sender_type, body, message_type)
        VALUES (${conv.id}, 'system', ${systemBody}, 'system')
      `;
    }

    return getConversation({ conversationId: conv.id, authUserId });
  }

  async function getConversation({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const rows = await prisma.$queryRaw`
      SELECT
        c.*,
        (
          SELECT json_agg(json_build_object(
            'id', cm.id,
            'userId', cm.user_id,
            'role', cm.role,
            'joinedAt', cm.joined_at,
            'leftAt', cm.left_at,
            'lastReadAt', cm.last_read_at,
            'displayName', up.display_name,
            'avatarUrl', up.avatar_url,
            'email', up.email
          ) ORDER BY cm.joined_at)
          FROM chat_conversation_members cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
          WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
        ) AS members
      FROM chat_conversations c
      WHERE c.id = ${conversationId} AND c.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Conversacion no encontrada.", 404);
    return rows[0];
  }

  async function updateConversation({ conversationId, authUserId, updates }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const sets = [];
    const values = [];

    if (updates.title !== undefined) {
      sets.push("title");
      values.push(updates.title);
    }
    if (updates.status !== undefined) {
      sets.push("status");
      values.push(updates.status);
    }

    if (!sets.length) return getConversation({ conversationId, authUserId });

    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET title = COALESCE(${updates.title ?? null}, title),
          status = COALESCE(${updates.status ?? null}, status),
          updated_at = NOW()
      WHERE id = ${conversationId}
    `;

    return getConversation({ conversationId, authUserId });
  }

  // ------------------------------------------------------------------
  // Members
  // ------------------------------------------------------------------

  async function addMembers({ conversationId, authUserId, userIds, role = "member" }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const results = [];
    for (const uid of userIds) {
      await prisma.$executeRaw`
        INSERT INTO chat_conversation_members (conversation_id, user_id, role)
        VALUES (${conversationId}, ${uid}, ${role})
        ON CONFLICT DO NOTHING
      `;

      // System message
      const [newUser] = await prisma.$queryRaw`
        SELECT display_name FROM user_profile WHERE id = ${uid} LIMIT 1
      `;
      if (newUser) {
        await prisma.$executeRaw`
          INSERT INTO chat_messages (conversation_id, sender_type, body, message_type, sender_user_id)
          VALUES (${conversationId}, 'system', ${`${newUser.display_name} se unió al grupo`}, 'system', ${profileId})
        `;
      }
      results.push(uid);
    }
    return { added: results };
  }

  async function removeMember({ conversationId, authUserId, targetUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET left_at = NOW()
      WHERE conversation_id = ${conversationId}
        AND user_id = ${targetUserId}
        AND left_at IS NULL
    `;

    const [removedUser] = await prisma.$queryRaw`
      SELECT display_name FROM user_profile WHERE id = ${targetUserId} LIMIT 1
    `;
    if (removedUser) {
      await prisma.$executeRaw`
        INSERT INTO chat_messages (conversation_id, sender_type, body, message_type, sender_user_id)
        VALUES (${conversationId}, 'system', ${`${removedUser.display_name} salió del grupo`}, 'system', ${profileId})
      `;
    }

    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Messages
  // ------------------------------------------------------------------

  async function listMessages({ conversationId, authUserId, limit = 40, before = null }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const rows = await prisma.$queryRaw`
      SELECT
        m.id,
        m.conversation_id,
        m.sender_user_id,
        m.sender_guest_id,
        m.sender_type,
        m.body,
        m.message_type,
        m.attachment_count,
        m.metadata,
        m.created_at,
        m.edited_at,
        m.deleted_at,
        -- sender info
        json_build_object(
          'id', up.id,
          'displayName', up.display_name,
          'avatarUrl', up.avatar_url
        ) AS sender,
        -- attachments
        (
          SELECT json_agg(json_build_object(
            'id', a.id,
            'fileName', a.file_name,
            'mimeType', a.mime_type,
            'sizeBytes', a.size_bytes,
            'width', a.width,
            'height', a.height,
            'objectKey', a.object_key,
            'bucket', a.bucket
          ) ORDER BY a.created_at)
          FROM chat_attachments a WHERE a.message_id = m.id
        ) AS attachments
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.conversation_id = ${conversationId}
        ${before ? prisma.$queryRaw`AND m.created_at < ${new Date(before)}` : prisma.$queryRaw``}
      ORDER BY m.created_at DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: data.reverse(),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.created_at?.toISOString() : null,
    };
  }

  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [] }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const msgRows = await prisma.$queryRaw`
      INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata)
      VALUES (
        ${conversationId},
        ${profileId},
        'user',
        ${body},
        ${messageType},
        ${attachmentIds.length},
        ${JSON.stringify(metadata)}::jsonb
      )
      RETURNING *
    `;
    const msg = msgRows[0];

    if (attachmentIds.length) {
      await prisma.$executeRaw`
        UPDATE chat_attachments
        SET message_id = ${msg.id}
        WHERE id = ANY(${attachmentIds}::uuid[])
          AND uploaded_by_user_id = ${profileId}
      `;
    }

    await updateConversationLastMessage(conversationId, msg.id, msg.created_at);

    // Notify other members (fire-and-forget — don't fail the send on notification error)
    if (notificationService) {
      setImmediate(async () => {
        try {
          const senderMembership = await prisma.membership.findFirst({
            where: { userId: profileId.toString(), enabled: true },
            orderBy: { createdAt: "desc" },
            select: { companyId: true },
          });
          const companyId = senderMembership?.companyId;
          if (!companyId) return;

          const otherMembers = await prisma.$queryRaw`
            SELECT user_id
            FROM chat_conversation_members
            WHERE conversation_id = ${conversationId}
              AND user_id != ${profileId}
              AND left_at IS NULL
          `;
          if (!otherMembers.length) return;

          const recipientIds = otherMembers.map((m) => m.user_id.toString());
          const preview = body.length > 80 ? `${body.slice(0, 80)}...` : body;
          await notificationService.publish({
            companyId,
            actorId: profileId,
            input: {
              eventType: "chat.message.new",
              title: "Nuevo mensaje de chat",
              body: preview,
              link: `/app/m/atlas.chat/chat/inbox`,
              recipients: { userIds: recipientIds },
              channels: ["in_app"],
              priority: "medium",
              sourceType: "chat_conversation",
              sourceId: conversationId,
              dedupeKey: `chat.message.new:${msg.id}`,
            },
          });
        } catch {}
      });
    }

    return msg;
  }

  async function editMessage({ messageId, authUserId, body }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.*, ccm.user_id AS member_user_id
      FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL AND m.sender_user_id = ${profileId}
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado o sin permiso.", 403);

    const updated = await prisma.$queryRaw`
      UPDATE chat_messages
      SET body = ${body}, edited_at = NOW()
      WHERE id = ${messageId}
      RETURNING *
    `;
    return updated[0];
  }

  async function deleteMessage({ messageId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT id FROM chat_messages
      WHERE id = ${messageId}
        AND sender_user_id = ${profileId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado o sin permiso.", 403);

    await prisma.$executeRaw`
      UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${messageId}
    `;
    return { ok: true };
  }

  async function markConversationRead({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET last_read_at = NOW()
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId}
    `;
    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Attachments
  // ------------------------------------------------------------------

  async function presignAttachmentUpload({ authUserId, conversationId, fileName, mimeType, sizeBytes }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const ALLOWED_MIME = [
      /^image\//,
      /^application\/pdf$/,
      /^text\/plain$/,
      /^application\/msword$/,
      /^application\/vnd\.openxmlformats/,
      /^application\/zip$/,
      /^application\/x-zip/,
    ];
    const allowed = ALLOWED_MIME.some(re => re.test(mimeType));
    if (!allowed) throw new ChatServiceError("Tipo de archivo no permitido.", 422);
    if (sizeBytes > 20 * 1024 * 1024) throw new ChatServiceError("Archivo demasiado grande (max 20 MB).", 422);

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const placeholderMsgId = crypto.randomUUID();
    const objectKey = `conversations/${conversationId}/${placeholderMsgId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from("atlas-chat")
      .createSignedUploadUrl(objectKey, { expiresIn: 300 });

    if (error) throw new ChatServiceError("Error generando URL de subida.", 500);

    // Pre-create attachment record (message_id will be set on sendMessage)
    const attRows = await prisma.$queryRaw`
      INSERT INTO chat_attachments
        (conversation_id, message_id, bucket, object_key, file_name, mime_type, size_bytes, uploaded_by_user_id)
      VALUES (
        ${conversationId},
        ${placeholderMsgId}::uuid,
        'atlas-chat',
        ${objectKey},
        ${fileName},
        ${mimeType},
        ${sizeBytes},
        ${profileId}
      )
      RETURNING id
    `;

    return {
      attachmentId: attRows[0].id,
      uploadUrl: data.signedUrl,
      token: data.token,
      objectKey,
    };
  }

  async function getAttachmentSignedUrl({ attachmentId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.* FROM chat_attachments a
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = a.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Adjunto no encontrado.", 404);

    const att = rows[0];
    const { data, error } = await supabaseAdmin.storage
      .from(att.bucket)
      .createSignedUrl(att.object_key, 3600);

    if (error) throw new ChatServiceError("Error generando URL firmada.", 500);
    return { url: data.signedUrl, attachment: att };
  }

  // ------------------------------------------------------------------
  // External inbox (operator view)
  // ------------------------------------------------------------------

  async function listExternalInbox({ authUserId, status = "open", limit = 30, cursor = null }) {
    const rows = await prisma.$queryRaw`
      SELECT
        c.*,
        gs.email AS guest_email,
        gs.name AS guest_name,
        gs.page_url AS guest_page_url,
        (
          SELECT COUNT(*)::int FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
        ) AS message_count,
        (
          SELECT json_build_object(
            'id', m.id, 'body', m.body, 'senderType', m.sender_type, 'createdAt', m.created_at
          )
          FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
          ORDER BY m.created_at DESC LIMIT 1
        ) AS last_message
      FROM chat_conversations c
      LEFT JOIN chat_guest_sessions gs ON gs.id = c.created_by_guest_id
      WHERE c.type = 'external_support'
        AND c.deleted_at IS NULL
        AND c.status = ${status}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT ${limit}
    `;
    return { data: rows };
  }

  async function assignOperator({ conversationId, authUserId, operatorUserId }) {
    const profileId = await getUserProfileId(authUserId);

    await prisma.$executeRaw`
      INSERT INTO chat_conversation_members (conversation_id, user_id, role)
      VALUES (${conversationId}, ${operatorUserId}, 'operator')
      ON CONFLICT DO NOTHING
    `;

    const [op] = await prisma.$queryRaw`
      SELECT display_name FROM user_profile WHERE id = ${operatorUserId} LIMIT 1
    `;
    if (op) {
      await prisma.$executeRaw`
        INSERT INTO chat_messages (conversation_id, sender_type, body, message_type, sender_user_id)
        VALUES (${conversationId}, 'system', ${`${op.display_name} fue asignado como operador`}, 'system', ${profileId})
      `;
    }

    return { ok: true };
  }

  async function closeExternalConversation({ conversationId, authUserId }) {
    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET status = 'closed', updated_at = NOW()
      WHERE id = ${conversationId} AND type = 'external_support'
    `;
    return { ok: true };
  }

  return {
    listConversations,
    createConversation,
    getConversation,
    updateConversation,
    addMembers,
    removeMember,
    listMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markConversationRead,
    presignAttachmentUpload,
    getAttachmentSignedUrl,
    listExternalInbox,
    assignOperator,
    closeExternalConversation,
  };
}
