import JSZip from "jszip";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_SECONDS = 3600;
const BULK_DOWNLOAD_MAX_FILE_IDS = 50;
const BULK_DOWNLOAD_MAX_TOTAL_BYTES = 250 * 1024 * 1024;
const STORAGE_BUCKET_NAME = "atlas-files";
const WEBSITE_BUCKET_NAME = "atlas-website";
const BULK_ZIP_FOLDER = "system/bulk-downloads";
const ALLOWED_FILE_ENTITY_TYPES = [
  "AtlasFile",
  "BrandingConfig",
  "Company",
  "HrEmployee",
  "Contact",
  "FleetVehicle",
  "FleetDriver",
  "FleetMaintenance",
  "FleetReport",
  "Task",
];
const ALLOWED_EXACT_MIME_TYPES = new Set([
  "application/pdf",
  "application/json",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

const ALLOWED_MIME_PREFIXES = ["image/", "text/"];

class FilesServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = "FilesServiceError";
    this.status = status;
  }
}

function sanitizeSegment(value, fallback = "file") {
  return (
    String(value ?? fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || fallback
  );
}

function getExtension(fileName = "", mimeType = "") {
  const fromName = String(fileName).split(".").pop();
  if (fromName && fromName !== fileName)
    return sanitizeSegment(fromName, "bin");
  if (mimeType.startsWith("image/")) return mimeType.split("/")[1];
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("text/")) return "txt";
  return "bin";
}

function buildModuleObjectKey({
  moduleKey,
  entityType,
  entityId,
  fileName,
  mimeType,
}) {
  const moduleSegment = sanitizeSegment(moduleKey, "atlas-files");
  const entityTypeSegment = sanitizeSegment(entityType, "atlasfile");
  const entityIdSegment = sanitizeSegment(entityId, "company");
  const ext = getExtension(fileName, mimeType);
  const random = Math.random().toString(36).slice(2, 10);
  return `modules/${moduleSegment}/${entityTypeSegment}/${entityIdSegment}/${Date.now()}-${random}.${ext}`;
}

function normalizePagination({ page, pageSize }) {
  const safePage = Math.max(1, Number.parseInt(String(page ?? "1"), 10) || 1);
  const safePageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(String(pageSize ?? "20"), 10) || 20),
  );

  return {
    page: safePage,
    pageSize: safePageSize,
    skip: (safePage - 1) * safePageSize,
    take: safePageSize,
  };
}

