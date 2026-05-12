import { z } from '../../../../apps/api/node_modules/zod/index.js'

const HEX_COLOR_REGEX = /^#[0-9a-fA-F]{3,8}$/
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

const vehicleStatusSchema = z.enum(['active', 'maintenance', 'inactive', 'retired'])
const maintenanceTypeSchema = z.enum(['preventive', 'corrective', 'inspection'])

function isValidIsoDate(value) {
  if (!ISO_DATE_REGEX.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return false
  return date.toISOString().slice(0, 10) === value
}

const isoDateSchema = z.string().refine(isValidIsoDate, {
  message: 'Debe ser una fecha ISO valida (YYYY-MM-DD).',
})

export const createVehicleSchema = z.object({
  plate: z.string().min(1).max(20),
  brand: z.string().min(1).max(100),
  model_name: z.string().min(1).max(100),
  year: z.number().int().min(1900).max(2100),
  status: vehicleStatusSchema.default('active'),
  color: z.string().regex(HEX_COLOR_REGEX, 'Color hexadecimal invalido.').optional(),
  driver_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
})

export const updateVehicleSchema = z.object({
  plate: z.string().min(1).max(20).optional(),
  brand: z.string().min(1).max(100).optional(),
  model_name: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  status: vehicleStatusSchema.optional(),
  color: z.string().regex(HEX_COLOR_REGEX, 'Color hexadecimal invalido.').optional(),
  driver_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
})

export const createMaintenanceSchema = z.object({
  vehicle_id: z.string().uuid(),
  type: maintenanceTypeSchema,
  description: z.string().min(1).max(5000),
  scheduled_date: isoDateSchema,
  completed_date: isoDateSchema.nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
})

export const updateMaintenanceSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  type: maintenanceTypeSchema.optional(),
  description: z.string().min(1).max(5000).optional(),
  scheduled_date: isoDateSchema.optional(),
  completed_date: isoDateSchema.nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
})
