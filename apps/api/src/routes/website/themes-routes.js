import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createThemeSchema, updateThemeSchema } from './validators.js'
import { WebsiteServiceError } from './service-helpers.js'

export function createThemesRouter({ websiteSvc, requirePermission }) {
  const app = new Hono()

  app.get('/themes', requirePermission('website.theme.read'), async (c) => {
    const companyId = c.get('companyId')
    const siteId    = c.req.query('siteId')
    if (!siteId) return c.json({ data: [] })
    const themes = await websiteSvc.listThemes({ companyId, siteId })
    return c.json({ data: themes })
  })

  app.get('/themes/:id', requirePermission('website.theme.read'), async (c) => {
    const companyId = c.get('companyId')
    try {
      const theme = await websiteSvc.getTheme({ companyId, themeId: c.req.param('id') })
      if (!theme) return c.json({ error: 'Tema no encontrado' }, 404)
      return c.json(theme)
    } catch (err) {
      if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
      throw err
    }
  })

  app.post(
    '/themes',
    requirePermission('website.theme.update'),
    zValidator('json', createThemeSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const theme = await websiteSvc.createTheme({ companyId, siteId: data.siteId, data })
        return c.json(theme, 201)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  app.patch(
    '/themes/:id',
    requirePermission('website.theme.update'),
    zValidator('json', updateThemeSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data      = c.req.valid('json')
      try {
        const theme = await websiteSvc.updateTheme({ companyId, themeId: c.req.param('id'), data })
        return c.json(theme)
      } catch (err) {
        if (err instanceof WebsiteServiceError) return c.json({ error: err.message }, err.status)
        throw err
      }
    },
  )

  return app
}
