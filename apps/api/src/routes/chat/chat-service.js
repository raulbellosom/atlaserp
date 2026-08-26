import crypto from "node:crypto";
import { Prisma } from "@prisma/client";
import { signedUrlWithVariant } from "../../lib/image-variants.js";
import { parseMentionIds } from "../../lib/mention-utils.js";

export class ChatServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "ChatServiceError";
    this.status = status;
  }
}

// auth_user_id → user_profile.id never changes; cache per-process to avoid
// one extra DB round-trip on every chat request when the pool is under load.
const _profileIdCache = new Map();
const PROFILE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Supabase Storage signed URLs are valid for 3600s; cache them for 55 min so we
// never hit the VPS more than once per file per hour regardless of poll frequency.
const _signedUrlCache = new Map();
const SIGNED_URL_TTL_MS = 55 * 60 * 1000; // 55 minutes

function getCachedSignedUrl(bucket, objectKey, variant) {
  const key = `${bucket}:${objectKey}:${variant}`;
  const entry = _signedUrlCache.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.url;
  _signedUrlCache.delete(key);
  return null;
}

function setCachedSignedUrl(bucket, objectKey, variant, url) {
  _signedUrlCache.set(`${bucket}:${objectKey}:${variant}`, {
    url,
    expiresAt: Date.now() + SIGNED_URL_TTL_MS,
  });
}

// Exported so sibling chat services (chat-permissions-service.js,
// channel-directory-service.js) can resolve auth_user_id -> user_profile.id
// without duplicating the cache.
export async function resolveUserProfileId(prisma, authUserId) {
  const cached = _profileIdCache.get(authUserId);
  if (cached && cached.expiresAt > Date.now()) return cached.profileId;

  const rows = await prisma.$queryRaw`
    SELECT id FROM user_profile WHERE auth_user_id = ${authUserId} LIMIT 1
  `;
  if (!rows.length) throw new ChatServiceError("Usuario no encontrado.", 404);

  const profileId = rows[0].id;
  _profileIdCache.set(authUserId, { profileId, expiresAt: Date.now() + PROFILE_CACHE_TTL_MS });
  return profileId;
}

// Test-only: clears the shared cache so unit tests with mocked prisma clients
// don't get a cached profileId leaked from a different test's mock data.
export function _resetProfileIdCacheForTests() {
  _profileIdCache.clear();
}

