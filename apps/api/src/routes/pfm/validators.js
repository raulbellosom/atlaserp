// apps/api/src/routes/pfm/validators.js
import { z } from "zod";

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (!ISO_DATE_REGEX.test(value)) return false;
  const d = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export const isoDateSchema = z.string().refine(isValidIsoDate, {
  message: "Debe ser una fecha ISO valida (YYYY-MM-DD).",
});

// ── Wallets ──────────────────────────────────────────────────────────────────

export const createWalletSchema = z.object({
  name: z.string().min(1).max(120),
  kind: z.enum(["CASH", "DEBIT", "CREDIT"]),
  currency: z.enum(["MXN", "USD"]).default("MXN"),
  openingBalance: z.number().default(0),
  color: z.string().max(32).optional().nullable(),
  icon: z.string().max(48).optional().nullable(),
  ledgerAccountId: z.string().uuid().optional().nullable(),
  reference: z.string().max(40).optional().nullable(),
  creditLimit: z.number().positive().max(9_999_999_999).optional().nullable(),
  statementDay: z.number().int().min(1).max(31).optional().nullable(),
  paymentDueDay: z.number().int().min(1).max(31).optional().nullable(),
  openingUsed: z.number().min(0).max(9_999_999_999).optional().nullable(),
});

export const updateWalletSchema = createWalletSchema
  .partial()
  .omit({ ledgerAccountId: true, openingUsed: true })
  .extend({
    ledgerAccountId: z.string().uuid().nullable().optional(),
  });

export const enabledSchema = z.object({ enabled: z.boolean() });

// ── Wallet members ───────────────────────────────────────────────────────────

export const upsertWalletMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.enum(["VIEWER", "EDITOR"]),
});

// ── Categories ───────────────────────────────────────────────────────────────

export const createCategorySchema = z.object({
  name: z.string().min(1).max(80),
  kind: z.enum(["EXPENSE", "INCOME"]),
  color: z.string().max(32).optional().nullable(),
  icon: z.string().max(48).optional().nullable(),
  parentId: z.string().uuid().optional().nullable(),
});

export const updateCategorySchema = createCategorySchema.partial();

// ── Movements (Plan A2) ──────────────────────────────────────────────────────

export const createMovementSchema = z.object({
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive().max(9_999_999_999),
  occurredOn: isoDateSchema,
  categoryId: z.string().uuid().optional().nullable(),
  note: z.string().max(500).optional().nullable(),
  merchant: z.string().max(160).optional().nullable(),
  receiptId: z.string().uuid().optional().nullable(),
  status: z.enum(["PENDING", "POSTED"]).default("POSTED"),
});

export const updateMovementSchema = createMovementSchema.partial();

export const confirmMovementSchema = z.object({
  amount: z.number().positive().max(9_999_999_999).optional(),
});

export const listMovementsQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  categoryId: z.string().uuid().optional(),
  search: z.string().max(160).optional(),
  status: z.enum(["PENDING", "POSTED", "SKIPPED"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(100),
  cursor: z.string().optional(),
});

export const enrichLedgerMovementSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  receiptId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});

// ── Recurring rules (Phase 2) ────────────────────────────────────────────────

export const rruleSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]),
  interval: z.number().int().min(1).max(60).default(1),
  byMonthDay: z.number().int().min(1).max(31).optional(),
});

export const createRecurringRuleSchema = z
  .object({
    walletId: z.string().uuid(),
    label: z.string().min(1).max(120),
    categoryId: z.string().uuid().optional().nullable(),
    direction: z.enum(["EXPENSE", "INCOME"]),
    amountMode: z.enum(["FIXED", "VARIABLE"]),
    amount: z.number().positive().max(9_999_999_999).optional().nullable(),
    rrule: rruleSchema,
    autoPost: z.boolean().default(false),
    startOn: isoDateSchema,
    endOn: isoDateSchema.optional().nullable(),
  })
  .refine((v) => v.amountMode !== "FIXED" || (v.amount != null && v.amount > 0), {
    message: "Un cargo de monto fijo requiere un monto.",
    path: ["amount"],
  })
  .refine((v) => v.amountMode === "FIXED" || v.autoPost !== true, {
    message: "Solo los cargos de monto fijo pueden registrarse automaticamente.",
    path: ["autoPost"],
  });

export const updateRecurringRuleSchema = z.object({
  label: z.string().min(1).max(120).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.number().positive().max(9_999_999_999).nullable().optional(),
  rrule: rruleSchema.optional(),
  autoPost: z.boolean().optional(),
  endOn: isoDateSchema.nullable().optional(),
});

// ── Receipts (Phase 3) ───────────────────────────────────────────────────────

export const confirmReceiptSchema = z.object({
  walletId: z.string().uuid(),
  direction: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive().max(9_999_999_999),
  occurredOn: isoDateSchema,
  categoryId: z.string().uuid().optional().nullable(),
  merchant: z.string().max(160).optional().nullable(),
  note: z.string().max(500).optional().nullable(),
});

// ── Budgets & goals (Phase 4) ────────────────────────────────────────────────

export const createBudgetSchema = z.object({
  categoryId: z.string().uuid(),
  walletId: z.string().uuid().optional().nullable(),
  amount: z.number().positive().max(9_999_999_999),
  alertThreshold: z.number().min(0.1).max(1).default(0.8),
});

export const updateBudgetSchema = z.object({
  amount: z.number().positive().max(9_999_999_999).optional(),
  alertThreshold: z.number().min(0.1).max(1).optional(),
});

export const createGoalSchema = z.object({
  name: z.string().min(1).max(120),
  targetAmount: z.number().positive().max(9_999_999_999),
  targetDate: isoDateSchema.optional().nullable(),
  walletId: z.string().uuid().optional().nullable(),
  color: z.string().max(32).optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const contributeGoalSchema = z.object({
  amount: z.number().refine((n) => n !== 0, "El monto no puede ser cero"),
});

export const adjustBalanceSchema = z.object({
  targetBalance: z.number().max(9_999_999_999),
  note: z.string().max(500).optional().nullable(),
  occurredOn: isoDateSchema.optional(),
});
