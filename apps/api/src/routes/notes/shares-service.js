import { randomBytes } from 'node:crypto'

export class SharesServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'SharesServiceError'
    this.status = status
  }
}

export function createSharesService({ prisma, broadcaster }) {
  async function _verifyAccess(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}
        AND deleted_at IS NULL
        AND (
          owner_user_id = ${userId}
          OR EXISTS (
            SELECT 1 FROM note_shares
            WHERE note_shares.note_id = notes.id
              AND note_shares.shared_with_user_id = ${userId}
          )
        )
    `
    if (!rows.length) throw new SharesServiceError('Nota no encontrada', 404)
    return rows[0]
  }

  async function _verifyOwner(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId} AND owner_user_id = ${userId} AND deleted_at IS NULL
    `
    if (!rows.length) throw new SharesServiceError('No tienes permiso para realizar esta acción', 403)
    return rows[0]
  }

  // A note may only be shared with a user who belongs to (at least) one company
  // the owner also belongs to. Blocks cross-tenant sharing and self-sharing.
  async function _assertShareableTarget(ownerUserId, targetUserId) {
    if (!targetUserId || typeof targetUserId !== 'string') {
      throw new SharesServiceError('Usuario destino invalido', 400)
    }
    if (targetUserId === ownerUserId) {
      throw new SharesServiceError('No puedes compartir una nota contigo mismo', 400)
    }
    const rows = await prisma.$queryRaw`
      SELECT 1
      FROM membership m_owner
      JOIN membership m_target
        ON m_target.company_id = m_owner.company_id
      WHERE m_owner.user_id  = ${ownerUserId}::uuid  AND m_owner.enabled  = true
        AND m_target.user_id = ${targetUserId}::uuid AND m_target.enabled = true
      LIMIT 1
    `
    if (!rows.length) {
      throw new SharesServiceError('Solo puedes compartir con usuarios de tu empresa', 403)
    }
  }

  async function listShares(noteId, userId) {
    await _verifyAccess(noteId, userId)
    const ownerRows = await prisma.$queryRaw`
      SELECT id FROM notes WHERE id = ${noteId} AND owner_user_id = ${userId}
    `
    const isOwner = ownerRows.length > 0
    const rows = await prisma.$queryRaw`
      SELECT
        ns.*,
        up.display_name,
        up.avatar_file_id
      FROM note_shares ns
      JOIN user_profile up ON ns.shared_with_user_id = up.id
      WHERE ns.note_id = ${noteId}
    `
    // Email is only exposed to the note owner (who manages the share list).
    if (!isOwner) return rows
    const emails = await prisma.$queryRaw`
      SELECT ns.id, up.email
      FROM note_shares ns
      JOIN user_profile up ON ns.shared_with_user_id = up.id
      WHERE ns.note_id = ${noteId}
    `
    const emailById = new Map(emails.map((r) => [r.id, r.email]))
    return rows.map((r) => ({ ...r, user_email: emailById.get(r.id) ?? null }))
  }

  // The target must actually be able to use the notes module: an enabled
  // membership (in a company shared with the actor) whose role is an admin role
  // — those get every permission — or grants `notes.notes.read`. Without this a
  // note could be shared with a user who then can't open it at all.
  async function _assertTargetHasNotesAccess(actorUserId, targetUserId) {
    const rows = await prisma.$queryRaw`
      SELECT 1
      FROM membership m_owner
      JOIN membership m_target
        ON m_target.company_id = m_owner.company_id
      JOIN role r ON r.id = m_target.role_id AND r.enabled = true
      WHERE m_owner.user_id  = ${actorUserId}::uuid  AND m_owner.enabled  = true
        AND m_target.user_id = ${targetUserId}::uuid AND m_target.enabled = true
        AND (
          r.key IN ('atlas.admin', 'system.admin')
          OR EXISTS (
            SELECT 1 FROM role_permission rp
            JOIN permission p ON p.id = rp.permission_id
            WHERE rp.role_id = r.id
              AND p.key = 'notes.notes.read'
              AND p.active = true
          )
        )
      LIMIT 1
    `
    if (!rows.length) {
      throw new SharesServiceError('Ese usuario no tiene acceso al modulo de notas', 403)
    }
  }

  // Picker source for the share modal — same eligibility rule as
  // _assertTargetHasNotesAccess, plus a name/email search. Gated at the route
  // by `notes.shares.create`.
  async function listShareableUsers(actorUserId, search) {
    const like = search && search.trim() ? `%${search.trim()}%` : null
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT up.id, up.display_name, up.email
      FROM membership m_owner
      JOIN membership m_target
        ON m_target.company_id = m_owner.company_id
      JOIN user_profile up ON up.id = m_target.user_id AND up.enabled = true
      JOIN role r ON r.id = m_target.role_id AND r.enabled = true
      WHERE m_owner.user_id = ${actorUserId}::uuid AND m_owner.enabled = true
        AND m_target.enabled = true
        AND m_target.user_id <> ${actorUserId}::uuid
        AND (
          r.key IN ('atlas.admin', 'system.admin')
          OR EXISTS (
            SELECT 1 FROM role_permission rp
            JOIN permission p ON p.id = rp.permission_id
            WHERE rp.role_id = r.id
              AND p.key = 'notes.notes.read'
              AND p.active = true
          )
        )
        AND (
          ${like}::text IS NULL
          OR up.display_name ILIKE ${like}
          OR up.email ILIKE ${like}
        )
      ORDER BY up.display_name ASC
      LIMIT 20
    `
    return rows.map((r) => ({
      id: r.id,
      displayName: r.display_name,
      email: r.email,
      avatarUrl: null,
    }))
  }

  async function shareNote(noteId, userId, { targetUserId, permission }) {
    await _verifyOwner(noteId, userId)
    if (!['read', 'edit'].includes(permission)) {
      throw new SharesServiceError("El permiso debe ser 'read' o 'edit'")
    }
    await _assertShareableTarget(userId, targetUserId)
    await _assertTargetHasNotesAccess(userId, targetUserId)
    const rows = await prisma.$queryRaw`
      INSERT INTO note_shares (note_id, shared_with_user_id, shared_by_user_id, permission)
      VALUES (${noteId}, ${targetUserId}, ${userId}, ${permission}::text)
      ON CONFLICT (note_id, shared_with_user_id)
      DO UPDATE SET
        permission = EXCLUDED.permission,
        shared_by_user_id = EXCLUDED.shared_by_user_id
      RETURNING *
    `
    const share = rows[0]
    if (broadcaster) {
      try {
        await broadcaster.broadcastToUser(targetUserId, 'notes.note.shared', {
          noteId,
          permission,
          sharedBy: userId,
        })
      } catch (err) {
        console.warn('[shares-service] broadcast error:', err?.message)
      }
    }
    return share
  }

  async function updateShare(shareId, userId, { permission }) {
    if (!['read', 'edit'].includes(permission)) {
      throw new SharesServiceError("El permiso debe ser 'read' o 'edit'")
    }
    const check = await prisma.$queryRaw`
      SELECT ns.id FROM note_shares ns
      JOIN notes ON ns.note_id = notes.id
      WHERE ns.id = ${shareId} AND notes.owner_user_id = ${userId}
    `
    if (!check.length) throw new SharesServiceError('No tienes permiso para realizar esta acción', 403)
    const rows = await prisma.$queryRaw`
      UPDATE note_shares SET permission = ${permission}::text WHERE id = ${shareId} RETURNING *
    `
    return rows[0]
  }

  async function revokeShare(shareId, userId) {
    const check = await prisma.$queryRaw`
      SELECT ns.id FROM note_shares ns
      JOIN notes ON ns.note_id = notes.id
      WHERE ns.id = ${shareId} AND notes.owner_user_id = ${userId}
    `
    if (!check.length) throw new SharesServiceError('No tienes permiso para realizar esta acción', 403)
    await prisma.$queryRaw`
      DELETE FROM note_shares
      WHERE id = ${shareId}
        AND note_id IN (SELECT id FROM notes WHERE owner_user_id = ${userId})
    `
    return { ok: true }
  }

  async function publishNote(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id, is_public, public_slug FROM notes
      WHERE id = ${noteId} AND owner_user_id = ${userId} AND deleted_at IS NULL
    `
    if (!rows.length) throw new SharesServiceError('No tienes permiso para realizar esta acción', 403)
    const existing = rows[0]
    if (!existing.is_public || !existing.public_slug) {
      const slug = randomBytes(8).toString('base64url')
      await prisma.$executeRaw`
        UPDATE notes SET is_public = true, public_slug = ${slug}
        WHERE id = ${noteId} AND owner_user_id = ${userId}
      `
    }
    const updated = await prisma.$queryRaw`
      SELECT * FROM notes WHERE id = ${noteId}
    `
    return updated[0]
  }

  async function unpublishNote(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId} AND owner_user_id = ${userId} AND deleted_at IS NULL
    `
    if (!rows.length) throw new SharesServiceError('No tienes permiso para realizar esta acción', 403)
    await prisma.$executeRaw`
      UPDATE notes SET is_public = false, public_slug = NULL
      WHERE id = ${noteId} AND owner_user_id = ${userId}
    `
    const updated = await prisma.$queryRaw`
      SELECT * FROM notes WHERE id = ${noteId}
    `
    return updated[0]
  }

  async function getPublicNote(slug) {
    // Public endpoint (no auth) — expose only render-safe fields, never internal
    // identifiers (company_id, owner_user_id, folder_id) or workflow flags.
    const rows = await prisma.$queryRaw`
      SELECT
        notes.id,
        notes.title,
        notes.content,
        notes.content_text,
        notes.icon,
        notes.cover_url,
        notes.background_color,
        notes.background_image_url,
        notes.word_count,
        notes.public_slug,
        notes.created_at,
        notes.updated_at,
        up.display_name AS author_name,
        up.avatar_file_id AS author_avatar_file_id
      FROM notes
      JOIN user_profile up ON notes.owner_user_id = up.id
      WHERE notes.public_slug = ${slug}
        AND notes.is_public = true
        AND notes.deleted_at IS NULL
        AND notes.is_trashed = false
    `
    if (!rows.length) throw new SharesServiceError('Nota no encontrada', 404)
    return rows[0]
  }

  return { listShares, listShareableUsers, shareNote, updateShare, revokeShare, publishNote, unpublishNote, getPublicNote }
}
