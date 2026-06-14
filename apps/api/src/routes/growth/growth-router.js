import { Hono } from "hono";

import { createNotificationService } from "../../services/notification-service.js";
import { createGrowthLeadRoutes } from "./growth-lead-routes.js";
import { createGrowthLeadService } from "./growth-lead-service.js";

export function createGrowthRouter({
  prisma,
  requirePermission,
  notificationService = createNotificationService({ prisma }),
}) {
  const app = new Hono();
  const service = createGrowthLeadService({
    prisma,
    notificationService,
  });
  app.route("", createGrowthLeadRoutes({ service, requirePermission }));
  return app;
}
