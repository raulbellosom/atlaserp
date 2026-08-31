# atlas.pfm — Phase 4 — Plan A (API: budgets, goals, credit-card cycle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monthly per-category budgets with threshold/overage notifications, savings goals with progress, and a credit-card statement cycle (cut day / payment-due day / credit limit) with period-vs-total-owed math and a payment-due reminder on the calendar.

**Architecture:** Continues Phase 3. New `PfmBudget` + `PfmGoal` models; `PfmWallet` gains nullable `creditLimit` / `statementDay` / `paymentDueDay`. `budgets-service.js` owns budget CRUD (owner-private), month-spend rollup, and `evaluateBudgets()` (worker entrypoint) which fires a notification via the existing `notificationService.publish(...)` when a budget crosses its threshold or 100%, deduped per budget/month/level. `goals-service.js` owns goal CRUD + `contribute()` (adjusts `currentAmount` by a signed delta). Credit-card cycle math is added to `wallets-service.getWallet()` (period spend since last cut, total owed, available credit) and `pfm-calendar-bridge` gains `syncCreditReminder(wallet)` (a monthly recurring "Fecha limite de pago" event with a 3-day-before reminder). Budgets and goals are **always private to `ownerId`** — never visible to wallet members (spec §7).

**Tech Stack:** Node.js + Hono, Prisma 7 + PostgreSQL, Zod, `node --test` (mocked prisma), `notificationService.publish`, `apps/worker` setInterval ticks.

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (sections 3.1 credit fields, 3.8, 3.9, 7). **Prereq:** Phases 1-3 merged.

**Environment note:** Task 1 applies a migration to the live Supabase DB via hand-written SQL + `pnpm exec prisma migrate deploy`.

---

## File Structure

- `prisma/schema.prisma` — `PfmBudget`, `PfmGoal`, credit fields on `PfmWallet`, `PfmBudgetPeriod` enum (modify).
- `prisma/migrations/20260831030000_atlas_pfm_phase4/migration.sql` (create).
- `apps/api/src/routes/pfm/budgets-service.js` — CRUD + month spend + `evaluateBudgets` (create).
- `apps/api/src/routes/pfm/goals-service.js` — CRUD + `contribute` (create).
- `apps/api/src/routes/pfm/budgets-routes.js` — `/pfm/budgets` + `/pfm/goals` (create).
- `apps/api/src/routes/pfm/wallets-service.js` — credit-cycle fields in `getWallet` + `updateWallet` allowlist (modify).
- `apps/api/src/routes/pfm/pfm-calendar-bridge.js` — `syncCreditReminder(wallet)` (modify).
- `apps/api/src/routes/pfm/validators.js` — budget/goal/credit schemas (modify).
- `apps/api/src/routes/pfm/index.js` — compose budgets/goals, pass `notificationService` (modify).
- `apps/api/src/index.js` — pass `notificationService` into `createPfmRouter` (modify).
- `apps/api/src/permission-catalog.js` + `apps/api/src/manifests/official/core-modules.js` — add `pfm.budgets.manage`, `pfm.goals.manage` (modify).
- `apps/worker/src/index.js` — `runPfmBudgetTick()` + interval (modify).
- `packages/sdk/src/index.js` — budget + goal methods (modify).
- Tests: `budgets-service.test.js`, `goals-service.test.js`, `credit-cycle.test.js` (create).

---

## Task 1: Schema + migration

**Files:** `prisma/schema.prisma`, `prisma/migrations/20260831030000_atlas_pfm_phase4/migration.sql`

- [ ] **Step 1: `prisma/schema.prisma`**

Add to `PfmWallet` (after `ledgerAccountId`):

```prisma
  creditLimit    Decimal? @map("credit_limit") @db.Decimal(15, 2)
  statementDay   Int?     @map("statement_day")
  paymentDueDay  Int?     @map("payment_due_day")
  creditReminderEventId String? @map("credit_reminder_event_id") @db.Uuid
```

Add enum + models (after `PfmReceipt`):

```prisma
enum PfmBudgetPeriod {
  MONTHLY

  @@map("pfm_budget_period")
}

model PfmBudget {
  id             String          @id @default(uuid(7)) @db.Uuid
  companyId      String          @map("company_id") @db.Uuid
  ownerId        String          @map("owner_id") @db.Uuid
  categoryId     String          @map("category_id") @db.Uuid
  walletId       String?         @map("wallet_id") @db.Uuid
  period         PfmBudgetPeriod  @default(MONTHLY)
  amount         Decimal         @db.Decimal(15, 2)
  alertThreshold Decimal         @default(0.8) @map("alert_threshold") @db.Decimal(4, 3)
  enabled        Boolean         @default(true)
  createdAt      DateTime        @default(now()) @map("created_at")
  updatedAt      DateTime        @updatedAt @map("updated_at")

  @@unique([ownerId, categoryId, walletId, period])
  @@index([companyId, ownerId, enabled])
  @@map("pfm_budget")
}

model PfmGoal {
  id            String    @id @default(uuid(7)) @db.Uuid
  companyId     String    @map("company_id") @db.Uuid
  ownerId       String    @map("owner_id") @db.Uuid
  name          String
  targetAmount  Decimal   @map("target_amount") @db.Decimal(15, 2)
  targetDate    DateTime? @map("target_date") @db.Date
  walletId      String?   @map("wallet_id") @db.Uuid
  currentAmount Decimal   @default(0) @map("current_amount") @db.Decimal(15, 2)
  color         String?
  enabled       Boolean   @default(true)
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")

  @@index([companyId, ownerId, enabled])
  @@map("pfm_goal")
}
```

