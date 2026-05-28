import { Hono } from 'hono'
import createAccountsRouter   from './accounts-routes.js'
import createTypesRouter      from './types-routes.js'
import createCategoriesRouter from './categories-routes.js'

/**
 * Route factory called by route-loader-service.js at API boot.
 * Receives { prisma, requirePermission, moduleContext, cache }.
 */
export default function createLedgerRouter({ prisma, requirePermission, moduleContext, cache = null }) {
  const app = new Hono()

  app.route('/', createAccountsRouter({ prisma, requirePermission }))
  app.route('/', createTypesRouter({ prisma, requirePermission }))
  app.route('/', createCategoriesRouter({ prisma, requirePermission }))

  return app
}
