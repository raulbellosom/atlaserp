import { Hono } from 'hono'
import { z } from 'zod'
import { createMaintenanceSchema, updateMaintenanceSchema, createDocumentAssociationSchema } from '../validators/index.js'
import { createMaintenanceService } from './maintenance-service.js'
import { FleetServiceError } from './fleet-service.js'

const maintenanceEnabledSchema = z.object({ enabled: z.boolean() })

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

export function createMaintenanceRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  const service = createMaintenanceService({ prisma })
  const moduleKey = moduleContext?.moduleKey ?? 'custom.fleet'

  app.get('/fleet/maintenance', requirePermission('fleet.maintenance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listMaintenance({
        companyId,
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        search: c.req.query('search'),
        status: c.req.query('status'),
        vehicleId: c.req.query('vehicle_id'),
        driverId: c.req.query('driver_id'),
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir'),
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo listar el mantenimiento.', route: '/fleet/maintenance', moduleKey, operation: 'listMaintenance' })
    }
  })

  app.post('/fleet/maintenance', requirePermission('fleet.maintenance.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createMaintenanceSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createMaintenance({ companyId, actorId, payload: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear el mantenimiento.', route: '/fleet/maintenance', moduleKey, operation: 'createMaintenance' })
    }
  })

  app.get('/fleet/maintenance/:id', requirePermission('fleet.maintenance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const row = await service.getMaintenance({ companyId, id: c.req.param('id') })
      return c.json({ data: row })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo obtener el mantenimiento.', route: '/fleet/maintenance/:id', moduleKey, operation: 'getMaintenance' })
    }
  })

  app.patch('/fleet/maintenance/:id', requirePermission('fleet.maintenance.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateMaintenanceSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updateMaintenance({ companyId, actorId, id: c.req.param('id'), payload: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el mantenimiento.', route: '/fleet/maintenance/:id', moduleKey, operation: 'updateMaintenance' })
    }
  })

  app.patch('/fleet/maintenance/:id/enabled', requirePermission('fleet.maintenance.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = maintenanceEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.setMaintenanceEnabled({ companyId, actorId, id: c.req.param('id'), enabled: parsed.data.enabled })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el estado del mantenimiento.', route: '/fleet/maintenance/:id/enabled', moduleKey, operation: 'setMaintenanceEnabled' })
    }
  })

  app.get('/fleet/maintenance/:id/documents', requirePermission('fleet.maintenance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listMaintenanceDocuments({ companyId, maintenanceId: c.req.param('id') })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los documentos del mantenimiento.', route: '/fleet/maintenance/:id/documents', moduleKey, operation: 'listMaintenanceDocuments' })
    }
  })

  app.post('/fleet/maintenance/:id/documents', requirePermission('fleet.maintenance.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createDocumentAssociationSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const doc = await service.addMaintenanceDocument({ companyId, actorId, maintenanceId: c.req.param('id'), payload: parsed.data })
      return c.json({ data: doc }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo agregar el documento al mantenimiento.', route: '/fleet/maintenance/:id/documents', moduleKey, operation: 'addMaintenanceDocument' })
    }
  })

  app.delete('/fleet/maintenance/:id/documents/:docId', requirePermission('fleet.maintenance.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const result = await service.removeMaintenanceDocument({ companyId, actorId, maintenanceId: c.req.param('id'), docId: c.req.param('docId') })
      return c.json({ data: result })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo eliminar el documento del mantenimiento.', route: '/fleet/maintenance/:id/documents/:docId', moduleKey, operation: 'removeMaintenanceDocument' })
    }
  })

  return app
}