function parseEnabled(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;

  const normalized = String(value).trim().toLowerCase();
  if (["true", "1", "yes", "si"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;

  return undefined;
}

function parseMetadata(raw) {
  if (!raw) return {};
  if (typeof raw === "object") return raw;

  try {
    return JSON.parse(String(raw));
  } catch {
    return {};
  }
}

function isAllowedSort(sortBy) {
  return ["createdAt", "sizeBytes", "originalName"].includes(sortBy);
}

function isAllowedMimeType(mimeType) {
  if (!mimeType) return false;
  if (ALLOWED_EXACT_MIME_TYPES.has(mimeType)) return true;
  return ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function emptyListResponse(page, pageSize) {
  return {
    data: [],
    pagination: {
      page,
      pageSize,
      total: 0,
      totalPages: 1,
    },
  };
}

function getUniqueZipEntryName(originalName, usedNames) {
  const trimmedName = String(originalName ?? "").trim();
  const fallbackName = `archivo-${Date.now()}`;
  const baseName = trimmedName || fallbackName;

  const lastDot = baseName.lastIndexOf(".");
  const hasExtension = lastDot > 0 && lastDot < baseName.length - 1;
  const stem = hasExtension ? baseName.slice(0, lastDot) : baseName;
  const extension = hasExtension ? baseName.slice(lastDot) : "";

  const currentCount = usedNames.get(baseName) ?? 0;
  usedNames.set(baseName, currentCount + 1);
  if (currentCount === 0) return baseName;

  return `${stem} (${currentCount + 1})${extension}`;
}

export function createFilesService({ prisma, supabaseAdmin }) {
  async function getUserCompanyContext(authUserId) {
    const profile = await prisma.userProfile.findUnique({
      where: { authUserId },
      select: { id: true },
    });

    if (!profile) {
      throw new FilesServiceError("Perfil de usuario no encontrado.", 404);
    }

    const membership = await prisma.membership.findFirst({
      where: { userId: profile.id, enabled: true },
      orderBy: { createdAt: "desc" },
      select: { companyId: true },
    });

    if (!membership?.companyId) {
      throw new FilesServiceError(
        "No tienes una empresa activa para gestionar archivos.",
        403,
      );
    }

    return {
      profileId: profile.id,
      companyId: membership.companyId,
    };
  }

  async function ensureFileBelongsToCompany({
    fileId,
    companyId,
    includeDisabled = true,
  }) {
    const where = {
      id: fileId,
      entityId: companyId,
      entityType: { in: ALLOWED_FILE_ENTITY_TYPES },
    };

    if (!includeDisabled) {
      where.enabled = true;
    }

    const file = await prisma.fileAsset.findFirst({ where });
    if (!file) {
      throw new FilesServiceError("Archivo no encontrado.", 404);
    }

    return file;
  }

  return {
    async upload({ authUserId, file, fields = {} }) {
      const context = await getUserCompanyContext(authUserId);

      if (!(file instanceof File) || file.size <= 0) {
        throw new FilesServiceError("Selecciona un archivo válido.", 400);
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        throw new FilesServiceError(
          "El archivo supera el límite de 10 MB.",
          400,
        );
      }

      if (!isAllowedMimeType(file.type)) {
        throw new FilesServiceError(
          "Tipo de archivo no permitido. Usa imagen, PDF, texto u oficina.",
          400,
        );
      }

      const moduleKey =
        String(fields.moduleKey ?? "atlas.files").trim() || "atlas.files";
      const entityType =
        String(fields.entityType ?? "AtlasFile").trim() || "AtlasFile";
      const entityId = context.companyId;
      const sourceEntityId = String(fields.entityId ?? "").trim() || null;
      const visibility = String(fields.visibility ?? "PRIVATE")
        .trim()
        .toUpperCase();
      const metadata = parseMetadata(fields.metadata);

      const objectKey = buildModuleObjectKey({
        moduleKey,
        entityType,
        entityId,
        fileName: file.name,
        mimeType: file.type,
      });

      const targetBucket = visibility === "PUBLIC" ? WEBSITE_BUCKET_NAME : STORAGE_BUCKET_NAME;
      const arrayBuffer = await file.arrayBuffer();
      const { error: uploadError } = await supabaseAdmin.storage
        .from(targetBucket)
        .upload(objectKey, arrayBuffer, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        throw new FilesServiceError("No se pudo subir el archivo.", 500);
      }

      const asset = await prisma.fileAsset.create({
        data: {
          bucket: targetBucket,
          objectKey,
          originalName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          visibility: ["PUBLIC", "INTERNAL", "PRIVATE"].includes(visibility)
            ? visibility
            : "PRIVATE",
          moduleKey,
          entityType,
          entityId,
          uploadedById: context.profileId,
          metadata: {
            ...metadata,
            companyId: context.companyId,
            sourceEntityId,
          },
        },
      });

      return asset;
    },

    async list({ authUserId, query = {} }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      const { page, pageSize, skip, take } = normalizePagination(query);

      const q = String(query.q ?? "").trim();
      const moduleKey = String(query.moduleKey ?? "").trim();
      const entityType = String(query.entityType ?? "").trim();
      const requestedEntityId = String(query.entityId ?? "").trim();
      const sourceEntityId = String(query.sourceEntityId ?? "").trim();
      const mime = String(query.mime ?? "")
        .trim()
        .toLowerCase();
      const enabled = parseEnabled(query.enabled);
      const sortBy = isAllowedSort(query.sortBy) ? query.sortBy : "createdAt";
      const sortDir =
        String(query.sortDir ?? "desc").toLowerCase() === "asc"
          ? "asc"
          : "desc";

      // If a plain entityId is given and it doesn't match the company, bail early
      // unless caller is using sourceEntityId (metadata-based filter).
      if (
        requestedEntityId &&
        requestedEntityId !== companyId &&
        !sourceEntityId
      ) {
        return emptyListResponse(page, pageSize);
      }

      const where = {
        entityId: companyId,
        entityType: { in: ALLOWED_FILE_ENTITY_TYPES },
      };

      if (enabled !== undefined) where.enabled = enabled;
      if (moduleKey) where.moduleKey = moduleKey;
      if (entityType) where.entityType = entityType;
      if (mime) {
        where.mimeType = { startsWith: mime };
      }
      // Filter by the originating entity stored in metadata (e.g. HrEmployee ID)
      if (sourceEntityId) {
        where.metadata = {
          path: ["sourceEntityId"],
          equals: sourceEntityId,
        };
      }

      if (q) {
        where.OR = [
          { originalName: { contains: q, mode: "insensitive" } },
          { objectKey: { contains: q, mode: "insensitive" } },
          { moduleKey: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
        ];
      }

      const [total, rows] = await prisma.$transaction([
        prisma.fileAsset.count({ where }),
        prisma.fileAsset.findMany({
          where,
          orderBy: { [sortBy]: sortDir },
          skip,
          take,
        }),
      ]);

      return {
        data: rows,
        pagination: {
          page,
          pageSize,
          total,
          totalPages: Math.max(1, Math.ceil(total / pageSize)),
        },
      };
    },

    async getById({ authUserId, id }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      return ensureFileBelongsToCompany({ fileId: id, companyId });
    },

    async rename({ authUserId, id, originalName }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      await ensureFileBelongsToCompany({ fileId: id, companyId });

      return prisma.fileAsset.update({
        where: { id },
        data: { originalName: String(originalName).trim() },
      });
    },

    async bulkDownload({ authUserId, fileIds, mode }) {
      if (!Array.isArray(fileIds) || fileIds.length === 0) {
        throw new FilesServiceError(
          "Solicitud de descarga masiva invalida.",
          400,
        );
      }
      if (fileIds.length > BULK_DOWNLOAD_MAX_FILE_IDS) {
        throw new FilesServiceError(
          "No puedes seleccionar mas de 50 archivos por solicitud.",
          400,
        );
      }
      if (!["direct", "zip"].includes(mode)) {
        throw new FilesServiceError(
          "Solicitud de descarga masiva invalida.",
          400,
        );
      }

      const requestedFileIds = fileIds.map((fileId) =>
        String(fileId ?? "").trim(),
      );
      if (requestedFileIds.some((fileId) => !fileId)) {
        throw new FilesServiceError(
          "Solicitud de descarga masiva invalida.",
          400,
        );
      }

      const { companyId } = await getUserCompanyContext(authUserId);
      const uniqueRequestedFileIds = [...new Set(requestedFileIds)];

      const files = await prisma.fileAsset.findMany({
        where: {
          id: { in: uniqueRequestedFileIds },
          entityId: companyId,
          enabled: true,
          entityType: { in: ALLOWED_FILE_ENTITY_TYPES },
        },
      });

      if (files.length !== uniqueRequestedFileIds.length) {
        throw new FilesServiceError(
          "Uno o mas archivos no existen, no pertenecen a tu empresa o estan deshabilitados.",
          403,
        );
      }

      const totalBytes = files.reduce(
        (sum, file) => sum + Math.max(0, Number(file.sizeBytes ?? 0)),
        0,
      );
      if (totalBytes > BULK_DOWNLOAD_MAX_TOTAL_BYTES) {
        throw new FilesServiceError(
          "La descarga supera el limite de 250 MB por solicitud.",
          400,
        );
      }

      const fileById = new Map(files.map((file) => [file.id, file]));

      if (mode === "direct") {
        const directFiles = await Promise.all(
          requestedFileIds.map(async (fileId) => {
            const file = fileById.get(fileId);
            const { data, error } = await supabaseAdmin.storage
              .from(file.bucket)
              .createSignedUrl(file.objectKey, SIGNED_URL_SECONDS);

            if (error || !data?.signedUrl) {
              throw new FilesServiceError(
                "No se pudo generar el enlace de descarga.",
                500,
              );
            }

            return {
              id: file.id,
              originalName: file.originalName,
              mimeType: file.mimeType,
              sizeBytes: file.sizeBytes,
              signedUrl: data.signedUrl,
              expiresIn: SIGNED_URL_SECONDS,
            };
          }),
        );

        return {
          mode: "direct",
          expiresIn: SIGNED_URL_SECONDS,
          files: directFiles,
        };
      }

      const zip = new JSZip();
      const usedNames = new Map();

      for (const fileId of requestedFileIds) {
        const file = fileById.get(fileId);
        const { data, error } = await supabaseAdmin.storage
          .from(file.bucket)
          .download(file.objectKey);

        if (error || !data) {
          throw new FilesServiceError(
            "No se pudo preparar la descarga masiva.",
            500,
          );
        }

        const entryName = getUniqueZipEntryName(file.originalName, usedNames);
        const fileBuffer = Buffer.from(await data.arrayBuffer());
        zip.file(entryName, fileBuffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const zipFileName = `atlas-archivos-${new Date().toISOString().slice(0, 10)}.zip`;
      const zipObjectKey = `${BULK_ZIP_FOLDER}/${sanitizeSegment(companyId, "company")}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.zip`;

      const { error: uploadZipError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET_NAME)
        .upload(zipObjectKey, zipBuffer, {
          contentType: "application/zip",
          upsert: false,
        });

      if (uploadZipError) {
        throw new FilesServiceError(
          "No se pudo preparar la descarga masiva.",
          500,
        );
      }

      const { data: signedZipData, error: signedZipError } =
        await supabaseAdmin.storage
          .from(STORAGE_BUCKET_NAME)
          .createSignedUrl(zipObjectKey, SIGNED_URL_SECONDS, {
            download: zipFileName,
          });

      if (signedZipError || !signedZipData?.signedUrl) {
        throw new FilesServiceError(
          "No se pudo generar el enlace de descarga.",
          500,
        );
      }

      return {
        mode: "zip",
        signedUrl: signedZipData.signedUrl,
        expiresIn: SIGNED_URL_SECONDS,
        fileName: zipFileName,
      };
    },

    async getSignedUrl({ authUserId, id }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      const file = await ensureFileBelongsToCompany({
        fileId: id,
        companyId,
        includeDisabled: false,
      });

      if (file.visibility === "PUBLIC" || file.bucket === WEBSITE_BUCKET_NAME) {
        const { data } = supabaseAdmin.storage.from(file.bucket).getPublicUrl(file.objectKey)
        return { signedUrl: data.publicUrl, expiresIn: null, permanent: true }
      }

      const { data, error } = await supabaseAdmin.storage
        .from(file.bucket)
        .createSignedUrl(file.objectKey, SIGNED_URL_SECONDS);

      if (error || !data?.signedUrl) {
        throw new FilesServiceError(
          "No se pudo generar el enlace de descarga.",
          500,
        );
      }

      return {
        signedUrl: data.signedUrl,
        expiresIn: SIGNED_URL_SECONDS,
      };
    },

    async setEnabled({ authUserId, id, enabled }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      await ensureFileBelongsToCompany({ fileId: id, companyId });

      return prisma.fileAsset.update({
        where: { id },
        data: { enabled: Boolean(enabled) },
      });
    },

    async delete({ authUserId, id }) {
      const { companyId } = await getUserCompanyContext(authUserId);
      const file = await ensureFileBelongsToCompany({
        fileId: id,
        companyId,
        includeDisabled: true,
      });

      const { error: storageError } = await supabaseAdmin.storage
        .from(file.bucket)
        .remove([file.objectKey]);

      if (storageError) {
        console.error(
          `[files-service] Storage delete failed for ${file.objectKey}:`,
          storageError.message,
        );
      }

      await prisma.fileAsset.delete({ where: { id: file.id } });

      // Audit log for HR employee file deletions
      if (file.moduleKey === "atlas.hr" && file.entityType === "HrEmployee") {
        const sourceEntityId = file.metadata?.sourceEntityId ?? null;
        if (sourceEntityId) {
          const actor = await prisma.userProfile.findUnique({
            where: { authUserId },
            select: { id: true },
          });
          if (actor?.id) {
            await prisma.auditLog.create({
              data: {
                actorId: actor.id,
                moduleKey: "atlas.hr",
                entityType: "HrEmployee",
                entityId: String(sourceEntityId),
                action: "hr.employee.file.delete",
                metadata: {
                  fileId: file.id,
                  originalName: file.originalName,
                  mimeType: file.mimeType,
                },
              },
            });
          }
        }
      }

      return { ok: true };
    },
  };
}

export { FilesServiceError };
