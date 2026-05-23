import { z } from '../../../../apps/api/node_modules/zod/index.js'

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

const ECON_NUM_REGEX = /^[0-9]{1,4}$/

export const createVehicleSchema = z.object({
  plate: z.string().min(1).max(20),
  brand: z.string().min(1).max(100).optional(),
  model_name: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  status: vehicleStatusSchema.default('active'),
  color: z.string().min(1).max(100).optional(),
  driver_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
  economic_group_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
  economic_individual_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
  vehicle_type_id: z.string().uuid().nullable().optional(),
  vehicle_brand_id: z.string().uuid().nullable().optional(),
  vehicle_model_id: z.string().uuid().nullable().optional(),
})

export const updateVehicleSchema = z.object({
  plate: z.string().min(1).max(20).optional(),
  brand: z.string().min(1).max(100).optional(),
  model_name: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  status: vehicleStatusSchema.optional(),
  color: z.string().min(1).max(100).optional(),
  driver_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(5000).optional(),
  economic_group_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
  economic_individual_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
  vehicle_type_id: z.string().uuid().nullable().optional(),
  vehicle_brand_id: z.string().uuid().nullable().optional(),
  vehicle_model_id: z.string().uuid().nullable().optional(),
})

const maintenanceStatusSchema = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled'])
const isoDateTimeSchema = z.string().refine(
  (v) => !Number.isNaN(new Date(v).getTime()),
  { message: 'Debe ser una fecha y hora ISO valida.' }
)

export const createMaintenanceSchema = z.object({
  vehicle_id: z.string().uuid(),
  type: maintenanceTypeSchema,
  description: z.string().min(1).max(5000),
  scheduled_date: isoDateSchema,
  completed_date: isoDateSchema.nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
  // V003 expansion fields (all optional for backward compat)
  maintenance_type_id: z.string().uuid().nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  status: maintenanceStatusSchema.default('scheduled'),
  driver_id: z.string().uuid().nullable().optional(),
  started_at: isoDateTimeSchema.nullable().optional(),
  odometer_km: z.number().int().min(0).nullable().optional(),
  provider: z.string().max(200).nullable().optional(),
  currency: z.string().max(10).optional(),
})

export const updateMaintenanceSchema = z.object({
  vehicle_id: z.string().uuid().optional(),
  type: maintenanceTypeSchema.optional(),
  description: z.string().min(1).max(5000).optional(),
  scheduled_date: isoDateSchema.optional(),
  completed_date: isoDateSchema.nullable().optional(),
  cost: z.number().min(0).nullable().optional(),
  notes: z.string().optional(),
  // V003 expansion fields
  maintenance_type_id: z.string().uuid().nullable().optional(),
  title: z.string().max(255).nullable().optional(),
  status: maintenanceStatusSchema.optional(),
  driver_id: z.string().uuid().nullable().optional(),
  started_at: isoDateTimeSchema.nullable().optional(),
  odometer_km: z.number().int().min(0).nullable().optional(),
  provider: z.string().max(200).nullable().optional(),
  currency: z.string().max(10).optional(),
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
  file_asset_id: z.string().min(1, 'ID de archivo invalido.'),
  document_type: z.string().max(50).optional(),
  label: z.string().max(200).nullable().optional(),
})

export const createVehicleTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  economic_group_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
})

export const updateVehicleTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  economic_group_number: z.string().regex(ECON_NUM_REGEX, 'Maximo 4 digitos numericos.').nullable().optional(),
})

export const createVehicleModelSchema = z.object({
  brand_id: z.string().uuid(),
  type_id: z.string().uuid(),
  name: z.string().min(1).max(150),
  year: z.number().int().min(1900).max(2100),
})

export const updateVehicleModelSchema = z.object({
  brand_id: z.string().uuid().optional(),
  type_id: z.string().uuid().optional(),
  name: z.string().min(1).max(150).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})

export const createVehicleBrandSchema = z.object({
  name: z.string().min(1).max(100),
})

export const updateVehicleBrandSchema = z.object({
  name: z.string().min(1).max(100).optional(),
})

export const createMaintenanceTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const updateMaintenanceTypeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

const reportTypeSchema = z.enum(['maintenance', 'service', 'repair', 'other'])
const reportStatusSchema = z.enum(['draft', 'finalized'])
const maintenanceSubtypeSchema = z.enum(['preventive', 'corrective', 'inspection', 'alignment', 'oil_change', 'tire_service', 'other'])
const serviceSubtypeSchema = z.enum(['general', 'diagnostic', 'cleaning', 'electrical', 'other'])
const repairPrioritySchema = z.enum(['low', 'normal', 'high', 'urgent'])
const repairDamageTypeSchema = z.enum(['mechanical', 'electrical', 'body', 'interior', 'other'])

