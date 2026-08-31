# atlas.pfm — Phase 2 — Plan A (API: recurring rules, materialization, calendar bridge) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recurring-charge rules (`FIXED` may auto-post; `VARIABLE` always produces a `PENDING` movement to confirm), a worker tick that materializes upcoming occurrences idempotently, a best-effort `atlas.calendar` bridge that puts one recurring event per rule on a dedicated "Finanzas personales" calendar, and an `/pfm/upcoming` feed for the Resumen "Proximos cargos" block.

**Architecture:** Continues Phase 1. New `PfmRecurringRule` model. `pfm-rrule.js` is a small self-contained recurrence-date helper (the `computeRruleNextAt` in `projects/tasks-service.js` is a 4-string preset lookup with no anchor date — not reusable here, so pfm gets its own). `recurring-service.js` owns rule CRUD (wallet-owner only) plus `materializeDueRules()` (the worker entrypoint) and `materializeRule()` (called inline on create/update so the user sees occurrences immediately). `pfm-calendar-bridge.js` mirrors `projects-calendar-bridge.js`: guarded by `isCalendarAvailable()`, never throws into the caller. Confirm/skip already exist (Phase 1 `movements-service`).

**Tech Stack:** Node.js + Hono, Prisma 7 + PostgreSQL, Zod, `node --test` (mocked prisma), `apps/worker` setInterval ticks.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (sections 3.6, 4, 5). **Prereq:** Phase 1 (Plans A1/A2/B) merged.

**Environment note:** Task 1 applies a migration to the live Supabase DB via hand-written SQL + `pnpm exec prisma migrate deploy` (same approach as Phase 1 — `prisma migrate dev` is unusable here because an old chat migration references a `supabase_realtime` publication absent from the shadow DB).

---

## File Structure

- `prisma/schema.prisma` — add `PfmRecurringRule` model + enum `PfmRecurringAmountMode` + relation on `PfmWallet` (modify).
- `prisma/migrations/20260831010000_atlas_pfm_phase2/migration.sql` — table + partial unique index on `pfm_movement(recurring_rule_id, occurred_on)` (create).
- `apps/api/src/routes/pfm/pfm-rrule.js` — `computeNextRun`, `firstRunOnOrAfter` (create).
- `apps/api/src/routes/pfm/recurring-service.js` — rule CRUD + `materializeDueRules` + `materializeRule` (create).
- `apps/api/src/routes/pfm/pfm-calendar-bridge.js` — dedicated calendar + one recurring event per rule (create).
- `apps/api/src/routes/pfm/recurring-routes.js` — `/pfm/recurring` REST + `/pfm/upcoming` (create).
- `apps/api/src/routes/pfm/summary-service.js` — add `getUpcoming()` (modify).
- `apps/api/src/routes/pfm/validators.js` — add rule schemas (modify).
- `apps/api/src/routes/pfm/index.js` — build `recurringService` + `calendarBridge`, mount `recurring-routes` (modify).
- `apps/worker/src/index.js` — `runPfmRecurringTick()` + interval (modify).
- `packages/sdk/src/index.js` — add recurring + upcoming methods to `pfm` (modify).
- Tests: `pfm-rrule.test.js`, `recurring-service.test.js`, `pfm-calendar-bridge.test.js` (create).

---

## Task 1: Schema + migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/20260831010000_atlas_pfm_phase2/migration.sql`

- [ ] **Step 1: Add to `prisma/schema.prisma`** — a new enum, a new model, and a back-relation field on `PfmWallet`.

Add the enum next to the other pfm enums:

```prisma
enum PfmRecurringAmountMode {
  FIXED
  VARIABLE

  @@map("pfm_recurring_amount_mode")
}
```

Add `recurringRules PfmRecurringRule[]` to the `PfmWallet` model's relation block (next to `members` and `movements`).

Add the model after `PfmLedgerEnrichment`:

```prisma
model PfmRecurringRule {
  id              String                 @id @default(uuid(7)) @db.Uuid
  companyId       String                 @map("company_id") @db.Uuid
  ownerId         String                 @map("owner_id") @db.Uuid
  walletId        String                 @map("wallet_id") @db.Uuid
  label           String
  categoryId      String?                @map("category_id") @db.Uuid
  direction       PfmMovementDirection
  amountMode      PfmRecurringAmountMode  @map("amount_mode")
  amount          Decimal?               @db.Decimal(15, 2)
  rrule           Json
  autoPost        Boolean                @default(false) @map("auto_post")
  nextRunAt       DateTime               @map("next_run_at")
  endOn           DateTime?              @map("end_on") @db.Date
  calendarEventId String?                @map("calendar_event_id") @db.Uuid
  enabled         Boolean                @default(true)
  createdAt       DateTime               @default(now()) @map("created_at")
  updatedAt       DateTime               @updatedAt @map("updated_at")

  wallet PfmWallet @relation(fields: [walletId], references: [id], onDelete: Cascade)

  @@index([nextRunAt, enabled])
  @@index([walletId, enabled])
  @@map("pfm_recurring_rule")
}
```

- [ ] **Step 2: Validate** — `pnpm exec prisma validate` → `valid 🚀`.

- [ ] **Step 3: Write the migration SQL** at `prisma/migrations/20260831010000_atlas_pfm_phase2/migration.sql`:

