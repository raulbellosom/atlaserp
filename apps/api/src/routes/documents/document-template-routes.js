import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { DocumentProviderError } from "./document-provider-registry.js";
import { DocumentTemplateServiceError } from "./document-template-service.js";
import {
  documentTemplateCreateSchema,
  documentTemplateEnabledSchema,
  documentTemplateQuerySchema,
  documentTemplateUpdateSchema,
  documentVersionCreateSchema,
  documentVersionPublishSchema,
  documentVersionUpdateSchema,
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
    error instanceof DocumentTemplateServiceError ||
    error instanceof DocumentProviderError
  ) {
    return c.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      error.status,
    );
  }
  console.error("[atlas.documents]", error);
  return c.json({ error: "Error interno de Documentos." }, 500);
}

export function createDocumentTemplateRoutes({
  service,
  providerRegistry,
  requirePermission,
}) {
  const app = new Hono();

  app.get(
    "/documents/templates",
    requirePermission("documents.templates.read"),
    zValidator("query", documentTemplateQuerySchema),
    async (c) => {
      try {
        return c.json(
          await service.listTemplates({
            companyId: companyId(c),
            query: c.req.valid("query"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/documents/templates",
    requirePermission("documents.templates.create"),
    zValidator("json", documentTemplateCreateSchema),
    async (c) => {
      try {
        return c.json(
          await service.createTemplate({
            companyId: companyId(c),
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
    "/documents/templates/:id",
    requirePermission("documents.templates.read"),
    async (c) => {
      try {
        return c.json(
          await service.getTemplate({
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
    "/documents/templates/:id",
    requirePermission("documents.templates.update"),
    zValidator("json", documentTemplateUpdateSchema),
    async (c) => {
      try {
        return c.json(
          await service.updateTemplate({
            companyId: companyId(c),
            id: c.req.param("id"),
            actorId: actorId(c),
            ...accessContext(c),
            input: c.req.valid("json"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.patch(
    "/documents/templates/:id/enabled",
    requirePermission("documents.templates.delete"),
    zValidator("json", documentTemplateEnabledSchema),
    async (c) => {
      try {
        return c.json(
          await service.setTemplateEnabled({
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

  app.get(
    "/documents/templates/:id/versions",
    requirePermission("documents.templates.read"),
    async (c) => {
      try {
        return c.json(
          await service.listVersions({
            companyId: companyId(c),
            templateId: c.req.param("id"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/documents/templates/:id/versions",
    requirePermission("documents.templates.update"),
    zValidator("json", documentVersionCreateSchema),
    async (c) => {
      try {
        return c.json(
          await service.createVersion({
            companyId: companyId(c),
            templateId: c.req.param("id"),
            actorId: actorId(c),
            input: c.req.valid("json"),
          }),
          201,
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.patch(
    "/documents/templates/:id/versions/:versionId",
    requirePermission("documents.templates.update"),
    zValidator("json", documentVersionUpdateSchema),
    async (c) => {
      try {
        return c.json(
          await service.updateVersion({
            companyId: companyId(c),
            templateId: c.req.param("id"),
            versionId: c.req.param("versionId"),
            actorId: actorId(c),
            input: c.req.valid("json"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/documents/templates/:id/versions/:versionId/publish",
    requirePermission("documents.templates.publish"),
    zValidator("json", documentVersionPublishSchema),
    async (c) => {
      try {
        return c.json(
          await service.publishVersion({
            companyId: companyId(c),
            templateId: c.req.param("id"),
            versionId: c.req.param("versionId"),
            actorId: actorId(c),
            ...accessContext(c),
            input: c.req.valid("json"),
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/documents/providers/:sourceType/schema",
    requirePermission("documents.templates.read"),
    async (c) => {
      try {
        const access = accessContext(c);
        return c.json(
          providerRegistry.getSchema({
            sourceType: c.req.param("sourceType"),
            permissionKeys: access.permissions,
            isAdmin: access.isAdmin,
          }),
        );
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  return app;
}
