import { Hono } from 'hono'
import { createStorefrontMiddleware } from './storefront-middleware.js'
import { createStorefrontAuthRoutes } from './storefront-auth-routes.js'
import { createStorefrontFilesRoutes } from './storefront-files-routes.js'
import { createStorefrontConfigRoutes } from './storefront-config-routes.js'
import { createStorefrontAuthService } from '../../services/storefront-auth-service.js'
import { createStorefrontFilesService } from '../../services/storefront-files-service.js'

export function createStorefrontRouter({ prisma, supabaseAdmin, supabaseAnon }) {
  const app = new Hono()

  const { storefrontAuthMiddleware } = createStorefrontMiddleware({ prisma, supabaseAdmin })
  const authService = createStorefrontAuthService({ prisma, supabaseAdmin, supabaseAnon })
  const filesService = createStorefrontFilesService({ prisma, supabaseAdmin })

  app.route('/auth', createStorefrontAuthRoutes({ authService, storefrontAuthMiddleware }))
  app.route('/files', createStorefrontFilesRoutes({ filesService, storefrontAuthMiddleware }))
  app.route('/', createStorefrontConfigRoutes({ prisma }))

  return app
}
