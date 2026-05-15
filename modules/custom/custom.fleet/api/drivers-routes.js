import { Hono } from 'hono'
import { z } from 'zod'
import { createDriverSchema, updateDriverSchema, createDocumentAssociationSchema } from '../validators/index.js'
import { createDriverService } from './driver-service.js'
import { FleetServiceError } from './fleet-service.js'

const driverEnabledSchema = z.object({ enabled: z.boolean() })

function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Datos invalidos.'
  const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null
  return path ? `Datos invalidos en ${path}: ${issue.message}` : `Datos invalidos: ${issue.message}`
}

function getCompanyIdFromContext(c) {
  const companyId = c.get('userContext')?.memberships?.[0]?.companyId
  return typeof companyId === 'string' && companyId.trim() ? companyId.trim() : null
}

function getActorIdFromContext(c) {
  const actorId = c.get('userContext')?.profile?.id
  return typeof actorId === 'string' && actorId.trim() ? actorId.trim() : null
}

function handleRouteError(c, err, { fallbackError, route, moduleKey, operation }) {
  if (err instanceof FleetServiceError) return c.json({ error: err.message }, err.status)
  if (process.env.NODE_ENV !== 'production') {
    console.error('[custom.fleet] route error', { route, moduleKey, operation, error: { name: err?.name, message: err?.message, stack: err?.stack } })
  }
  return c.json({ error: fallbackError }, 500)
}

export function createDriversRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  const service = createDriverService({ prisma })
  const moduleKey = moduleContext?.moduleKey ?? 'custom.fleet'

  app.get('/fleet/drivers', requirePermission('fleet.drivers.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listDrivers({
        companyId,
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        search: c.req.query('search'),
        status: c.req.query('status'),
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir'),
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los choferes.', route: '/fleet/drivers', moduleKey, operation: 'listDrivers' })
    }
  })

  app.post('/fleet/drivers', requirePermission('fleet.drivers.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createDriverSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createDriver({ companyId, actorId, payload: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear el chofer.', route: '/fleet/drivers', moduleKey, operation: 'createDriver' })
    }
  })

  app.get('/fleet/drivers/:id', requirePermission('fleet.drivers.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const row = await service.getDriver({ companyId, id: c.req.param('id') })
      return c.json({ data: row })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo obtener el chofer.', route: '/fleet/drivers/:id', moduleKey, operation: 'getDriver' })
    }
  })

  app.patch('/fleet/drivers/:id', requirePermission('fleet.drivers.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateDriverSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updateDriver({ companyId, actorId, id: c.req.param('id'), payload: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el chofer.', route: '/fleet/drivers/:id', moduleKey, operation: 'updateDriver' })
    }
  })

  app.patch('/fleet/drivers/:id/enabled', requirePermission('fleet.drivers.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = driverEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.setDriverEnabled({ companyId, actorId, id: c.req.param('id'), enabled: parsed.data.enabled })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el estado del chofer.', route: '/fleet/drivers/:id/enabled', moduleKey, operation: 'setDriverEnabled' })
    }
  })

  app.get('/fleet/drivers/:id/documents', requirePermission('fleet.drivers.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listDriverDocuments({ companyId, driverId: c.req.param('id') })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los documentos del chofer.', route: '/fleet/drivers/:id/documents', moduleKey, operation: 'listDriverDocuments' })
    }
  })

  app.post('/fleet/drivers/:id/documents', requirePermission('fleet.drivers.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createDocumentAssociationSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const doc = await service.addDriverDocument({ companyId, actorId, driverId: c.req.param('id'), payload: parsed.data })
      return c.json({ data: doc }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo agregar el documento al chofer.', route: '/fleet/drivers/:id/documents', moduleKey, operation: 'addDriverDocument' })
    }
  })

  app.delete('/fleet/drivers/:id/documents/:docId', requirePermission('fleet.drivers.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const result = await service.removeDriverDocument({ companyId, actorId, driverId: c.req.param('id'), docId: c.req.param('docId') })
      return c.json({ data: result })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo eliminar el documento del chofer.', route: '/fleet/drivers/:id/documents/:docId', moduleKey, operation: 'removeDriverDocument' })
    }
  })

  return app
}
