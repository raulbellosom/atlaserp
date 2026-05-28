import { Hono } from "hono";
import { z } from "zod";
import {
  createReportSchema,
  updateReportSchema,
  createDocumentAssociationSchema,
} from "../validators/index.js";
import { FleetServiceError } from "./fleet-service.js";
import { createReportsService } from "./reports-service.js";

const REPORT_TYPES = ["maintenance", "service", "repair", "other"];
const reportEnabledSchema = z.object({ enabled: z.boolean() });

function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0];
  if (!issue) return "Datos invalidos.";
  const path =
    Array.isArray(issue.path) && issue.path.length > 0
      ? issue.path.join(".")
      : null;
  return path
    ? `Datos invalidos en ${path}: ${issue.message}`
    : `Datos invalidos: ${issue.message}`;
}

function getCompanyIdFromContext(c) {
  const companyId = c.get("userContext")?.memberships?.[0]?.companyId;
  return typeof companyId === "string" && companyId.trim() ? companyId.trim() : null;
}

function getActorIdFromContext(c) {
  const actorId = c.get("userContext")?.profile?.id;
  return typeof actorId === "string" && actorId.trim() ? actorId.trim() : null;
}

function handleRouteError(c, err, { fallbackError, route, moduleKey, operation }) {
  if (err instanceof FleetServiceError) return c.json({ error: err.message }, err.status);
  if (process.env.NODE_ENV !== "production") {
    console.error("[atlas.fleet] route error", {
      route,
      moduleKey,
      operation,
      error: { name: err?.name, message: err?.message, stack: err?.stack },
    });
  }
  return c.json({ error: fallbackError }, 500);
}

