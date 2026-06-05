// apps/api/src/routes/ledger/index.js
import { Hono } from 'hono'
import { createAccountsRouter }      from './accounts-routes.js'
import { createTypesRouter }          from './types-routes.js'
import { createCategoriesRouter }     from './categories-routes.js'
import { createGroupsRouter }         from './groups-routes.js'
import { createCollaborationRouter }  from './collaboration-routes.js'

export function createLedgerRouter({ prisma, requirePermission }) {
  const app = new Hono()

  app.route('/', createAccountsRouter({ prisma, requirePermission }))
  app.route('/', createTypesRouter({ prisma, requirePermission }))
  app.route('/', createCategoriesRouter({ prisma, requirePermission }))
  app.route('/', createGroupsRouter({ prisma, requirePermission }))
  app.route('/', createCollaborationRouter({ prisma, requirePermission }))

  return app
}
