export class FileAccessError extends Error {
  constructor(message, status = 403) {
    super(message);
    this.status = status;
  }
}

// Shared by Files discovery/downloads and every Office read/write request.
export function createFileAccess({ prisma }) {
  function readWhere({ profileId, admin }) {
    return admin
      ? {}
      : {
          OR: [
            { accessScope: "COMPANY" },
            { uploadedById: profileId },
            { shares: { some: { userId: profileId, status: "ACCEPTED" } } },
          ],
        };
  }
  async function assertAccess(
    file,
    { profileId, admin },
    operation = "read",
    db = prisma,
  ) {
    if (admin || file.uploadedById === profileId) return;
    if (operation === "manage")
      throw new FileAccessError(
        "Solo el propietario o un administrador puede gestionar el acceso.",
      );
    if (!file.accessScope || file.accessScope === "COMPANY") return;
    const share = await db.fileAssetShare.findUnique({
      where: { fileId_userId: { fileId: file.id, userId: profileId } },
    });
    if (
      share?.status !== "ACCEPTED" ||
      (operation === "write" && share.role !== "EDITOR")
    ) {
      throw new FileAccessError(
        operation === "write"
          ? "No tienes permiso para editar este documento."
          : "No tienes acceso a este documento.",
      );
    }
  }
  return { readWhere, assertAccess };
}
