import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createCategorySchema, updateCategorySchema } from '../validators/index.js'

export function createCategoriesRouter({ catalogSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    const companyId = c.get('companyId')
    const data = await catalogSvc.listCategories({ companyId })
    return c.json({ data })
  })

  app.post(
    '/catalog/categories',
    requirePermission('catalog.categories.create'),
    zValidator('json', createCategorySchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data = c.req.valid('json')
      const row = await catalogSvc.createCategory({ companyId, data })
      return c.json({ data: row }, 201)
    },
  )

  app.patch(
    '/catalog/categories/:id',
    requirePermission('catalog.categories.update'),
    zValidator('json', updateCategorySchema),
    async (c) => {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      const data = c.req.valid('json')
      const row = await catalogSvc.updateCategory({ companyId, id, data })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    },
  )

  app.delete(
    '/catalog/categories/:id',
    requirePermission('catalog.categories.delete'),
    async (c) => {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      await catalogSvc.deleteCategory({ companyId, id })
      return c.json({ ok: true })
    },
  )

  return app
}
