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

const driverStatusSchema = z.enum(['active', 'inactive', 'suspended'])

export const createDriverSchema = z.object({
  first_name: z.string().min(1, 'El nombre es requerido.').max(100),
  last_name: z.string().min(1, 'El apellido es requerido.').max(100),
  phone: z.string().min(5, 'El telefono debe tener al menos 5 caracteres.').max(30),
  email: z.string().email('Correo electronico invalido.').nullable().optional(),
  photo_asset_id: z.string().uuid('UUID de foto invalido.').nullable().optional(),
  license_number: z.string().min(1, 'El numero de licencia es requerido.').max(50),
  license_type: z.string().min(1, 'El tipo de licencia es requerido.').max(50),
  license_expiry_date: isoDateSchema,
  status: driverStatusSchema.default('active'),
  notes: z.string().max(5000).nullable().optional(),
})

export const updateDriverSchema = z.object({
  first_name: z.string().min(1).max(100).optional(),
  last_name: z.string().min(1).max(100).optional(),
  phone: z.string().min(5).max(30).optional(),
  email: z.string().email().nullable().optional(),
  photo_asset_id: z.string().uuid().nullable().optional(),
  license_number: z.string().min(1).max(50).optional(),
  license_type: z.string().min(1).max(50).optional(),
  license_expiry_date: isoDateSchema.optional(),
  status: driverStatusSchema.optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export const createDocumentAssociationSchema = z.object({
  file_asset_id: z.string().uuid('UUID de archivo invalido.'),
  document_type: z.string().max(50).optional(),
  label: z.string().max(200).nullable().optional(),
})
