import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createCategorySchema, updateCategorySchema } from '../validators/index.js'

export function createCategoriesRouter({ catalogSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const data = await catalogSvc.listCategories({ companyId })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/categories/:id', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      const row = await catalogSvc.getCategoryById({ companyId, id })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    } catch (err) {
      console.error('[GET /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post(
    '/catalog/categories',
    requirePermission('catalog.categories.create'),
    zValidator('json', createCategorySchema),
    async (c) => {
      try {
        const companyId = c.get('companyId')
        const data = c.req.valid('json')
        const row = await catalogSvc.createCategory({ companyId, data })
        return c.json({ data: row }, 201)
      } catch (err) {
        if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
        console.error('[POST /catalog/categories]', err?.message)
        return c.json({ error: 'Internal error' }, 500)
      }
    },
  )

  app.patch(
    '/catalog/categories/:id',
    requirePermission('catalog.categories.update'),
    zValidator('json', updateCategorySchema),
    async (c) => {
      try {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        const data = c.req.valid('json')
        const row = await catalogSvc.updateCategory({ companyId, id, data })
        if (!row) return c.json({ error: 'Not found' }, 404)
        return c.json({ data: row })
      } catch (err) {
        if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
        console.error('[PATCH /catalog/categories/:id]', err?.message)
        return c.json({ error: 'Internal error' }, 500)
      }
    },
  )

  app.delete(
    '/catalog/categories/:id',
    requirePermission('catalog.categories.delete'),
    async (c) => {
      try {
        const companyId = c.get('companyId')
        const id = c.req.param('id')
        await catalogSvc.deleteCategory({ companyId, id })
        return c.json({ ok: true })
      } catch (err) {
        console.error('[DELETE /catalog/categories/:id]', err?.message)
        return c.json({ error: 'Internal error' }, 500)
      }
    },
  )

  return app
}
