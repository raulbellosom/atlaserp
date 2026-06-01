// apps/api/src/routes/catalog/categories-routes.js
import { Hono } from 'hono'
import { createCategorySchema, updateCategorySchema } from './validators.js'
import {
  publishActivityFromContext,
  getActivityContext,
} from '../../services/activity-publisher.js'

export function createCategoriesRouter({ productSvc, prisma, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/categories', requirePermission('catalog.categories.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { flat, page, pageSize, search, sort, order } = c.req.query()

      if (flat === 'true') {
        const data = await productSvc.listCategories({ companyId })
        return c.json({ data })
      }

      if (page || pageSize) {
        const limit  = Math.min(Number.parseInt(pageSize, 10) || 20, 200)
        const offset = (Math.max(Number.parseInt(page, 10) || 1, 1) - 1) * limit
        const result = await productSvc.listCategoriesPaginated({
          companyId,
          search: search || undefined,
          sort,
          order,
          limit,
          offset,
        })
        return c.json(result)
      }

      const data = await productSvc.listCategoriesTree({ companyId })
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
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.create',
        severity: 'success',
        entityType: 'CatalogCategory',
        entityId: row.id,
        summary: `${actorName} creó la categoría "${row.name}"`,
        link: `/m/atlas.catalog/categories`,
      })
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
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.update',
        severity: 'info',
        entityType: 'CatalogCategory',
        entityId: row.id,
        summary: `${actorName} actualizó la categoría "${row.name}"`,
        link: `/m/atlas.catalog/categories`,
      })
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
      const existing = await productSvc.getCategoryById({ companyId, id: c.req.param('id') })
      await productSvc.deleteCategory({ companyId, id: c.req.param('id') })
      const { actorName } = getActivityContext(c)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.category.delete',
        severity: 'warning',
        entityType: 'CatalogCategory',
        entityId: c.req.param('id'),
        summary: `${actorName} eliminó la categoría "${existing?.name ?? c.req.param('id')}"`,
        link: `/m/atlas.catalog/categories`,
      })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/categories/:id]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
