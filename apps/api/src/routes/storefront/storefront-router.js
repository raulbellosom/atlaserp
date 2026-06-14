import { Hono } from 'hono'
import { createStorefrontMiddleware } from './storefront-middleware.js'
import { createStorefrontAuthRoutes } from './storefront-auth-routes.js'
import { createStorefrontFilesRoutes } from './storefront-files-routes.js'
import { createStorefrontConfigRoutes } from './storefront-config-routes.js'
import { createStorefrontCaptureRoutes, createTurnstileVerifier } from './storefront-capture-routes.js'
import { createStorefrontAuthService } from '../../services/storefront-auth-service.js'
import { createStorefrontFilesService } from '../../services/storefront-files-service.js'
import { StorefrontCaptureError, createStorefrontCaptureService } from '../../services/storefront-capture-service.js'
import { createNotificationService } from '../../services/notification-service.js'

export function createStorefrontRouter({ prisma, supabaseAdmin, supabaseAnon }) {
  const app = new Hono()

  const { storefrontAuthMiddleware, anyAuthMiddleware } = createStorefrontMiddleware({ prisma, supabaseAdmin })
  const authService = createStorefrontAuthService({ prisma, supabaseAdmin, supabaseAnon })
  const filesService = createStorefrontFilesService({ prisma, supabaseAdmin })
  const captureService = createStorefrontCaptureService({
    prisma,
    verifyTurnstile: createTurnstileVerifier(),
    notificationService: createNotificationService({ prisma }),
  })

  async function resolveAuthenticatedProfile(c) {
    const authorization = c.req.header('Authorization')
    if (!authorization?.startsWith('Bearer ')) return null

    const token = authorization.slice('Bearer '.length)
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      throw new StorefrontCaptureError('invalid_token', 'Token invalido o expirado.', 401)
    }

    const companySlug = c.req.header('X-Atlas-Company')
    if (!companySlug) return null
    const profile = await prisma.userProfile.findFirst({
      where: {
        authUserId: user.id,
        enabled: true,
        memberships: {
          some: {
            enabled: true,
            company: { slug: companySlug, enabled: true },
          },
        },
      },
      select: { id: true },
    })
    return profile?.id ?? null
  }

  app.route('/auth', createStorefrontAuthRoutes({ authService, storefrontAuthMiddleware, anyAuthMiddleware }))
  app.route('/files', createStorefrontFilesRoutes({ filesService, storefrontAuthMiddleware }))
  app.route('/v1', createStorefrontCaptureRoutes({
    captureService,
    resolveAuthenticatedProfile,
  }))
  app.route('/', createStorefrontConfigRoutes({ prisma }))

  return app
}
