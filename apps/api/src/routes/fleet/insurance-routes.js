import { Hono } from "hono";
import { z } from "zod";
import {
  createInsurancePolicySchema,
  updateInsurancePolicySchema,
} from "./validators.js";
import { createInsuranceService } from "./insurance-service.js";
import { FleetServiceError } from "./fleet-service.js";
import { buildInsuranceExcelBuffer } from "./fleet-export-service.js";

const insuranceEnabledSchema = z.object({ enabled: z.boolean() });

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  return typeof companyId === "string" && companyId.trim()
    ? companyId.trim()
    : null;
}

function getActorIdFromContext(c) {
  const actorId = c.get("userContext")?.profile?.id;
  return typeof actorId === "string" && actorId.trim() ? actorId.trim() : null;
}

function handleRouteError(
  c,
  err,
  { fallbackError, route, moduleKey, operation },
) {
  if (err instanceof FleetServiceError)
    return c.json({ error: err.message }, err.status);
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

export function createInsuranceRouter({
  prisma,
  requirePermission,
  moduleContext,
}) {
  const app = new Hono();
  const service = createInsuranceService({ prisma });
  const moduleKey = moduleContext?.moduleKey ?? "atlas.fleet";

  // GET /fleet/insurance/export
  app.get(
    "/fleet/insurance/export",
    requirePermission("fleet.insurance.read"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const result = await service.listPolicies({
          companyId,
          page: 1,
          pageSize: 5000,
        });
        const buffer = await buildInsuranceExcelBuffer({ rows: result.data });
        c.header(
          "Content-Type",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        c.header("Content-Disposition", 'attachment; filename="seguros.xlsx"');
        return new Response(buffer, { status: 200, headers: c.res.headers });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo exportar las polizas.",
          route: "/fleet/insurance/export",
          moduleKey,
          operation: "exportInsurance",
        });
      }
    },
  );

  // GET /fleet/insurance — list policies
  app.get(
    "/fleet/insurance",
    requirePermission("fleet.insurance.read"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const activeRaw = c.req.query("active");
        const active =
          activeRaw === "true"
            ? true
            : activeRaw === "false"
              ? false
              : undefined;
        const result = await service.listPolicies({
          companyId,
          vehicleId: c.req.query("vehicle_id"),
          active,
          page: c.req.query("page"),
          pageSize: c.req.query("pageSize"),
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudieron listar las polizas de seguro.",
          route: "/fleet/insurance",
          moduleKey,
          operation: "listPolicies",
        });
      }
    },
  );

  // POST /fleet/insurance — create policy
  app.post(
    "/fleet/insurance",
    requirePermission("fleet.insurance.create"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const body = await c.req.json();
        const parsed = createInsurancePolicySchema.safeParse(body);
        if (!parsed.success)
          return c.json(
            { error: getValidationErrorMessage(parsed.error) },
            400,
          );
        const result = await service.createPolicy({
          companyId,
          actorId,
          data: parsed.data,
        });
        return c.json({ data: result }, 201);
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo crear la poliza de seguro.",
          route: "/fleet/insurance",
          moduleKey,
          operation: "createPolicy",
        });
      }
    },
  );

  // GET /fleet/insurance/:id — get single policy
  app.get(
    "/fleet/insurance/:id",
    requirePermission("fleet.insurance.read"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const result = await service.getPolicy({
          companyId,
          id: c.req.param("id"),
        });
        return c.json({ data: result });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo obtener la poliza de seguro.",
          route: "/fleet/insurance/:id",
          moduleKey,
          operation: "getPolicy",
        });
      }
    },
  );

  // PATCH /fleet/insurance/:id — update policy
  app.patch(
    "/fleet/insurance/:id",
    requirePermission("fleet.insurance.update"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const body = await c.req.json();
        const parsed = updateInsurancePolicySchema.safeParse(body);
        if (!parsed.success)
          return c.json(
            { error: getValidationErrorMessage(parsed.error) },
            400,
          );
        const result = await service.updatePolicy({
          companyId,
          actorId,
          id: c.req.param("id"),
          data: parsed.data,
        });
        return c.json({ data: result });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo actualizar la poliza de seguro.",
          route: "/fleet/insurance/:id",
          moduleKey,
          operation: "updatePolicy",
        });
      }
    },
  );

  // PATCH /fleet/insurance/:id/enabled — soft-delete (one-way, disable only)
  app.patch(
    "/fleet/insurance/:id/enabled",
    requirePermission("fleet.insurance.delete"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const actorId = getActorIdFromContext(c);
        const body = await c.req.json();
        const parsed = insuranceEnabledSchema.safeParse(body);
        if (!parsed.success)
          return c.json(
            { error: getValidationErrorMessage(parsed.error) },
            400,
          );
        if (parsed.data.enabled === true) {
          return c.json(
            { error: "No se puede reactivar una poliza desactivada." },
            400,
          );
        }
        const result = await service.disablePolicy({
          companyId,
          actorId,
          id: c.req.param("id"),
        });
        return c.json({ data: result });
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudo actualizar el estado de la poliza.",
          route: "/fleet/insurance/:id/enabled",
          moduleKey,
          operation: "disablePolicy",
        });
      }
    },
  );

  // GET /fleet/vehicles/:vehicleId/insurance — list policies for a vehicle
  app.get(
    "/fleet/vehicles/:vehicleId/insurance",
    requirePermission("fleet.vehicles.read"),
    async (c) => {
      try {
        const companyId = getCompanyIdFromContext(c);
        const vehicleId = c.req.param("vehicleId");
        // Return empty data for non-UUID vehicle IDs (graceful empty for sub-resource list)
        if (!UUID_REGEX.test(String(vehicleId ?? "").trim())) {
          return c.json({ data: [] });
        }
        const result = await service.listVehiclePolicies({
          companyId,
          vehicleId,
        });
        return c.json(result);
      } catch (err) {
        return handleRouteError(c, err, {
          fallbackError: "No se pudieron listar las polizas del vehiculo.",
          route: "/fleet/vehicles/:vehicleId/insurance",
          moduleKey,
          operation: "listVehiclePolicies",
        });
      }
    },
  );

  return app;
}

export default createInsuranceRouter;
