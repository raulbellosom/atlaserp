import { Hono } from 'hono'
import { createCatalogProductService } from './catalog-product-service.js'
import { createCatalogVariantService } from './catalog-variant-service.js'
import { createCatalogStockService }   from './catalog-stock-service.js'
import { createCatalogPublicService }  from './catalog-public-service.js'
import { createCategoriesRouter }      from './categories-routes.js'
import { createProductsRouter }        from './products-routes.js'
import { createVariantsRouter }        from './variants-routes.js'
import { createStockRouter }           from './stock-routes.js'
import { createPublicRouter }          from './public-routes.js'

export default function createCatalogRouter({ prisma, requirePermission }) {
  const app = new Hono()

  const productSvc = createCatalogProductService({ prisma })
  const variantSvc = createCatalogVariantService({ prisma })
  const stockSvc   = createCatalogStockService({ prisma })
  const publicSvc  = createCatalogPublicService({ prisma })

  app.route('/', createCategoriesRouter({ productSvc, prisma, requirePermission }))
  app.route('/', createProductsRouter({ productSvc, prisma, requirePermission }))
  app.route('/', createVariantsRouter({ variantSvc, requirePermission }))
  app.route('/', createStockRouter({ stockSvc, prisma, requirePermission }))
  app.route('/', createPublicRouter({ publicSvc }))

  return app
}
