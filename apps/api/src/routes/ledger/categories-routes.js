import { Hono } from 'hono'
import { createCategorySchema, updateCategorySchema, enabledSchema } from './validators.js'
import { createCategoriesService } from './categories-service.js'
import { LedgerServiceError } from './ledger-service.js'
import { getCompanyId, getValidationErrorMessage } from './service-helpers.js'

function handleError(c, err, fallback) {
  if (err instanceof LedgerServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[atlas.ledger:categories]', err)
  return c.json({ error: fallback }, 500)
}

export function createCategoriesRouter({ prisma, requirePermission }) {
  const app     = new Hono()
  const service = createCategoriesService({ prisma })

  app.get('/ledger/categories', requirePermission('ledger.categories.manage'), async (c) => {
    try { return c.json(await service.listCategories({ companyId: getCompanyId(c) })) }
    catch (err) { return handleError(c, err, 'No se pudieron listar las categorias.') }
  })

  app.post('/ledger/categories', requirePermission('ledger.categories.manage'), async (c) => {
    try {
      const parsed = createCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.createCategory({ companyId: getCompanyId(c), data: parsed.data }) }, 201)
    } catch (err) { return handleError(c, err, 'No se pudo crear la categoria.') }
  })

  app.get('/ledger/categories/:id', requirePermission('ledger.categories.manage'), async (c) => {
    try { return c.json({ data: await service.getCategory({ companyId: getCompanyId(c), categoryId: c.req.param('id') }) }) }
    catch (err) { return handleError(c, err, 'No se pudo obtener la categoria.') }
  })

  app.patch('/ledger/categories/:id', requirePermission('ledger.categories.manage'), async (c) => {
    try {
      const parsed = updateCategorySchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateCategory({ companyId: getCompanyId(c), categoryId: c.req.param('id'), data: parsed.data }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar la categoria.') }
  })

  app.patch('/ledger/categories/:id/enabled', requirePermission('ledger.categories.manage'), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Se requiere { enabled: boolean }.' }, 400)
      return c.json({ data: await service.setCategoryEnabled({ companyId: getCompanyId(c), categoryId: c.req.param('id'), enabled: parsed.data.enabled }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el estado de la categoria.') }
  })

  return app
}
