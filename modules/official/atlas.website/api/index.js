import { Hono } from 'hono'
import { createWebsiteService } from './website-service.js'
import { createPagesRouter } from './pages-routes.js'
import { createThemesRouter } from './themes-routes.js'
import { createMenusRouter } from './menus-routes.js'

export default function createWebsiteRouter({ prisma, requirePermission }) {
  const app = new Hono()
  const websiteSvc = createWebsiteService({ prisma })

  app.route('/website', createPagesRouter({ websiteSvc, requirePermission }))
  app.route('/website', createThemesRouter({ websiteSvc, requirePermission }))
  app.route('/website', createMenusRouter({ websiteSvc, requirePermission }))

  app.get('/website/site', requirePermission('website.site.read'), async (c) => {
    const companyId = c.get('companyId')
    const site = await websiteSvc.getOrCreateSite({ companyId })
    return c.json({ data: site })
  })

  return app
}
