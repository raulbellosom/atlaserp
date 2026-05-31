import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { createProductSchema, updateProductSchema } from '../validators/index.js'

export function createProductsRouter({ catalogSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/products', requirePermission('catalog.products.read'), async (c) => {
    const companyId = c.get('companyId')
    const { categoryId, search, limit, offset } = c.req.query()
    const data = await catalogSvc.listProducts({
      companyId,
      categoryId: categoryId || undefined,
      search:     search     || undefined,
      limit:      limit  ? Number(limit)  : 50,
      offset:     offset ? Number(offset) : 0,
    })
    return c.json({ data })
  })

  app.get('/catalog/products/:id', requirePermission('catalog.products.read'), async (c) => {
    const companyId = c.get('companyId')
    const id = c.req.param('id')
    const row = await catalogSvc.getProductById({ companyId, id })
    if (!row) return c.json({ error: 'Not found' }, 404)
    return c.json({ data: row })
  })

  app.post(
    '/catalog/products',
    requirePermission('catalog.products.create'),
    zValidator('json', createProductSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const data = c.req.valid('json')
      const row = await catalogSvc.createProduct({ companyId, data })
      return c.json({ data: row }, 201)
    },
  )

  app.patch(
    '/catalog/products/:id',
    requirePermission('catalog.products.update'),
    zValidator('json', updateProductSchema),
    async (c) => {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      const data = c.req.valid('json')
      const row = await catalogSvc.updateProduct({ companyId, id, data })
      if (!row) return c.json({ error: 'Not found' }, 404)
      return c.json({ data: row })
    },
  )

  app.delete(
    '/catalog/products/:id',
    requirePermission('catalog.products.delete'),
    async (c) => {
      const companyId = c.get('companyId')
      const id = c.req.param('id')
      await catalogSvc.deleteProduct({ companyId, id })
      return c.json({ ok: true })
    },
  )

  return app
}
