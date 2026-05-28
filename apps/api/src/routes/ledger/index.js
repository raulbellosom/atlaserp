import { Hono } from 'hono'
import { createAccountsRouter } from './accounts-routes.js'
import { createTypesRouter }    from './types-routes.js'
import { createCategoriesRouter } from './categories-routes.js'

/**
 * Named export consumed by apps/api/src/index.js at boot.
 * Receives { prisma, requirePermission }.
 */
export function createLedgerRouter({ prisma, requirePermission }) {
  const app = new Hono()

  app.route('/', createAccountsRouter({ prisma, requirePermission }))
  app.route('/', createTypesRouter({ prisma, requirePermission }))
  app.route('/', createCategoriesRouter({ prisma, requirePermission }))

  return app
}
