import { Prisma } from "@prisma/client";
import { ChatServiceError } from "./chat-service.js";

// Backs both the "1 channel per project" rule and the generic
// future-proofing that motivated linked_module/linked_entity_id over a
// project-specific column — this pair of columns is meant to support future
// connectors beyond just atlas.projects, without another migration.
export function createChatChannelLinksService({ prisma }) {
  // linkedModule/linkedEntityId must travel together — a row with one set and
  // the other null is a "half-linked" state the partial unique index (added
  // in a prior migration) cannot catch (Postgres unique indexes never treat
  // two NULLs as colliding, so N rows could all have the same linked_module
  // with a null linked_entity_id). Synchronous — pure validation, no I/O —
  // so callers can call it before touching prisma at all.
  function assertBothOrNeither(linkedModule, linkedEntityId) {
    const hasModule = linkedModule !== null && linkedModule !== undefined;
    const hasEntityId = linkedEntityId !== null && linkedEntityId !== undefined;
    if (hasModule !== hasEntityId) {
      throw new ChatServiceError("linkedModule y linkedEntityId deben enviarse juntos.", 422);
    }
  }

  async function findByLink(linkedModule, linkedEntityId) {
    const rows = await prisma.$queryRaw`
      SELECT * FROM chat_conversations
      WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId} AND deleted_at IS NULL
      LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async function assertLinkAvailable(linkedModule, linkedEntityId, excludeConversationId = null) {
    const rows = excludeConversationId
      ? await prisma.$queryRaw`
          SELECT id FROM chat_conversations
          WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId}
            AND deleted_at IS NULL AND id != ${excludeConversationId}
          LIMIT 1
        `
      : await prisma.$queryRaw`
          SELECT id FROM chat_conversations
          WHERE linked_module = ${linkedModule} AND linked_entity_id = ${linkedEntityId} AND deleted_at IS NULL
          LIMIT 1
        `;
    if (rows.length) {
      throw new ChatServiceError("Ese registro ya tiene un canal vinculado.", 409);
    }
  }

  // Single entry point for updateConversation's SET-clause building: checks
  // availability (skipped entirely when clearing the link — an unlink can
  // never collide) and returns the Prisma.sql fragments to push into the
  // caller's `sets` array. Returns [] when `updates` doesn't touch the link
  // at all (linkedModule absent from the object), so the caller can always
  // spread the result into `sets` unconditionally without its own branching.
  async function applyLinkUpdate(updates, conversationId) {
    if (updates.linkedModule === undefined) return [];
    if (updates.linkedModule !== null) {
      await assertLinkAvailable(updates.linkedModule, updates.linkedEntityId, conversationId);
    }
    return [
      Prisma.sql`linked_module = ${updates.linkedModule}`,
      Prisma.sql`linked_entity_id = ${updates.linkedEntityId ?? null}`,
    ];
  }

  return { findByLink, assertLinkAvailable, assertBothOrNeither, applyLinkUpdate };
}