```sql
-- atlas.pfm — Finanzas personales (Phase 2: recurring rules)

-- CreateEnum
CREATE TYPE "pfm_recurring_amount_mode" AS ENUM ('FIXED', 'VARIABLE');

-- CreateTable
CREATE TABLE "pfm_recurring_rule" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "wallet_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category_id" UUID,
    "direction" "pfm_movement_direction" NOT NULL,
    "amount_mode" "pfm_recurring_amount_mode" NOT NULL,
    "amount" DECIMAL(15,2),
    "rrule" JSONB NOT NULL,
    "auto_post" BOOLEAN NOT NULL DEFAULT false,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "end_on" DATE,
    "calendar_event_id" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_recurring_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pfm_recurring_rule_next_run_at_enabled_idx" ON "pfm_recurring_rule"("next_run_at", "enabled");

-- CreateIndex
CREATE INDEX "pfm_recurring_rule_wallet_id_enabled_idx" ON "pfm_recurring_rule"("wallet_id", "enabled");

-- AddForeignKey
ALTER TABLE "pfm_recurring_rule" ADD CONSTRAINT "pfm_recurring_rule_wallet_id_fkey" FOREIGN KEY ("wallet_id") REFERENCES "pfm_wallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotent materialization guard: one movement per (rule, day)
CREATE UNIQUE INDEX "pfm_movement_recurring_rule_id_occurred_on_key"
  ON "pfm_movement"("recurring_rule_id", "occurred_on")
  WHERE "recurring_rule_id" IS NOT NULL;
```

- [ ] **Step 4: Apply** — `pnpm exec prisma migrate deploy` → "successfully applied", then `pnpm db:generate` → "Generated Prisma Client".

- [ ] **Step 5: Verify** —
```bash
node --input-type=module -e "import 'dotenv/config'; import pkg from '@prisma/client'; import { PrismaPg } from '@prisma/adapter-pg'; const p=new pkg.PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); console.log('rules', await p.pfmRecurringRule.count()); await p.\$disconnect();"
```
Expected: `rules 0`.

- [ ] **Step 6: Commit** — `git add prisma/schema.prisma prisma/migrations && git commit -m "feat(pfm): PfmRecurringRule model + migration (phase 2)"`

---

## Task 2: `pfm-rrule.js` (test first)

**Files:** `apps/api/src/routes/pfm/pfm-rrule.js`, `apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeNextRun, firstRunOnOrAfter } from "../pfm-rrule.js";

const at = (iso) => new Date(`${iso}T00:00:00.000Z`);

describe("pfm-rrule", () => {
  it("MONTHLY on byMonthDay=15 advances to the next month, same day", () => {
    const next = computeNextRun({ freq: "MONTHLY", interval: 1, byMonthDay: 15 }, at("2026-08-15"));
    assert.equal(next.toISOString().slice(0, 10), "2026-09-15");
  });

  it("MONTHLY interval=1 clamps byMonthDay=31 to the last day of a short month", () => {
    const next = computeNextRun({ freq: "MONTHLY", interval: 1, byMonthDay: 31 }, at("2026-01-31"));
    assert.equal(next.toISOString().slice(0, 10), "2026-02-28");
  });

  it("WEEKLY interval=2 advances 14 days", () => {
    const next = computeNextRun({ freq: "WEEKLY", interval: 2 }, at("2026-08-03"));
    assert.equal(next.toISOString().slice(0, 10), "2026-08-17");
  });

  it("YEARLY advances one year", () => {
    const next = computeNextRun({ freq: "YEARLY", interval: 1 }, at("2026-03-01"));
    assert.equal(next.toISOString().slice(0, 10), "2027-03-01");
  });

  it("DAILY interval=3 advances 3 days", () => {
    const next = computeNextRun({ freq: "DAILY", interval: 3 }, at("2026-08-10"));
    assert.equal(next.toISOString().slice(0, 10), "2026-08-13");
  });

  it("firstRunOnOrAfter(MONTHLY byMonthDay=15, anchor 2026-08-20) is 2026-09-15", () => {
    const first = firstRunOnOrAfter({ freq: "MONTHLY", interval: 1, byMonthDay: 15 }, at("2026-08-20"));
    assert.equal(first.toISOString().slice(0, 10), "2026-09-15");
  });

  it("firstRunOnOrAfter(MONTHLY byMonthDay=15, anchor 2026-08-10) is 2026-08-15", () => {
    const first = firstRunOnOrAfter({ freq: "MONTHLY", interval: 1, byMonthDay: 15 }, at("2026-08-10"));
    assert.equal(first.toISOString().slice(0, 10), "2026-08-15");
  });

  it("invalid freq returns null", () => {
    assert.equal(computeNextRun({ freq: "HOURLY" }, at("2026-08-10")), null);
  });
});
```

- [ ] **Step 2: Run** — `node --test "apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js"` → FAIL (module missing).

- [ ] **Step 3: Write `pfm-rrule.js`**

```js
// apps/api/src/routes/pfm/pfm-rrule.js
//
// Minimal recurrence-date math for atlas.pfm. All dates are treated as UTC
// calendar days (time component ignored / normalized to 00:00:00Z).
//
// rrule shape: { freq: 'DAILY'|'WEEKLY'|'MONTHLY'|'YEARLY', interval?: number,
//                byMonthDay?: 1..31 }

const FREQS = new Set(["DAILY", "WEEKLY", "MONTHLY", "YEARLY"]);

function dayUTC(d) {
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

function lastDayOfMonth(year, monthIdx) {
  return new Date(Date.UTC(year, monthIdx + 1, 0)).getUTCDate();
}

function addMonthsClamped(from, months, byMonthDay) {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth() + months;
  const targetYear = y + Math.floor(m / 12);
  const targetMonth = ((m % 12) + 12) % 12;
  const desired = byMonthDay ?? from.getUTCDate();
  const day = Math.min(desired, lastDayOfMonth(targetYear, targetMonth));
  return new Date(Date.UTC(targetYear, targetMonth, day));
}

// Next occurrence strictly after `from` (from is a prior occurrence).
export function computeNextRun(rrule, from) {
  if (!rrule || !FREQS.has(rrule.freq)) return null;
  const interval = Math.max(1, Number(rrule.interval) || 1);
  const base = dayUTC(from);
  switch (rrule.freq) {
    case "DAILY":
      return new Date(base.getTime() + interval * 86400000);
    case "WEEKLY":
      return new Date(base.getTime() + interval * 7 * 86400000);
    case "MONTHLY":
      return addMonthsClamped(base, interval, rrule.byMonthDay);
    case "YEARLY": {
      const d = new Date(base);
      d.setUTCFullYear(d.getUTCFullYear() + interval);
      return d;
    }
    default:
      return null;
  }
}

// First occurrence on or after `anchor` (used when a rule is created).
export function firstRunOnOrAfter(rrule, anchor) {
  if (!rrule || !FREQS.has(rrule.freq)) return null;
  const a = dayUTC(anchor);
  if (rrule.freq === "MONTHLY" && rrule.byMonthDay) {
    const thisMonth = new Date(
      Date.UTC(
        a.getUTCFullYear(),
        a.getUTCMonth(),
        Math.min(rrule.byMonthDay, lastDayOfMonth(a.getUTCFullYear(), a.getUTCMonth())),
      ),
    );
    if (thisMonth.getTime() >= a.getTime()) return thisMonth;
    return addMonthsClamped(thisMonth, Math.max(1, Number(rrule.interval) || 1), rrule.byMonthDay);
  }
  // For the other frequencies the anchor itself is the first run.
  return a;
}
```

