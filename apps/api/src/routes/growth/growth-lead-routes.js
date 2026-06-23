import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { GrowthLeadServiceError } from "./growth-lead-service.js";
import {
  growthLeadConvertSchema,
  growthLeadCreateSchema,
  growthLeadEnabledSchema,
  growthLeadNoteSchema,
  growthLeadQuerySchema,
  growthLeadUpdateSchema,
} from "./growth-validators.js";

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

function permissions(c) {
  const context = c.get("userContext");
  if (context?.permissionSet instanceof Set) {
    return [...context.permissionSet];
  }
  return Array.isArray(context?.permissions) ? context.permissions : [];
}

function hasPermission(c, permissionKey) {
  const context = c.get("userContext");
  return Boolean(
    context?.isAdmin ||
      context?.permissionSet?.has?.(permissionKey) ||
      context?.permissions?.includes?.(permissionKey),
  );
}

function handleError(c, error) {
  if (error instanceof GrowthLeadServiceError) {
    return c.json(
      {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
      error.status,
    );
  }
  console.error("[atlas.growth]", error);
  return c.json({ error: "Error interno de Growth." }, 500);
}

export function createGrowthLeadRoutes({ service, requirePermission, enrichFileAssets = null }) {
  const app = new Hono();

  app.get(
    "/growth/leads/summary",
    requirePermission("growth.leads.read"),
    zValidator("query", growthLeadQuerySchema),
    async (c) => {
      try {
        const data = await service.getLeadSummary({
          companyId: companyId(c),
          query: c.req.valid("query"),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/growth/leads",
    requirePermission("growth.leads.read"),
    zValidator("query", growthLeadQuerySchema),
    async (c) => {
      try {
        const result = await service.listLeads({
          companyId: companyId(c),
          query: c.req.valid("query"),
        });
        return c.json({ data: result.rows, total: result.total, page: result.page, pageSize: result.pageSize });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/growth/leads",
    requirePermission("growth.leads.create"),
    zValidator("json", growthLeadCreateSchema),
    async (c) => {
      try {
        const data = await service.createLead({
          companyId: companyId(c),
          actorId: actorId(c),
          data: c.req.valid("json"),
        });
        return c.json({ data }, 201);
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/growth/leads/assignees",
    requirePermission("growth.leads.assign"),
    async (c) => {
      try {
        const data = await service.listAssignees({
          companyId: companyId(c),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/growth/leads/:id",
    requirePermission("growth.leads.read"),
    async (c) => {
      try {
        const data = await service.getLead({
          companyId: companyId(c),
          id: c.req.param("id"),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.get(
    "/growth/leads/:id/files",
    requirePermission("growth.leads.read"),
    async (c) => {
      try {
        let data = await service.listLeadFiles({
          companyId: companyId(c),
          id: c.req.param("id"),
        });
        if (enrichFileAssets && Array.isArray(data)) {
          data = await enrichFileAssets(data);
        }
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/growth/leads/:id/files",
    requirePermission("growth.leads.update"),
    async (c) => {
      try {
        const body = await c.req.json();
        const fileAssetId = String(
          body?.file_asset_id ?? body?.fileAssetId ?? "",
        ).trim();
        if (!fileAssetId) {
          return c.json({ error: "file_asset_id es obligatorio." }, 400);
        }
        const data = await service.associateLeadFile({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          fileAssetId,
        });
        return c.json({ data }, 201);
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.delete(
    "/growth/leads/:id/files/:fileAssetId",
    requirePermission("growth.leads.update"),
    async (c) => {
      try {
        const data = await service.removeLeadFile({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          fileAssetId: c.req.param("fileAssetId"),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.patch(
    "/growth/leads/:id",
    requirePermission("growth.leads.update"),
    zValidator("json", growthLeadUpdateSchema),
    async (c) => {
      const data = c.req.valid("json");
      if (
        data.assigneeUserId !== undefined &&
        !hasPermission(c, "growth.leads.assign")
      ) {
        return c.json(
          { error: "No tienes permiso para asignar leads." },
          403,
        );
      }
      try {
        const updated = await service.updateLead({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          data,
        });
        return c.json({ data: updated });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/growth/leads/:id/notes",
    requirePermission("growth.leads.update"),
    zValidator("json", growthLeadNoteSchema),
    async (c) => {
      try {
        const data = await service.addLeadNote({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          data: c.req.valid("json"),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.post(
    "/growth/leads/:id/convert",
    requirePermission("growth.leads.convert"),
    zValidator("json", growthLeadConvertSchema),
    async (c) => {
      try {
        const data = await service.convertLead({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          data: c.req.valid("json"),
          permissions: permissions(c),
          isAdmin: Boolean(c.get("userContext")?.isAdmin),
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  app.patch(
    "/growth/leads/:id/enabled",
    requirePermission("growth.leads.delete"),
    zValidator("json", growthLeadEnabledSchema),
    async (c) => {
      try {
        const body = c.req.valid("json");
        const data = await service.setLeadEnabled({
          companyId: companyId(c),
          actorId: actorId(c),
          id: c.req.param("id"),
          enabled: body.enabled,
          updatedAt: body.updatedAt,
        });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  return app;
}
