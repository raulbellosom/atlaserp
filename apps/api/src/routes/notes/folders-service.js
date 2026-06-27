export class FoldersServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "FoldersServiceError";
    this.status = status;
  }
}

export function createFoldersService({ prisma }) {
  // ------------------------------------------------------------------
  // List
  // ------------------------------------------------------------------

  async function listFolders({ userId, companyId }) {
    const rows = await prisma.$queryRaw`
      SELECT *
      FROM note_folders
      WHERE owner_user_id = ${userId}
      ORDER BY sort_order ASC, name ASC
    `;
    return rows;
  }

  // ------------------------------------------------------------------
  // Create
  // ------------------------------------------------------------------

  async function createFolder({ userId, companyId, name, color, icon, parentFolderId, sortOrder }) {
    const rows = await prisma.$queryRaw`
      INSERT INTO note_folders (
        owner_user_id,
        company_id,
        name,
        color,
        icon,
        parent_folder_id,
        sort_order
      )
      VALUES (
        ${userId},
        ${companyId ?? null}::uuid,
        ${name},
        ${color ?? null}::text,
        ${icon ?? null}::text,
        ${parentFolderId ?? null}::uuid,
        ${sortOrder ?? 0}
      )
      RETURNING *
    `;
    return rows[0];
  }

  // ------------------------------------------------------------------
  // Update
  // ------------------------------------------------------------------

  async function updateFolder(folderId, userId, data) {
    const existing = await prisma.$queryRaw`
      SELECT id
      FROM note_folders
      WHERE id = ${folderId}
        AND owner_user_id = ${userId}
      LIMIT 1
    `;

    if (!existing.length) {
      throw new FoldersServiceError("Carpeta no encontrada.", 404);
    }

    const rows = await prisma.$queryRaw`
      UPDATE note_folders
      SET
        name             = COALESCE(${data.name ?? null}::text, name),
        color            = CASE
                             WHEN ${data.color !== undefined ? "t" : "f"}::boolean = TRUE
                             THEN ${data.color ?? null}::text
                             ELSE color
                           END,
        icon             = CASE
                             WHEN ${data.icon !== undefined ? "t" : "f"}::boolean = TRUE
                             THEN ${data.icon ?? null}::text
                             ELSE icon
                           END,
        parent_folder_id = CASE
                             WHEN ${data.parentFolderId !== undefined ? "t" : "f"}::boolean = TRUE
                             THEN ${data.parentFolderId ?? null}::uuid
                             ELSE parent_folder_id
                           END,
        sort_order       = COALESCE(${data.sortOrder ?? null}::integer, sort_order),
        updated_at       = NOW()
      WHERE id = ${folderId}
        AND owner_user_id = ${userId}
      RETURNING *
    `;

    if (!rows.length) {
      throw new FoldersServiceError("Carpeta no encontrada.", 404);
    }

    return rows[0];
  }

  // ------------------------------------------------------------------
  // Delete
  // ------------------------------------------------------------------

  async function deleteFolder(folderId, userId) {
    const existing = await prisma.$queryRaw`
      SELECT id
      FROM note_folders
      WHERE id = ${folderId}
        AND owner_user_id = ${userId}
      LIMIT 1
    `;

    if (!existing.length) {
      throw new FoldersServiceError("Carpeta no encontrada.", 404);
    }

    await prisma.$executeRaw`
      DELETE FROM note_folders
      WHERE id = ${folderId}
        AND owner_user_id = ${userId}
    `;

    return { ok: true };
  }

  // ------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------

  return { listFolders, createFolder, updateFolder, deleteFolder };
}
