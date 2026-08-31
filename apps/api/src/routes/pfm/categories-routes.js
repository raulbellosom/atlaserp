// apps/api/src/routes/pfm/categories-routes.js
import { Hono } from "hono";
import { createCategorySchema, updateCategorySchema, enabledSchema } from "./validators.js";
import { createCategoriesService } from "./categories-service.js";
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

export function createCategoriesRouter({ prisma, requirePermission, requireAnyPermission }) {
  const app = new Hono();
  const service = createCategoriesService({ prisma });

  app.get(
    "/pfm/categories",
    requireAnyPermission(["pfm.categories.read", "pfm.categories.manage", "pfm.movements.read"]),
    async (c) => {
      try {
        const kind = c.req.query("kind");
        const includeShared = c.req.query("includeShared") === "true";
        return c.json(
          await service.listCategories({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            kind: kind === "EXPENSE" || kind === "INCOME" ? kind : undefined,
            includeShared,
          }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar las categorias.");
      }
    },
  );

  app.post("/pfm/categories", requirePermission("pfm.categories.manage"), async (c) => {
    try {
      const parsed = createCategorySchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const category = await service.createCategory({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        data: parsed.data,
      });
      return c.json({ data: category }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la categoria.");
    }
  });

  app.patch("/pfm/categories/:id", requirePermission("pfm.categories.manage"), async (c) => {
    try {
      const parsed = updateCategorySchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const category = await service.updateCategory({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        categoryId: c.req.param("id"),
        data: parsed.data,
      });
      return c.json({ data: category });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la categoria.");
    }
  });

  app.patch(
    "/pfm/categories/:id/enabled",
    requirePermission("pfm.categories.manage"),
    async (c) => {
      try {
        const parsed = enabledSchema.safeParse(await c.req.json());
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        return c.json({
          data: await service.setCategoryEnabled({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            categoryId: c.req.param("id"),
            enabled: parsed.data.enabled,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo cambiar el estado de la categoria.");
      }
    },
  );

  return app;
}
