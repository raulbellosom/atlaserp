// apps/api/src/routes/pfm/budgets-routes.js
import { Hono } from "hono";
import {
  createBudgetSchema,
  updateBudgetSchema,
  createGoalSchema,
  updateGoalSchema,
  contributeGoalSchema,
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
  if (process.env.NODE_ENV !== "production") console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

export function createBudgetsRouter({
  requirePermission,
  requireAnyPermission,
  budgets,
  goals,
  wallets,
}) {
  const app = new Hono();

  // ── Budgets ────────────────────────────────────────────────────────────────

  app.get(
    "/pfm/budgets",
    requireAnyPermission(["pfm.budgets.manage", "pfm.wallets.read"]),
    async (c) => {
      try {
        const month = c.req.query("month");
        return c.json(
          await budgets.listBudgets({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            month: /^\d{4}-\d{2}$/.test(month ?? "") ? month : undefined,
          }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los presupuestos.");
      }
    },
  );

  app.post("/pfm/budgets", requirePermission("pfm.budgets.manage"), async (c) => {
    try {
      const parsed = createBudgetSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json(
        {
          data: await budgets.createBudget({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            data: parsed.data,
          }),
        },
        201,
      );
    } catch (err) {
      return handleError(c, err, "No se pudo crear el presupuesto.");
    }
  });

  app.patch("/pfm/budgets/:id", requirePermission("pfm.budgets.manage"), async (c) => {
    try {
      const parsed = updateBudgetSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await budgets.updateBudget({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          budgetId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el presupuesto.");
    }
  });

  app.patch("/pfm/budgets/:id/enabled", requirePermission("pfm.budgets.manage"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await budgets.setBudgetEnabled({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          budgetId: c.req.param("id"),
          enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado del presupuesto.");
    }
  });

  // ── Goals ──────────────────────────────────────────────────────────────────

  app.get(
    "/pfm/goals",
    requireAnyPermission(["pfm.goals.manage", "pfm.wallets.read"]),
    async (c) => {
      try {
        return c.json(
          await goals.listGoals({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar las metas.");
      }
    },
  );

  app.post("/pfm/goals", requirePermission("pfm.goals.manage"), async (c) => {
    try {
      const parsed = createGoalSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json(
        {
          data: await goals.createGoal({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            data: parsed.data,
          }),
        },
        201,
      );
    } catch (err) {
      return handleError(c, err, "No se pudo crear la meta.");
    }
  });

  app.patch("/pfm/goals/:id", requirePermission("pfm.goals.manage"), async (c) => {
    try {
      const parsed = updateGoalSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await goals.updateGoal({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          goalId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la meta.");
    }
  });

  app.patch("/pfm/goals/:id/enabled", requirePermission("pfm.goals.manage"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await goals.setGoalEnabled({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          goalId: c.req.param("id"),
          enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado de la meta.");
    }
  });

  app.post("/pfm/goals/:id/contribute", requirePermission("pfm.goals.manage"), async (c) => {
    try {
      const parsed = contributeGoalSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await goals.contribute({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          goalId: c.req.param("id"),
          amount: parsed.data.amount,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el progreso de la meta.");
    }
  });

  return app;
}
