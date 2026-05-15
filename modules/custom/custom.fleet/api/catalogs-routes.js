import { Hono } from 'hono'
import { z } from 'zod'
import {
  createVehicleTypeSchema,
  updateVehicleTypeSchema,
  createVehicleBrandSchema,
  updateVehicleBrandSchema,
  createMaintenanceTypeSchema,
  updateMaintenanceTypeSchema,
} from '../validators/index.js'
import { createCatalogService } from './catalog-service.js'
import { FleetServiceError } from './fleet-service.js'

const catalogEnabledSchema = z.object({ enabled: z.boolean() })

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

export function createCatalogsRouter({ prisma, requirePermission, moduleContext }) {
  const app = new Hono()
  const service = createCatalogService({ prisma })
  const moduleKey = moduleContext?.moduleKey ?? 'custom.fleet'

  // ── Vehicle Types ─────────────────────────────────────────────────────────

  app.get('/fleet/catalogs/vehicle-types', requirePermission('fleet.catalogs.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listVehicleTypes({
        companyId,
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        search: c.req.query('search'),
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir'),
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los tipos de vehiculo.', route: '/fleet/catalogs/vehicle-types', moduleKey, operation: 'listVehicleTypes' })
    }
  })

  app.post('/fleet/catalogs/vehicle-types', requirePermission('fleet.catalogs.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createVehicleTypeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createVehicleType({ companyId, actorId, payload: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear el tipo de vehiculo.', route: '/fleet/catalogs/vehicle-types', moduleKey, operation: 'createVehicleType' })
    }
  })

  app.patch('/fleet/catalogs/vehicle-types/:id', requirePermission('fleet.catalogs.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateVehicleTypeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updateVehicleType({ companyId, actorId, id: c.req.param('id'), payload: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el tipo de vehiculo.', route: '/fleet/catalogs/vehicle-types/:id', moduleKey, operation: 'updateVehicleType' })
    }
  })

  app.patch('/fleet/catalogs/vehicle-types/:id/enabled', requirePermission('fleet.catalogs.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = catalogEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.setVehicleTypeEnabled({ companyId, actorId, id: c.req.param('id'), enabled: parsed.data.enabled })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el estado del tipo de vehiculo.', route: '/fleet/catalogs/vehicle-types/:id/enabled', moduleKey, operation: 'setVehicleTypeEnabled' })
    }
  })

  // ── Vehicle Brands ────────────────────────────────────────────────────────

  app.get('/fleet/catalogs/vehicle-brands', requirePermission('fleet.catalogs.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listVehicleBrands({
        companyId,
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        search: c.req.query('search'),
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir'),
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar las marcas de vehiculo.', route: '/fleet/catalogs/vehicle-brands', moduleKey, operation: 'listVehicleBrands' })
    }
  })

  app.post('/fleet/catalogs/vehicle-brands', requirePermission('fleet.catalogs.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createVehicleBrandSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createVehicleBrand({ companyId, actorId, payload: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear la marca de vehiculo.', route: '/fleet/catalogs/vehicle-brands', moduleKey, operation: 'createVehicleBrand' })
    }
  })

  app.patch('/fleet/catalogs/vehicle-brands/:id', requirePermission('fleet.catalogs.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateVehicleBrandSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updateVehicleBrand({ companyId, actorId, id: c.req.param('id'), payload: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar la marca de vehiculo.', route: '/fleet/catalogs/vehicle-brands/:id', moduleKey, operation: 'updateVehicleBrand' })
    }
  })

  app.patch('/fleet/catalogs/vehicle-brands/:id/enabled', requirePermission('fleet.catalogs.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = catalogEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.setVehicleBrandEnabled({ companyId, actorId, id: c.req.param('id'), enabled: parsed.data.enabled })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el estado de la marca de vehiculo.', route: '/fleet/catalogs/vehicle-brands/:id/enabled', moduleKey, operation: 'setVehicleBrandEnabled' })
    }
  })

  // ── Maintenance Types ─────────────────────────────────────────────────────

  app.get('/fleet/catalogs/maintenance-types', requirePermission('fleet.catalogs.read'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const result = await service.listMaintenanceTypes({
        companyId,
        page: c.req.query('page'),
        pageSize: c.req.query('pageSize'),
        search: c.req.query('search'),
        sortBy: c.req.query('sortBy'),
        sortDir: c.req.query('sortDir'),
      })
      return c.json(result)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron listar los tipos de mantenimiento.', route: '/fleet/catalogs/maintenance-types', moduleKey, operation: 'listMaintenanceTypes' })
    }
  })

  app.post('/fleet/catalogs/maintenance-types/seed', requirePermission('fleet.catalogs.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const result = await service.seedMaintenanceTypes({ companyId, actorId })
      return c.json({ data: result }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudieron sembrar los tipos de mantenimiento.', route: '/fleet/catalogs/maintenance-types/seed', moduleKey, operation: 'seedMaintenanceTypes' })
    }
  })

  app.post('/fleet/catalogs/maintenance-types', requirePermission('fleet.catalogs.create'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = createMaintenanceTypeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const created = await service.createMaintenanceType({ companyId, actorId, payload: parsed.data })
      return c.json({ data: created }, 201)
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo crear el tipo de mantenimiento.', route: '/fleet/catalogs/maintenance-types', moduleKey, operation: 'createMaintenanceType' })
    }
  })

  app.patch('/fleet/catalogs/maintenance-types/:id', requirePermission('fleet.catalogs.update'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = updateMaintenanceTypeSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.updateMaintenanceType({ companyId, actorId, id: c.req.param('id'), payload: parsed.data })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el tipo de mantenimiento.', route: '/fleet/catalogs/maintenance-types/:id', moduleKey, operation: 'updateMaintenanceType' })
    }
  })

  app.patch('/fleet/catalogs/maintenance-types/:id/enabled', requirePermission('fleet.catalogs.delete'), async (c) => {
    try {
      const companyId = getCompanyIdFromContext(c)
      const actorId = getActorIdFromContext(c)
      const body = await c.req.json()
      const parsed = catalogEnabledSchema.safeParse(body)
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400)
      const updated = await service.setMaintenanceTypeEnabled({ companyId, actorId, id: c.req.param('id'), enabled: parsed.data.enabled })
      return c.json({ data: updated })
    } catch (err) {
      return handleRouteError(c, err, { fallbackError: 'No se pudo actualizar el estado del tipo de mantenimiento.', route: '/fleet/catalogs/maintenance-types/:id/enabled', moduleKey, operation: 'setMaintenanceTypeEnabled' })
    }
  })

  return app
}
