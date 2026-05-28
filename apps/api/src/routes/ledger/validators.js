import { z } from 'zod'

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidIsoDate(value) {
  if (!ISO_DATE_REGEX.test(value)) return false
  const d = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) return false
  return d.toISOString().slice(0, 10) === value
}

const isoDateSchema = z.string().refine(isValidIsoDate, {
  message: 'Debe ser una fecha ISO valida (YYYY-MM-DD).',
})

// ── Accounts ──────────────────────────────────────────────────────────────────

export const createAccountSchema = z.object({
  name:            z.string().min(1).max(255),
  bank:            z.string().min(1).max(255),
  account_number:  z.string().max(64).optional().nullable(),
  currency:        z.enum(['MXN', 'USD']).default('MXN'),
  opening_balance: z.number().default(0),
})

export const updateAccountSchema = createAccountSchema.partial()

// ── Transaction types ─────────────────────────────────────────────────────────

export const createTypeSchema = z.object({
  code: z.string().min(1).max(32),
  name: z.string().min(1).max(128),
})

export const updateTypeSchema = createTypeSchema.partial()

// ── Categories ────────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name:  z.string().min(1).max(128),
  color: z.string().max(32).optional().nullable(),
  kind:  z.enum(['income', 'expense', 'both']).default('both'),
})

export const updateCategorySchema = createCategorySchema.partial()

// ── Transactions ──────────────────────────────────────────────────────────────

export const createTransactionSchema = z.object({
  fecha:       isoDateSchema,
  tipo_id:     z.string().uuid().optional().nullable(),
  numero:      z.string().max(64).optional().nullable(),
  nombre:      z.string().min(1).max(255),
  referencia:  z.string().max(255).optional().nullable(),
  concepto:    z.string().max(512).optional().nullable(),
  deposito:    z.number().min(0).optional().nullable(),
  retiro:      z.number().min(0).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
}).refine(
  (d) => (d.deposito != null && d.deposito > 0) || (d.retiro != null && d.retiro > 0),
  { message: 'Se requiere deposito o retiro mayor a cero.' }
)

export const updateTransactionSchema = z.object({
  fecha:       isoDateSchema.optional(),
  tipo_id:     z.string().uuid().optional().nullable(),
  numero:      z.string().max(64).optional().nullable(),
  nombre:      z.string().min(1).max(255).optional(),
  referencia:  z.string().max(255).optional().nullable(),
  concepto:    z.string().max(512).optional().nullable(),
  deposito:    z.number().min(0).optional().nullable(),
  retiro:      z.number().min(0).optional().nullable(),
  category_id: z.string().uuid().optional().nullable(),
})

export const enabledSchema = z.object({ enabled: z.boolean() })
