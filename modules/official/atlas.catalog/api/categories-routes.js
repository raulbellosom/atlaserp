import { Hono } from 'hono'
import { createCategorySchema, updateCategorySchema } from '../validators/index.js'

export function createCategoriesRouter({ productSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { flat } = c.req.query()
      const data = flat === 'true'
        ? await productSvc.listCategories({ companyId })
        : await productSvc.listCategoriesTree({ companyId })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/categories/:id', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const row = await productSvc.getCategoryById({ companyId, id: c.req.param('id') })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    } catch (err) {
      console.error('[GET /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/categories', requirePermission('catalog.categories.create'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.createCategory({ companyId, data: parsed.data })
      return c.json({ data: row }, 201)
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[POST /catalog/categories]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/categories/:id', requirePermission('catalog.categories.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const row = await productSvc.updateCategory({ companyId, id: c.req.param('id'), data: parsed.data })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    } catch (err) {
      if (err?.code === '23505') return c.json({ error: 'El slug ya existe' }, 409)
      console.error('[PATCH /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/categories/:id', requirePermission('catalog.categories.delete'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await productSvc.deleteCategory({ companyId, id: c.req.param('id') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
