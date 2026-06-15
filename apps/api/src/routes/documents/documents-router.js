import { Hono } from "hono";

import { createDocumentProviderRegistry } from "./document-provider-registry.js";
import { createDocumentTemplateRoutes } from "./document-template-routes.js";
import { createDocumentTemplateService } from "./document-template-service.js";
import { createGrowthLeadDocumentProvider } from "./providers/growth-lead-provider.js";

export function createDocumentsRouter({ prisma, requirePermission }) {
  const app = new Hono();
  const providerRegistry = createDocumentProviderRegistry();
  providerRegistry.register(createGrowthLeadDocumentProvider({ prisma }));
  const service = createDocumentTemplateService({
    prisma,
    providerRegistry,
  });

  app.route(
    "",
    createDocumentTemplateRoutes({
      service,
      providerRegistry,
      requirePermission,
    }),
  );
  return app;
}