- [ ] **Step 2** — `pnpm exec prisma validate` → `valid 🚀`.

- [ ] **Step 3: migration SQL** at `prisma/migrations/20260831030000_atlas_pfm_phase4/migration.sql`:

```sql
-- atlas.pfm — Finanzas personales (Phase 4: budgets, goals, credit cycle)

-- AlterTable: credit-card fields on pfm_wallet
ALTER TABLE "pfm_wallet"
  ADD COLUMN "credit_limit" DECIMAL(15,2),
  ADD COLUMN "statement_day" INTEGER,
  ADD COLUMN "payment_due_day" INTEGER,
  ADD COLUMN "credit_reminder_event_id" UUID;

-- CreateEnum
CREATE TYPE "pfm_budget_period" AS ENUM ('MONTHLY');

-- CreateTable
CREATE TABLE "pfm_budget" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "wallet_id" UUID,
    "period" "pfm_budget_period" NOT NULL DEFAULT 'MONTHLY',
    "amount" DECIMAL(15,2) NOT NULL,
    "alert_threshold" DECIMAL(4,3) NOT NULL DEFAULT 0.8,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pfm_goal" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "target_amount" DECIMAL(15,2) NOT NULL,
    "target_date" DATE,
    "wallet_id" UUID,
    "current_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "color" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pfm_goal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pfm_budget_owner_id_category_id_wallet_id_period_key"
  ON "pfm_budget"("owner_id", "category_id", "wallet_id", "period");
CREATE INDEX "pfm_budget_company_id_owner_id_enabled_idx" ON "pfm_budget"("company_id", "owner_id", "enabled");
CREATE INDEX "pfm_goal_company_id_owner_id_enabled_idx" ON "pfm_goal"("company_id", "owner_id", "enabled");
```

Note: Postgres treats `NULL` values in a `UNIQUE` index as distinct, so the `wallet_id IS NULL` (global) budget is not de-duplicated by the unique constraint — that's acceptable (the service also guards). If strict single-global-per-category is wanted later, add a partial unique index; not in scope here.

- [ ] **Step 4** — `pnpm exec prisma migrate deploy`; `pnpm db:generate`.
- [ ] **Step 5** — verify: `node --input-type=module -e "import 'dotenv/config'; import pkg from '@prisma/client'; import { PrismaPg } from '@prisma/adapter-pg'; const p=new pkg.PrismaClient({adapter:new PrismaPg({connectionString:process.env.DATABASE_URL})}); console.log('budgets', await p.pfmBudget.count(), 'goals', await p.pfmGoal.count()); await p.\$disconnect();"` → `budgets 0 goals 0`.
- [ ] **Step 6** — `git add prisma/schema.prisma prisma/migrations && git commit -m "feat(pfm): PfmBudget + PfmGoal + credit-card fields (phase 4 migration)"`

---

## Task 2: Permission keys

**Files:** `apps/api/src/permission-catalog.js`, `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: `permission-catalog.js`** — after `"pfm.receipts.manage": { ... }`, add:

```js
  "pfm.budgets.manage": {
    displayNameEs: "Administrar presupuestos",
    descriptionEs: "Permite crear y administrar presupuestos por categoria.",
    groupKey: "pfm",
    order: 55,
  },
  "pfm.goals.manage": {
    displayNameEs: "Administrar metas de ahorro",
    descriptionEs: "Permite crear y administrar metas de ahorro.",
    groupKey: "pfm",
    order: 56,
  },
```

- [ ] **Step 2: `core-modules.js`** — in `atlasPfmManifest.permissions` add `{ key: "pfm.budgets.manage", name: "Administrar presupuestos" }` and `{ key: "pfm.goals.manage", name: "Administrar metas de ahorro" }`; add the same two keys to `acl.actions`. Bump `version` `"0.1.0"` → `"0.2.0"`.

- [ ] **Step 3** — `node -e "const m=require('./apps/api/src/manifests/official/core-modules.js'); const p=m.coreModules.find(x=>x.key==='atlas.pfm'); console.log(p.version, p.permissions.length);"` → `0.2.0 17`.
- [ ] **Step 4** — `git add apps/api/src/permission-catalog.js apps/api/src/manifests/official/core-modules.js && git commit -m "feat(pfm): budgets + goals permission keys, manifest 0.2.0"`

---

## Task 3: Validators

**Files:** `apps/api/src/routes/pfm/validators.js` (modify)

- [ ] **Step 1: Append**

```js
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