export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null, mentionsService = null }) {
  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  async function getUserProfileId(authUserId) {
    return resolveUserProfileId(prisma, authUserId);
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

  async function getConversationMemberIds(conversationId) {
    const rows = await prisma.$queryRaw`
      SELECT user_id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND left_at IS NULL AND user_id IS NOT NULL
    `;
    return rows.map((r) => r.user_id.toString());
  }

  // fileAsset rows for avatar files never change; cache them to avoid DB queries per poll
  const _fileAssetCache = new Map(); // fileId → { bucket, objectKey, expiresAt }
  const FILE_ASSET_TTL_MS = 30 * 60 * 1000; // 30 minutes

  async function batchSignAvatarUrls(fileIds) {
    if (!fileIds.length) return {};

    // Split into cache hits and misses
    const now = Date.now();
    const missIds = [];
    const assetMap = {};
    for (const id of fileIds) {
      const entry = _fileAssetCache.get(id);
      if (entry && entry.expiresAt > now) {
        assetMap[id] = entry;
      } else {
        missIds.push(id);
      }
    }

    if (missIds.length) {
      const rows = await prisma.fileAsset.findMany({
        where: { id: { in: missIds } },
        select: { id: true, bucket: true, objectKey: true },
      });
      for (const row of rows) {
        const entry = { bucket: row.bucket, objectKey: row.objectKey, expiresAt: now + FILE_ASSET_TTL_MS };
        _fileAssetCache.set(row.id, entry);
        assetMap[row.id] = entry;
      }
    }

    const result = {};
    await Promise.all(
      Object.entries(assetMap).map(async ([id, fa]) => {
        try {
          const cached = getCachedSignedUrl(fa.bucket, fa.objectKey, "thumb");
          if (cached) { result[id] = cached; return; }
          const signedUrl = await signedUrlWithVariant(supabaseAdmin, fa.bucket, fa.objectKey, "thumb");
          if (signedUrl) {
            setCachedSignedUrl(fa.bucket, fa.objectKey, "thumb", signedUrl);
            result[id] = signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }

  // Returns { "bucket:objectKey": signedUrl } for a list of { bucket, objectKey } pairs.
  async function batchSignAttachmentUrls(pairs) {
    if (!pairs.length) return {};
    const result = {};
    await Promise.all(
      pairs.map(async ({ bucket, objectKey }) => {
        const cacheKey = `${bucket}:${objectKey}`;
        try {
          const cached = getCachedSignedUrl(bucket, objectKey, "card");
          if (cached) { result[cacheKey] = cached; return; }
          const signedUrl = await signedUrlWithVariant(supabaseAdmin, bucket, objectKey, "card");
          if (signedUrl) {
            setCachedSignedUrl(bucket, objectKey, "card", signedUrl);
            result[cacheKey] = signedUrl;
          }
        } catch {}
      }),
    );
    return result;
  }

  // ------------------------------------------------------------------
  // Conversations
  // ------------------------------------------------------------------

  async function listConversations({ authUserId, limit = 50, cursor = null, archived = false }) {
    const profileId = await getUserProfileId(authUserId);

    const cursorClause = cursor ? Prisma.sql`AND c.last_message_at < ${new Date(cursor)}` : Prisma.empty;
    const archiveClause = archived
      ? Prisma.sql`AND ccm.archived_at IS NOT NULL`
      : Prisma.sql`AND ccm.archived_at IS NULL`;

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
        -- IS DISTINCT FROM handles NULL sender_user_id (guest messages) correctly
        -- != would evaluate NULL != profileId as NULL (falsy), missing guest messages
        (
          SELECT COUNT(*)::int FROM chat_messages m
          WHERE m.conversation_id = c.id
            AND m.deleted_at IS NULL
            AND m.thread_root_id IS NULL
            AND m.sender_type != 'system'
            AND m.sender_user_id IS DISTINCT FROM ${profileId}
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM chat_conversation_members
               WHERE conversation_id = c.id AND user_id = ${profileId}),
              '1970-01-01'::timestamptz
            )
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
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL AND m.thread_root_id IS NULL
          ORDER BY m.created_at DESC
          LIMIT 1
        ) AS last_message,
        -- members preview (up to 5)
        (
          SELECT json_agg(json_build_object(
            'userId', cm.user_id,
            'role', cm.role,
            'displayName', up.display_name,
            'avatarFileId', up.avatar_file_id::text,
            'authAvatarUrl', au.raw_user_meta_data->>'avatar_url',
            'lastReadAt', cm.last_read_at
          ) ORDER BY cm.joined_at)
          FROM (
            SELECT * FROM chat_conversation_members
            WHERE conversation_id = c.id AND user_id IS NOT NULL AND left_at IS NULL
            LIMIT 5
          ) cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
          LEFT JOIN auth.users au ON au.id = up.auth_user_id
        ) AS members,
        ccm.archived_at IS NOT NULL AS is_archived
      FROM chat_conversations c
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = c.id
        AND ccm.user_id = ${profileId}
        AND ccm.left_at IS NULL
      WHERE c.deleted_at IS NULL
        AND c.type != 'external_support'
        ${archiveClause}
        ${cursorClause}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const allFileIds = [
      ...new Set(
        data.flatMap((c) => (c.members ?? []).map((m) => m.avatarFileId).filter(Boolean)),
      ),
    ];
    const avatarUrlMap = allFileIds.length ? await batchSignAvatarUrls(allFileIds) : {};
    for (const conv of data) {
      if (conv.members) {
        conv.members = conv.members.map((m) => ({
          ...m,
          avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
          avatarFileId: undefined,
          authAvatarUrl: undefined,
        }));
      }
    }

    return {
      data,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1].last_message_at?.toISOString() : null,
    };
  }

  async function archiveConversation({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET archived_at = NOW()
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
    `;
    return { ok: true };
  }

  async function unarchiveConversation({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET archived_at = NULL
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
    `;
    return { ok: true };
  }

  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {}, isPublic = false, slug = null, description = null }) {
    const creatorProfileId = await getUserProfileId(authUserId);

    // Prevent self-chat
    if (type === "direct" && memberUserIds.length === 1 && memberUserIds[0] === creatorProfileId.toString()) {
      throw new ChatServiceError("No puedes iniciar un chat contigo mismo.", 400);
    }

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

    const membership = await prisma.membership.findFirst({
      where: { userId: creatorProfileId.toString(), enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });
    const companyId = membership?.companyId ?? null;

    if (type === "channel" && slug) {
      // IS NOT DISTINCT FROM (not =) because company_id can be NULL for a creator
      // with no active membership — SQL's `NULL = NULL` is UNKNOWN, never TRUE, so
      // a plain `=` would silently let two NULL-company channels share a slug.
      const dupe = await prisma.$queryRaw`
        SELECT id FROM chat_conversations WHERE company_id IS NOT DISTINCT FROM ${companyId} AND slug = ${slug} AND deleted_at IS NULL LIMIT 1
      `;
      if (dupe.length) throw new ChatServiceError("Ya existe un canal con ese slug en tu empresa.", 400);
    }

    const convRows = await prisma.$queryRaw`
      INSERT INTO chat_conversations (type, title, created_by_user_id, company_id, is_public, slug, description, metadata)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${companyId}, ${isPublic}, ${slug}, ${description}, ${JSON.stringify(metadata)}::jsonb)
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

    if ((type === "channel" || type === "group") && permissionsService) {
      // Transactional: a crash between seeding the roles and assigning the Owner
      // role would otherwise leave every member (including the creator) with
      // role_id NULL on a channel that already has 4 fully-formed role rows —
      // nobody, not even the nominal Owner, could then manage it (no reseed path).
      await prisma.$transaction(async (tx) => {
        const roleIds = await permissionsService.seedDefaultRoles(conv.id, tx);
        await tx.$executeRaw`
          UPDATE chat_conversation_members SET role_id = ${roleIds.Owner}
          WHERE conversation_id = ${conv.id} AND user_id = ${creatorProfileId}
        `;
        const otherIds = allMembers.filter((id) => id !== creatorProfileId);
        if (otherIds.length) {
          await tx.$executeRaw`
            UPDATE chat_conversation_members SET role_id = ${roleIds.Member}
            WHERE conversation_id = ${conv.id} AND user_id IN (${Prisma.join(otherIds)})
          `;
        }
      });
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

    const newConv = await getConversation({ conversationId: conv.id, authUserId });

    if (broadcaster) {
      const memberIds = allMembers.map((id) => id.toString());
      broadcaster.broadcastToUsers(memberIds, "chat.conversation.new", {
        conversationId: conv.id,
      }).catch(() => {});
    }

    return newConv;
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
            'avatarFileId', up.avatar_file_id::text,
            'authAvatarUrl', au.raw_user_meta_data->>'avatar_url',
            'email', up.email,
            'roleId', cm.role_id,
            'roleName', ccr.name,
            'roleColor', ccr.color,
            'rolePosition', ccr.position,
            'roleIsSystem', ccr.is_system,
            'rolePermissions', ccr.permissions
          ) ORDER BY cm.joined_at)
          FROM chat_conversation_members cm
          LEFT JOIN user_profile up ON up.id = cm.user_id
          LEFT JOIN auth.users au ON au.id = up.auth_user_id
          LEFT JOIN chat_channel_roles ccr ON ccr.id = cm.role_id
          WHERE cm.conversation_id = c.id AND cm.left_at IS NULL
        ) AS members
      FROM chat_conversations c
      WHERE c.id = ${conversationId} AND c.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Conversacion no encontrada.", 404);
    const conv = rows[0];
    if (conv.members) {
      const fileIds = [...new Set(conv.members.map((m) => m.avatarFileId).filter(Boolean))];
      const avatarUrlMap = fileIds.length ? await batchSignAvatarUrls(fileIds) : {};
      conv.members = conv.members.map((m) => ({
        ...m,
        avatarUrl: m.avatarFileId ? (avatarUrlMap[m.avatarFileId] ?? m.authAvatarUrl ?? null) : (m.authAvatarUrl ?? null),
        avatarFileId: undefined,
        authAvatarUrl: undefined,
      }));
    }
    return conv;
  }

  async function updateConversation({ conversationId, authUserId, updates }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (permissionsService) {
      const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (conv && (conv.type === "channel" || conv.type === "group")) {
        await permissionsService.assertChannelPermission(conversationId, profileId, "channel.manage");
      }
    }

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

    if (permissionsService) {
      const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (conv && (conv.type === "channel" || conv.type === "group")) {
        await permissionsService.assertChannelPermission(conversationId, profileId, "members.manage");
      }
    }

    const results = [];
    for (const uid of userIds) {
      await prisma.$executeRaw`
        INSERT INTO chat_conversation_members (conversation_id, user_id, role)
        VALUES (${conversationId}, ${uid}, ${role})
        ON CONFLICT DO NOTHING
      `;

      await prisma.$executeRaw`
        UPDATE chat_conversation_members
        SET role_id = (SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' LIMIT 1)
        WHERE conversation_id = ${conversationId} AND user_id = ${uid} AND role_id IS NULL
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

    if (permissionsService) {
      const isLast = await permissionsService.isLastOwner(conversationId, targetUserId);
      if (isLast) {
        throw new ChatServiceError("No puedes eliminar al unico Owner de la conversacion. Asigna otro Owner primero.", 400);
      }

      // Removing someone ELSE requires members.manage + outranking them. Leaving
      // a conversation on your own (targetUserId === profileId) is always allowed
      // — it is not a "manage members" action — and must skip this block entirely,
      // with no permission check at all, exactly like before this fix.
      if (targetUserId !== profileId) {
        const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
        if (conv && (conv.type === "channel" || conv.type === "group")) {
          const actorRole = await permissionsService.assertChannelPermission(conversationId, profileId, "members.manage");
          const targetRole = await permissionsService.getMemberRole(conversationId, targetUserId);
          // Default to the base Member floor (0), not below it — a role_id-less
          // member (only reachable via the already-documented Member-role-deletion
          // gap) should be exactly as protected as a normal Member, not less.
          const targetPosition = targetRole?.position ?? 0;
          if (actorRole.position <= targetPosition) {
            throw new ChatServiceError("No puedes eliminar a un miembro de rango igual o mayor al tuyo.", 403);
          }
        }
      }
    }

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
  // Internal: fetch a single message with sender + attachments joins
  // ------------------------------------------------------------------

  async function getMessageFull(messageId) {
    const rows = await prisma.$queryRaw`
      SELECT
        m.id, m.conversation_id, m.sender_user_id, m.sender_guest_id,
        m.sender_type, m.body, m.message_type, m.attachment_count,
        m.metadata, m.created_at, m.edited_at, m.deleted_at,
        m.pinned_at,
        m.pinned_by_user_id,
        m.thread_root_id,
        m.thread_reply_count,
        m.thread_last_reply_at,
        json_build_object(
          'id', up.id,
          'displayName', up.display_name,
          'avatarFileId', up.avatar_file_id::text
        ) AS sender,
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
        ) AS attachments,
        -- reactions, grouped by emoji
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) r
        ) AS reactions
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.id = ${messageId}
      LIMIT 1
    `;
    if (!rows.length) return null;
    const m = rows[0];
    const avatarFileIds = m.sender?.avatarFileId ? [m.sender.avatarFileId] : [];
    const urlMap = avatarFileIds.length ? await batchSignAvatarUrls(avatarFileIds) : {};
    return {
      ...m,
      sender: m.sender
        ? {
            ...m.sender,
            avatarUrl: m.sender.avatarFileId ? (urlMap[m.sender.avatarFileId] ?? null) : null,
            avatarFileId: undefined,
          }
        : m.sender,
    };
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
        m.pinned_at,
        m.pinned_by_user_id,
        m.thread_root_id,
        m.thread_reply_count,
        m.thread_last_reply_at,
        -- sender info
        json_build_object(
          'id', up.id,
          'displayName', up.display_name,
          'avatarFileId', up.avatar_file_id::text
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
        ) AS attachments,
        -- reactions, grouped by emoji
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id
            GROUP BY emoji
          ) r
        ) AS reactions
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.conversation_id = ${conversationId}
        AND m.thread_root_id IS NULL
        ${before ? Prisma.sql`AND m.created_at < ${new Date(before)}` : Prisma.empty}
      ORDER BY m.created_at DESC
      LIMIT ${limit + 1}
    `;

    const hasMore = rows.length > limit;
    const data = hasMore ? rows.slice(0, limit) : rows;

    const senderFileIds = [
      ...new Set(data.map((m) => m.sender?.avatarFileId).filter(Boolean)),
    ];

    // Collect unique attachment (bucket, objectKey) pairs across all messages
    const attachmentPairs = [];
    const seenAttachmentKeys = new Set();
    for (const m of data) {
      for (const a of m.attachments ?? []) {
        if (a.bucket && a.objectKey) {
          const k = `${a.bucket}:${a.objectKey}`;
          if (!seenAttachmentKeys.has(k)) {
            seenAttachmentKeys.add(k);
            attachmentPairs.push({ bucket: a.bucket, objectKey: a.objectKey });
          }
        }
      }
    }

    const [avatarUrlMap, attachmentUrlMap] = await Promise.all([
      senderFileIds.length ? batchSignAvatarUrls(senderFileIds) : Promise.resolve({}),
      attachmentPairs.length ? batchSignAttachmentUrls(attachmentPairs) : Promise.resolve({}),
    ]);

    return {
      data: data.reverse().map((m) => ({
        ...m,
        attachments: (m.attachments ?? []).map((a) => ({
          ...a,
          url: attachmentUrlMap[`${a.bucket}:${a.objectKey}`] ?? null,
          objectKey: undefined,
          bucket: undefined,
        })),
        sender: m.sender
          ? {
              ...m.sender,
              avatarUrl: m.sender.avatarFileId
                ? (avatarUrlMap[m.sender.avatarFileId] ?? null)
                : null,
              avatarFileId: undefined,
            }
          : m.sender,
      })),
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.created_at?.toISOString() : null,
    };
  }

  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [], threadRootId = null }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    // Resolve threadRootId: validate it exists, belongs to this conversation,
    // isn't soft-deleted, and auto-flatten a reply-to-a-reply onto its own
    // root (spec Non-goal 1 — threads are one level deep, replying to a
    // reply silently redirects to that reply's own root instead of erroring
    // or creating a nested thread).
    let resolvedThreadRootId = null;
    if (threadRootId) {
      const targetRows = await prisma.$queryRaw`
        SELECT id, conversation_id, thread_root_id, deleted_at
        FROM chat_messages
        WHERE id = ${threadRootId} AND deleted_at IS NULL
        LIMIT 1
      `;
      if (!targetRows.length || targetRows[0].conversation_id !== conversationId) {
        throw new ChatServiceError("Mensaje no encontrado.", 404);
      }
      resolvedThreadRootId = targetRows[0].thread_root_id ?? targetRows[0].id;
    }

    // Cheap regex scan first — skips the sender-role lookup + resolution queries
    // entirely for the common case (no @ tokens at all, e.g. every direct/
    // external_support message and most channel/group messages too).
    let mentionResult = { userIds: [], roleIds: [], everyone: false, here: false, notifyUserIds: [] };
    if (mentionsService && parseMentionIds(body).length) {
      try {
        const senderRole = permissionsService ? await permissionsService.getMemberRole(conversationId, profileId) : null;
        mentionResult = await mentionsService.resolveMentions({ conversationId, senderProfileId: profileId, body, senderRole });
      } catch (err) {
        // A malformed-but-regex-matching mention token (e.g. one that fails
        // Postgres's uuid parser) must never block sending the message itself —
        // degrade to "no mentions resolved" instead of failing the whole request.
        console.error("[atlas.chat] mention resolution failed, sending without mentions", err?.message ?? err);
      }
    }
    const hasMentions = mentionResult.userIds.length || mentionResult.roleIds.length || mentionResult.everyone || mentionResult.here;
    const finalMetadata = hasMentions
      ? { ...metadata, mentions: { userIds: mentionResult.userIds, roleIds: mentionResult.roleIds, everyone: mentionResult.everyone, here: mentionResult.here } }
      : metadata;

    let msg;
    if (resolvedThreadRootId) {
      // Insert + root counter-increment must not diverge (reply inserted but
      // counter update fails, or vice versa) — wrap both in a transaction.
      [msg] = await prisma.$transaction(async (tx) => {
        const inserted = await tx.$queryRaw`
          INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, thread_root_id)
          VALUES (
            ${conversationId}, ${profileId}, 'user', ${body}, ${messageType}, ${attachmentIds.length},
            ${JSON.stringify(finalMetadata)}::jsonb, ${resolvedThreadRootId}
          )
          RETURNING *
        `;
        await tx.$executeRaw`
          UPDATE chat_messages
          SET thread_reply_count = thread_reply_count + 1,
              thread_last_reply_at = ${inserted[0].created_at}
          WHERE id = ${resolvedThreadRootId}
        `;
        return inserted;
      });
    } else {
      const msgRows = await prisma.$queryRaw`
        INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata)
        VALUES (
          ${conversationId},
          ${profileId},
          'user',
          ${body},
          ${messageType},
          ${attachmentIds.length},
          ${JSON.stringify(finalMetadata)}::jsonb
        )
        RETURNING *
      `;
      msg = msgRows[0];
    }

    if (attachmentIds.length) {
      await prisma.$executeRaw`
        UPDATE chat_attachments
        SET message_id = ${msg.id}
        WHERE id = ANY(${attachmentIds}::uuid[])
          AND uploaded_by_user_id = ${profileId}
      `;
    }

    if (!resolvedThreadRootId) {
      await updateConversationLastMessage(conversationId, msg.id, msg.created_at);
    }

    // Fetch full message with sender + attachments joins before returning
    const fullMsg = await getMessageFull(msg.id);

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

          const mentionedSet = new Set(mentionResult.notifyUserIds);
          const recipientIds = otherMembers
            .map((m) => m.user_id.toString())
            .filter((id) => !mentionedSet.has(id));
          const preview = body.length > 80 ? `${body.slice(0, 80)}...` : body;

          if (resolvedThreadRootId) {
            // Thread replies never fan out chat.message.new to the whole
            // channel (spec Section 8 Goal 4) — only the root author + prior
            // repliers are notified via chat.thread.reply, minus anyone who's
            // already getting chat.mention.new below (same precedence rule
            // applied to the non-thread path above).
            const participantRows = await prisma.$queryRaw`
              SELECT DISTINCT sender_user_id FROM chat_messages
              WHERE (id = ${resolvedThreadRootId} OR thread_root_id = ${resolvedThreadRootId})
                AND sender_user_id IS NOT NULL
                AND sender_user_id != ${profileId}
            `;
            const mentionedSet2 = new Set(mentionResult.notifyUserIds);
            const threadRecipientIds = participantRows
              .map((r) => r.sender_user_id.toString())
              .filter((id) => !mentionedSet2.has(id));
            if (threadRecipientIds.length) {
              await notificationService.publish({
                companyId,
                actorId: profileId,
                input: {
                  eventType: "chat.thread.reply",
                  title: "Nueva respuesta en un hilo",
                  body: preview,
                  link: `/app/m/atlas.chat/chat/inbox`,
                  recipients: { userIds: threadRecipientIds },
                  channels: ["in_app", "web_push"],
                  priority: "medium",
                  sourceType: "chat_conversation",
                  sourceId: conversationId,
                  dedupeKey: `chat.thread.reply:${msg.id}`,
                },
              });
            }
          } else if (recipientIds.length) {
            await notificationService.publish({
              companyId,
              actorId: profileId,
              input: {
                eventType: "chat.message.new",
                title: "Nuevo mensaje de chat",
                body: preview,
                link: `/app/m/atlas.chat/chat/inbox`,
                recipients: { userIds: recipientIds },
                channels: ["in_app", "web_push"],
                priority: "medium",
                sourceType: "chat_conversation",
                sourceId: conversationId,
                dedupeKey: `chat.message.new:${msg.id}`,
              },
            });
          }

          if (mentionResult.notifyUserIds.length) {
            await notificationService.publish({
              companyId,
              actorId: profileId,
              input: {
                eventType: "chat.mention.new",
                title: "Te mencionaron en un chat",
                body: preview,
                link: `/app/m/atlas.chat/chat/inbox`,
                recipients: { userIds: mentionResult.notifyUserIds },
                channels: ["in_app", "web_push"],
                priority: "high",
                sourceType: "chat_conversation",
                sourceId: conversationId,
                dedupeKey: `chat.mention.new:${msg.id}`,
              },
            });
          }
        } catch {}
      });
    }

    if (broadcaster) {
      const memberIds = await getConversationMemberIds(conversationId).catch(() => []);
      broadcaster.broadcastToUsers(memberIds, "chat.message.new", {
        conversationId,
        messageId: msg.id,
        senderId: profileId.toString(),
        senderName: fullMsg?.sender?.displayName ?? null,
        threadRootId: resolvedThreadRootId,
      }).catch(() => {});
    }

    return fullMsg ?? msg;
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

  async function pinMessage({ messageId, authUserId, pinned }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT m.id, m.conversation_id, c.type AS conversation_type
      FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      INNER JOIN chat_conversations c ON c.id = m.conversation_id
      WHERE m.id = ${messageId} AND m.deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado.", 404);
    const { conversation_id: conversationId, conversation_type: conversationType } = rows[0];

    if (permissionsService && (conversationType === "channel" || conversationType === "group")) {
      await permissionsService.assertChannelPermission(conversationId, profileId, "messages.pin");
    }

    await prisma.$executeRaw`
      UPDATE chat_messages
      SET pinned_at = ${pinned ? new Date() : null},
          pinned_by_user_id = ${pinned ? profileId : null}
      WHERE id = ${messageId}
    `;

    return getMessageFull(messageId);
  }

  async function listPinnedMessages({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const rows = await prisma.$queryRaw`
      SELECT m.id FROM chat_messages m
      WHERE m.conversation_id = ${conversationId} AND m.pinned_at IS NOT NULL AND m.deleted_at IS NULL
      ORDER BY m.pinned_at DESC
    `;
    const messages = await Promise.all(rows.map((r) => getMessageFull(r.id)));
    return { data: messages.filter(Boolean) };
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
      /^audio\//,
      /^video\//,
      /^application\/pdf$/,
      /^text\/plain$/,
      /^application\/msword$/,
      /^application\/vnd\.openxmlformats/,
      /^application\/zip$/,
      /^application\/x-zip/,
    ];
    const allowed = ALLOWED_MIME.some(re => re.test(mimeType));
    if (!allowed) throw new ChatServiceError("Tipo de archivo no permitido.", 422);
    if (sizeBytes > 50 * 1024 * 1024) throw new ChatServiceError("Archivo demasiado grande (max 50 MB).", 422);

    const ext = fileName.split(".").pop()?.toLowerCase() ?? "bin";
    const objectKey = `conversations/${conversationId}/${crypto.randomUUID()}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from("atlas-chat")
      .createSignedUploadUrl(objectKey, { expiresIn: 300 });

    if (error) {
      console.error("[atlas.chat] createSignedUploadUrl failed", { bucket: "atlas-chat", key: objectKey, error });
      throw new ChatServiceError("Error generando URL de subida.", 500);
    }

    // message_id is NULL until sendMessage links it
    const attRows = await prisma.$queryRaw`
      INSERT INTO chat_attachments
        (conversation_id, bucket, object_key, file_name, mime_type, size_bytes, uploaded_by_user_id)
      VALUES (
        ${conversationId},
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

  async function getAttachmentSignedUrl({ attachmentId, authUserId, variant = "full" }) {
    const profileId = await getUserProfileId(authUserId);

    const rows = await prisma.$queryRaw`
      SELECT a.* FROM chat_attachments a
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = a.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE a.id = ${attachmentId}
      LIMIT 1
    `;
    if (!rows.length) {
      console.error("[atlas.chat] getAttachmentSignedUrl: attachment not found or user not member", { attachmentId, profileId });
      throw new ChatServiceError("Adjunto no encontrado.", 404);
    }

    const att = rows[0];

    const cached = getCachedSignedUrl(att.bucket, att.object_key, variant);
    if (cached) return { url: cached };

    const signedUrl = await signedUrlWithVariant(supabaseAdmin, att.bucket, att.object_key, variant);

    if (!signedUrl) {
      console.error("[atlas.chat] createSignedUrl failed", { bucket: att.bucket, key: att.object_key });
      throw new ChatServiceError("Error generando URL firmada.", 500);
    }
    setCachedSignedUrl(att.bucket, att.object_key, variant, signedUrl);
    return { url: signedUrl };
  }

  // ------------------------------------------------------------------
  // External inbox (operator view)
  // ------------------------------------------------------------------

  async function listExternalInbox({ authUserId, status = "open", limit = 30, cursor = null, search = null }) {
    const profileId = await getUserProfileId(authUserId);

    // Build search filter dynamically to avoid untyped NULL parameter (42P18)
    const searchFilter = search
      ? Prisma.sql`AND (
          LOWER(c.tracking_code) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(gs.email) LIKE ${"%" + search.toLowerCase() + "%"}
          OR LOWER(gs.name) LIKE ${"%" + search.toLowerCase() + "%"}
        )`
      : Prisma.empty;

    const rows = await prisma.$queryRaw`
      SELECT
        c.*,
        gs.email AS guest_email,
        gs.name AS guest_name,
        gs.page_url AS guest_page_url,
        gs.idle_expires_at,
        gs.absolute_expires_at,
        (
          SELECT COUNT(*)::int FROM chat_messages m
          WHERE m.conversation_id = c.id AND m.deleted_at IS NULL
        ) AS message_count,
        (
          SELECT COUNT(*)::int FROM chat_messages m
          WHERE m.conversation_id = c.id
            AND m.deleted_at IS NULL
            AND m.sender_type = 'guest'
            AND m.created_at > COALESCE(
              (SELECT last_read_at FROM chat_conversation_members
               WHERE conversation_id = c.id AND user_id = ${profileId}),
              '1970-01-01'::timestamptz
            )
        ) AS unread_count,
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
        ${searchFilter}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
      LIMIT ${limit}
    `;
    return { data: rows };
  }

  async function markExternalRead({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    // Ensure a member row exists for this operator (partial index — DO NOTHING on any conflict)
    await prisma.$executeRaw`
      INSERT INTO chat_conversation_members (conversation_id, user_id, role, last_read_at)
      VALUES (${conversationId}, ${profileId}, 'operator', NOW())
      ON CONFLICT DO NOTHING
    `;
    // Then update last_read_at on the existing row
    await prisma.$executeRaw`
      UPDATE chat_conversation_members
      SET last_read_at = NOW()
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
    `;
    return { ok: true };
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
    broadcaster?.broadcastToChannel(`chat:conv:${conversationId}`, "conversation_closed", { conversationId });
    return { ok: true };
  }

  return {
    listConversations,
    archiveConversation,
    unarchiveConversation,
    createConversation,
    getConversation,
    updateConversation,
    addMembers,
    removeMember,
    listMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    pinMessage,
    listPinnedMessages,
    markConversationRead,
    presignAttachmentUpload,
    getAttachmentSignedUrl,
    listExternalInbox,
    markExternalRead,
    assignOperator,
    closeExternalConversation,
  };
}
