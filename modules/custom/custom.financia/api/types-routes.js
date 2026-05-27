import { Hono } from 'hono'
import { createTypeSchema, updateTypeSchema, enabledSchema } from '../validators/index.js'
import { createTypesService } from './types-service.js'
import { FinanciaServiceError } from './financia-service.js'
import { getCompanyId, getValidationErrorMessage } from './service-helpers.js'

function handleError(c, err, fallback) {
  if (err instanceof FinanciaServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') console.error('[custom.financia:types]', err)
  return c.json({ error: fallback }, 500)
}

export default function createTypesRouter({ prisma, requirePermission }) {
  const app     = new Hono()
  const service = createTypesService({ prisma })

  app.get('/financia/types', requirePermission('financia.types.manage'), async (c) => {
    try { return c.json(await service.listTypes({ companyId: getCompanyId(c) })) }
    catch (err) { return handleError(c, err, 'No se pudieron listar los tipos.') }
  })

  app.post('/financia/types', requirePermission('financia.types.manage'), async (c) => {
    try {
      const parsed = createTypeSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.createType({ companyId: getCompanyId(c), data: parsed.data }) }, 201)
    } catch (err) { return handleError(c, err, 'No se pudo crear el tipo.') }
  })

  app.get('/financia/types/:id', requirePermission('financia.types.manage'), async (c) => {
    try { return c.json({ data: await service.getType({ companyId: getCompanyId(c), typeId: c.req.param('id') }) }) }
    catch (err) { return handleError(c, err, 'No se pudo obtener el tipo.') }
  })

  app.patch('/financia/types/:id', requirePermission('financia.types.manage'), async (c) => {
    try {
      const parsed = updateTypeSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      return c.json({ data: await service.updateType({ companyId: getCompanyId(c), typeId: c.req.param('id'), data: parsed.data }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el tipo.') }
  })

  app.patch('/financia/types/:id/enabled', requirePermission('financia.types.manage'), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json())
      if (!parsed.success) return c.json({ error: 'Se requiere { enabled: boolean }.' }, 400)
      return c.json({ data: await service.setTypeEnabled({ companyId: getCompanyId(c), typeId: c.req.param('id'), enabled: parsed.data.enabled }) })
    } catch (err) { return handleError(c, err, 'No se pudo actualizar el estado del tipo.') }
  })

  return app
}
