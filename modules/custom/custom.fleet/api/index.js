import { Hono } from 'hono'
import { z } from 'zod'
import {
  createVehicleSchema,
  updateVehicleSchema,
  createMaintenanceSchema,
  updateMaintenanceSchema,
} from '../validators/index.js'
import { createFleetService, FleetServiceError } from './fleet-service.js'

const vehicleEnabledSchema = z.object({
  enabled: z.boolean(),
})

const maintenanceEnabledSchema = z.object({
  enabled: z.boolean(),
})

const vehicleStatusFilterSchema = z.enum(['active', 'maintenance', 'inactive', 'retired'])

function getValidationErrorMessage(error) {
  const issue = error?.issues?.[0]
  if (!issue) return 'Datos invalidos.'
  const path = Array.isArray(issue.path) && issue.path.length > 0 ? issue.path.join('.') : null
  if (!path) return `Datos invalidos: ${issue.message}`
  return `Datos invalidos en ${path}: ${issue.message}`
}

function getCompanyIdFromContext(c) {
  const companyId = c.get('userContext')?.memberships?.[0]?.companyId
  if (typeof companyId === 'string' && companyId.trim()) return companyId.trim()
  return null
}

function getActorIdFromContext(c) {
  const actorId = c.get('userContext')?.profile?.id
  if (typeof actorId === 'string' && actorId.trim()) return actorId.trim()
  return null
}

function handleRouteError(c, err, fallbackError) {
  if (err instanceof FleetServiceError) {
    return c.json({ error: err.message }, err.status)
  }
  console.error('[custom.fleet] route error:', err)
  return c.json({ error: fallbackError }, 500)
}

export default function createFleetRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  const service = createFleetService({ prisma })
  const moduleKey = moduleContext?.moduleKey ?? 'custom.fleet'

  app.get('/fleet/vehicles', requirePermission('fleet.vehicles.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const page = c.req.query('page')
      const pageSize = c.req.query('pageSize')
      const search = c.req.query('search')
      const rawStatus = c.req.query('status')
      let status = null
      if (rawStatus !== undefined) {
        const parsedStatus = vehicleStatusFilterSchema.safeParse(rawStatus)
        if (!parsedStatus.success) {
          return c.json({ error: getValidationErrorMessage(parsedStatus.error) }, 400)
        }
        status = parsedStatus.data
      }

      const result = await service.listVehicles({
        companyId,
        page,
        pageSize,
        status,
        search,
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, `No se pudieron listar los vehiculos de ${moduleKey}.`)
    }
  })

  app.post('/fleet/vehicles', requirePermission('fleet.vehicles.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createVehicleSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const created = await service.createVehicle({
        companyId,
        data: parsed.data,
        actorId,
      })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, `No se pudo crear el vehiculo de ${moduleKey}.`)
    }
  })

  app.get('/fleet/vehicles/:id', requirePermission('fleet.vehicles.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const id = c.req.param('id')
      const row = await service.getVehicle({ companyId, id })
      return c.json({ data: row })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo obtener el vehiculo de ${moduleKey}.`)
    }
  })

  app.patch('/fleet/vehicles/:id', requirePermission('fleet.vehicles.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = updateVehicleSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const updated = await service.updateVehicle({
        companyId,
        id,
        data: parsed.data,
        actorId,
      })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo actualizar el vehiculo de ${moduleKey}.`)
    }
  })

  app.patch('/fleet/vehicles/:id/enabled', requirePermission('fleet.vehicles.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = vehicleEnabledSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const updated = await service.setVehicleEnabled({
        companyId,
        id,
        enabled: parsed.data.enabled,
        actorId,
      })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo actualizar el estado del vehiculo de ${moduleKey}.`)
    }
  })

  app.get('/fleet/maintenance', requirePermission('fleet.maintenance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const vehicleId = c.req.query('vehicle_id')
      const page = c.req.query('page')
      const pageSize = c.req.query('pageSize')

      const result = await service.listMaintenance({
        companyId,
        vehicleId,
        page,
        pageSize,
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, `No se pudo listar el mantenimiento de ${moduleKey}.`)
    }
  })

  app.post('/fleet/maintenance', requirePermission('fleet.maintenance.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createMaintenanceSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const created = await service.createMaintenance({
        companyId,
        data: parsed.data,
        actorId,
      })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, `No se pudo crear el mantenimiento de ${moduleKey}.`)
    }
  })

  app.get('/fleet/maintenance/:id', requirePermission('fleet.maintenance.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const id = c.req.param('id')
      const row = await service.getMaintenance({ companyId, id })
      return c.json({ data: row })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo obtener el mantenimiento de ${moduleKey}.`)
    }
  })

  app.patch('/fleet/maintenance/:id', requirePermission('fleet.maintenance.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = updateMaintenanceSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const updated = await service.updateMaintenance({
        companyId,
        id,
        data: parsed.data,
        actorId,
      })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo actualizar el mantenimiento de ${moduleKey}.`)
    }
  })

  app.patch('/fleet/maintenance/:id/enabled', requirePermission('fleet.maintenance.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const id = c.req.param('id')
      const body = await c.req.json()
      const parsed = maintenanceEnabledSchema.safeParse(body)
      if (!parsed.success) {
        return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      }

      const updated = await service.setMaintenanceEnabled({
        companyId,
        id,
        enabled: parsed.data.enabled,
        actorId,
      })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, `No se pudo actualizar el estado del mantenimiento de ${moduleKey}.`)
    }
  })

  return app
}
