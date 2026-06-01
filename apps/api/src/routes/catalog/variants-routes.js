// apps/api/src/routes/catalog/variants-routes.js
import { Hono } from 'hono'
import { createOptionSchema, updateOptionSchema, createVariantSchema, updateVariantSchema } from './validators.js'

export function createVariantsRouter({ variantSvc, requirePermission }) {
  const app = new Hono()

  app.get('/catalog/products/:id/options', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const data = await variantSvc.listOptions({ companyId, productId: c.req.param('id') })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/products/:id/options]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/options', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createOptionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.createOption({ companyId, productId: c.req.param('id'), data: parsed.data })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/options]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/products/:id/options/:optionId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateOptionSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.updateOption({ companyId, optionId: c.req.param('optionId'), data: parsed.data })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[PATCH /catalog/products/:id/options/:optionId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id/options/:optionId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await variantSvc.deleteOption({ companyId, optionId: c.req.param('optionId') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id/options/:optionId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/products/:id/variants', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const data = await variantSvc.listVariants({ companyId, productId: c.req.param('id') })
      return c.json({ data })
    } catch (err) {
      console.error('[GET /catalog/products/:id/variants]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.post('/catalog/products/:id/variants', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = createVariantSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.createVariant({ companyId, productId: c.req.param('id'), data: parsed.data })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/variants]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.patch('/catalog/products/:id/variants/:variantId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const parsed = updateVariantSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await variantSvc.updateVariant({ companyId, variantId: c.req.param('variantId'), data: parsed.data })
      if (!data) return c.json({ error: 'Not found' }, 404)
      return c.json({ data })
    } catch (err) {
      console.error('[PATCH /catalog/products/:id/variants/:variantId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.delete('/catalog/products/:id/variants/:variantId', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      await variantSvc.deleteVariant({ companyId, variantId: c.req.param('variantId') })
      return c.json({ ok: true })
    } catch (err) {
      console.error('[DELETE /catalog/products/:id/variants/:variantId]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
