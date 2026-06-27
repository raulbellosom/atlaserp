export class YDocServiceError extends Error {
  constructor(message, status = 400) {
    super(message)
    this.name = 'YDocServiceError'
    this.status = status
  }
}

export function createYDocService({ prisma }) {
  async function getState(noteId, userId) {
    const [note] = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
          )
        )
    `
    if (!note) {
      throw new YDocServiceError('Nota no encontrada', 404)
    }

    const [row] = await prisma.$queryRaw`
      SELECT state, version FROM note_ydoc_state
      WHERE note_id = ${noteId}::uuid
    `
    if (!row) {
      return { state: null }
    }

    const state = Buffer.from(row.state).toString('base64')
    return { state, version: row.version }
  }

  async function saveState(noteId, userId, stateBase64) {
    const [note] = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
              AND permission = 'edit'
          )
        )
    `
    if (!note) {
      throw new YDocServiceError('Sin permisos de edicion', 403)
    }

    const stateBuffer = Buffer.from(stateBase64, 'base64')
    await prisma.$executeRaw`
      INSERT INTO note_ydoc_state (note_id, state, version, updated_at)
      VALUES (${noteId}::uuid, ${stateBuffer}::bytea, 1, NOW())
      ON CONFLICT (note_id) DO UPDATE
        SET state = EXCLUDED.state,
            version = note_ydoc_state.version + 1,
            updated_at = NOW()
    `
    return { ok: true }
  }

  return { getState, saveState }
}
