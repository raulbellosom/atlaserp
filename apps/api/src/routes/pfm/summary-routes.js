// apps/api/src/routes/pfm/summary-routes.js
import { Hono } from "hono";
import { toLocalMonth } from "@atlas/core";
import { createSummaryService } from "./summary-service.js";
import { PfmServiceError, getCompanyId, getActorId } from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

function currentMonth() {
  return toLocalMonth();
}

export function createSummaryRouter({ prisma, requireAnyPermission }) {
  const app = new Hono();
  const service = createSummaryService({ prisma });

  app.get(
    "/pfm/summary",
    requireAnyPermission(["pfm.wallets.read", "pfm.movements.read"]),
    async (c) => {
      try {
        const monthRaw = c.req.query("month");
        const month = /^\d{4}-\d{2}$/.test(monthRaw ?? "") ? monthRaw : currentMonth();
        return c.json({
          data: await service.getOverview({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            month,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo obtener el resumen.");
      }
    },
  );

  return app;
}
