import { Hono } from 'hono'

export function createMenusRouter({ websiteSvc, requirePermission }) {
  const app = new Hono()

  app.get('/menus', requirePermission('website.menus.read'), async (c) => {
    const companyId = c.get('companyId')
    const siteId    = c.req.query('siteId')
    if (!siteId) return c.json({ data: [] })
    const menus = await websiteSvc.listMenus({ companyId, siteId })
    return c.json({ data: menus })
  })

  return app
}
