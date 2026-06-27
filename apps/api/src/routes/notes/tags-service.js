export class TagsServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "TagsServiceError";
    this.status = status;
  }
}

export function createTagsService({ prisma }) {
  // ------------------------------------------------------------------
  // List
  // ------------------------------------------------------------------

  async function listTags({ userId }) {
    const rows = await prisma.$queryRaw`
      SELECT
        note_tags.*,
        COUNT(note_tag_assignments.note_id) AS note_count
      FROM note_tags
      LEFT JOIN note_tag_assignments
        ON note_tags.id = note_tag_assignments.tag_id
      WHERE note_tags.owner_user_id = ${userId}
      GROUP BY note_tags.id
      ORDER BY note_tags.name ASC
    `;
    return rows.map((row) => ({
      ...row,
      note_count: parseInt(row.note_count, 10),
    }));
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  async function createTag({ userId, companyId, name, color }) {
    try {
      const rows = await prisma.$queryRaw`
        INSERT INTO note_tags (owner_user_id, company_id, name, color)
        VALUES (
          ${userId},
          ${companyId ?? null}::uuid,
          ${name},
          ${color ?? "#6366f1"}
        )
        RETURNING *
      `;
      return rows[0];
    } catch (err) {
      if (err?.message?.includes("unique") || err?.code === "23505") {
        throw new TagsServiceError("Ya existe una etiqueta con ese nombre", 409);
      }
      throw err;
    }
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  async function updateTag(tagId, userId, data) {
    const existing = await prisma.$queryRaw`
      SELECT id
      FROM note_tags
      WHERE id = ${tagId}
        AND owner_user_id = ${userId}
      LIMIT 1
    `;

    if (!existing.length) {
      throw new TagsServiceError("Etiqueta no encontrada.", 404);
    }

    const rows = await prisma.$queryRaw`
      UPDATE note_tags
      SET
        name       = COALESCE(${data.name ?? null}::text, name),
        color      = COALESCE(${data.color ?? null}::text, color),
        updated_at = NOW()
      WHERE id = ${tagId}
        AND owner_user_id = ${userId}
      RETURNING *
    `;

    if (!rows.length) {
      throw new TagsServiceError("Etiqueta no encontrada.", 404);
    }

    return rows[0];
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  async function deleteTag(tagId, userId) {
    const existing = await prisma.$queryRaw`
      SELECT id
      FROM note_tags
      WHERE id = ${tagId}
        AND owner_user_id = ${userId}
      LIMIT 1
    `;

    if (!existing.length) {
      throw new TagsServiceError("Etiqueta no encontrada.", 404);
    }

    await prisma.$executeRaw`
      DELETE FROM note_tags
      WHERE id = ${tagId}
        AND owner_user_id = ${userId}
    `;

    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Set note tags (replace-all)
  // ------------------------------------------------------------------

  async function setNoteTags(noteId, userId, tagIds) {
    // Verify user has edit access to this note (owner OR share with edit permission)
    const access = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND deleted_at IS NULL
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
              AND permission = 'edit'
          )
        )
    `
    if (!access.length) throw new TagsServiceError('No tienes permiso para editar esta nota', 403)

    await prisma.$executeRaw`DELETE FROM note_tag_assignments WHERE note_id = ${noteId}::uuid`
    if (!tagIds || !tagIds.length) return { ok: true, count: 0 }
    for (const tagId of tagIds) {
      await prisma.$executeRaw`
        INSERT INTO note_tag_assignments (note_id, tag_id)
        VALUES (${noteId}::uuid, ${tagId}::uuid)
        ON CONFLICT DO NOTHING
      `
    }
    return { ok: true, count: tagIds.length }
  }

  // ------------------------------------------------------------------
  // Remove single note tag
  // ------------------------------------------------------------------

  async function removeNoteTag(noteId, tagId, userId) {
    // Verify user has edit access
    const access = await prisma.$queryRaw`
      SELECT id FROM notes
      WHERE id = ${noteId}::uuid
        AND deleted_at IS NULL
        AND (
          owner_user_id = ${userId}::uuid
          OR id IN (
            SELECT note_id FROM note_shares
            WHERE shared_with_user_id = ${userId}::uuid
              AND permission = 'edit'
          )
        )
    `
    if (!access.length) throw new TagsServiceError('No tienes permiso para editar esta nota', 403)

    await prisma.$executeRaw`
      DELETE FROM note_tag_assignments
      WHERE note_id = ${noteId}::uuid
        AND tag_id  = ${tagId}::uuid
    `
    return { ok: true }
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return { listTags, createTag, updateTag, deleteTag, setNoteTags, removeNoteTag };
}
