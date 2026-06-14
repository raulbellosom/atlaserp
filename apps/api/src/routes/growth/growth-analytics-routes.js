import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createAnalyticsCsv } from "./growth-analytics-csv.js";
import { GrowthAnalyticsServiceError } from "./growth-analytics-service.js";
import {
  growthAnalyticsExportQuerySchema,
  growthAnalyticsQuerySchema,
} from "./growth-validators.js";

const REPORT_METHODS = {
  overview: "getOverview",
  acquisition: "getAcquisition",
  content: "getContent",
  conversions: "getConversions",
  retention: "getRetention",
};

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

function handleError(c, error) {
  if (error instanceof GrowthAnalyticsServiceError) {
    return c.json({ error: error.message, code: error.code }, error.status);
  }
  console.error("[atlas.growth.analytics]", error);
  return c.json({ error: "Error interno de analitica Growth." }, 500);
}

export function createGrowthAnalyticsRoutes({
  service,
  prisma,
  requirePermission,
}) {
  const app = new Hono();

  app.get(
    "/growth/analytics/sites",
    requirePermission("growth.analytics.read"),
    async (c) => {
      try {
        const data = await service.listSites({ companyId: companyId(c) });
        return c.json({ data });
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  for (const [report, method] of Object.entries(REPORT_METHODS)) {
    app.get(
      `/growth/analytics/${report}`,
      requirePermission("growth.analytics.read"),
      zValidator("query", growthAnalyticsQuerySchema),
      async (c) => {
        try {
          const data = await service[method]({
            companyId: companyId(c),
            query: c.req.valid("query"),
          });
          return c.json({ data });
        } catch (error) {
          return handleError(c, error);
        }
      },
    );
  }

  app.get(
    "/growth/analytics/export.csv",
    requirePermission("growth.analytics.export"),
    zValidator("query", growthAnalyticsExportQuerySchema),
    async (c) => {
      const query = c.req.valid("query");
      try {
        const data = await service[REPORT_METHODS[query.report]]({
          companyId: companyId(c),
          query,
        });
        await prisma.auditLog.create({
          data: {
            actorId: actorId(c),
            moduleKey: "atlas.growth",
            entityType: "growth.analytics",
            entityId: companyId(c),
            action: "growth.analytics.export",
            metadata: {
              companyId: companyId(c),
              report: query.report,
              from: query.from ?? null,
              to: query.to ?? null,
              siteId: query.siteId ?? null,
              compare: query.compare,
            },
          },
        });
        c.header("Content-Type", "text/csv; charset=utf-8");
        c.header(
          "Content-Disposition",
          `attachment; filename="growth-${query.report}.csv"`,
        );
        return c.body(createAnalyticsCsv(query.report, data));
      } catch (error) {
        return handleError(c, error);
      }
    },
  );

  return app;
}
