import { Hono } from 'hono'

export function createThemesRouter({ websiteSvc, requirePermission }) {
  const app = new Hono()

  app.get('/themes', requirePermission('website.theme.read'), async (c) => {
    const companyId = c.get('companyId')
    const siteId    = c.req.query('siteId')
    if (!siteId) return c.json({ data: [] })
    const themes = await websiteSvc.listThemes({ companyId, siteId })
    return c.json({ data: themes })
  })

  return app
}
