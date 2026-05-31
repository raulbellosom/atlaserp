import { Hono } from 'hono'
import { createCatalogService } from './catalog-service.js'
import { createCategoriesRouter } from './categories-routes.js'
import { createProductsRouter } from './products-routes.js'

export default function createCatalogRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const catalogSvc = createCatalogService({ prisma })

  app.route('/', createCategoriesRouter({ catalogSvc, requirePermission }))
  app.route('/', createProductsRouter({ catalogSvc, requirePermission }))

  return app
}
