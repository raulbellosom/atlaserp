// apps/api/src/routes/pfm/receipts-routes.js
import { Hono } from "hono";
import { FilesServiceError } from "../../services/files-service.js";
import { confirmReceiptSchema } from "./validators.js";
import {
  PfmServiceError,
  getCompanyId,
  getActorId,
  getValidationErrorMessage,
} from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  // filesService.upload throws FilesServiceError (missing profile, bad mime, size limit...).
  // Preserve its status/message instead of collapsing every case into an opaque 500.
  if (err instanceof FilesServiceError || (err?.name === "FilesServiceError" && err?.status)) {
    return c.json({ error: err.message || fallback }, err.status ?? 500);
  }
  console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

// `filesService` is the shared createFilesService({ prisma, supabaseAdmin }) instance.
export function createReceiptsRouter({
  requirePermission,
  requireAnyPermission,
  receipts,
  filesService,
  visionConfigured,
}) {
  const app = new Hono();

  app.get(
    "/pfm/receipts",
    requireAnyPermission(["pfm.receipts.read", "pfm.receipts.manage"]),
    async (c) => {
      try {
        return c.json(
          await receipts.listReceipts({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los tickets.");
      }
    },
  );

  app.get(
    "/pfm/receipts/:id",
    requireAnyPermission(["pfm.receipts.read", "pfm.receipts.manage"]),
    async (c) => {
      try {
        return c.json({
          data: await receipts.getReceipt({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            receiptId: c.req.param("id"),
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo obtener el ticket.");
      }
    },
  );

  app.post("/pfm/receipts", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      if (!visionConfigured()) {
        return c.json(
          {
            error:
              "El lector de tickets con IA no esta configurado. Registra el gasto manualmente.",
          },
          503,
        );
      }
      const form = await c.req.formData();
      const file = form.get("file");
      if (!file || typeof file === "string") {
        return c.json({ error: "Adjunta la foto del ticket." }, 400);
      }
      const authUserId = c.get("authUserId");
      const asset = await filesService.upload({
        authUserId,
        file,
        fields: { moduleKey: "atlas.pfm", entityType: "PfmReceipt", visibility: "PRIVATE" },
      });
      const receipt = await receipts.createReceipt({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        fileId: asset.id ?? asset.data?.id,
      });
      return c.json({ data: { receiptId: receipt.id, status: receipt.status } }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo subir el ticket.");
    }
  });

  app.patch("/pfm/receipts/:id/confirm", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      const parsed = confirmReceiptSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await receipts.confirmReceipt({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          receiptId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo registrar el ticket.");
    }
  });

  app.patch("/pfm/receipts/:id/retry", requirePermission("pfm.receipts.manage"), async (c) => {
    try {
      return c.json({
        data: await receipts.retryReceipt({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          receiptId: c.req.param("id"),
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo reintentar el ticket.");
    }
  });

  return app;
}