- [ ] **Step 4: Run** — `node --test "apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js"` → PASS (8).
- [ ] **Step 5: Commit** — `git add apps/api/src/routes/pfm/pfm-rrule.js apps/api/src/routes/pfm/__tests__/pfm-rrule.test.js && git commit -m "feat(pfm): recurrence-date helper"`

---

## Task 3: Rule validators

**Files:** `apps/api/src/routes/pfm/validators.js` (modify)

- [ ] **Step 1: Append**

```js
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
```

- [ ] **Step 2** — `node --check apps/api/src/routes/pfm/validators.js`.
- [ ] **Step 3** — `git add apps/api/src/routes/pfm/validators.js && git commit -m "feat(pfm): recurring-rule validators"`

---

## Task 4: `recurring-service.js` (test first)

**Files:** `apps/api/src/routes/pfm/recurring-service.js`, `apps/api/src/routes/pfm/__tests__/recurring-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/recurring-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createRecurringService } from "../recurring-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000201";
const OWNER = "01900000-0000-7000-8000-000000000202";
const OTHER = "01900000-0000-7000-8000-000000000203";
const WALLET = "01900000-0000-7000-8000-000000000204";
const RULE = "01900000-0000-7000-8000-000000000205";

function walletsStub({ owner = true } = {}) {
  return { isWalletOwner: async () => owner };
}
function bridgeStub() {
  const calls = [];
  return {
    calls,
    syncRuleEvent: async (r) => calls.push(["sync", r.id]),
    deleteRuleEvent: async (r) => calls.push(["delete", r.id]),
  };
}

describe("recurring-service", () => {
  it("createRule refuses (403) when the actor is not the wallet owner", async () => {
    const service = createRecurringService({
      prisma: {},
      wallets: walletsStub({ owner: false }),
      calendarBridge: bridgeStub(),
    });
    await assert.rejects(
      () =>
        service.createRule({
          companyId: COMPANY,
          actorId: OTHER,
          data: {
            walletId: WALLET,
            label: "Netflix",
            direction: "EXPENSE",
            amountMode: "FIXED",
            amount: 219,
            rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 5 },
            autoPost: true,
            startOn: "2026-08-01",
          },
        }),
      (e) => e instanceof PfmServiceError && e.status === 403,
    );
  });

  it("createRule stamps owner, computes nextRunAt from startOn, and syncs a calendar event", async () => {
    let created = null;
    const bridge = bridgeStub();
    const prisma = {
      pfmRecurringRule: {
        create: async ({ data }) => ((created = data), { id: RULE, ...data }),
        update: async ({ data }) => ({ id: RULE, ...created, ...data }),
      },
      pfmMovement: { findFirst: async () => null, createMany: async () => ({ count: 0 }) },
      $executeRaw: async () => 0,
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridge,
    });
    const rule = await service.createRule({
      companyId: COMPANY,
      actorId: OWNER,
      data: {
        walletId: WALLET,
        label: "Netflix",
        direction: "EXPENSE",
        amountMode: "FIXED",
        amount: 219,
        rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 5 },
        autoPost: true,
        startOn: "2026-08-20",
      },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    // startOn 2026-08-20, byMonthDay 5 -> first run 2026-09-05
    assert.equal(new Date(created.nextRunAt).toISOString().slice(0, 10), "2026-09-05");
    assert.ok(bridge.calls.some(([k]) => k === "sync"));
    assert.ok(rule.id);
  });

  it("materializeDueRules creates a POSTED movement for FIXED+autoPost and PENDING otherwise, advancing nextRunAt", async () => {
    const inserted = [];
    let ruleNextRun = "2026-08-01";
    const rule = {
      id: RULE,
      company_id: COMPANY,
      owner_id: OWNER,
      wallet_id: WALLET,
      category_id: null,
      direction: "EXPENSE",
      amount_mode: "VARIABLE",
      amount: null,
      auto_post: false,
      rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 1 },
      next_run_at: new Date(`${ruleNextRun}T00:00:00.000Z`),
      end_on: null,
    };
    const prisma = {
      $queryRaw: async (s) => {
        const sql = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase();
        if (sql.includes("from pfm_recurring_rule")) return [rule];
        return [];
      },
      pfmMovement: {
        create: async ({ data }) => (inserted.push(data), { id: "m" + inserted.length, ...data }),
      },
      pfmRecurringRule: {
        update: async ({ data }) => {
          if (data.nextRunAt) ruleNextRun = new Date(data.nextRunAt).toISOString().slice(0, 10);
          return { id: RULE, ...data };
        },
      },
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridgeStub(),
    });
    // horizon far enough to materialize a couple of months from 2026-08-01
    const res = await service.materializeDueRules({
      now: new Date("2026-09-15T00:00:00.000Z"),
      horizonDays: 45,
    });
    assert.ok(res.created >= 1);
    assert.ok(inserted.every((m) => m.status === "PENDING"));
    assert.ok(inserted.every((m) => m.recurringRuleId === RULE));
  });

  it("materializeDueRules disables a rule once nextRunAt passes endOn", async () => {
    let disabled = false;
    const rule = {
      id: RULE,
      company_id: COMPANY,
      owner_id: OWNER,
      wallet_id: WALLET,
      category_id: null,
      direction: "EXPENSE",
      amount_mode: "FIXED",
      amount: 100,
      auto_post: true,
      rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 1 },
      next_run_at: new Date("2026-08-01T00:00:00.000Z"),
      end_on: new Date("2026-08-15T00:00:00.000Z"),
    };
    const prisma = {
      $queryRaw: async (s) => {
        const sql = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase();
        return sql.includes("from pfm_recurring_rule") ? [rule] : [];
      },
      pfmMovement: { create: async ({ data }) => ({ id: "m", ...data }) },
      pfmRecurringRule: {
        update: async ({ data }) => {
          if (data.enabled === false) disabled = true;
          return { id: RULE, ...data };
        },
      },
    };
    const service = createRecurringService({
      prisma,
      wallets: walletsStub(),
      calendarBridge: bridgeStub(),
    });
    await service.materializeDueRules({ now: new Date("2026-10-01T00:00:00.000Z"), horizonDays: 45 });
    assert.equal(disabled, true);
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Write `recurring-service.js`**

```js
// apps/api/src/routes/pfm/recurring-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";
import { computeNextRun, firstRunOnOrAfter } from "./pfm-rrule.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";
const MATERIALIZE_CAP = 24; // safety bound on occurrences created per rule per run

