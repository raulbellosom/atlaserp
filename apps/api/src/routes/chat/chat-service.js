import { Prisma } from "@prisma/client";
import { signedUrlWithVariant } from "../../lib/image-variants.js";
import { parseMentionIds } from "../../lib/mention-utils.js";
import { ChatServiceError } from "./chat-service-error.js";
import { createChatConversationReadsService } from "./chat-conversation-reads-service.js";
import { createChatAttachmentsService } from "./chat-attachments-service.js";
import { buildReplyPreview } from "./chat-reply-preview.js";

export { ChatServiceError };

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

export function createChatService({ prisma, supabaseAdmin, notificationService = null, broadcaster = null, permissionsService = null, mentionsService = null, entityReferencesService = null, channelLinksService = null }) {
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

  // Only direct conversations can be blocked (spec Non-goal 2 — a block never
  // affects shared groups/channels). Checks both directions: either party
  // blocking the other stops messages both ways. `conversationType` is passed
  // in by the caller (sendMessage already needs it for the messages.send
  // permission check too) rather than queried here a second time.
  async function assertNotBlocked(conversationId, profileId, conversationType) {
    if (conversationType !== "direct") return;

    // The validator does not currently constrain type: "direct" conversations
    // to exactly one other member (pre-existing gap, out of scope here), so a
    // raw API call could in theory create one with 2+ other members. Fetch
    // ALL active other members (no LIMIT 1) and check the block relationship
    // against every one of them — checking only an arbitrarily-picked single
    // member would let a real block silently go unenforced depending on
    // Postgres's (unordered) row return order.
    const otherRows = await prisma.$queryRaw`
      SELECT user_id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id != ${profileId} AND user_id IS NOT NULL AND left_at IS NULL
    `;
    if (!otherRows.length) return;

    const otherIds = otherRows.map((r) => r.user_id);
    const blocks = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id IN (${Prisma.join(otherIds)}))
         OR (blocked_user_id = ${profileId} AND blocker_user_id IN (${Prisma.join(otherIds)}))
      LIMIT 1
    `;
    if (blocks.length) {
      throw new ChatServiceError("No puedes enviar mensajes a este usuario.", 403);
    }
  }

  async function assertNotBlockedByTarget(profileId, targetUserId) {
    const blocks = await prisma.$queryRaw`
      SELECT blocker_user_id, blocked_user_id FROM chat_blocks
      WHERE (blocker_user_id = ${profileId} AND blocked_user_id = ${targetUserId})
         OR (blocker_user_id = ${targetUserId} AND blocked_user_id = ${profileId})
      LIMIT 1
    `;
    if (blocks.length) {
      throw new ChatServiceError("No puedes iniciar una conversacion con este usuario.", 403);
    }
  }

  // Restricts a set of candidate user_profile ids to those sharing at least one
  // enabled company Membership with actingProfileId — same cross-tenant guard
  // pattern as calendar-event-service.js's filterCompanyPeers. Without this,
  // createConversation/addMembers would trust a client-supplied user id as-is
  // and could add a user from a different company into a private conversation.
  async function filterCompanyPeers(actingProfileId, candidateIds) {
    const ids = [...new Set((candidateIds ?? []).filter(Boolean))];
    if (ids.length === 0) return [];
    const ownerMemberships = await prisma.membership.findMany({
      where: { userId: actingProfileId.toString(), enabled: true },
      select: { companyId: true },
    });
    const companyIds = ownerMemberships.map((m) => m.companyId);
    if (companyIds.length === 0) {
      // Acting user has no active company membership (e.g. platform admin) —
      // only allow self-reference, never an arbitrary foreign user id.
      return ids.includes(actingProfileId.toString()) ? [actingProfileId.toString()] : [];
    }
    const peers = await prisma.membership.findMany({
      where: { userId: { in: ids }, enabled: true, companyId: { in: companyIds } },
      select: { userId: true },
    });
    const allowed = new Set(peers.map((m) => m.userId));
    allowed.add(actingProfileId.toString());
    return ids.filter((id) => allowed.has(id));
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

  const conversationReadsService = createChatConversationReadsService({ prisma, getUserProfileId, assertMember, batchSignAvatarUrls });
  const { listConversations, archiveConversation, unarchiveConversation, getConversation } = conversationReadsService;

  async function createConversation({ authUserId, type, title, memberUserIds, metadata = {}, isPublic = false, slug = null, description = null, linkedModule = null, linkedEntityId = null }) {
    if (channelLinksService) channelLinksService.assertBothOrNeither(linkedModule, linkedEntityId);
    const creatorProfileId = await getUserProfileId(authUserId);

    // Cross-tenant guard: a member id must share a company with the creator.
    // Without this, any caller could pass an arbitrary user_profile id (from
    // another company entirely) as memberUserIds and be silently added to a
    // conversation with them — the frontend picker is already company-scoped,
    // but the API must not trust that.
    const requestedMemberIds = [...new Set((memberUserIds ?? []).filter(Boolean))];
    const validMemberIds = await filterCompanyPeers(creatorProfileId, requestedMemberIds);
    if (validMemberIds.length !== requestedMemberIds.length) {
      throw new ChatServiceError("Uno o mas usuarios no pertenecen a tu empresa.", 403);
    }
    memberUserIds = validMemberIds;

    // Prevent self-chat
    if (type === "direct" && memberUserIds.length === 1 && memberUserIds[0] === creatorProfileId.toString()) {
      throw new ChatServiceError("No puedes iniciar un chat contigo mismo.", 400);
    }

    // For direct conversations, enforce uniqueness (find existing)
    if (type === "direct" && memberUserIds.length === 1) {
      const otherId = memberUserIds[0];
      await assertNotBlockedByTarget(creatorProfileId, otherId);
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

    // Same "find existing, return it" idempotency as above, applied to channel<->module links.
    if (linkedModule && linkedEntityId && channelLinksService) {
      const existing = await channelLinksService.findByLink(linkedModule, linkedEntityId);
      if (existing) return getConversation({ conversationId: existing.id, authUserId });
      await channelLinksService.assertLinkAvailable(linkedModule, linkedEntityId);
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
      INSERT INTO chat_conversations (type, title, created_by_user_id, company_id, is_public, slug, description, metadata, linked_module, linked_entity_id)
      VALUES (${type}, ${title ?? null}, ${creatorProfileId}, ${companyId}, ${isPublic}, ${slug}, ${description}, ${JSON.stringify(metadata)}::jsonb, ${linkedModule}, ${linkedEntityId})
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

  async function updateConversation({ conversationId, authUserId, updates }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    if (permissionsService) {
      const [conv] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (conv && (conv.type === "channel" || conv.type === "group")) {
        await permissionsService.assertChannelPermission(conversationId, profileId, "channel.manage");
      }
    }
    if (channelLinksService) channelLinksService.assertBothOrNeither(updates.linkedModule, updates.linkedEntityId);

    const hasTitle = updates.title !== undefined;
    const hasStatus = updates.status !== undefined;
    const hasAvatarFileId = updates.avatarFileId !== undefined;
    const hasAvatarEmoji = updates.avatarEmoji !== undefined;
    const hasDescription = updates.description !== undefined;

    if (!hasTitle && !hasStatus && !hasAvatarFileId && !hasAvatarEmoji && !hasDescription && updates.linkedModule === undefined) {
      return getConversation({ conversationId, authUserId });
    }

    // Mutual exclusivity: setting a real (non-null) avatar of one kind clears
    // the other kind, even if the caller didn't explicitly touch it — a
    // conversation has at most one avatar source at a time. Explicitly
    // clearing one (sending null) does NOT touch the other — a "remove both"
    // action must send both fields as null itself (spec Section 23 edge case 1).
    // If a caller sends both as real (non-null) values in the same request,
    // avatarFileId wins and the emoji is discarded — an `if`, not parallel
    // handling, so this branch always fires first when both are present.
    let nextAvatarFileId = updates.avatarFileId;
    let nextAvatarEmoji = updates.avatarEmoji;
    let touchAvatarFileId = hasAvatarFileId;
    let touchAvatarEmoji = hasAvatarEmoji;
    if (hasAvatarFileId && nextAvatarFileId !== null) {
      nextAvatarEmoji = null;
      touchAvatarEmoji = true;
    } else if (hasAvatarEmoji && nextAvatarEmoji !== null) {
      nextAvatarFileId = null;
      touchAvatarFileId = true;
    }

    const sets = [Prisma.sql`updated_at = NOW()`];
    if (hasTitle) sets.push(Prisma.sql`title = ${updates.title}`);
    if (hasStatus) sets.push(Prisma.sql`status = ${updates.status}`);
    if (touchAvatarFileId) sets.push(Prisma.sql`avatar_file_id = ${nextAvatarFileId}`);
    if (touchAvatarEmoji) sets.push(Prisma.sql`avatar_emoji = ${nextAvatarEmoji}`);
    if (hasDescription) sets.push(Prisma.sql`description = ${updates.description}`);
    if (channelLinksService) sets.push(...(await channelLinksService.applyLinkUpdate(updates, conversationId)));

    await prisma.$executeRaw`
      UPDATE chat_conversations
      SET ${Prisma.join(sets, ", ")}
      WHERE id = ${conversationId}
    `;

    return getConversation({ conversationId, authUserId });
  }

  // Permanently removes a channel/group for every member — gated on
  // channel.manage (Owner + Admin by default), same tier as updateConversation's
  // other channel-level changes. Scoped to channel/group only: direct/
  // external_support already have their own "leave"/block-based exits and no
  // roles to gate this against. Soft-delete (deleted_at) matches the existing
  // convention every read already filters on (getConversation, listConversations,
  // channel-directory-service) — no cascade needed, messages/members just become
  // permanently unreachable through those filters.
  async function deleteConversation({ conversationId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const [conv] = await prisma.$queryRaw`
      SELECT type FROM chat_conversations WHERE id = ${conversationId} AND deleted_at IS NULL LIMIT 1
    `;
    if (!conv) throw new ChatServiceError("Conversacion no encontrada.", 404);
    if (conv.type !== "channel" && conv.type !== "group") {
      throw new ChatServiceError("Solo se pueden eliminar canales o grupos.", 400);
    }

    let memberIds = [];
    if (permissionsService) {
      await permissionsService.assertChannelPermission(conversationId, profileId, "channel.manage");
    }
    if (broadcaster) {
      const memberRows = await prisma.$queryRaw`
        SELECT user_id FROM chat_conversation_members WHERE conversation_id = ${conversationId} AND left_at IS NULL
      `;
      memberIds = memberRows.map((r) => r.user_id.toString());
    }

    await prisma.$executeRaw`
      UPDATE chat_conversations SET deleted_at = NOW() WHERE id = ${conversationId}
    `;

    if (broadcaster && memberIds.length) {
      broadcaster.broadcastToUsers(memberIds, "chat.conversation.deleted", { conversationId }).catch(() => {});
    }

    return { ok: true };
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

    // Same cross-tenant guard as createConversation — reject any userId that
    // doesn't share a company with the caller rather than silently adding a
    // foreign-company user to this conversation.
    const requestedUserIds = [...new Set((userIds ?? []).filter(Boolean))];
    const validUserIds = await filterCompanyPeers(profileId, requestedUserIds);
    if (validUserIds.length !== requestedUserIds.length) {
      throw new ChatServiceError("Uno o mas usuarios no pertenecen a tu empresa.", 403);
    }

    const results = [];
    for (const uid of validUserIds) {
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
        m.reply_to_message_id,
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
            'bucket', a.bucket,
            'reactions', (
              SELECT json_agg(json_build_object('emoji', ar.emoji, 'userIds', ar.user_ids))
              FROM (
                SELECT emoji, json_agg(user_id) AS user_ids
                FROM chat_message_reactions
                WHERE attachment_id = a.id
                GROUP BY emoji
              ) ar
            )
          ) ORDER BY a.created_at)
          FROM chat_attachments a WHERE a.message_id = m.id
        ) AS attachments,
        -- reactions, grouped by emoji — message-level ONLY. Attachment-scoped
        -- reactions are nested inside each attachment object above instead,
        -- so a single reaction never shows up in both places.
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id AND attachment_id IS NULL
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
    const replyMap = m.reply_to_message_id ? await fetchReplyPreviewRows([m]) : null;
    return {
      ...m,
      reply_to: m.reply_to_message_id
        ? buildReplyPreview(replyMap?.get(m.reply_to_message_id) ?? null)
        : null,
      sender: m.sender
        ? {
            ...m.sender,
            avatarUrl: m.sender.avatarFileId ? (urlMap[m.sender.avatarFileId] ?? null) : null,
            avatarFileId: undefined,
          }
        : m.sender,
    };
  }

  // Given message rows that may carry `reply_to_message_id`, fetch every
  // referenced original once and return a Map<id, previewRow> ready for
  // buildReplyPreview. One query regardless of page size.
  async function fetchReplyPreviewRows(rows) {
    const ids = [...new Set(rows.map((r) => r.reply_to_message_id).filter(Boolean))];
    if (!ids.length) return new Map();
    const previewRows = await prisma.$queryRaw`
      SELECT
        m.id,
        m.sender_user_id,
        m.body,
        m.message_type,
        m.deleted_at,
        up.display_name AS sender_name,
        (SELECT a.mime_type FROM chat_attachments a
           WHERE a.message_id = m.id ORDER BY a.created_at LIMIT 1) AS attachment_mime,
        (m.metadata ? 'entityRefs') AS has_entity_refs
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.id IN (${Prisma.join(ids)})
    `;
    const map = new Map();
    for (const pr of previewRows) map.set(pr.id, pr);
    return map;
  }

  // Attach `reply_to` (built preview or null) to each row and return the new
  // array. A deleted original still yields a preview object (isDeleted:true)
  // so the client can render "Mensaje eliminado".
  async function attachReplyPreviews(rows) {
    const map = await fetchReplyPreviewRows(rows);
    return rows.map((r) => ({
      ...r,
      reply_to: r.reply_to_message_id ? buildReplyPreview(map.get(r.reply_to_message_id) ?? null) : null,
    }));
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
        m.reply_to_message_id,
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
            'bucket', a.bucket,
            'reactions', (
              SELECT json_agg(json_build_object('emoji', ar.emoji, 'userIds', ar.user_ids))
              FROM (
                SELECT emoji, json_agg(user_id) AS user_ids
                FROM chat_message_reactions
                WHERE attachment_id = a.id
                GROUP BY emoji
              ) ar
            )
          ) ORDER BY a.created_at)
          FROM chat_attachments a WHERE a.message_id = m.id
        ) AS attachments,
        -- reactions, grouped by emoji — message-level ONLY. Attachment-scoped
        -- reactions are nested inside each attachment object above instead,
        -- so a single reaction never shows up in both places.
        (
          SELECT json_agg(json_build_object('emoji', r.emoji, 'userIds', r.user_ids))
          FROM (
            SELECT emoji, json_agg(user_id) AS user_ids
            FROM chat_message_reactions
            WHERE message_id = m.id AND attachment_id IS NULL
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

    const mapped = data.reverse().map((m) => ({
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
    }));

    const withReplies = await attachReplyPreviews(mapped);

    return {
      data: withReplies,
      hasMore,
      nextCursor: hasMore ? data[data.length - 1]?.created_at?.toISOString() : null,
    };
  }

  async function sendMessage({ conversationId, authUserId, body, messageType = "text", metadata = {}, attachmentIds = [], threadRootId = null, entityRefs = [], replyToMessageId = null }) {
    const profileId = await getUserProfileId(authUserId);
    await assertMember(conversationId, profileId);

    const [convRow] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
    const conversationType = convRow?.type ?? null;
    await assertNotBlocked(conversationId, profileId, conversationType);

    // Validate the quoted message (WhatsApp-style inline reply): must exist,
    // not be soft-deleted, and live in THIS conversation — a quote never
    // crosses conversations (the client only ever offers reply within the
    // open conversation). Independent of threadRootId: a thread reply may
    // also quote another message, so both columns can be set.
    let resolvedReplyToId = null;
    if (replyToMessageId) {
      const [replyTarget] = await prisma.$queryRaw`
        SELECT id, conversation_id, deleted_at
        FROM chat_messages
        WHERE id = ${replyToMessageId}
        LIMIT 1
      `;
      if (!replyTarget || replyTarget.conversation_id !== conversationId || replyTarget.deleted_at) {
        throw new ChatServiceError("No se puede responder a ese mensaje.", 400);
      }
      resolvedReplyToId = replyToMessageId;
    }

    // messages.send is a real, editable permission (RoleEditorDialog already
    // exposes an "Enviar mensajes" checkbox) but was never actually enforced
    // here — every default role happens to grant it, so this only starts
    // rejecting sends once an Owner/Admin explicitly revokes it from a role
    // (e.g. an announcements-only channel). Same conv-type gate pattern as
    // updateConversation/removeMember: direct/external_support conversations
    // have no roles, so skip the check entirely for them.
    if (permissionsService && (conversationType === "channel" || conversationType === "group")) {
      await permissionsService.assertChannelPermission(conversationId, profileId, "messages.send");
    }

    // Resolve threadRootId: validate it exists, belongs to this conversation,
    // isn't soft-deleted, and auto-flatten a reply-to-a-reply onto its own
    // root (spec Non-goal 1 — threads are one level deep, replying to a
    // reply silently redirects to that reply's own root instead of erroring
    // or creating a nested thread).
    let resolvedThreadRootId = null;
    if (threadRootId) {
      // Threads are scoped to channel/group conversations only (spec
      // Non-goal 3) — the UI never offers "Responder en hilo" outside those
      // types, but that's a client-side gate; enforce it here too so a
      // direct API call can't create a thread reply in a direct/
      // external_support conversation, where it would silently vanish from
      // that conversation's timeline (listMessages filters thread_root_id
      // IS NOT NULL out) with no thread UI able to surface it there.
      const targetRows = await prisma.$queryRaw`
        SELECT m.id, m.conversation_id, m.thread_root_id, m.deleted_at, c.type AS conversation_type
        FROM chat_messages m
        INNER JOIN chat_conversations c ON c.id = m.conversation_id
        WHERE m.id = ${threadRootId} AND m.deleted_at IS NULL
        LIMIT 1
      `;
      if (
        !targetRows.length ||
        targetRows[0].conversation_id !== conversationId ||
        (targetRows[0].conversation_type !== "channel" && targetRows[0].conversation_type !== "group")
      ) {
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
    let finalMetadata = hasMentions
      ? { ...metadata, mentions: { userIds: mentionResult.userIds, roleIds: mentionResult.roleIds, everyone: mentionResult.everyone, here: mentionResult.here } }
      : metadata;

    // Cross-module entity references (Phase F). Only when the caller actually
    // sends entityRefs — the overwhelmingly common plain-text send pays no
    // extra query or service call here at all. Reject the whole send for an
    // external_support conversation BEFORE attempting any resolution (defense
    // in depth: a guest-facing conversation must never expose a clickable
    // link to an internal record, even via a stray direct API call bypassing
    // the composer's hidden button — spec Non-goal 3 / edge case 4). This is
    // a fresh conversation-type lookup rather than reusing the threadRootId
    // block's query above, since that one only runs when threadRootId is set.
    if (entityRefs?.length) {
      const [convRow] = await prisma.$queryRaw`SELECT type FROM chat_conversations WHERE id = ${conversationId} LIMIT 1`;
      if (convRow?.type === "external_support") {
        throw new ChatServiceError("No se pueden adjuntar referencias en conversaciones de soporte externo.", 400);
      }
      if (entityReferencesService) {
        const resolvedEntityRefs = await entityReferencesService.resolveEntityRefs({ authUserId, entityRefs });
        if (resolvedEntityRefs.length) {
          finalMetadata = { ...finalMetadata, entityRefs: resolvedEntityRefs };
        }
      }
    }

    let msg;
    if (resolvedThreadRootId) {
      // Insert + root counter-increment must not diverge (reply inserted but
      // counter update fails, or vice versa) — wrap both in a transaction.
      [msg] = await prisma.$transaction(async (tx) => {
        const inserted = await tx.$queryRaw`
          INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, thread_root_id, reply_to_message_id)
          VALUES (
            ${conversationId}, ${profileId}, 'user', ${body}, ${messageType}, ${attachmentIds.length},
            ${JSON.stringify(finalMetadata)}::jsonb, ${resolvedThreadRootId}, ${resolvedReplyToId}
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
        INSERT INTO chat_messages (conversation_id, sender_user_id, sender_type, body, message_type, attachment_count, metadata, reply_to_message_id)
        VALUES (
          ${conversationId},
          ${profileId},
          'user',
          ${body},
          ${messageType},
          ${attachmentIds.length},
          ${JSON.stringify(finalMetadata)}::jsonb,
          ${resolvedReplyToId}
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
            // Thread participation is derived from message history (who's
            // ever posted in this thread), which can include someone who has
            // since left the conversation — otherMembers (above) is already
            // scoped to currently-active members (left_at IS NULL), so
            // intersect against it rather than notifying a former member.
            const activeMemberIds = new Set(otherMembers.map((m) => m.user_id.toString()));
            const threadRecipientIds = participantRows
              .map((r) => r.sender_user_id.toString())
              .filter((id) => activeMemberIds.has(id) && !mentionedSet.has(id));
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
        replyToMessageId: resolvedReplyToId,
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
      SELECT id, thread_root_id FROM chat_messages
      WHERE id = ${messageId}
        AND sender_user_id = ${profileId}
        AND deleted_at IS NULL
      LIMIT 1
    `;
    if (!rows.length) throw new ChatServiceError("Mensaje no encontrado o sin permiso.", 403);

    await prisma.$executeRaw`
      UPDATE chat_messages SET deleted_at = NOW(), body = '' WHERE id = ${messageId}
    `;

    // Only a reply (thread_root_id set on its OWN row) decrements its root's
    // counter. A thread root's own row always has thread_root_id = NULL, even
    // when other messages point at it, so deleting a root never decrements
    // anything here — matches the data model in spec Section 10.
    if (rows[0].thread_root_id) {
      await prisma.$executeRaw`
        UPDATE chat_messages
        SET thread_reply_count = GREATEST(thread_reply_count - 1, 0)
        WHERE id = ${rows[0].thread_root_id}
      `;
    }

    return { ok: true };
  }

  // Removes ONE attachment from a message without touching the rest of it —
  // the message and its other attachments (if any) stay intact. If this was
  // the message's only attachment and there's nothing else left to show
  // (no body text, no entity refs), the whole message is soft-deleted
  // instead, matching what deleteMessage already does for a single-
  // attachment message (spec Section 12/Goal 5).
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

  // Looks up messageId, resolves it to its thread root (auto-flattening a
  // reply-to-a-reply reference onto its own ancestor, same rule sendMessage
  // uses), then returns the root plus its replies in chronological order.
  // Mirrors listPinnedMessages' accepted N+1 getMessageFull-per-row pattern —
  // expected reply volumes per thread are small, so a second aggregation
  // strategy isn't warranted here.
  async function listThreadReplies({ messageId, authUserId }) {
    const profileId = await getUserProfileId(authUserId);

    // Membership folded into the same query (rather than a separate
    // assertMember call) so a nonexistent message id and a message the
    // caller isn't a member of both produce the same 404 — same
    // non-leaking convention pinMessage already uses (spec Section 12).
    const targetRows = await prisma.$queryRaw`
      SELECT m.id, m.conversation_id, m.thread_root_id
      FROM chat_messages m
      INNER JOIN chat_conversation_members ccm
        ON ccm.conversation_id = m.conversation_id AND ccm.user_id = ${profileId} AND ccm.left_at IS NULL
      WHERE m.id = ${messageId}
      LIMIT 1
    `;
    if (!targetRows.length) throw new ChatServiceError("Mensaje no encontrado.", 404);
    const rootId = targetRows[0].thread_root_id ?? targetRows[0].id;

    const root = await getMessageFull(rootId);
    const replyRows = await prisma.$queryRaw`
      SELECT id FROM chat_messages
      WHERE thread_root_id = ${rootId}
      ORDER BY created_at ASC
    `;
    const replies = await Promise.all(replyRows.map((r) => getMessageFull(r.id)));

    return { root, replies: replies.filter(Boolean) };
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
  // Attachments — presign/sign/delete live in chat-attachments-service.js
  // ------------------------------------------------------------------

  const attachmentsService = createChatAttachmentsService({
    prisma,
    supabaseAdmin,
    getUserProfileId,
    assertMember,
    getCachedSignedUrl,
    setCachedSignedUrl,
  });
  const { presignAttachmentUpload, getAttachmentSignedUrl, deleteAttachment } = attachmentsService;

  return {
    listConversations,
    archiveConversation,
    unarchiveConversation,
    createConversation,
    getConversation,
    updateConversation,
    deleteConversation,
    addMembers,
    removeMember,
    listMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    deleteAttachment,
    pinMessage,
    listPinnedMessages,
    listThreadReplies,
    markConversationRead,
    presignAttachmentUpload,
    getAttachmentSignedUrl,
  };
}
