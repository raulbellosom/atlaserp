// apps/api/src/routes/pfm/movements-routes.js
import { Hono } from "hono";
import {
  createMovementSchema,
  updateMovementSchema,
  confirmMovementSchema,
  listMovementsQuerySchema,
  enrichLedgerMovementSchema,
  enabledSchema,
  adjustBalanceSchema,
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

export function createMovementsRouter({
  requirePermission,
  requireAnyPermission,
  wallets,
  movements,
  ledgerLink,
}) {
  const app = new Hono();

  app.get(
    "/pfm/wallets/:id/movements",
    requireAnyPermission(["pfm.movements.read", "pfm.movements.update"]),
    async (c) => {
      try {
        const companyId = getCompanyId(c);
        const actorId = getActorId(c);
        const walletId = c.req.param("id");
        const parsed = listMovementsQuerySchema.safeParse(c.req.query());
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        const wallet = await wallets.getWallet({ companyId, walletId, actorId });
        if (wallet.ledgerAccountId) {
          return c.json(
            await ledgerLink.getLinkedMovements({
              companyId,
              actorId,
              walletId,
              ledgerAccountId: wallet.ledgerAccountId,
              query: parsed.data,
            }),
          );
        }
        return c.json(
          await movements.listMovements({ companyId, actorId, walletId, query: parsed.data }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los movimientos.");
      }
    },
  );

  app.post("/pfm/wallets/:id/movements", requirePermission("pfm.movements.create"), async (c) => {
    try {
      const companyId = getCompanyId(c);
      const actorId = getActorId(c);
      const walletId = c.req.param("id");
      const wallet = await wallets.getWallet({ companyId, walletId, actorId });
      if (wallet.ledgerAccountId) {
        return c.json(
          {
            error:
              "Esta cartera refleja una cuenta bancaria; registra el movimiento en Libro de cuentas.",
          },
          400,
        );
      }
      const parsed = createMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const movement = await movements.createMovement({
        companyId,
        actorId,
        walletId,
        data: parsed.data,
      });
      return c.json({ data: movement }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el movimiento.");
    }
  });

  app.post("/pfm/wallets/:id/adjust", requirePermission("pfm.movements.create"), async (c) => {
    try {
      const parsed = adjustBalanceSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const movement = await movements.adjustWalletBalance({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        walletId: c.req.param("id"),
        data: parsed.data,
      });
      return c.json({ data: movement }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo ajustar el saldo.");
    }
  });

  app.patch("/pfm/movements/:movementId", requirePermission("pfm.movements.update"), async (c) => {
    try {
      const parsed = updateMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await movements.updateMovement({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          movementId: c.req.param("movementId"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el movimiento.");
    }
  });

  app.patch(
    "/pfm/movements/:movementId/enabled",
    requirePermission("pfm.movements.delete"),
    async (c) => {
      try {
        const parsed = enabledSchema.safeParse(await c.req.json());
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        return c.json({
          data: await movements.setMovementEnabled({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            movementId: c.req.param("movementId"),
            enabled: parsed.data.enabled,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo cambiar el estado del movimiento.");
      }
    },
  );

  app.patch(
    "/pfm/movements/:movementId/confirm",
    requirePermission("pfm.movements.update"),
    async (c) => {
      try {
        const body = await c.req.json().catch(() => ({}));
        const parsed = confirmMovementSchema.safeParse(body);
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        return c.json({
          data: await movements.confirmMovement({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            movementId: c.req.param("movementId"),
            amount: parsed.data.amount,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo confirmar el movimiento.");
      }
    },
  );

  app.patch(
    "/pfm/movements/:movementId/skip",
    requirePermission("pfm.movements.update"),
    async (c) => {
      try {
        return c.json({
          data: await movements.skipMovement({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            movementId: c.req.param("movementId"),
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo omitir el movimiento.");
      }
    },
  );

  app.put(
    "/pfm/wallets/:id/ledger-movements/:ltxId/enrichment",
    requirePermission("pfm.movements.update"),
    async (c) => {
      try {
        const companyId = getCompanyId(c);
        const actorId = getActorId(c);
        const walletId = c.req.param("id");
        const wallet = await wallets.getWallet({ companyId, walletId, actorId });
        if (!wallet.ledgerAccountId) {
          return c.json({ error: "La cartera no esta enlazada a una cuenta bancaria." }, 400);
        }
        const parsed = enrichLedgerMovementSchema.safeParse(await c.req.json());
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        return c.json({
          data: await ledgerLink.enrichLedgerMovement({
            companyId,
            actorId,
            walletId,
            ledgerAccountId: wallet.ledgerAccountId,
            ledgerTransactionId: c.req.param("ltxId"),
            data: parsed.data,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo guardar el enriquecimiento.");
      }
    },
  );

  return app;
}
