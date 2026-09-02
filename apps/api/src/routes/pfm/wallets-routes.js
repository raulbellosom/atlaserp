// apps/api/src/routes/pfm/wallets-routes.js
import { Hono } from "hono";
import {
  createWalletSchema,
  updateWalletSchema,
  enabledSchema,
  upsertWalletMemberSchema,
} from "./validators.js";
import { createWalletsService } from "./wallets-service.js";
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

export function createWalletsRouter({ prisma, requirePermission, requireAnyPermission }) {
  const app = new Hono();
  const service = createWalletsService({ prisma });

  app.get(
    "/pfm/wallets",
    requireAnyPermission(["pfm.wallets.read", "pfm.wallets.update"]),
    async (c) => {
      try {
        return c.json(
          await service.listWallets({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar las carteras.");
      }
    },
  );

  app.get(
    "/pfm/wallets/:id",
    requireAnyPermission(["pfm.wallets.read", "pfm.wallets.update"]),
    async (c) => {
      try {
        return c.json({
          data: await service.getWallet({
            companyId: getCompanyId(c),
            walletId: c.req.param("id"),
            actorId: getActorId(c),
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo obtener la cartera.");
      }
    },
  );

  app.post("/pfm/wallets", requirePermission("pfm.wallets.create"), async (c) => {
    try {
      const parsed = createWalletSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const wallet = await service.createWallet({
        companyId: getCompanyId(c),
        ownerId: getActorId(c),
        data: parsed.data,
      });
      return c.json({ data: wallet }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la cartera.");
    }
  });

  app.patch("/pfm/wallets/:id", requirePermission("pfm.wallets.update"), async (c) => {
    try {
      const parsed = updateWalletSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const wallet = await service.updateWallet({
        companyId: getCompanyId(c),
        walletId: c.req.param("id"),
        actorId: getActorId(c),
        data: parsed.data,
      });
      return c.json({ data: wallet });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la cartera.");
    }
  });

  app.patch("/pfm/wallets/:id/enabled", requirePermission("pfm.wallets.delete"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await service.setWalletEnabled({
          companyId: getCompanyId(c),
          walletId: c.req.param("id"),
          actorId: getActorId(c),
          enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado de la cartera.");
    }
  });

  // ── Members ────────────────────────────────────────────────────────────────

  app.get(
    "/pfm/wallets/:id/members",
    requireAnyPermission(["pfm.members.manage", "pfm.wallets.read"]),
    async (c) => {
      try {
        return c.json(
          await service.listMembers({
            companyId: getCompanyId(c),
            walletId: c.req.param("id"),
            actorId: getActorId(c),
          }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los colaboradores.");
      }
    },
  );

  app.put("/pfm/wallets/:id/members", requirePermission("pfm.members.manage"), async (c) => {
    try {
      const parsed = upsertWalletMemberSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await service.upsertMember({
          companyId: getCompanyId(c),
          walletId: c.req.param("id"),
          actorId: getActorId(c),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo guardar el colaborador.");
    }
  });

  app.delete(
    "/pfm/wallets/:id/members/:userId",
    requirePermission("pfm.members.manage"),
    async (c) => {
      try {
        return c.json({
          data: await service.removeMember({
            companyId: getCompanyId(c),
            walletId: c.req.param("id"),
            actorId: getActorId(c),
            userId: c.req.param("userId"),
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo remover el colaborador.");
      }
    },
  );

  return app;
}