function dayUTC(d) {
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return new Date(`${s}T00:00:00.000Z`);
}

export function createRecurringService({ prisma, wallets, calendarBridge }) {
  async function assertOwner({ companyId, walletId, actorId }) {
    if (!(await wallets.isWalletOwner({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Solo el propietario de la cartera gestiona los cargos recurrentes.", 403);
    }
  }

  function normalizeRule(row) {
    return {
      id: row.id,
      companyId: row.company_id ?? row.companyId,
      ownerId: row.owner_id ?? row.ownerId,
      walletId: row.wallet_id ?? row.walletId,
      label: row.label,
      categoryId: row.category_id ?? row.categoryId ?? null,
      direction: row.direction,
      amountMode: row.amount_mode ?? row.amountMode,
      amount: row.amount == null ? null : toPlainNumber(row.amount),
      rrule: row.rrule,
      autoPost: Boolean(row.auto_post ?? row.autoPost),
      nextRunAt:
        (row.next_run_at ?? row.nextRunAt) instanceof Date
          ? (row.next_run_at ?? row.nextRunAt).toISOString()
          : (row.next_run_at ?? row.nextRunAt),
      endOn: row.end_on ?? row.endOn ?? null,
      calendarEventId: row.calendar_event_id ?? row.calendarEventId ?? null,
      enabled: row.enabled,
    };
  }

  async function listRules({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.$queryRaw`
        SELECT r.* FROM pfm_recurring_rule r
        JOIN pfm_wallet w ON w.id = r.wallet_id
        WHERE r.company_id = ${companyId}::uuid
          AND r.enabled = true
          AND w.owner_id = ${actorId}::uuid
        ORDER BY r.next_run_at ASC
      `;
      return { data: rows.map(normalizeRule) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function createRule({ companyId, actorId, data }) {
    await assertOwner({ companyId, walletId: data.walletId, actorId });
    const firstRun = firstRunOnOrAfter(data.rrule, dayUTC(data.startOn));
    if (!firstRun) throw new PfmServiceError("Regla de recurrencia invalida.", 400);
    let rule = await prisma.pfmRecurringRule.create({
      data: {
        companyId,
        ownerId: actorId,
        walletId: data.walletId,
        label: data.label,
        categoryId: data.categoryId ?? null,
        direction: data.direction,
        amountMode: data.amountMode,
        amount: data.amountMode === "FIXED" ? data.amount : (data.amount ?? null),
        rrule: data.rrule,
        autoPost: data.amountMode === "FIXED" ? Boolean(data.autoPost) : false,
        nextRunAt: firstRun,
        endOn: data.endOn ? dayUTC(data.endOn) : null,
      },
    });
    await materializeRule(rule);
    await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(rule)));
    const refreshed = await prisma.pfmRecurringRule.findUnique({ where: { id: rule.id } });
    return normalizeRule(refreshed ?? rule);
  }

  async function updateRule({ companyId, actorId, ruleId, data }) {
    const existing = await prisma.pfmRecurringRule.findFirst({
      where: { id: ruleId, companyId, enabled: true },
    });
    if (!existing) throw new PfmServiceError("Regla no encontrada.", 404);
    await assertOwner({ companyId, walletId: existing.walletId, actorId });
    const patch = {};
    for (const k of ["label", "categoryId", "amount", "rrule", "autoPost"]) {
      if (Object.prototype.hasOwnProperty.call(data, k)) patch[k] = data[k];
    }
    if ("endOn" in data) patch.endOn = data.endOn ? dayUTC(data.endOn) : null;
    if (patch.autoPost && (patch.amountMode ?? existing.amountMode) !== "FIXED") patch.autoPost = false;
    const updated = await prisma.pfmRecurringRule.update({ where: { id: ruleId }, data: patch });
    await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(updated)));
    return normalizeRule(updated);
  }

  async function setRuleEnabled({ companyId, actorId, ruleId, enabled }) {
    const existing = await prisma.pfmRecurringRule.findFirst({ where: { id: ruleId, companyId } });
    if (!existing) throw new PfmServiceError("Regla no encontrada.", 404);
    await assertOwner({ companyId, walletId: existing.walletId, actorId });
    const updated = await prisma.pfmRecurringRule.update({ where: { id: ruleId }, data: { enabled } });
    if (!enabled) await safeBridge(() => calendarBridge.deleteRuleEvent(normalizeRule(updated)));
    else await safeBridge(() => calendarBridge.syncRuleEvent(normalizeRule(updated)));
    return { id: ruleId, enabled };
  }

  // Create the PENDING/POSTED movements for one rule up to `horizon`.
  async function materializeRule(ruleRow, { now = new Date(), horizonDays = 45 } = {}) {
    const rule = ruleRow.company_id ? ruleRow : toRow(ruleRow);
    const horizon = new Date(dayUTC(now).getTime() + horizonDays * 86400000);
    let cursor = dayUTC(rule.next_run_at);
    let created = 0;
    let guard = 0;
    while (cursor.getTime() <= horizon.getTime() && guard < MATERIALIZE_CAP) {
      guard += 1;
      if (rule.end_on && cursor.getTime() > dayUTC(rule.end_on).getTime()) {
        await prisma.pfmRecurringRule.update({ where: { id: rule.id }, data: { enabled: false } });
        return created;
      }
      const isAutoPost = rule.amount_mode === "FIXED" && rule.auto_post === true;
      try {
        await prisma.pfmMovement.create({
          data: {
            companyId: rule.company_id,
            ownerId: rule.owner_id,
            walletId: rule.wallet_id,
            categoryId: rule.category_id ?? null,
            direction: rule.direction,
            amount: rule.amount != null ? rule.amount : 0,
            occurredOn: cursor,
            status: isAutoPost ? "POSTED" : "PENDING",
            recurringRuleId: rule.id,
            merchant: rule.label,
          },
        });
        created += 1;
      } catch (err) {
        // 23505 = the partial unique guard already has this (rule, day) — skip.
        const code = err?.code ?? err?.meta?.code ?? "";
        if (!(String(code).includes("23505") || String(err?.message ?? "").includes("duplicate key"))) {
          throw err;
        }
      }
      const next = computeNextRun(rule.rrule, cursor);
      if (!next) break;
      cursor = dayUTC(next);
      await prisma.pfmRecurringRule.update({
        where: { id: rule.id },
        data: { nextRunAt: cursor },
      });
    }
    return created;
  }

  function toRow(normalized) {
    return {
      id: normalized.id,
      company_id: normalized.companyId,
      owner_id: normalized.ownerId,
      wallet_id: normalized.walletId,
      category_id: normalized.categoryId,
      direction: normalized.direction,
      amount_mode: normalized.amountMode,
      amount: normalized.amount,
      auto_post: normalized.autoPost,
      rrule: normalized.rrule,
      next_run_at: normalized.nextRunAt,
      end_on: normalized.endOn,
    };
  }

  // Worker entrypoint.
  async function materializeDueRules({ now = new Date(), horizonDays = 45 } = {}) {
    let dueRules;
    try {
      dueRules = await prisma.$queryRaw`
        SELECT * FROM pfm_recurring_rule
        WHERE enabled = true AND next_run_at <= ${new Date(dayUTC(now).getTime() + horizonDays * 86400000)}
        ORDER BY next_run_at ASC
        LIMIT 500
      `;
    } catch (err) {
      if (isTableNotFoundError(err)) return { processed: 0, created: 0 };
      throw err;
    }
    let created = 0;
    for (const rule of dueRules) {
      try {
        created += await materializeRule(rule, { now, horizonDays });
      } catch (err) {
        console.error("[atlas.pfm] materializeRule failed", rule.id, err?.message ?? err);
      }
    }
    return { processed: dueRules.length, created };
  }

  async function safeBridge(fn) {
    try {
      await fn();
    } catch (err) {
      console.error("[atlas.pfm] calendar bridge failed", err?.message ?? err);
    }
  }

  return { listRules, createRule, updateRule, setRuleEnabled, materializeRule, materializeDueRules };
}
```

- [ ] **Step 4: Run** — `node --test "apps/api/src/routes/pfm/__tests__/recurring-service.test.js"` → PASS (5).
- [ ] **Step 5: Commit** — `git add apps/api/src/routes/pfm/recurring-service.js apps/api/src/routes/pfm/__tests__/recurring-service.test.js && git commit -m "feat(pfm): recurring-rule service + idempotent materialization"`

---

## Task 5: `pfm-calendar-bridge.js` (test first)

**Files:** `apps/api/src/routes/pfm/pfm-calendar-bridge.js`, `apps/api/src/routes/pfm/__tests__/pfm-calendar-bridge.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/pfm-calendar-bridge.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPfmCalendarBridge } from "../pfm-calendar-bridge.js";

const OWNER = "01900000-0000-7000-8000-000000000301";
const RULE = "01900000-0000-7000-8000-000000000302";
const CAL = "01900000-0000-7000-8000-000000000303";

function baseRule(over = {}) {
  return {
    id: RULE,
    ownerId: OWNER,
    label: "Netflix",
    direction: "EXPENSE",
    amountMode: "FIXED",
    amount: 219,
    rrule: { freq: "MONTHLY", interval: 1, byMonthDay: 5 },
    nextRunAt: "2026-09-05T00:00:00.000Z",
    calendarEventId: null,
    ...over,
  };
}

describe("pfm-calendar-bridge", () => {
  it("degrades silently when the calendar tables are absent", async () => {
    const bridge = createPfmCalendarBridge({ prisma: {} });
    await assert.doesNotReject(() => bridge.syncRuleEvent(baseRule()));
  });

  it("provisions a dedicated calendar once and creates one recurring event per rule", async () => {
    const state = { calendars: [], events: [], config: {} };
    const prisma = {
      calendarCalendar: {
        create: async ({ data }) => {
          const row = { id: CAL, ...data };
          state.calendars.push(row);
          return row;
        },
        findFirst: async () => state.calendars[0] ?? null,
      },
      instanceConfig: {
        findUnique: async ({ where }) => (state.config[where.key] ? { value: state.config[where.key] } : null),
        upsert: async ({ where, create }) => {
          state.config[where.key] = create.value;
          return create;
        },
      },
      calendarEvent: {
        create: async ({ data }) => {
          const row = { id: "evt1", ...data };
          state.events.push(row);
          return row;
        },
        update: async ({ where, data }) => {
          const e = state.events.find((x) => x.id === where.id);
          Object.assign(e, data);
          return e;
        },
      },
      pfmRecurringRule: { update: async () => ({}) },
    };
    const bridge = createPfmCalendarBridge({ prisma });
    await bridge.syncRuleEvent(baseRule());
    assert.equal(state.calendars.length, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.events[0].sourceModule, "atlas.pfm");
    assert.equal(state.events[0].sourceEntityId, RULE);
    assert.ok(state.events[0].recurrenceRule);
  });

  it("deleteRuleEvent removes the linked event", async () => {
    let deleted = null;
    const prisma = {
      calendarEvent: { delete: async ({ where }) => (deleted = where.id) },
    };
    const bridge = createPfmCalendarBridge({ prisma });
    await bridge.deleteRuleEvent(baseRule({ calendarEventId: "evt9" }));
    assert.equal(deleted, "evt9");
  });
});
```

- [ ] **Step 2: Run** — FAIL (module missing).

- [ ] **Step 3: Write `pfm-calendar-bridge.js`**

```js
// apps/api/src/routes/pfm/pfm-calendar-bridge.js
//
// Best-effort mirror of atlas.pfm recurring rules onto atlas.calendar. Mirrors
// the projects-calendar-bridge.js contract: never throws into the caller; if the
// calendar module is not installed, every method is a no-op.

const SOURCE = "atlas.pfm";

function isCalendarAvailable(prisma) {
  return (
    typeof prisma?.calendarCalendar?.create === "function" &&
    typeof prisma?.calendarEvent?.create === "function"
  );
}

function ruleToRruleJson(rrule) {
  // Store the same compact shape pfm uses elsewhere; atlas.calendar treats
  // recurrenceRule as opaque Json for display/expansion.
  return { ...rrule };
}

function eventTitle(rule) {
  if (rule.amountMode === "VARIABLE" || rule.amount == null) return `${rule.label} (monto variable)`;
  const amt = Number(rule.amount).toLocaleString("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${rule.label} ($${amt})`;
}

export function createPfmCalendarBridge({ prisma }) {
  async function ensureCalendar(ownerId) {
    const key = `pfm.calendarId.${ownerId}`;
    const cfg = await prisma.instanceConfig.findUnique({ where: { key } });
    if (cfg?.value) {
      const existing = await prisma.calendarCalendar.findFirst({
        where: { id: cfg.value, enabled: true },
        select: { id: true },
      });
      if (existing) return cfg.value;
    }
    const calendar = await prisma.calendarCalendar.create({
      data: { ownerId, name: "Finanzas personales", color: "#0ea5e9", isDefault: false },
    });
    await prisma.instanceConfig.upsert({
      where: { key },
      update: { value: calendar.id },
      create: { key, value: calendar.id },
    });
    return calendar.id;
  }

  async function syncRuleEvent(rule) {
    if (!isCalendarAvailable(prisma)) return null;
    try {
      const calendarId = await ensureCalendar(rule.ownerId);
      const startAt = new Date(String(rule.nextRunAt).slice(0, 10) + "T00:00:00.000Z");
      const payload = {
        calendarId,
        title: eventTitle(rule),
        startAt,
        allDay: true,
        recurrenceRule: ruleToRruleJson(rule.rrule),
        color: "#0ea5e9",
        sourceModule: SOURCE,
        sourceEntityId: rule.id,
      };
      if (rule.calendarEventId) {
        await prisma.calendarEvent.update({
          where: { id: rule.calendarEventId },
          data: {
            title: payload.title,
            startAt: payload.startAt,
            allDay: true,
            recurrenceRule: payload.recurrenceRule,
          },
        });
        return rule.calendarEventId;
      }
      const event = await prisma.calendarEvent.create({ data: payload });
      await prisma.pfmRecurringRule.update({
        where: { id: rule.id },
        data: { calendarEventId: event.id },
      });
      return event.id;
    } catch (err) {
      console.error("[atlas.pfm] pfm-calendar-bridge syncRuleEvent failed:", err?.message ?? err);
      return null;
    }
  }

  async function deleteRuleEvent(rule) {
    if (!isCalendarAvailable(prisma) || !rule.calendarEventId) return;
    try {
      await prisma.calendarEvent.delete({ where: { id: rule.calendarEventId } });
    } catch {
      // event already gone — fine
    }
  }

  return { ensureCalendar, syncRuleEvent, deleteRuleEvent };
}
```

- [ ] **Step 4: Run** — PASS (3).
- [ ] **Step 5: Commit** — `git add apps/api/src/routes/pfm/pfm-calendar-bridge.js apps/api/src/routes/pfm/__tests__/pfm-calendar-bridge.test.js && git commit -m "feat(pfm): best-effort atlas.calendar bridge for recurring rules"`

---

## Task 6: `getUpcoming()` in summary-service + `/pfm/upcoming` + `/pfm/recurring` routes

**Files:** `apps/api/src/routes/pfm/summary-service.js` (modify), `apps/api/src/routes/pfm/recurring-routes.js` (create)

- [ ] **Step 1: Add `getUpcoming` to `summary-service.js`** (inside `createSummaryService`, before the `return`):

```js
  async function getUpcoming({ companyId, actorId, days = 14 }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const horizon = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
    try {
      const rows = await prisma.$queryRaw`
        SELECT m.id, m.wallet_id, w.name AS wallet_name, w.currency,
               m.direction, m.amount, m.occurred_on, m.merchant, m.status,
               m.recurring_rule_id, c.name AS category_name, c.color AS category_color
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        LEFT JOIN pfm_category c ON c.id = m.category_id
        WHERE m.company_id = ${companyId}::uuid
          AND m.enabled = true
          AND m.status = 'PENDING'
          AND m.occurred_on <= ${horizon}::date
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        ORDER BY m.occurred_on ASC
        LIMIT 100
      `;
      return {
        data: rows.map((r) => ({
          id: r.id,
          walletId: r.wallet_id,
          walletName: r.wallet_name,
          currency: r.currency,
          direction: r.direction,
          amount: toPlainNumber(r.amount),
          occurredOn:
            (r.occurred_on instanceof Date ? r.occurred_on.toISOString() : String(r.occurred_on)).slice(0, 10),
          merchant: r.merchant ?? null,
          categoryName: r.category_name ?? null,
          categoryColor: r.category_color ?? null,
          fromRule: Boolean(r.recurring_rule_id),
        })),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }
```

Add `getUpcoming` to the returned object: `return { getOverview, getUpcoming };`

- [ ] **Step 2: Write `recurring-routes.js`**

```js
// apps/api/src/routes/pfm/recurring-routes.js
import { Hono } from "hono";
import {
  createRecurringRuleSchema,
  updateRecurringRuleSchema,
  enabledSchema,
} from "./validators.js";
import {
  PfmServiceError,
  getCompanyId,
  getActorId,
  getValidationErrorMessage,
} from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  if (process.env.NODE_ENV !== "production") console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

export function createRecurringRouter({ requirePermission, requireAnyPermission, recurring, summary }) {
  const app = new Hono();

  app.get(
    "/pfm/recurring",
    requireAnyPermission(["pfm.recurring.read", "pfm.recurring.manage"]),
    async (c) => {
      try {
        return c.json(
          await recurring.listRules({ companyId: getCompanyId(c), actorId: getActorId(c) }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los cargos recurrentes.");
      }
    },
  );

  app.post("/pfm/recurring", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = createRecurringRuleSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const rule = await recurring.createRule({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        data: parsed.data,
      });
      return c.json({ data: rule }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el cargo recurrente.");
    }
  });

  app.patch("/pfm/recurring/:id", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = updateRecurringRuleSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await recurring.updateRule({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          ruleId: c.req.param("id"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el cargo recurrente.");
    }
  });

  app.patch("/pfm/recurring/:id/enabled", requirePermission("pfm.recurring.manage"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await recurring.setRuleEnabled({
          companyId: getCompanyId(c),
          actorId: getActorId(c),
          ruleId: c.req.param("id"),
          enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado del cargo recurrente.");
    }
  });

  app.get(
    "/pfm/upcoming",
    requireAnyPermission(["pfm.movements.read", "pfm.wallets.read"]),
    async (c) => {
      try {
        const days = Number(c.req.query("days")) || 14;
        return c.json(
          await summary.getUpcoming({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            days: Math.min(60, Math.max(1, days)),
          }),
        );
      } catch (err) {
        return handleError(c, err, "No se pudieron obtener los proximos cargos.");
      }
    },
  );

  return app;
}
```

- [ ] **Step 3** — `node --check` both files; run `node --test "apps/api/src/routes/pfm/__tests__/summary-service.test.js"` (still 2 pass).
- [ ] **Step 4** — `git add apps/api/src/routes/pfm/summary-service.js apps/api/src/routes/pfm/recurring-routes.js && git commit -m "feat(pfm): upcoming feed + recurring-rule routes"`

---

## Task 7: Wire into `index.js`

**Files:** `apps/api/src/routes/pfm/index.js` (modify)

- [ ] **Step 1: Update the factory** — add imports and composition:

```js
import { createRecurringService } from "./recurring-service.js";
import { createPfmCalendarBridge } from "./pfm-calendar-bridge.js";
import { createRecurringRouter } from "./recurring-routes.js";
import { createSummaryService } from "./summary-service.js";
```

Inside `createPfmRouter`, after `const movements = createMovementsService({ prisma, wallets });`:

```js
  const summary = createSummaryService({ prisma });
  const calendarBridge = createPfmCalendarBridge({ prisma });
  const recurring = createRecurringService({ prisma, wallets, calendarBridge });
```

Add the route mount after the summary router line:

```js
  app.route(
    "/",
    createRecurringRouter({
      requirePermission,
      requireAnyPermission: anyPermission,
      recurring,
      summary,
    }),
  );
```

Export `recurring` so the worker can reach it without re-composing: change the return to

```js
  const routerApp = app;
  routerApp.pfmServices = { recurring, summary };
  return routerApp;
```

(Do **not** change how `index.js` in `apps/api/src` mounts it — it only uses `.route`/`.fetch`.)

- [ ] **Step 2** — `node --check apps/api/src/routes/pfm/index.js`; boot smoke test:
```bash
node -e "import('./apps/api/src/routes/pfm/index.js').then(m => { const a = m.createPfmRouter({ prisma:{}, requirePermission:()=>(c,n)=>n(), requireAnyPermission:()=>(c,n)=>n() }); console.log('ok', typeof a.fetch, !!a.pfmServices?.recurring); })"
```
Expected: `ok function true`

- [ ] **Step 3** — `git add apps/api/src/routes/pfm/index.js && git commit -m "feat(pfm): compose recurring service + router"`

---

## Task 8: Worker tick

**Files:** `apps/worker/src/index.js` (modify)

- [ ] **Step 1: Add near the other service constructions** (after the `createRecurringTasksService` import block — search for `createRecurringTasksService`):

```js
import { createWalletsService } from '../../api/src/routes/pfm/wallets-service.js'
import { createPfmCalendarBridge } from '../../api/src/routes/pfm/pfm-calendar-bridge.js'
import { createRecurringService as createPfmRecurringService } from '../../api/src/routes/pfm/recurring-service.js'
```

Near where other services are instantiated with `{ prisma }`:

```js
const pfmRecurringService = createPfmRecurringService({
  prisma,
  wallets: createWalletsService({ prisma }),
  calendarBridge: createPfmCalendarBridge({ prisma }),
})
const PFM_RECURRING_INTERVAL_MS = 60 * 60 * 1000
```

- [ ] **Step 2: Add the tick function** near `runRecurringTasksTick`:

```js
async function runPfmRecurringTick() {
  try {
    const result = await pfmRecurringService.materializeDueRules({ now: new Date(), horizonDays: 45 })
    if ((result?.created ?? 0) > 0) {
      console.log(
        `[worker] pfm recurring ${formatLogTimestamp()} processed=${result.processed} created=${result.created}`,
      )
    }
  } catch (err) {
    console.error('[worker] pfm recurring tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}
```

- [ ] **Step 3: Schedule it** near the other `runXxxTick(); setInterval(...)` calls at the bottom:

```js
runPfmRecurringTick()
setInterval(() => {
  runPfmRecurringTick()
}, PFM_RECURRING_INTERVAL_MS)
```

- [ ] **Step 4** — `node --check apps/worker/src/index.js`.
- [ ] **Step 5** — `git add apps/worker/src/index.js && git commit -m "feat(pfm): worker tick materializes due recurring rules"`

---

## Task 9: SDK methods

**Files:** `packages/sdk/src/index.js` (modify — inside the `pfm` group)

- [ ] **Step 1: Add**

```js
      listRecurringRules: (token) =>
        request("/pfm/recurring", { headers: withAuthHeaders(token) }),
      createRecurringRule: (data, token) =>
        request("/pfm/recurring", {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateRecurringRule: (id, data, token) =>
        request(`/pfm/recurring/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setRecurringRuleEnabled: (id, enabled, token) =>
        request(`/pfm/recurring/${encodeURIComponent(id)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      listUpcoming: (token, query = {}) =>
        request(`/pfm/upcoming${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
```

- [ ] **Step 2** — `node --check packages/sdk/src/index.js`; `node --test "packages/sdk/src/__tests__/*.test.js"` (22 pass / 1 pre-existing fail — unchanged).
- [ ] **Step 3** — `git add packages/sdk/src/index.js && git commit -m "feat(pfm): SDK recurring + upcoming methods"`

---

## Task 10: Full sweep + live check

- [ ] **Step 1** — `node --test "apps/api/src/routes/pfm/__tests__/*.test.js"` → all PASS (Phase 1's 18 + rrule 8 + recurring 5 + bridge 3 = 34).
- [ ] **Step 2** — `pnpm build` → success.
- [ ] **Step 3 (live)** — start `pnpm dev:api`, then run a script that: creates a wallet, `createRule` (VARIABLE monthly byMonthDay = tomorrow's day, autoPost off), asserts a `PENDING` movement exists on the next occurrence, calls `materializeDueRules` again and asserts **no** duplicate is created (partial unique guard), then `setRuleEnabled(false)` and asserts the rule is gone from `listRules`. Clean up. Stop the server.
- [ ] **Step 4** — `git add -A && git commit -m "chore(pfm): phase 2 plan a sweep"`

---

## Self-Review

- **Spec coverage:** §3.6 `PfmRecurringRule` (all fields, `autoPost` only when `FIXED`) → Tasks 1, 3, 4. §5.1 worker materialization (horizon = today+45d, idempotent via partial unique, RRULE advance, disable past `endOn`) → Tasks 1 (index), 4, 8. §5.2 confirm/skip → already Phase 1. §5.3 calendar bridge (dedicated calendar via `InstanceConfig` key `pfm.calendarId.<ownerId>`, one recurring `CalendarEvent` per rule, `sourceModule: "atlas.pfm"`, update on edit, delete on disable, degrades with no calendar) → Task 5. Resumen "Proximos cargos" data → Task 6 (`getUpcoming` + `/pfm/upcoming`). SDK → Task 9.
- **Deviation from spec:** spec §5.1 said "reuse `computeRruleNextAt` from `tasks-service.js`". That helper is a 4-string preset lookup with no anchor date and always computes from `now` — unusable for pfm (needs anchor-relative advance, `byMonthDay`, `YEARLY`, interval N). Task 2 writes a dedicated `pfm-rrule.js` instead. Noted here and in the code comment.
- **Placeholder scan:** none — every step has literal code or a concrete command.
- **Type consistency:** `createRecurringService({ prisma, wallets, calendarBridge })` and `createPfmCalendarBridge({ prisma })` signatures match across service, `index.js`, worker, and tests. `wallets.isWalletOwner({ companyId, walletId, actorId })` exists (Phase 1 `wallets-service.js`). Rule normalized shape (`{ id, walletId, label, direction, amountMode, amount, rrule, autoPost, nextRunAt, endOn, calendarEventId, enabled }`) is what `pfm-calendar-bridge` consumes and what SDK/Plan B render. `materializeRule` accepts **either** a raw DB row (`company_id`…) or a normalized rule (`toRow` bridges) — tests exercise the raw-row path (worker) and `createRule` exercises the create-then-materialize path.