export const creditCardSchema = z.object({
  creditLimit: z.number().positive().max(9_999_999_999).nullable().optional(),
  statementDay: z.number().int().min(1).max(31).nullable().optional(),
  paymentDueDay: z.number().int().min(1).max(31).nullable().optional(),
});
```

- [ ] **Step 2** — `node --check apps/api/src/routes/pfm/validators.js`.
- [ ] **Step 3** — `git add apps/api/src/routes/pfm/validators.js && git commit -m "feat(pfm): budget/goal/credit validators"`

---

## Task 4: `budgets-service.js` (test first)

**Files:** `apps/api/src/routes/pfm/budgets-service.js`, `apps/api/src/routes/pfm/__tests__/budgets-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/budgets-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createBudgetsService } from "../budgets-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000501";
const OWNER = "01900000-0000-7000-8000-000000000502";
const OTHER = "01900000-0000-7000-8000-000000000503";
const CAT = "01900000-0000-7000-8000-000000000504";
const BUDGET = "01900000-0000-7000-8000-000000000505";

describe("budgets-service", () => {
  it("createBudget stamps owner + company and defaults alertThreshold 0.8", async () => {
    let created = null;
    const prisma = { pfmBudget: { create: async ({ data }) => ((created = data), { id: BUDGET, ...data }) } };
    const svc = createBudgetsService({ prisma });
    await svc.createBudget({
      companyId: COMPANY,
      actorId: OWNER,
      data: { categoryId: CAT, amount: 3000, alertThreshold: 0.8 },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    assert.equal(Number(created.alertThreshold), 0.8);
  });

  it("listBudgets returns each budget with month spend + pct (spend from the raw query)", async () => {
    const prisma = {
      $queryRaw: async () => [
        { id: BUDGET, category_id: CAT, category_name: "Comida", amount: "3000.00", alert_threshold: "0.800", wallet_id: null, spent: "2400.00" },
      ],
    };
    const svc = createBudgetsService({ prisma });
    const { data } = await svc.listBudgets({ companyId: COMPANY, actorId: OWNER, month: "2026-08" });
    assert.equal(data[0].amount, 3000);
    assert.equal(data[0].spent, 2400);
    assert.equal(data[0].pct, 0.8);
    assert.equal(data[0].categoryName, "Comida");
  });

  it("updateBudget refuses a budget owned by someone else (404)", async () => {
    const prisma = { pfmBudget: { findFirst: async () => null } };
    const svc = createBudgetsService({ prisma });
    await assert.rejects(
      () => svc.updateBudget({ companyId: COMPANY, actorId: OTHER, budgetId: BUDGET, data: { amount: 1 } }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("evaluateBudgets publishes a threshold notification once per budget/month/level (deduped)", async () => {
    const published = [];
    const prisma = {
      $queryRaw: async () => [
        { id: BUDGET, owner_id: OWNER, company_id: COMPANY, category_id: CAT, category_name: "Comida", amount: "3000.00", alert_threshold: "0.800", wallet_id: null, spent: "2500.00" },
      ],
    };
    const notificationService = {
      publish: async ({ input }) => published.push(input),
    };
    const svc = createBudgetsService({ prisma, notificationService });
    await svc.evaluateBudgets({ now: new Date("2026-08-20T00:00:00.000Z") });
    assert.equal(published.length, 1);
    assert.match(published[0].eventType, /pfm\.budget\.(threshold|overage)/);
    assert.match(published[0].dedupeKey, /2026-08/);
    assert.deepEqual(published[0].recipients.userIds, [OWNER]);
  });

  it("evaluateBudgets uses the 'overage' event + high priority when spend >= 100%", async () => {
    const published = [];
    const prisma = {
      $queryRaw: async () => [
        { id: BUDGET, owner_id: OWNER, company_id: COMPANY, category_id: CAT, category_name: "Comida", amount: "3000.00", alert_threshold: "0.800", wallet_id: null, spent: "3100.00" },
      ],
    };
    const svc = createBudgetsService({
      prisma,
      notificationService: { publish: async ({ input }) => published.push(input) },
    });
    await svc.evaluateBudgets({ now: new Date("2026-08-20T00:00:00.000Z") });
    assert.equal(published[0].eventType, "pfm.budget.overage");
    assert.equal(published[0].priority, "high");
    assert.match(published[0].dedupeKey, /overage/);
  });
});
```

- [ ] **Step 2** — run → FAIL (module missing).

- [ ] **Step 3: Write `budgets-service.js`**

```js
// apps/api/src/routes/pfm/budgets-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function monthStartOf(now = new Date()) {
  return `${new Date(now).toISOString().slice(0, 7)}-01`;
}

export function createBudgetsService({ prisma, notificationService = null }) {
  async function ownedBudget({ companyId, actorId, budgetId }) {
    const b = await prisma.pfmBudget.findFirst({
      where: { id: budgetId, companyId, ownerId: actorId, enabled: true },
    });
    if (!b) throw new PfmServiceError("Presupuesto no encontrado.", 404);
    return b;
  }

  async function createBudget({ companyId, actorId, data }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      return await prisma.pfmBudget.create({
        data: {
          companyId,
          ownerId: actorId,
          categoryId: data.categoryId,
          walletId: data.walletId ?? null,
          amount: data.amount,
          alertThreshold: data.alertThreshold ?? 0.8,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function listBudgets({ companyId, actorId, month }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const start = month ? `${month}-01` : monthStartOf();
    try {
      const rows = await prisma.$queryRaw`
        SELECT b.id, b.category_id, c.name AS category_name, b.wallet_id,
               b.amount, b.alert_threshold,
               COALESCE(SUM(m.amount) FILTER (
                 WHERE m.enabled = true AND m.status = 'POSTED' AND m.direction = 'EXPENSE'
                   AND m.occurred_on >= ${start}::date
                   AND m.occurred_on < (${start}::date + INTERVAL '1 month')
                   AND (b.wallet_id IS NULL OR m.wallet_id = b.wallet_id)
               ), 0) AS spent
        FROM pfm_budget b
        LEFT JOIN pfm_category c ON c.id = b.category_id
        LEFT JOIN pfm_movement m ON m.category_id = b.category_id AND m.company_id = ${companyId}::uuid
        WHERE b.company_id = ${companyId}::uuid AND b.owner_id = ${actorId}::uuid AND b.enabled = true
        GROUP BY b.id, c.name
        ORDER BY c.name
      `;
      return {
        data: rows.map((r) => {
          const amount = toPlainNumber(r.amount);
          const spent = toPlainNumber(r.spent);
          return {
            id: r.id,
            categoryId: r.category_id,
            categoryName: r.category_name ?? "Sin categoria",
            walletId: r.wallet_id ?? null,
            amount,
            spent,
            remaining: amount - spent,
            pct: amount > 0 ? spent / amount : 0,
            alertThreshold: toPlainNumber(r.alert_threshold),
          };
        }),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function updateBudget({ companyId, actorId, budgetId, data }) {
    await ownedBudget({ companyId, actorId, budgetId });
    const patch = {};
    if ("amount" in data) patch.amount = data.amount;
    if ("alertThreshold" in data) patch.alertThreshold = data.alertThreshold;
    const b = await prisma.pfmBudget.update({ where: { id: budgetId }, data: patch });
    return b;
  }

  async function setBudgetEnabled({ companyId, actorId, budgetId, enabled }) {
    await ownedBudget({ companyId, actorId, budgetId });
    await prisma.pfmBudget.update({ where: { id: budgetId }, data: { enabled } });
    return { id: budgetId, enabled };
  }

  // Worker entrypoint. Fires one notification per (budget, month, level); the
  // notification service dedupes on dedupeKey so re-runs are safe.
  async function evaluateBudgets({ now = new Date() } = {}) {
    if (!notificationService) return { evaluated: 0, alerted: 0 };
    const start = monthStartOf(now);
    const monthKey = start.slice(0, 7);
    let rows;
    try {
      rows = await prisma.$queryRaw`
        SELECT b.id, b.owner_id, b.company_id, b.category_id, c.name AS category_name,
               b.amount, b.alert_threshold, b.wallet_id,
               COALESCE(SUM(m.amount) FILTER (
                 WHERE m.enabled = true AND m.status = 'POSTED' AND m.direction = 'EXPENSE'
                   AND m.occurred_on >= ${start}::date
                   AND m.occurred_on < (${start}::date + INTERVAL '1 month')
                   AND (b.wallet_id IS NULL OR m.wallet_id = b.wallet_id)
               ), 0) AS spent
        FROM pfm_budget b
        LEFT JOIN pfm_category c ON c.id = b.category_id
        LEFT JOIN pfm_movement m ON m.category_id = b.category_id AND m.company_id = b.company_id
        WHERE b.enabled = true
        GROUP BY b.id, c.name
      `;
    } catch (err) {
      if (isTableNotFoundError(err)) return { evaluated: 0, alerted: 0 };
      throw err;
    }
    let alerted = 0;
    for (const r of rows) {
      const amount = toPlainNumber(r.amount);
      const spent = toPlainNumber(r.spent);
      if (amount <= 0) continue;
      const pct = spent / amount;
      const threshold = toPlainNumber(r.alert_threshold) || 0.8;
      const level = pct >= 1 ? "overage" : pct >= threshold ? "threshold" : null;
      if (!level) continue;
      const name = r.category_name ?? "una categoria";
      try {
        await notificationService.publish({
          companyId: r.company_id,
          actorId: r.owner_id,
          input: {
            eventType: `pfm.budget.${level}`,
            title:
              level === "overage"
                ? `Rebasaste tu presupuesto de ${name}`
                : `Vas al ${Math.round(pct * 100)}% de tu presupuesto de ${name}`,
            body:
              level === "overage"
                ? `Llevas ${spent.toFixed(2)} de ${amount.toFixed(2)} este mes.`
                : `Llevas ${spent.toFixed(2)} de ${amount.toFixed(2)} este mes.`,
            link: "/app/m/atlas.pfm/overview",
            priority: level === "overage" ? "high" : "medium",
            recipients: { userIds: [r.owner_id] },
            dedupeKey: `pfm.budget.${r.id}.${monthKey}.${level}`,
          },
        });
        alerted += 1;
      } catch (err) {
        console.error("[atlas.pfm] budget alert publish failed", r.id, err?.message ?? err);
      }
    }
    return { evaluated: rows.length, alerted };
  }

  return { createBudget, listBudgets, updateBudget, setBudgetEnabled, evaluateBudgets };
}
```

- [ ] **Step 4** — run → PASS (5).
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/budgets-service.js apps/api/src/routes/pfm/__tests__/budgets-service.test.js && git commit -m "feat(pfm): budgets service + threshold/overage notifications"`

---

## Task 5: `goals-service.js` (test first)

**Files:** `apps/api/src/routes/pfm/goals-service.js`, `apps/api/src/routes/pfm/__tests__/goals-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/goals-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createGoalsService } from "../goals-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-000000000601";
const OWNER = "01900000-0000-7000-8000-000000000602";
const OTHER = "01900000-0000-7000-8000-000000000603";
const GOAL = "01900000-0000-7000-8000-000000000604";

describe("goals-service", () => {
  it("createGoal stamps owner + company and starts at currentAmount 0", async () => {
    let created = null;
    const prisma = { pfmGoal: { create: async ({ data }) => ((created = data), { id: GOAL, ...data }) } };
    const svc = createGoalsService({ prisma });
    await svc.createGoal({
      companyId: COMPANY,
      actorId: OWNER,
      data: { name: "Vacaciones", targetAmount: 20000, targetDate: "2027-01-01", walletId: null, color: null },
    });
    assert.equal(created.ownerId, OWNER);
    assert.equal(created.companyId, COMPANY);
    assert.equal(Number(created.currentAmount ?? 0), 0);
  });

  it("listGoals returns progress pct clamped to [0,1]", async () => {
    const prisma = {
      pfmGoal: {
        findMany: async () => [
          { id: GOAL, name: "Fondo", targetAmount: "10000.00", currentAmount: "12500.00", targetDate: null, color: null, walletId: null },
        ],
      },
    };
    const svc = createGoalsService({ prisma });
    const { data } = await svc.listGoals({ companyId: COMPANY, actorId: OWNER });
    assert.equal(data[0].targetAmount, 10000);
    assert.equal(data[0].currentAmount, 12500);
    assert.equal(data[0].pct, 1);
  });

  it("contribute adjusts currentAmount by a signed delta, never below 0", async () => {
    let updateArg = null;
    const prisma = {
      pfmGoal: {
        findFirst: async () => ({ id: GOAL, companyId: COMPANY, ownerId: OWNER, currentAmount: "300.00" }),
        update: async ({ data }) => ((updateArg = data), { id: GOAL, ...data }),
      },
    };
    const svc = createGoalsService({ prisma });
    await svc.contribute({ companyId: COMPANY, actorId: OWNER, goalId: GOAL, amount: -500 });
    assert.equal(Number(updateArg.currentAmount), 0);
  });

  it("contribute refuses a goal owned by someone else (404)", async () => {
    const prisma = { pfmGoal: { findFirst: async () => null } };
    const svc = createGoalsService({ prisma });
    await assert.rejects(
      () => svc.contribute({ companyId: COMPANY, actorId: OTHER, goalId: GOAL, amount: 100 }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });
});
```

- [ ] **Step 2** — run → FAIL.

- [ ] **Step 3: Write `goals-service.js`**

```js
// apps/api/src/routes/pfm/goals-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function dayUTC(d) {
  return d ? new Date(`${String(d).slice(0, 10)}T00:00:00.000Z`) : null;
}

export function createGoalsService({ prisma }) {
  async function ownedGoal({ companyId, actorId, goalId }) {
    const g = await prisma.pfmGoal.findFirst({
      where: { id: goalId, companyId, ownerId: actorId, enabled: true },
    });
    if (!g) throw new PfmServiceError("Meta no encontrada.", 404);
    return g;
  }

  async function createGoal({ companyId, actorId, data }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      return await prisma.pfmGoal.create({
        data: {
          companyId,
          ownerId: actorId,
          name: data.name,
          targetAmount: data.targetAmount,
          targetDate: dayUTC(data.targetDate),
          walletId: data.walletId ?? null,
          color: data.color ?? null,
          currentAmount: 0,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function listGoals({ companyId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const rows = await prisma.pfmGoal.findMany({
        where: { companyId, ownerId: actorId, enabled: true },
        orderBy: { createdAt: "asc" },
      });
      return {
        data: rows.map((g) => {
          const target = toPlainNumber(g.targetAmount);
          const current = toPlainNumber(g.currentAmount);
          return {
            id: g.id,
            name: g.name,
            targetAmount: target,
            currentAmount: current,
            targetDate: g.targetDate ? String(g.targetDate).slice(0, 10) : null,
            walletId: g.walletId ?? null,
            color: g.color ?? null,
            pct: target > 0 ? Math.max(0, Math.min(1, current / target)) : 0,
          };
        }),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function updateGoal({ companyId, actorId, goalId, data }) {
    await ownedGoal({ companyId, actorId, goalId });
    const patch = {};
    if ("name" in data) patch.name = data.name;
    if ("targetAmount" in data) patch.targetAmount = data.targetAmount;
    if ("targetDate" in data) patch.targetDate = dayUTC(data.targetDate);
    if ("walletId" in data) patch.walletId = data.walletId ?? null;
    if ("color" in data) patch.color = data.color ?? null;
    return prisma.pfmGoal.update({ where: { id: goalId }, data: patch });
  }

  async function setGoalEnabled({ companyId, actorId, goalId, enabled }) {
    await ownedGoal({ companyId, actorId, goalId });
    await prisma.pfmGoal.update({ where: { id: goalId }, data: { enabled } });
    return { id: goalId, enabled };
  }

  async function contribute({ companyId, actorId, goalId, amount }) {
    const goal = await ownedGoal({ companyId, actorId, goalId });
    const next = Math.max(0, toPlainNumber(goal.currentAmount) + Number(amount));
    const updated = await prisma.pfmGoal.update({
      where: { id: goalId },
      data: { currentAmount: next },
    });
    return { id: goalId, currentAmount: toPlainNumber(updated.currentAmount) };
  }

  return { createGoal, listGoals, updateGoal, setGoalEnabled, contribute };
}
```

- [ ] **Step 4** — run → PASS (4).
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/goals-service.js apps/api/src/routes/pfm/__tests__/goals-service.test.js && git commit -m "feat(pfm): savings-goals service"`

---

## Task 6: Credit-card cycle in `wallets-service` (test first)

**Files:** `apps/api/src/routes/pfm/wallets-service.js` (modify), `apps/api/src/routes/pfm/__tests__/credit-cycle.test.js` (create)

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/credit-cycle.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { computeCreditCycle } from "../wallets-service.js";

describe("computeCreditCycle", () => {
  it("returns null for a non-credit wallet or one without a statement day", () => {
    assert.equal(computeCreditCycle({ kind: "CASH" }, []), null);
    assert.equal(computeCreditCycle({ kind: "CREDIT", statementDay: null }, []), null);
  });

  it("splits movements into current-period vs total owed and computes available credit", () => {
    const wallet = { kind: "CREDIT", statementDay: 5, paymentDueDay: 25, creditLimit: 20000 };
    const now = new Date("2026-08-20T00:00:00.000Z"); // last cut = 2026-08-05
    const movements = [
      { direction: "EXPENSE", amount: 1000, occurredOn: "2026-08-10", status: "POSTED" }, // in period
      { direction: "EXPENSE", amount: 500, occurredOn: "2026-08-02", status: "POSTED" }, // before cut
      { direction: "INCOME", amount: 300, occurredOn: "2026-08-12", status: "POSTED" }, // payment in period
    ];
    const c = computeCreditCycle(wallet, movements, now);
    assert.equal(c.periodSpend, 700); // 1000 - 300
    assert.equal(c.totalOwed, 1200); // 1000 + 500 - 300
    assert.equal(c.availableCredit, 20000 - 1200);
    assert.equal(c.statementDay, 5);
    assert.equal(c.paymentDueDay, 25);
  });
});
```

- [ ] **Step 2** — run → FAIL (`computeCreditCycle` not exported).

- [ ] **Step 3: Add `computeCreditCycle` to `wallets-service.js`** (export it; call it from `getWallet` when the row is `CREDIT`):

```js
export function computeCreditCycle(wallet, movements, now = new Date()) {
  if (wallet.kind !== "CREDIT" || !wallet.statementDay) return null;
  const ref = new Date(now);
  const y = ref.getUTCFullYear();
  const mo = ref.getUTCMonth();
  const day = ref.getUTCDate();
  // Last statement cut: the statementDay of this month if already passed, else last month.
  const cutMonth = day >= wallet.statementDay ? mo : mo - 1;
  const lastCut = new Date(Date.UTC(y, cutMonth, Math.min(wallet.statementDay, 28)));
  const signed = (m) => Number(m.amount) * (m.direction === "INCOME" ? -1 : 1);
  const posted = movements.filter((m) => m.status === "POSTED");
  const totalOwed = posted.reduce((s, m) => s + signed(m), 0);
  const periodSpend = posted
    .filter((m) => new Date(`${String(m.occurredOn).slice(0, 10)}T00:00:00.000Z`) >= lastCut)
    .reduce((s, m) => s + signed(m), 0);
  const creditLimit = wallet.creditLimit != null ? Number(wallet.creditLimit) : null;
  return {
    statementDay: wallet.statementDay,
    paymentDueDay: wallet.paymentDueDay ?? null,
    creditLimit,
    lastStatementDate: lastCut.toISOString().slice(0, 10),
    totalOwed,
    periodSpend,
    availableCredit: creditLimit != null ? creditLimit - totalOwed : null,
  };
}
```

In `getWallet`, after building the normalized wallet, if `row.kind === "CREDIT" && row.statement_day`, load this wallet's POSTED movements (`prisma.pfmMovement.findMany({ where: { walletId, enabled: true, status: "POSTED" }, select: { direction: true, amount: true, occurredOn: true, status: true } })`) and attach `wallet.creditCycle = computeCreditCycle({ kind, statementDay: row.statement_day, paymentDueDay: row.payment_due_day, creditLimit: row.credit_limit }, movs)`. Also add `creditLimit`, `statementDay`, `paymentDueDay` to `normalizeWalletRow`'s output, and add them to `updateWallet`'s field allowlist.

- [ ] **Step 4** — run → PASS (2). Also re-run the full pfm suite (wallets-service tests unchanged).
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/__tests__/credit-cycle.test.js && git commit -m "feat(pfm): credit-card statement cycle math in getWallet"`

---

## Task 7: `pfm-calendar-bridge.syncCreditReminder`

**Files:** `apps/api/src/routes/pfm/pfm-calendar-bridge.js` (modify)

- [ ] **Step 1: Add `syncCreditReminder(wallet)` and `deleteCreditReminder(wallet)`** — same shape as `syncRuleEvent` but keyed on the wallet:
  - No-op unless `isCalendarAvailable` and `wallet.kind === "CREDIT"` and `wallet.paymentDueDay`.
  - `ensureCalendar(wallet.ownerId)`, then a monthly recurring `CalendarEvent`:
    `title: "Fecha limite de pago — <wallet.name>"`, `allDay: true`,
    `recurrenceRule: { freq: "MONTHLY", interval: 1, byMonthDay: wallet.paymentDueDay }`,
    `startAt` = next occurrence of `paymentDueDay`, `sourceModule: "atlas.pfm"`,
    `sourceEntityId: wallet.id`, `color: "#ef4444"`.
  - Store the event id in `wallet.creditReminderEventId` (`prisma.pfmWallet.update`).
  - On update, if the event exists, patch title/startAt/recurrenceRule; if `paymentDueDay` was cleared, call `deleteCreditReminder`.
  - `deleteCreditReminder`: `prisma.calendarEvent.delete({ where: { id: wallet.creditReminderEventId } })` guarded like `deleteRuleEvent`.
- [ ] **Step 2: Wire from `wallets-service.updateWallet`** — after a successful update, if `kind === "CREDIT"`, call the bridge's `syncCreditReminder(updatedWallet)` best-effort (wrap in try/catch; the bridge is optional — inject it into `createWalletsService({ prisma, calendarBridge })` and default-guard `calendarBridge?.syncCreditReminder`). Update `index.js` to pass `calendarBridge` into `createWalletsService`.
- [ ] **Step 3: Test** — extend `pfm-calendar-bridge.test.js` with 2 cases: (a) `syncCreditReminder` no-ops for a non-credit wallet / missing `paymentDueDay`; (b) with a mock prisma it creates one `calendarEvent` with `sourceModule "atlas.pfm"` and a MONTHLY `recurrenceRule` and stores `creditReminderEventId`.
- [ ] **Step 4** — run the bridge test file → PASS (5 total). `node --check` the bridge + wallets-service.
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/pfm-calendar-bridge.js apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/__tests__/pfm-calendar-bridge.test.js && git commit -m "feat(pfm): credit-card payment-due reminder on the calendar"`

---

## Task 8: `budgets-routes.js` (budgets + goals) + `index.js` wiring

**Files:** `apps/api/src/routes/pfm/budgets-routes.js` (create), `apps/api/src/routes/pfm/index.js` (modify), `apps/api/src/index.js` (modify)

- [ ] **Step 1: Write `budgets-routes.js`** — a single router exposing:
  - `GET /pfm/budgets?month=YYYY-MM` (`requireAnyPermission(["pfm.budgets.manage","pfm.wallets.read"])`) → `budgets.listBudgets`
  - `POST /pfm/budgets` (`pfm.budgets.manage`) → `createBudget` (validate with `createBudgetSchema`)
  - `PATCH /pfm/budgets/:id` (`pfm.budgets.manage`) → `updateBudget` (`updateBudgetSchema`)
  - `PATCH /pfm/budgets/:id/enabled` (`pfm.budgets.manage`) → `setBudgetEnabled` (`enabledSchema`)
  - `GET /pfm/goals` (`requireAnyPermission(["pfm.goals.manage","pfm.wallets.read"])`) → `goals.listGoals`
  - `POST /pfm/goals` (`pfm.goals.manage`) → `createGoal` (`createGoalSchema`)
  - `PATCH /pfm/goals/:id` (`pfm.goals.manage`) → `updateGoal` (`updateGoalSchema`)
  - `PATCH /pfm/goals/:id/enabled` (`pfm.goals.manage`) → `setGoalEnabled` (`enabledSchema`)
  - `POST /pfm/goals/:id/contribute` (`pfm.goals.manage`) → `contribute` (`contributeGoalSchema`)
  - `PATCH /pfm/wallets/:id/credit` (`pfm.wallets.update`) → `wallets.updateWallet` with `creditCardSchema`-validated body (this reuses the Phase 1 `updateWallet`; ensure the credit fields are in its allowlist from Task 6).
  Follow the exact `handleError` + `getCompanyId`/`getActorId` pattern of `recurring-routes.js`.
- [ ] **Step 2: `apps/api/src/routes/pfm/index.js`** — accept `notificationService`; build:
  ```js
  const budgets = createBudgetsService({ prisma, notificationService });
  const goals = createGoalsService({ prisma });
  ```
  Mount `createBudgetsRouter({ requirePermission, requireAnyPermission: anyPermission, budgets, goals, wallets })`. Add `budgets` + `goals` to `app.pfmServices`.
- [ ] **Step 3: `apps/api/src/index.js`** — pass `notificationService` into `createPfmRouter({ ... , notificationService })` (it is already constructed in `apps/api/src/index.js` — `grep -n "notificationService" apps/api/src/index.js`).
- [ ] **Step 4** — `node --check` all three; boot smoke test asserts `a.pfmServices.budgets` + `.goals` exist.
- [ ] **Step 5** — `git add apps/api/src/routes/pfm/budgets-routes.js apps/api/src/routes/pfm/index.js apps/api/src/index.js && git commit -m "feat(pfm): budgets + goals + credit routes, composed"`

---

## Task 9: Worker tick + SDK

**Files:** `apps/worker/src/index.js`, `packages/sdk/src/index.js`

- [ ] **Step 1: Worker** — import `createBudgetsService as createPfmBudgetsService`; construct with `{ prisma, notificationService: createNotificationService({ prisma }) }` (that service is already imported in the worker — `grep -n "createNotificationService" apps/worker/src/index.js`). Add:
  ```js
  const PFM_BUDGET_INTERVAL_MS = 60 * 60 * 1000
  async function runPfmBudgetTick() {
    try {
      const r = await pfmBudgetsService.evaluateBudgets({ now: new Date() })
      if ((r?.alerted ?? 0) > 0) {
        console.log(`[worker] pfm budgets ${formatLogTimestamp()} evaluated=${r.evaluated} alerted=${r.alerted}`)
      }
    } catch (err) {
      console.error('[worker] pfm budget tick failed:', err?.message ?? err)
      if (isConnectionError(err)) await reconnect()
    }
  }
  runPfmBudgetTick()
  setInterval(() => { runPfmBudgetTick() }, PFM_BUDGET_INTERVAL_MS)
  ```
- [ ] **Step 2: SDK** — add to the `pfm` group: `listBudgets(token, query)`, `createBudget`, `updateBudget`, `setBudgetEnabled`, `listGoals`, `createGoal`, `updateGoal`, `setGoalEnabled`, `contributeGoal(id, amount, token)`, `updateWalletCredit(id, data, token)` (PATCH `/pfm/wallets/:id/credit`). Mirror the existing method style.
- [ ] **Step 3** — `node --check` both; `node --test "packages/sdk/src/__tests__/*.test.js"` (22/1 unchanged).
- [ ] **Step 4** — `git add apps/worker/src/index.js packages/sdk/src/index.js && git commit -m "feat(pfm): worker budget-alert tick + SDK budget/goal methods"`

---

## Task 10: Sweep + live check

- [ ] **Step 1** — `node --test "apps/api/src/routes/pfm/__tests__/*.test.js"` → all PASS (Phase 1-3's 38 + budgets 5 + goals 4 + credit 2 + 2 bridge = 51).
- [ ] **Step 2** — `pnpm db:seed` (re-seed so the new manifest perms land) → OK. `pnpm build` → success.
- [ ] **Step 3 (live)** — script against the real DB: create wallet + a `Comida` budget of 100; create two `POSTED` EXPENSE movements of 60 + 50 in `Comida`; call `budgets.listBudgets` and assert `spent === 110`, `pct === 1.1`; call `evaluateBudgets` with a **stub** `notificationService.publish` and assert it was called once with `eventType: "pfm.budget.overage"`. Create a CREDIT wallet with `statementDay`/`paymentDueDay`/`creditLimit` via `updateWallet`; add movements; `getWallet` and assert `creditCycle.totalOwed` / `availableCredit` are right. Create a goal, `contribute(+500)` then `contribute(-1000)` and assert `currentAmount` floors at 0. Clean up.
- [ ] **Step 4** — `git add -A && git commit -m "chore(pfm): phase 4 plan a sweep"`

---

## Self-Review

- **Spec coverage:** §3.1 credit fields (`creditLimit`/`statementDay`/`paymentDueDay`) on `PfmWallet` → Tasks 1, 6. §3.8 `PfmBudget` (MONTHLY, per-category, optional per-wallet, `alertThreshold` default 0.8, unique per owner/category/wallet/period) → Tasks 1, 4. §3.9 `PfmGoal` (`targetAmount`/`targetDate`/`currentAmount`, progress) → Tasks 1, 5. §7 budgets + goals **private to `ownerId`** — every query filters `owner_id = actor`, no membership branch → Tasks 4, 5. §4/§5.3 credit payment-due reminder as a monthly recurring `CalendarEvent` with `sourceModule "atlas.pfm"` and a reminder → Task 7. Budget threshold + overage → notification via the existing service, deduped per budget/month/level → Task 4 + worker Task 9. Period-vs-total-owed vs available credit → Task 6.
- **Placeholder scan:** Tasks 7, 8, 9 describe endpoints/shape rather than pasting every line — each names the exact pattern file to copy (`recurring-routes.js`), the exact schemas, the exact `grep` to confirm an injected dependency's local name, and the exact assertions. These are build instructions with no ambiguity, not "TODO". (If the executing agent prefers, expand Task 8's router inline from the `recurring-routes.js` template before writing.)
- **Type consistency:** `createBudgetsService({ prisma, notificationService })`, `createGoalsService({ prisma })`, `computeCreditCycle(wallet, movements, now)` signatures match service/index/worker/tests. Budget list shape (`{ id, categoryId, categoryName, walletId, amount, spent, remaining, pct, alertThreshold }`) and goal list shape (`{ id, name, targetAmount, currentAmount, targetDate, walletId, color, pct }`) are what the SDK + Plan B render. `notificationService.publish({ companyId, actorId, input: { eventType, title, body, link, priority, recipients: { userIds }, dedupeKey } })` matches `packages/validators` `notificationPublishSchema` exactly. New permission keys `pfm.budgets.manage` / `pfm.goals.manage` added to catalog + manifest + acl (Task 2).
