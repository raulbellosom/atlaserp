import { resolveUserProfileId, ChatServiceError } from "./chat-service.js";

export function createChannelDirectoryService({ prisma }) {
  // activeCompanyId: the requester's server-resolved active company (from
  // requirePermission's tenant middleware). When provided, it is used
  // directly instead of re-deriving "some company this user belongs to" from
  // their most-recently-created membership — a multi-company user's public-
  // channel directory must reflect the company they're currently acting as,
  // not an arbitrary one. Omitted (e.g. existing tests calling the service
  // directly), this falls back to the old most-recent-membership behavior.
  async function listChannelDirectory({ authUserId, cursor = null, limit = 30, activeCompanyId = null }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    let companyId = activeCompanyId;
    if (!companyId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: profileId.toString(), enabled: true },
        orderBy: { createdAt: "desc" },
        select: { companyId: true },
      });
      companyId = membership?.companyId ?? null;
    }
    if (!companyId) return { data: [], nextCursor: null };

    const rows = await prisma.$queryRaw`
      SELECT c.id, c.title, c.description, c.slug, c.is_public AS "isPublic", c.created_at AS "createdAt"
      FROM chat_conversations c
      WHERE c.company_id = ${companyId}
        AND c.type = 'channel'
        AND c.is_public = true
        AND c.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM chat_conversation_members m
          WHERE m.conversation_id = c.id AND m.user_id = ${profileId} AND m.left_at IS NULL
        )
        AND (${cursor}::timestamptz IS NULL OR c.created_at < ${cursor}::timestamptz)
      ORDER BY c.created_at DESC
      LIMIT ${limit}
    `;
    const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;
    return { data: rows, nextCursor };
  }

  async function joinChannel({ conversationId, authUserId, activeCompanyId = null }) {
    const profileId = await resolveUserProfileId(prisma, authUserId);

    // Company-scoped on purpose: a channel ID alone (not routed through the
    // directory, which is already company-filtered) must not let a user from a
    // different company join — UUIDv7 IDs are not secrets anywhere else in this
    // codebase, so this check is the only thing preventing a cross-tenant join.
    // Same activeCompanyId fast path as listChannelDirectory — prefer the
    // requester's server-resolved active company over their most-recent
    // membership when the caller (the route) provides it.
    let companyId = activeCompanyId;
    if (!companyId) {
      const membership = await prisma.membership.findFirst({
        where: { userId: profileId.toString(), enabled: true },
        orderBy: { createdAt: "desc" },
        select: { companyId: true },
      });
      companyId = membership?.companyId ?? null;
    }
    // A companyless caller must not match a companyless channel row: company_id
    // CAN legitimately be NULL (createConversation leaves it NULL when the
    // creator has no active membership — see chat-service.js), and without this
    // guard `IS NOT DISTINCT FROM` would treat "both sides have no company" as
    // "same company," letting any companyless caller join any companyless
    // public channel. listChannelDirectory already guards this same case.
    if (!companyId) throw new ChatServiceError("Canal no encontrado.", 404);

    const convRows = await prisma.$queryRaw`
      SELECT id, is_public AS "isPublic" FROM chat_conversations
      WHERE id = ${conversationId} AND type = 'channel' AND is_public = true AND deleted_at IS NULL
        AND company_id IS NOT DISTINCT FROM ${companyId}
      LIMIT 1
    `;
    if (!convRows.length) throw new ChatServiceError("Canal no encontrado.", 404);

    const existing = await prisma.$queryRaw`
      SELECT id FROM chat_conversation_members
      WHERE conversation_id = ${conversationId} AND user_id = ${profileId} AND left_at IS NULL
      LIMIT 1
    `;
    if (existing.length) throw new ChatServiceError("Ya eres miembro de este canal.", 400);

    const memberRoleRows = await prisma.$queryRaw`
      SELECT id FROM chat_channel_roles WHERE conversation_id = ${conversationId} AND name = 'Member' LIMIT 1
    `;
    const roleId = memberRoleRows[0]?.id ?? null;

    const inserted = await prisma.$queryRaw`
      INSERT INTO chat_conversation_members (conversation_id, user_id, role, role_id)
      VALUES (${conversationId}, ${profileId}, 'member', ${roleId})
      RETURNING id, conversation_id AS "conversationId", user_id AS "userId", role_id AS "roleId", joined_at AS "joinedAt"
    `;
    return inserted[0];
  }

  return { listChannelDirectory, joinChannel };
}
