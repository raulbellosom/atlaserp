// apps/api/src/routes/pfm/recurring-routes.js
import { Hono } from "hono";
import {
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  enabledSchema,
} from "./validators.js";
import {
  PfmServiceError,
  getCompanyId,
  getActorId,
  getValidationErrorMessage,
} from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

export function createRecurringRouter({ requirePermission, requireAnyPermission, recurring, summary }) {
  const app = new Hono();

  app.get(
    "/pfm/recurring",
    requireAnyPermission(["pfm.recurring.read", "pfm.recurring.manage"]),
    async (c) => {
      try {
        return c.json(
          await recurring.listRules({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los cargos recurrentes.");
      }
    },
  );

  app.post("/pfm/recurring", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = createRecurringRuleSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const rule = await recurring.createRule({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        data: parsed.data,
      });
      return c.json({ data: rule }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el cargo recurrente.");
    }
  });

  app.patch("/pfm/recurring/:id", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = updateRecurringRuleSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await recurring.updateRule({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          ruleId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el cargo recurrente.");
    }
  });

  app.patch("/pfm/recurring/:id/enabled", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await recurring.setRuleEnabled({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          ruleId: c.req.param("id"),
          enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado del cargo recurrente.");
    }
  });

  app.get(
    "/pfm/upcoming",
    requireAnyPermission(["pfm.movements.read", "pfm.wallets.read"]),
    async (c) => {
      try {
        const days = Number(c.req.query("days")) || 14;
        return c.json(
          await summary.getUpcoming({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            days: Math.min(60, Math.max(1, days)),
          }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron obtener los proximos cargos.");
      }
    },
  );

  return app;
}