const reportPartSchema = z.object({
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1),
  unit_cost: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
})

export const createReportSchema = z.object({
  report_type: reportTypeSchema,
  vehicle_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  report_date: isoDateSchema,
  status: reportStatusSchema.default('draft'),
  odometer_km: z.number().int().min(0).nullable().optional(),
  workshop_name: z.string().max(200).nullable().optional(),
  workshop_phone: z.string().max(50).nullable().optional(),
  workshop_address: z.string().max(300).nullable().optional(),
  invoice_number: z.string().max(80).nullable().optional(),
  labor_cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  parts: z.array(reportPartSchema).optional(),
  maintenance_subtype: maintenanceSubtypeSchema.nullable().optional(),
  next_service_date: isoDateSchema.nullable().optional(),
  next_service_odometer: z.number().int().min(0).nullable().optional(),
  service_subtype: serviceSubtypeSchema.nullable().optional(),
  repair_priority: repairPrioritySchema.nullable().optional(),
  repair_damage_type: repairDamageTypeSchema.nullable().optional(),
  repair_start_date: isoDateSchema.nullable().optional(),
  repair_completion_date: isoDateSchema.nullable().optional(),
  repair_estimated_cost: z.number().min(0).nullable().optional(),
  warranty_days: z.number().int().min(0).nullable().optional(),
  warranty_notes: z.string().max(1000).nullable().optional(),
  other_category_label: z.string().max(120).nullable().optional(),
}).superRefine((value, ctx) => {
  if (value.report_type === 'maintenance') {
    if (!value.maintenance_subtype) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['maintenance_subtype'], message: 'Subtipo requerido para mantenimiento.' })
    }
    if (!value.next_service_date && !value.next_service_odometer) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['next_service_date'], message: 'Indica fecha o kilometraje para proximo servicio.' })
    }
  }

  if (value.report_type === 'service') {
    if (!value.service_subtype) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['service_subtype'], message: 'Subtipo requerido para servicio.' })
    }
    if (!value.invoice_number) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['invoice_number'], message: 'Factura/ticket requerido para servicio.' })
    }
  }

  if (value.report_type === 'repair') {
    if (!value.repair_priority) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repair_priority'], message: 'Prioridad requerida para reparacion.' })
    }
    if (!value.repair_damage_type) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repair_damage_type'], message: 'Tipo de dano requerido para reparacion.' })
    }
    if (!value.repair_start_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repair_start_date'], message: 'Fecha de inicio requerida para reparacion.' })
    }
    if (value.repair_start_date && value.repair_completion_date && value.repair_completion_date < value.repair_start_date) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['repair_completion_date'], message: 'La fecha de fin no puede ser menor a la fecha de inicio.' })
    }
  }

  if (value.report_type === 'other' && !value.other_category_label) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['other_category_label'], message: 'Categoria personalizada requerida.' })
  }
})

export const updateReportSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  report_date: isoDateSchema.optional(),
  status: reportStatusSchema.optional(),
  odometer_km: z.number().int().min(0).nullable().optional(),
  workshop_name: z.string().max(200).nullable().optional(),
  workshop_phone: z.string().max(50).nullable().optional(),
  workshop_address: z.string().max(300).nullable().optional(),
  invoice_number: z.string().max(80).nullable().optional(),
  labor_cost: z.number().min(0).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  parts: z.array(reportPartSchema).optional(),
  maintenance_subtype: maintenanceSubtypeSchema.nullable().optional(),
  next_service_date: isoDateSchema.nullable().optional(),
  next_service_odometer: z.number().int().min(0).nullable().optional(),
  service_subtype: serviceSubtypeSchema.nullable().optional(),
  repair_priority: repairPrioritySchema.nullable().optional(),
  repair_damage_type: repairDamageTypeSchema.nullable().optional(),
  repair_start_date: isoDateSchema.nullable().optional(),
  repair_completion_date: isoDateSchema.nullable().optional(),
  repair_estimated_cost: z.number().min(0).nullable().optional(),
  warranty_days: z.number().int().min(0).nullable().optional(),
  warranty_notes: z.string().max(1000).nullable().optional(),
  other_category_label: z.string().max(120).nullable().optional(),
})
