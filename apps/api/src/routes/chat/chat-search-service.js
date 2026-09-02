import { Prisma } from "@prisma/client";
import { ChatServiceError } from "./chat-service-error.js";
import { resolveUserProfileId } from "./chat-service.js";

const MAX_TOKENS = 6;
const MIN_TOKEN_LEN = 2;
const SIMILARITY_THRESHOLD = 0.3; // word_similarity floor for typo tolerance; tunable
const MAX_LIMIT = 50;
const MAX_OFFSET = 300;

// JS-side mirror of the SQL atlas_unaccent(lower(x)): lower-case + strip the
// combining diacritics Postgres unaccent removes. NFD/strip/NFC is
// length-preserving for the Latin text this app deals with, which is what lets
// computeMatchRanges' offsets line up with the original body.
export function normalizeForSearch(input) {
  return (input ?? "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .normalize("NFC")
    .toLowerCase();
}

export function tokenizeQuery(raw) {
  const norm = normalizeForSearch(raw).trim();
  if (!norm) return [];
  const parts = norm.split(/\s+/).filter(Boolean);
  const uniqueLong = [...new Set(parts.filter((t) => t.length >= MIN_TOKEN_LEN))];
  const base = uniqueLong.length ? uniqueLong : parts.slice(0, 1);
  return base.slice(0, MAX_TOKENS);
}

function escapeLike(token) {
  return token.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

// Compute [start,end] match ranges on the ORIGINAL body by scanning its
// normalised form for each token. Returns [] if normalisation changed the
// string length (defensive — see normalizeForSearch), so the caller shows the
// plain snippet instead of a mis-aligned highlight.
export function computeMatchRanges(body, tokens) {
  const norm = normalizeForSearch(body);
  if (norm.length !== (body ?? "").length) return [];
  const ranges = [];
  for (const tok of tokens) {
    let from = 0;
    let idx = norm.indexOf(tok, from);
    while (idx !== -1) {
      ranges.push([idx, idx + tok.length]);
      from = idx + tok.length;
      idx = norm.indexOf(tok, from);
    }
  }
  if (!ranges.length) return [];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (let i = 1; i < ranges.length; i += 1) {
    const last = merged[merged.length - 1];
    if (ranges[i][0] <= last[1]) last[1] = Math.max(last[1], ranges[i][1]);
    else merged.push(ranges[i].slice());
  }
  return merged;
}

export function createChatSearchService({ prisma }) {
  async function searchMessages({
    authUserId,
    q,
    conversationId = null,
    limit = 30,
    offset = 0,
  }) {
    const tokens = tokenizeQuery(q);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), MAX_LIMIT);
    const safeOffset = Math.min(Math.max(parseInt(offset, 10) || 0, 0), MAX_OFFSET);

    if (!tokens.length) return { data: [], truncated: false };

    const profileId = await resolveUserProfileId(prisma, authUserId);

    // Per-token predicate: substring OR typo-similarity, against body / sender
    // name / any attachment file name. AND across tokens => order-independent.
    const tokenConds = tokens.map((tok) => {
      const like = `%${escapeLike(tok)}%`;
      return Prisma.sql`(
        m.body_norm ILIKE ${like}
        OR word_similarity(${tok}, m.body_norm) > ${SIMILARITY_THRESHOLD}
        OR up.name_norm ILIKE ${like}
        OR word_similarity(${tok}, up.name_norm) > ${SIMILARITY_THRESHOLD}
        OR EXISTS (
          SELECT 1 FROM chat_attachments a
          WHERE a.message_id = m.id
            AND (
              atlas_unaccent(lower(a.file_name)) ILIKE ${like}
              OR word_similarity(${tok}, atlas_unaccent(lower(a.file_name))) > ${SIMILARITY_THRESHOLD}
            )
        )
      )`;
    });
    const whereTokens = Prisma.join(tokenConds, " AND ");

    // score = sum over tokens of GREATEST(substring hit ? 1 : 0, word_similarity)
    const scoreTerms = tokens.map(
      (tok) => Prisma.sql`GREATEST(
        CASE WHEN m.body_norm ILIKE ${`%${escapeLike(tok)}%`} THEN 1.0 ELSE 0 END,
        word_similarity(${tok}, m.body_norm)
      )`,
    );
    const scoreExpr = Prisma.join(scoreTerms, " + ");

    const convFilter = conversationId
      ? Prisma.sql`AND m.conversation_id = ${conversationId}::uuid`
      : Prisma.empty;

    const rows = await prisma.$queryRaw`
      SELECT
        m.id            AS message_id,
        m.conversation_id,
        m.body,
        m.created_at,
        m.sender_user_id,
        up.display_name AS sender_name,
        conv.title      AS conversation_title,
        conv.type       AS conversation_type,
        conv.avatar_url AS conversation_avatar_url,
        conv.avatar_emoji AS conversation_avatar_emoji,
        (${scoreExpr})  AS score
      FROM chat_messages m
      JOIN chat_conversation_members cm
        ON cm.conversation_id = m.conversation_id
       AND cm.user_id = ${profileId}::uuid
       AND cm.left_at IS NULL
      JOIN chat_conversations conv ON conv.id = m.conversation_id
      LEFT JOIN LATERAL (
        SELECT display_name,
               atlas_unaccent(lower(coalesce(display_name, ''))) AS name_norm
        FROM user_profile WHERE id = m.sender_user_id
      ) up ON true
      WHERE m.deleted_at IS NULL
        ${convFilter}
        AND (${whereTokens})
      ORDER BY score DESC, m.created_at DESC
      LIMIT ${safeLimit + 1} OFFSET ${safeOffset}
    `;

    const truncated = rows.length > safeLimit;
    const page = truncated ? rows.slice(0, safeLimit) : rows;

    const data = page.map((r) => ({
      messageId: r.message_id,
      conversationId: r.conversation_id,
      conversation: {
        id: r.conversation_id,
        title: r.conversation_title,
        type: r.conversation_type,
        avatarUrl: r.conversation_avatar_url ?? null,
        avatarEmoji: r.conversation_avatar_emoji ?? null,
      },
      sender: { id: r.sender_user_id, displayName: r.sender_name ?? null },
      body: r.body ?? "",
      matchRanges: computeMatchRanges(r.body ?? "", tokens),
      createdAt: r.created_at,
      score: Number(r.score),
    }));

    return { data, truncated };
  }

  return { searchMessages };
}

export { ChatServiceError };
