import { createHash } from "node:crypto";

import { resolveCompanyBranding } from "../../services/pdf-branding-service.js";
import { renderDocumentPdf } from "./document-renderer.js";
import {
  documentGeneratedEnabledSchema,
  documentGeneratedQuerySchema,
  documentRenderSchema,
} from "./document-validators.js";

const STORAGE_BUCKET = "atlas-files";
const SIGNED_URL_SECONDS = 3600;

export class DocumentGenerationServiceError extends Error {
  constructor(message, status = 400, code = "document_generation_error") {
    super(message);
    this.name = "DocumentGenerationServiceError";
    this.status = status;
    this.code = code;
  }
}

function safeFileName(value) {
  return (
    String(value ?? "documento")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-_]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "documento"
  );
}

function auditJson(value) {
  if (value === undefined || value === null) return null;
  return JSON.parse(JSON.stringify(value));
}

export function createDocumentGenerationService({
  prisma,
  supabaseAdmin,
  providerRegistry,
  renderPdf = renderDocumentPdf,
  resolveBranding = resolveCompanyBranding,
  now = () => new Date(),
}) {
  async function loadTemplateAndVersion({
    companyId,
    templateId,
    versionId,
    requirePublished,
  }) {
    const template = await prisma.documentTemplate.findFirst({
      where: { id: templateId, companyId, enabled: true },
    });
    if (!template) {
      throw new DocumentGenerationServiceError(
        "Plantilla no encontrada.",
        404,
        "template_not_found",
      );
    }
    const selectedVersionId = versionId ?? template.publishedVersionId;
    if (!selectedVersionId) {
      throw new DocumentGenerationServiceError(
        "La plantilla no tiene una version disponible.",
        409,
        "template_version_unavailable",
      );
    }
    if (
      requirePublished &&
      selectedVersionId !== template.publishedVersionId
    ) {
      throw new DocumentGenerationServiceError(
        "Solo se puede generar con la version publicada activa.",
        409,
        "inactive_template_version",
      );
    }
    const version = await prisma.documentTemplateVersion.findFirst({
      where: {
        id: selectedVersionId,
        templateId,
        ...(requirePublished ? { status: "published" } : {}),
      },
    });
    if (!version) {
      throw new DocumentGenerationServiceError(
        "Version de plantilla no encontrada.",
        404,
        "template_version_not_found",
      );
    }
    return { template, version };
  }

  async function render({
    companyId,
    template,
    version,
    sourceId,
    actorId,
    permissions,
    isAdmin,
  }) {
    const [data, branding] = await Promise.all([
      providerRegistry.load({
        sourceType: template.sourceType,
        companyId,
        sourceId,
        actorId,
        permissionKeys: permissions,
        isAdmin,
      }),
      resolveBranding({ prisma, companyId }),
    ]);
    const rendered = await renderPdf({
      title: template.name,
      subtitle: `Version ${version.versionNumber}`,
      folio: sourceId,
      branding,
      generatedAt: now(),
      blocks: version.blocks,
      data,
    });
    return { rendered, data };
  }

  async function preview({
    companyId,
    templateId,
    actorId,
    permissions,
    isAdmin,
    input,
  }) {
    const parsed = documentRenderSchema.parse(input);
    const { template, version } = await loadTemplateAndVersion({
      companyId,
      templateId,
      versionId: parsed.versionId,
      requirePublished: false,
    });
    const { rendered } = await render({
      companyId,
      template,
      version,
      sourceId: parsed.sourceId,
      actorId,
      permissions,
      isAdmin,
    });
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        moduleKey: "atlas.documents",
        entityType: "DocumentTemplateVersion",
        entityId: version.id,
        action: "documents.template.preview",
        before: null,
        after: null,
        metadata: {
          companyId,
          templateId,
          versionId: version.id,
          sourceType: template.sourceType,
          sourceId: parsed.sourceId,
        },
      },
    });
    return rendered;
  }

  async function markFailed(id, error) {
    await prisma.generatedDocument
      .update({
        where: { id },
        data: {
          status: "failed",
          enabled: false,
          metadata: {
            error: String(error?.message ?? error).slice(0, 500),
          },
        },
      })
      .catch(() => {});
  }

  async function generate({
    companyId,
    templateId,
    actorId,
    permissions,
    isAdmin,
    input,
  }) {
    const parsed = documentRenderSchema.parse(input);
    const { template, version } = await loadTemplateAndVersion({
      companyId,
      templateId,
      versionId: parsed.versionId,
      requirePublished: true,
    });

    const [data, branding] = await Promise.all([
      providerRegistry.load({
        sourceType: template.sourceType,
        companyId,
        sourceId: parsed.sourceId,
        actorId,
        permissionKeys: permissions,
        isAdmin,
      }),
      resolveBranding({ prisma, companyId }),
    ]);

    const pending = await prisma.generatedDocument.create({
      data: {
        companyId,
        templateId,
        versionId: version.id,
        sourceType: template.sourceType,
        sourceId: parsed.sourceId,
        status: "pending",
        generatedById: actorId ?? null,
        metadata: {
          templateKey: template.key,
          versionNumber: version.versionNumber,
        },
      },
    });

    let rendered;
    try {
      rendered = await renderPdf({
        title: template.name,
        subtitle: `Version ${version.versionNumber}`,
        folio: parsed.sourceId,
        branding,
        generatedAt: now(),
        blocks: version.blocks,
        data,
      });
    } catch (error) {
      await markFailed(pending.id, error);
      throw error;
    }

    const generatedAt = now();
    const originalName = `${safeFileName(template.key)}-${generatedAt
      .toISOString()
      .replace(/[:.]/g, "-")}.pdf`;
    const objectKey =
      `modules/atlas.documents/GeneratedDocument/${pending.id}/` +
      `${generatedAt.getTime()}-${originalName}`;
    const bucket = supabaseAdmin.storage.from(STORAGE_BUCKET);
    const { error: uploadError } = await bucket.upload(
      objectKey,
      rendered.buffer,
      {
        contentType: "application/pdf",
        upsert: false,
      },
    );
    if (uploadError) {
      await markFailed(pending.id, uploadError);
      throw new DocumentGenerationServiceError(
        "No se pudo almacenar el PDF generado.",
        500,
        "document_upload_failed",
      );
    }

    const checksum = createHash("sha256")
      .update(rendered.buffer)
      .digest("hex");
    try {
      return await prisma.$transaction(async (tx) => {
        const file = await tx.fileAsset.create({
          data: {
            bucket: STORAGE_BUCKET,
            objectKey,
            originalName,
            mimeType: "application/pdf",
            sizeBytes: rendered.buffer.length,
            checksum,
            visibility: "PRIVATE",
            moduleKey: "atlas.documents",
            entityType: "GeneratedDocument",
            entityId: companyId,
            uploadedById: actorId ?? null,
            metadata: {
              companyId,
              sourceEntityId: parsed.sourceId,
              sourceType: template.sourceType,
              generatedDocumentId: pending.id,
              templateId,
              versionId: version.id,
            },
          },
        });
        const ready = await tx.generatedDocument.update({
          where: { id: pending.id },
          data: {
            fileAssetId: file.id,
            status: "ready",
            generatedAt,
            metadata: {
              pageCount: rendered.pageCount,
              warnings: rendered.warnings,
              checksum,
            },
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: actorId ?? null,
            moduleKey: "atlas.documents",
            entityType: "GeneratedDocument",
            entityId: pending.id,
            action: "documents.generated.create",
            before: null,
            after: auditJson(ready),
            metadata: {
              companyId,
              templateId,
              versionId: version.id,
              sourceType: template.sourceType,
              sourceId: parsed.sourceId,
              fileAssetId: file.id,
            },
          },
        });
        return ready;
      });
    } catch (error) {
      await bucket.remove([objectKey]).catch(() => {});
      await markFailed(pending.id, error);
      throw error;
    }
  }

  async function listGenerated({ companyId, query = {} }) {
    const parsed = documentGeneratedQuerySchema.parse(query);
    const where = {
      companyId,
      enabled: parsed.enabled,
      ...(parsed.templateId ? { templateId: parsed.templateId } : {}),
      ...(parsed.sourceType ? { sourceType: parsed.sourceType } : {}),
      ...(parsed.sourceId ? { sourceId: parsed.sourceId } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.generatedDocument.count({ where }),
      prisma.generatedDocument.findMany({
        where,
        include: {
          template: true,
          version: true,
          fileAsset: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (parsed.page - 1) * parsed.pageSize,
        take: parsed.pageSize,
      }),
    ]);
    return {
      items,
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
    };
  }

  async function getGenerated({ companyId, id }) {
    const generated = await prisma.generatedDocument.findFirst({
      where: { id, companyId },
      include: {
        template: true,
        version: true,
        fileAsset: true,
      },
    });
    if (!generated) {
      throw new DocumentGenerationServiceError(
        "Documento generado no encontrado.",
        404,
        "generated_document_not_found",
      );
    }
    return generated;
  }

  async function getGeneratedDownload({ companyId, id }) {
    const generated = await getGenerated({ companyId, id });
    if (!generated.enabled || generated.status !== "ready" || !generated.fileAsset) {
      throw new DocumentGenerationServiceError(
        "El archivo generado no esta disponible.",
        409,
        "generated_file_unavailable",
      );
    }
    const { data, error } = await supabaseAdmin.storage
      .from(generated.fileAsset.bucket)
      .createSignedUrl(generated.fileAsset.objectKey, SIGNED_URL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new DocumentGenerationServiceError(
        "No se pudo preparar la descarga.",
        500,
        "generated_download_failed",
      );
    }
    return { url: data.signedUrl, expiresIn: SIGNED_URL_SECONDS };
  }

  async function setGeneratedEnabled({ companyId, id, actorId, input }) {
    const parsed = documentGeneratedEnabledSchema.parse(input);
    return prisma.$transaction(async (tx) => {
      const current = await tx.generatedDocument.findFirst({
        where: { id, companyId },
      });
      if (!current) {
        throw new DocumentGenerationServiceError(
          "Documento generado no encontrado.",
          404,
          "generated_document_not_found",
        );
      }
      const updated = await tx.generatedDocument.update({
        where: { id },
        data: { enabled: parsed.enabled },
      });
      await tx.auditLog.create({
        data: {
          actorId: actorId ?? null,
          moduleKey: "atlas.documents",
          entityType: "GeneratedDocument",
          entityId: id,
          action: parsed.enabled
            ? "documents.generated.enable"
            : "documents.generated.disable",
          before: auditJson(current),
          after: auditJson(updated),
          metadata: { companyId },
        },
      });
      return updated;
    });
  }

  return {
    preview,
    generate,
    listGenerated,
    getGenerated,
    getGeneratedDownload,
    setGeneratedEnabled,
  };
}
