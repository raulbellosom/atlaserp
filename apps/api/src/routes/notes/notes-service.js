export class NotesServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "NotesServiceError";
    this.status = status;
  }
}

export function createNotesService({ prisma, broadcaster = null }) {
  // ------------------------------------------------------------------
  // Internal helpers
  // ------------------------------------------------------------------

  /**
   * assertAccess — verifies that userId is allowed to access noteId.
   * Returns { isOwner, sharePermission } on success.
   * Throws NotesServiceError 404 if note doesn't exist.
   * Throws NotesServiceError 403 if requiredPermission is not satisfied.
   */
  async function assertAccess(noteId, userId, requiredPermission = "read") {
    const rows = await prisma.$queryRaw`
      SELECT
        n.id,
        n.owner_user_id,
        ns.permission AS share_permission
      FROM notes n
      LEFT JOIN note_shares ns
        ON ns.note_id = n.id
        AND ns.shared_with_user_id = ${userId}
      WHERE n.id = ${noteId}
        AND n.deleted_at IS NULL
      LIMIT 1
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }

    const row = rows[0];
    const isOwner = row.owner_user_id === userId;
    const sharePermission = row.share_permission ?? null;

    if (requiredPermission === "edit") {
      if (!isOwner && sharePermission !== "edit") {
        throw new NotesServiceError("No tienes permiso para editar esta nota.", 403);
      }
    } else {
      // read
      if (!isOwner && !sharePermission) {
        throw new NotesServiceError("No tienes acceso a esta nota.", 403);
      }
    }

    return { isOwner, sharePermission };
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  async function createNote({ userId, companyId, folderId, title, content, icon, backgroundColor }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO notes (
        owner_user_id,
        company_id,
        folder_id,
        title,
        content,
        icon,
        background_color
      )
      VALUES (
        ${userId},
        ${companyId ?? null}::uuid,
        ${folderId ?? null}::uuid,
        ${title ?? "Sin titulo"},
        ${content ? JSON.stringify(content) : null}::jsonb,
        ${icon ?? null},
        ${backgroundColor ?? null}
      )
      RETURNING *
    `;
    return rows[0];
  }

  // ------------------------------------------------------------------
  // Read one
  // ------------------------------------------------------------------

  async function getNote(noteId, userId) {
    await assertAccess(noteId, userId, "read");

    const rows = await prisma.$queryRaw`
      SELECT
        n.*,
        up.display_name AS owner_display_name,
        up.avatar_url   AS owner_avatar_url,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',    nt.id,
              'name',  nt.name,
              'color', nt.color
            )
          ) FILTER (WHERE nt.id IS NOT NULL),
          '[]'
        ) AS tags,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',          ns.id,
              'userId',      ns.shared_with_user_id,
              'permission',  ns.permission,
              'displayName', sup.display_name,
              'avatarUrl',   sup.avatar_url
            )
          ) FILTER (WHERE ns.id IS NOT NULL),
          '[]'
        ) AS shares
      FROM notes n
      LEFT JOIN user_profile up
        ON up.id = n.owner_user_id
      LEFT JOIN note_tag_assignments nta
        ON nta.note_id = n.id
      LEFT JOIN note_tags nt
        ON nt.id = nta.tag_id
      LEFT JOIN note_shares ns
        ON ns.note_id = n.id
      LEFT JOIN user_profile sup
        ON sup.id = ns.shared_with_user_id
      WHERE n.id = ${noteId}
        AND n.deleted_at IS NULL
      GROUP BY n.id, up.display_name, up.avatar_url
      LIMIT 1
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }

    return rows[0];
  }

  // ------------------------------------------------------------------
  // List
  // ------------------------------------------------------------------

  async function listNotes({
    userId,
    folderId,
    tagId,
    q,
    archived,
    trashed,
    shared,
    page = 1,
    pageSize = 30,
  } = {}) {
    const offset = (page - 1) * pageSize;
    const isTrashed = trashed ?? false;
    const isArchived = archived ?? false;

    // Build conditional clauses using explicit booleans.
    // We use a CTE to filter accessible notes, then join for enrichment.
    const rows = await prisma.$queryRaw`
      WITH accessible AS (
        SELECT
          n.*,
          (n.owner_user_id = ${userId}) AS is_owner,
          ns_mine.permission              AS my_share_permission
        FROM notes n
        LEFT JOIN note_shares ns_mine
          ON ns_mine.note_id = n.id
          AND ns_mine.shared_with_user_id = ${userId}
        WHERE n.deleted_at IS NULL
          AND n.is_trashed   = ${isTrashed}
          AND n.is_archived  = ${isArchived}
          AND (
            n.owner_user_id = ${userId}
            OR ns_mine.id IS NOT NULL
          )
      )
      SELECT
        a.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'id',    nt.id,
              'name',  nt.name,
              'color', nt.color
            )
          ) FILTER (WHERE nt.id IS NOT NULL),
          '[]'
        ) AS tags
      FROM accessible a
      LEFT JOIN note_tag_assignments nta
        ON nta.note_id = a.id
      LEFT JOIN note_tags nt
        ON nt.id = nta.tag_id
      WHERE (
        ${folderId ?? null}::uuid IS NULL
        OR a.folder_id = ${folderId ?? null}::uuid
      )
      AND (
        ${tagId ?? null}::uuid IS NULL
        OR EXISTS (
          SELECT 1 FROM note_tag_assignments x
          WHERE x.note_id = a.id
            AND x.tag_id = ${tagId ?? null}::uuid
        )
      )
      AND (
        ${q ?? null}::text IS NULL
        OR to_tsvector('simple', COALESCE(a.title, '') || ' ' || COALESCE(a.content_text, ''))
           @@ plainto_tsquery('simple', ${q ?? null}::text)
      )
      AND (
        ${shared ?? null}::boolean IS NULL
        OR (
          ${shared ?? null}::boolean = TRUE AND a.is_owner = FALSE
        )
        OR (
          ${shared ?? null}::boolean = FALSE AND a.is_owner = TRUE
        )
      )
      GROUP BY
        a.id,
        a.owner_user_id,
        a.company_id,
        a.folder_id,
        a.title,
        a.content,
        a.content_text,
        a.cover_url,
        a.icon,
        a.background_color,
        a.background_image_url,
        a.is_pinned,
        a.is_archived,
        a.is_trashed,
        a.is_public,
        a.public_slug,
        a.word_count,
        a.deleted_at,
        a.trashed_at,
        a.created_at,
        a.updated_at,
        a.is_owner,
        a.my_share_permission
      ORDER BY a.is_pinned DESC, a.updated_at DESC
      LIMIT ${pageSize}
      OFFSET ${offset}
    `;

    return rows;
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  async function updateNote(noteId, userId, data) {
    await assertAccess(noteId, userId, "edit");

    const rows = await prisma.$queryRaw`
      UPDATE notes
      SET
        title                = COALESCE(${data.title !== undefined ? data.title : null}::text,               title),
        content              = COALESCE(${data.content !== undefined ? JSON.stringify(data.content) : null}::jsonb, content),
        content_text         = COALESCE(${data.contentText !== undefined ? data.contentText : null}::text,   content_text),
        icon                 = COALESCE(${data.icon !== undefined ? data.icon : null}::text,                 icon),
        background_color     = CASE
                                 WHEN ${data.backgroundColor !== undefined ? "t" : "f"}::text = 't'
                                 THEN ${data.backgroundColor !== undefined ? data.backgroundColor : null}::text
                                 ELSE background_color
                               END,
        background_image_url = CASE
                                 WHEN ${data.backgroundImageUrl !== undefined ? "t" : "f"}::text = 't'
                                 THEN ${data.backgroundImageUrl !== undefined ? data.backgroundImageUrl : null}::text
                                 ELSE background_image_url
                               END,
        cover_url            = CASE
                                 WHEN ${data.coverUrl !== undefined ? "t" : "f"}::text = 't'
                                 THEN ${data.coverUrl !== undefined ? data.coverUrl : null}::text
                                 ELSE cover_url
                               END,
        folder_id            = CASE
                                 WHEN ${data.folderId !== undefined ? "t" : "f"}::text = 't'
                                 THEN ${data.folderId !== undefined ? data.folderId : null}::uuid
                                 ELSE folder_id
                               END,
        is_pinned            = COALESCE(${data.isPinned !== undefined ? data.isPinned : null}::boolean,      is_pinned),
        is_archived          = COALESCE(${data.isArchived !== undefined ? data.isArchived : null}::boolean,  is_archived),
        word_count           = COALESCE(${data.wordCount !== undefined ? data.wordCount : null}::integer,    word_count),
        updated_at           = NOW()
      WHERE id = ${noteId}
        AND deleted_at IS NULL
      RETURNING *
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }

    // Broadcast to collaborators
    if (broadcaster) {
      try {
        const shareRows = await prisma.$queryRaw`
          SELECT shared_with_user_id
          FROM note_shares
          WHERE note_id = ${noteId}
        `;
        const collaboratorIds = shareRows.map((r) => r.shared_with_user_id.toString());
        if (collaboratorIds.length > 0) {
          await broadcaster.broadcastToUsers(collaboratorIds, "notes.note.updated", { noteId });
        }
      } catch (_err) {
        // Non-critical — don't fail the update if broadcast errors
      }
    }

    return rows[0];
  }

  // ------------------------------------------------------------------
  // Trash / Restore / Permanent delete
  // ------------------------------------------------------------------

  async function trashNote(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id, owner_user_id
      FROM notes
      WHERE id = ${noteId}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }
    if (rows[0].owner_user_id !== userId) {
      throw new NotesServiceError("Solo el propietario puede mover esta nota a la papelera.", 403);
    }

    await prisma.$executeRaw`
      UPDATE notes
      SET is_trashed = TRUE,
          trashed_at = NOW(),
          updated_at = NOW()
      WHERE id = ${noteId}
    `;

    return { ok: true };
  }

  async function restoreNote(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id, owner_user_id
      FROM notes
      WHERE id = ${noteId}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }
    if (rows[0].owner_user_id !== userId) {
      throw new NotesServiceError("Solo el propietario puede restaurar esta nota.", 403);
    }

    await prisma.$executeRaw`
      UPDATE notes
      SET is_trashed = FALSE,
          trashed_at = NULL,
          updated_at = NOW()
      WHERE id = ${noteId}
    `;

    return { ok: true };
  }

  async function permanentDelete(noteId, userId) {
    const rows = await prisma.$queryRaw`
      SELECT id, owner_user_id, is_trashed
      FROM notes
      WHERE id = ${noteId}
        AND deleted_at IS NULL
      LIMIT 1
    `;

    if (!rows.length) {
      throw new NotesServiceError("Nota no encontrada.", 404);
    }
    if (rows[0].owner_user_id !== userId) {
      throw new NotesServiceError("Solo el propietario puede eliminar esta nota.", 403);
    }
    if (!rows[0].is_trashed) {
      throw new NotesServiceError("La nota debe estar en la papelera antes de eliminarla permanentemente.", 400);
    }

    await prisma.$executeRaw`
      DELETE FROM notes
      WHERE id = ${noteId}
    `;

    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return {
    assertAccess,
    createNote,
    getNote,
    listNotes,
    updateNote,
    trashNote,
    restoreNote,
    permanentDelete,
  };
}
