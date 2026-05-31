import { Hono } from 'hono'

export function createPublicRouter({ publicSvc }) {
  const app = new Hono()

  app.get('/public/catalog/products', async (c) => {
    try {
      const { companyId, categorySlug, search, limit, offset } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const result = await publicSvc.listPublicProducts({
        companyId,
        categorySlug: categorySlug || undefined,
        search:       search       || undefined,
        limit:        limit  ? Number(limit)  : 20,
        offset:       offset ? Number(offset) : 0,
      })
      return c.json(result)
    } catch (err) {
      console.error('[GET /public/catalog/products]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/public/catalog/products/:slug', async (c) => {
    try {
      const { companyId } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const data = await publicSvc.getPublicProductBySlug({ companyId, slug: c.req.param('slug') })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[GET /public/catalog/products/:slug]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/public/catalog/categories', async (c) => {
    try {
      const { companyId } = c.req.query()
      if (!companyId) return c.json({ error: 'companyId required' }, 400)
      const data = await publicSvc.listPublicCategories({ companyId })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /public/catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
