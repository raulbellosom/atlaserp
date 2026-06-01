import { Hono } from 'hono'
import { createStockMovementSchema } from '../validators/index.js'
import {
  publishActivityFromContext,
  getActivityContext,
} from '../../../../apps/api/src/services/activity-publisher.js'

export function createStockRouter({ stockSvc, prisma, requirePermission }) {
  const app = new Hono()

  app.post('/catalog/products/:id/stock-movements', requirePermission('catalog.products.update'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const userId    = c.get('userId') ?? null
      const parsed = createStockMovementSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: parsed.error.errors[0]?.message }, 400)
      const data = await stockSvc.recordStockMovement({
        companyId,
        productId:     c.req.param('id'),
        variantId:     parsed.data.variant_id ?? null,
        quantityDelta: parsed.data.quantity_delta,
        reason:        parsed.data.reason,
        note:          parsed.data.note,
        userId,
      })
      const { actorName } = getActivityContext(c)
      const delta = parsed.data.quantity_delta
      const sign  = delta > 0 ? `+${delta}` : String(delta)
      await publishActivityFromContext(prisma, c, {
        type: 'catalog.stock.adjust',
        severity: delta > 0 ? 'success' : 'warning',
        entityType: 'CatalogProduct',
        entityId: c.req.param('id'),
        summary: `${actorName} ajustó stock ${sign} unidades${parsed.data.reason ? ` (${parsed.data.reason})` : ''}`,
        link: `/m/atlas.catalog/${c.req.param('id')}`,
      })
      return c.json({ data }, 201)
    } catch (err) {
      console.error('[POST /catalog/products/:id/stock-movements]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  app.get('/catalog/products/:id/stock-movements', requirePermission('catalog.products.read'), async (c) => {
    try {
      const companyId = c.get('companyId')
      const { variantId, limit, offset } = c.req.query()
      const result = await stockSvc.listStockMovements({
        companyId,
        productId:  c.req.param('id'),
        variantId:  variantId || undefined,
        limit:      limit  ? Number(limit)  : 50,
        offset:     offset ? Number(offset) : 0,
      })
      return c.json(result)
    } catch (err) {
      console.error('[GET /catalog/products/:id/stock-movements]', err?.message)
      return c.json({ error: 'Internal error' }, 500)
    }
  })

  return app
}
