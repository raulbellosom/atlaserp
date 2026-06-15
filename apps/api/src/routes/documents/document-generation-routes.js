import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { DocumentProviderError } from "./document-provider-registry.js";
import {
  DocumentGenerationServiceError,
} from "./document-generation-service.js";
import { DocumentRendererError } from "./document-renderer.js";
import {
  documentGeneratedEnabledSchema,
  documentGeneratedQuerySchema,
  documentRenderSchema,
} from "./document-validators.js";

function companyId(c) {
  return (
    c.get("companyId") ??
    c.get("userContext")?.memberships?.[0]?.companyId ??
    null
  );
}

function actorId(c) {
  return c.get("userContext")?.profile?.id ?? c.get("userId") ?? null;
}

function accessContext(c) {
  const context = c.get("userContext");
  return {
    permissions:
      context?.permissionSet instanceof Set
        ? [...context.permissionSet]
        : Array.isArray(context?.permissions)
          ? context.permissions
          : [],
    isAdmin: Boolean(context?.isAdmin),
  };
}

function handleError(c, error) {
  if (
    error instanceof DocumentGenerationServiceError ||
    error instanceof DocumentProviderError ||
    error instanceof DocumentRendererError
  ) {
    return c.json(
      { error: error.message, code: error.code },
      error.status,
    );
  }
  console.error("[atlas.documents.generation]", error);
  return c.json({ error: "Error interno al generar el documento." }, 500);
}

export function createDocumentGenerationRoutes({ service, requirePermission }) {
  const app = new Hono();

  app.post(
    "/documents/templates/:id/preview",
    requirePermission("documents.generated.create"),
    zValidator("json", documentRenderSchema),
    async (c) => {
      try {
        const rendered = await service.preview({
          companyId: companyId(c),
          templateId: c.req.param("id"),
          actorId: actorId(c),
          ...accessContext(c),
          input: c.req.valid("json"),
        });
        return c.body(rendered.buffer, 200, {
          "Content-Type": "application/pdf",
          "Content-Disposition": 'inline; filename="preview.pdf"',
          "Cache-Control": "no-store",
        });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/documents/templates/:id/generate",
    requirePermission("documents.generated.create"),
    zValidator("json", documentRenderSchema),
    async (c) => {
      try {
        return c.json(
          await service.generate({
            companyId: companyId(c),
            templateId: c.req.param("id"),
            actorId: actorId(c),
            ...accessContext(c),
            input: c.req.valid("json"),
          }),
          201,
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/documents/generated",
    requirePermission("documents.generated.read"),
    zValidator("query", documentGeneratedQuerySchema),
    async (c) => {
      try {
        return c.json(
          await service.listGenerated({
            companyId: companyId(c),
            query: c.req.valid("query"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/documents/generated/:id",
    requirePermission("documents.generated.read"),
    async (c) => {
      try {
        return c.json(
          await service.getGenerated({
            companyId: companyId(c),
            id: c.req.param("id"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/documents/generated/:id/download",
    requirePermission("documents.generated.read"),
    async (c) => {
      try {
        return c.json(
          await service.getGeneratedDownload({
            companyId: companyId(c),
            id: c.req.param("id"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.patch(
    "/documents/generated/:id/enabled",
    requirePermission("documents.generated.delete"),
    zValidator("json", documentGeneratedEnabledSchema),
    async (c) => {
      try {
        return c.json(
          await service.setGeneratedEnabled({
            companyId: companyId(c),
            id: c.req.param("id"),
            actorId: actorId(c),
            input: c.req.valid("json"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  return app;
}
