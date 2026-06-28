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

  async function listShares(noteId, userId) {
    await _verifyAccess(noteId, userId)
    const rows = await prisma.$queryRaw`
      SELECT
        ns.*,
        up.display_name,
        up.email        AS user_email,
        up.avatar_file_id
      FROM note_shares ns
      JOIN user_profile up ON ns.shared_with_user_id = up.id
      WHERE ns.note_id = ${noteId}
    `
    return rows
  }

  async function shareNote(noteId, userId, { targetUserId, permission }) {
    await _verifyOwner(noteId, userId)
    if (!['read', 'edit'].includes(permission)) {
      throw new SharesServiceError("El permiso debe ser 'read' o 'edit'")
    }
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
    const rows = await prisma.$queryRaw`
      SELECT
        notes.*,
        up.display_name AS author_name
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

  return { listShares, shareNote, updateShare, revokeShare, publishNote, unpublishNote, getPublicNote }
}
