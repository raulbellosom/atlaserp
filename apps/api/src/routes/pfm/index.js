// apps/api/src/routes/pfm/index.js
import { Hono } from "hono";
import { createWalletsRouter } from "./wallets-routes.js";
import { createCategoriesRouter } from "./categories-routes.js";
import { createMovementsRouter } from "./movements-routes.js";
import { createSummaryRouter } from "./summary-routes.js";
import { createWalletsService } from "./wallets-service.js";
import { createMovementsService } from "./movements-service.js";
import { createLedgerLinkService } from "./ledger-link-service.js";
import { createLedgerService } from "../ledger/ledger-service.js";

export function createPfmRouter({ prisma, requirePermission, requireAnyPermission }) {
  const app = new Hono();

  const anyPermission =
    typeof requireAnyPermission === "function"
      ? requireAnyPermission
      : (keys = []) => requirePermission(keys[0]);

  const wallets = createWalletsService({ prisma });
  const ledgerService = createLedgerService({ prisma });
  const ledgerLink = createLedgerLinkService({ prisma, ledgerService });
  const movements = createMovementsService({ prisma, wallets });

  app.route(
    "/",
    createWalletsRouter({ prisma, requirePermission, requireAnyPermission: anyPermission }),
  );
  app.route(
    "/",
    createCategoriesRouter({ prisma, requirePermission, requireAnyPermission: anyPermission }),
  );
  app.route(
    "/",
    createMovementsRouter({
      prisma,
      requirePermission,
      requireAnyPermission: anyPermission,
      wallets,
      movements,
      ledgerLink,
    }),
  );
  app.route("/", createSummaryRouter({ prisma, requireAnyPermission: anyPermission }));

  return app;
}