export function createReportsRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono();
  const service = createReportsService({ prisma });
  const moduleKey = moduleContext?.moduleKey ?? "atlas.fleet";

  app.get("/fleet/reports", requirePermission("fleet.reports.read"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const requestedType = String(c.req.query("type") ?? "")
        .trim()
        .toLowerCase();
      if (REPORT_TYPES.includes(requestedType)) {
        const typedResult = await service.listReports({
          companyId,
          reportType: requestedType,
          page: c.req.query("page"),
          pageSize: c.req.query("pageSize"),
          search: c.req.query("search"),
          status: c.req.query("status"),
        });
        return c.json(typedResult);
      }
      const result = await service.listReportsAnyType({
        companyId,
        page: c.req.query("page"),
        pageSize: c.req.query("pageSize"),
        search: c.req.query("search"),
        status: c.req.query("status"),
      });
      return c.json(result);
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudieron listar los reportes.",
        route: "/fleet/reports",
        moduleKey,
        operation: "listReportsAnyType",
      });
    }
  });

  app.post("/fleet/reports", requirePermission("fleet.reports.create"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const body = await c.req.json();
      const parsed = createReportSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      }
      const created = await service.createReport({
        companyId,
        actorId,
        payload: parsed.data,
        reportType: parsed.data.report_type,
      });
      return c.json({ data: created }, 201);
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo crear el reporte.",
        route: "/fleet/reports",
        moduleKey,
        operation: "createReportAnyType",
      });
    }
  });

  for (const type of REPORT_TYPES) {
    app.get(`/fleet/reports/${type}`, requirePermission("fleet.reports.read"), async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const result = await service.listReports({
          companyId,
          reportType: type,
          page: c.req.query("page"),
          pageSize: c.req.query("pageSize"),
          search: c.req.query("search"),
          status: c.req.query("status"),
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudieron listar los reportes.",
          route: `/fleet/reports/${type}`,
          moduleKey,
          operation: "listReports",
        });
      }
    });

    app.post(`/fleet/reports/${type}`, requirePermission("fleet.reports.create"), async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const body = await c.req.json();
        const parsed = createReportSchema.safeParse({ ...body, report_type: type });
        if (!parsed.success) {
          return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        }
        const created = await service.createReport({
          companyId,
          actorId,
          payload: parsed.data,
          reportType: type,
        });
        return c.json({ data: created }, 201);
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo crear el reporte.",
          route: `/fleet/reports/${type}`,
          moduleKey,
          operation: "createReport",
        });
      }
    });

    app.get(`/fleet/reports/${type}/:id`, requirePermission("fleet.reports.read"), async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const row = await service.getReport({
          companyId,
          id: c.req.param("id"),
          reportType: type,
        });
        return c.json({ data: row });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo obtener el reporte.",
          route: `/fleet/reports/${type}/:id`,
          moduleKey,
          operation: "getReportByType",
        });
      }
    });

    app.patch(
      `/fleet/reports/${type}/:id`,
      requirePermission("fleet.reports.update"),
      async (c) => {
        try {
          const companyId = getCompanyIdFromContext(c);
          const actorId = getActorIdFromContext(c);
          const body = await c.req.json();
          const parsed = updateReportSchema.safeParse(body);
          if (!parsed.success) {
            return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
          }
          const updated = await service.updateReport({
            companyId,
            actorId,
            id: c.req.param("id"),
            payload: parsed.data,
            reportType: type,
          });
          return c.json({ data: updated });
        } catch (err) {
          return handleRouteError(c, err, {
            fallbackError: "No se pudo actualizar el reporte.",
            route: `/fleet/reports/${type}/:id`,
            moduleKey,
            operation: "updateReportByType",
          });
        }
      },
    );
  }

  app.get("/fleet/reports/:id", requirePermission("fleet.reports.read"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const row = await service.getReport({ companyId, id: c.req.param("id") });
      return c.json({ data: row });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo obtener el reporte.",
        route: "/fleet/reports/:id",
        moduleKey,
        operation: "getReport",
      });
    }
  });

  app.patch("/fleet/reports/:id", requirePermission("fleet.reports.update"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const body = await c.req.json();
      const parsed = updateReportSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const updated = await service.updateReport({
        companyId,
        actorId,
        id: c.req.param("id"),
        payload: parsed.data,
      });
      return c.json({ data: updated });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo actualizar el reporte.",
        route: "/fleet/reports/:id",
        moduleKey,
        operation: "updateReport",
      });
    }
  });

  app.patch("/fleet/reports/:id/enabled", requirePermission("fleet.reports.delete"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const body = await c.req.json();
      const parsed = reportEnabledSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const updated = await service.setReportEnabled({
        companyId,
        actorId,
        id: c.req.param("id"),
        enabled: parsed.data.enabled,
      });
      return c.json({ data: updated });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo actualizar el estado del reporte.",
        route: "/fleet/reports/:id/enabled",
        moduleKey,
        operation: "setReportEnabled",
      });
    }
  });

  app.delete("/fleet/reports/:id", requirePermission("fleet.reports.delete"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const updated = await service.setReportEnabled({
        companyId,
        actorId,
        id: c.req.param("id"),
        enabled: false,
      });
      return c.json({ data: updated });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo desactivar el reporte.",
        route: "/fleet/reports/:id",
        moduleKey,
        operation: "deleteReport",
      });
    }
  });

  app.post("/fleet/reports/:id/finalize", requirePermission("fleet.reports.update"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const updated = await service.finalizeReport({
        companyId,
        actorId,
        id: c.req.param("id"),
      });
      return c.json({ data: updated });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo finalizar el reporte.",
        route: "/fleet/reports/:id/finalize",
        moduleKey,
        operation: "finalizeReport",
      });
    }
  });

  app.post("/fleet/reports/:id/reopen", requirePermission("fleet.reports.update"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const updated = await service.reopenReport({
        companyId,
        actorId,
        id: c.req.param("id"),
      });
      return c.json({ data: updated });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo reabrir el reporte.",
        route: "/fleet/reports/:id/reopen",
        moduleKey,
        operation: "reopenReport",
      });
    }
  });

  app.get("/fleet/reports/:id/documents", requirePermission("fleet.reports.read"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const result = await service.listReportDocuments({
        companyId,
        reportId: c.req.param("id"),
      });
      return c.json(result);
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudieron listar los documentos del reporte.",
        route: "/fleet/reports/:id/documents",
        moduleKey,
        operation: "listReportDocuments",
      });
    }
  });

  app.get("/fleet/reports/:id/parts", requirePermission("fleet.reports.read"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const result = await service.listReportParts({
        companyId,
        reportId: c.req.param("id"),
      });
      return c.json(result);
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudieron listar las refacciones del reporte.",
        route: "/fleet/reports/:id/parts",
        moduleKey,
        operation: "listReportParts",
      });
    }
  });

  app.post("/fleet/reports/:id/documents", requirePermission("fleet.reports.update"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const actorId = getActorIdFromContext(c);
      const body = await c.req.json();
      const parsed = createDocumentAssociationSchema.safeParse(body);
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const doc = await service.addReportDocument({
        companyId,
        actorId,
        reportId: c.req.param("id"),
        payload: parsed.data,
      });
      return c.json({ data: doc }, 201);
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo agregar el documento al reporte.",
        route: "/fleet/reports/:id/documents",
        moduleKey,
        operation: "addReportDocument",
      });
    }
  });

  app.delete(
    "/fleet/reports/:id/documents/:docId",
    requirePermission("fleet.reports.update"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const result = await service.removeReportDocument({
          companyId,
          actorId,
          reportId: c.req.param("id"),
          docId: c.req.param("docId"),
        });
        return c.json({ data: result });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo eliminar el documento del reporte.",
          route: "/fleet/reports/:id/documents/:docId",
          moduleKey,
          operation: "removeReportDocument",
        });
      }
    },
  );

  app.get("/fleet/reports/:id/pdf", requirePermission("fleet.reports.read"), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c);
      const { report, pdf } = await service.generateReportPdf({
        companyId,
        id: c.req.param("id"),
      });
      c.header("Content-Type", "application/pdf");
      c.header("Content-Disposition", `inline; filename=\"${report.folio}.pdf\"`);
      return new Response(pdf, { status: 200, headers: c.res.headers });
    } catch (err) {
      return handleRouteError(c, err, {
        fallbackError: "No se pudo generar el PDF del reporte.",
        route: "/fleet/reports/:id/pdf",
        moduleKey,
        operation: "generateReportPdf",
      });
    }
  });

  app.post(
    "/fleet/reports/dev/purge-legacy",
    requirePermission("fleet.reports.delete"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const result = await service.purgeLegacyMaintenanceData({ companyId, actorId });
        return c.json({ data: result });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo limpiar el legacy de mantenimiento.",
          route: "/fleet/reports/dev/purge-legacy",
          moduleKey,
          operation: "purgeLegacyMaintenanceData",
        });
      }
    },
  );

  return app;
}
