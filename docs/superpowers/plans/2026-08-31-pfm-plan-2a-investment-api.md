# atlas.pfm Plan 2A — API: investment/yield wallets + daily accrual

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an `INVESTMENT` wallet kind with an editable `expectedRate`, a per-day compounding yield accrual (worker tick → one `is_yield` INCOME movement per day per wallet, cursor-guarded by `last_accrued_on`), and wire the real `investments` total into the summary.

**Architecture:** Node + Hono API, Prisma-managed `pfm_*` tables (hand-authored forward migrations). New `investments-service.js` uses Prisma model accessors (the `pfm_*` tables have real Prisma models, like `wallets-service`/`movements-service`). The worker (`apps/worker/src/index.js`) runs `accrueYieldDue` on an hourly interval; the cursor makes it act at most once/day per wallet. Spec: `docs/superpowers/specs/2026-08-31-pfm-investment-wallets-design.md`.

**Tech Stack:** Node built-in test runner (`node --test`), Prisma 7, Zod, Hono.

**Prerequisite for Plan 2B:** land this first (2B consumes `kind = "INVESTMENT"`, `wallet.expectedRate`, `wallet.accruedThisMonth`, `movement.isYield`, `summary.investments`).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `prisma/schema.prisma` | `PfmWalletKind` + `INVESTMENT`; `PfmWallet` + `expectedRate` / `lastAccruedOn`; `PfmMovement` + `isYield` | 1 |
| `prisma/migrations/20260831070000_pfm_wallet_kind_investment/migration.sql` | create — `ALTER TYPE ADD VALUE` | 1 |
| `prisma/migrations/20260831070100_pfm_investment_fields/migration.sql` | create — 3× `ADD COLUMN` | 1 |
| `apps/api/src/routes/pfm/wallets-service.js` | `normalizeWalletRow` + fields; `createWallet` INVESTMENT branch; `updateWallet` patch keys; `getWallet` `accruedThisMonth` | 2, 4, 5 |
| `apps/api/src/routes/pfm/movements-service.js` | `normalizeMovement` surfaces `isYield` | 3 |
| `apps/api/src/routes/pfm/validators.js` | `createWalletSchema` — `INVESTMENT` kind + `expectedRate` | 6 |
| `apps/api/src/routes/pfm/investments-service.js` | create — `accrueYieldDue` | 7 |
| `apps/api/src/routes/pfm/index.js` | instantiate `investments`, expose on `app.pfmServices` | 8 |
| `apps/worker/src/index.js` | import factory, `runPfmYieldTick` + interval | 8 |
| `apps/api/src/routes/pfm/summary-service.js` | real `investments` aggregate | 9 |
| `apps/api/src/manifests/official/core-modules.js` | `atlas.pfm` `0.3.0` → `0.4.0` | 10 |
| `apps/api/src/routes/pfm/__tests__/investments-service.test.js` | create | 7 |
| `apps/api/src/routes/pfm/__tests__/wallets-service.test.js` | INVESTMENT create test | 4 |
| `apps/api/src/routes/pfm/__tests__/movements-service.test.js` | `isYield` DTO test | 3 |
| `apps/api/src/routes/pfm/__tests__/summary-service.test.js` | `investments` aggregate test | 9 |

---

## Task 1: schema + migrations

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260831070000_pfm_wallet_kind_investment/migration.sql`
- Create: `prisma/migrations/20260831070100_pfm_investment_fields/migration.sql`

- [ ] **Step 1: Edit the schema**

In `prisma/schema.prisma`:

`enum PfmWalletKind` — add `INVESTMENT` after `CREDIT`:

```prisma
enum PfmWalletKind {
  CASH
  DEBIT
  CREDIT
  INVESTMENT

  @@map("pfm_wallet_kind")
}
```

`model PfmWallet` — add two lines after `paymentDueDay         Int?     @map("payment_due_day")`:

```prisma
  expectedRate          Decimal? @map("expected_rate") @db.Decimal(6, 4)
  lastAccruedOn          DateTime? @map("last_accrued_on") @db.Date
```

`model PfmMovement` — add after `isAdjustment    Boolean              @default(false) @map("is_adjustment")`:

```prisma
  isYield         Boolean              @default(false) @map("is_yield")
```

- [ ] **Step 2: Create the enum-value migration**

Create `prisma/migrations/20260831070000_pfm_wallet_kind_investment/migration.sql`:

```sql
-- atlas.pfm: investment / yield wallet kind.
ALTER TYPE "pfm_wallet_kind" ADD VALUE IF NOT EXISTS 'INVESTMENT';
```

- [ ] **Step 3: Create the columns migration**

Create `prisma/migrations/20260831070100_pfm_investment_fields/migration.sql`:

```sql
-- atlas.pfm: investment wallet fields + yield movement flag.
ALTER TABLE "pfm_wallet" ADD COLUMN "expected_rate" DECIMAL(6,4);
ALTER TABLE "pfm_wallet" ADD COLUMN "last_accrued_on" DATE;
ALTER TABLE "pfm_movement" ADD COLUMN "is_yield" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 4: Apply + regenerate**

Run: `pnpm db:migrate`
Expected: `All migrations have been successfully applied.` then a successful `prisma generate`. (If Postgres rejects the enum `ADD VALUE` for being in a transaction with later use — it should not, since it is its own migration file and nothing in that file uses the value — re-run; the columns migration is separate.)

Run: `pnpm db:generate`
Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260831070000_pfm_wallet_kind_investment/ prisma/migrations/20260831070100_pfm_investment_fields/
git commit -m "feat(pfm): INVESTMENT wallet kind + expected_rate/last_accrued_on/is_yield columns"
```

---

## Task 2: `normalizeWalletRow` surfaces `expectedRate` + `lastAccruedOn`

**Files:**
- Modify: `apps/api/src/routes/pfm/wallets-service.js` (`normalizeWalletRow`, ~line 255)

No dedicated test (covered indirectly by Task 4 and 5). This is a pure additive DTO change.

- [ ] **Step 1: Add the fields**

In `apps/api/src/routes/pfm/wallets-service.js`, in `normalizeWalletRow`, add after the `paymentDueDay:` line:

```js
    expectedRate:
      (row.expected_rate ?? row.expectedRate) == null
        ? null
        : toPlainNumber(row.expected_rate ?? row.expectedRate),
    lastAccruedOn: (() => {
      const v = row.last_accrued_on ?? row.lastAccruedOn ?? null;
      if (!v) return null;
      return v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    })(),
```

- [ ] **Step 2: Static check**

Run: `node --check apps/api/src/routes/pfm/wallets-service.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pfm/wallets-service.js
git commit -m "feat(pfm): expose expectedRate + lastAccruedOn on wallet DTO"
```

---

## Task 3: `normalizeMovement` surfaces `isYield`

**Files:**
- Modify: `apps/api/src/routes/pfm/movements-service.js` (`normalizeMovement`)
- Test: `apps/api/src/routes/pfm/__tests__/movements-service.test.js`

- [ ] **Step 1: Write the failing test**

Add inside `describe("movements-service", ...)` in `apps/api/src/routes/pfm/__tests__/movements-service.test.js` (next to the existing `"listMovements exposes isAdjustment on each row"` test):

```js
  it("listMovements exposes isYield on each row", async () => {
    const prisma = {
      $queryRaw: async () => [
        {
          id: MOV,
          wallet_id: WALLET,
          direction: "INCOME",
          amount: "1.23",
          occurred_on: "2026-08-20",
          status: "POSTED",
          is_yield: true,
        },
      ],
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    const { data } = await service.listMovements({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      query: {},
    });
    assert.equal(data[0].isYield, true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: FAIL — `data[0].isYield` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/movements-service.js`, in `normalizeMovement`, add next to the `isAdjustment:` line:

```js
    isYield: Boolean(row.is_yield ?? row.isYield ?? false),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/movements-service.js apps/api/src/routes/pfm/__tests__/movements-service.test.js
git commit -m "feat(pfm): expose isYield on movement DTO"
```

---

## Task 4: `createWallet` INVESTMENT branch + `updateWallet` patch keys

**Files:**
- Modify: `apps/api/src/routes/pfm/wallets-service.js` (`createWallet`, `updateWallet`)
- Test: `apps/api/src/routes/pfm/__tests__/wallets-service.test.js`

- [ ] **Step 1: Write the failing test**

Add a new `describe` block at the end of `apps/api/src/routes/pfm/__tests__/wallets-service.test.js` (the file defines `COMPANY` / `OWNER`):

```js
describe("wallets-service — createWallet INVESTMENT", () => {
  it("persists expectedRate and sets lastAccruedOn to today", async () => {
    let createArgs = null;
    const prisma = {
      pfmWallet: {
        create: async (args) => ((createArgs = args), { id: "01900000-0000-7000-8000-00000000d0de", ...args.data }),
      },
    };
    const service = createWalletsService({ prisma });
    await service.createWallet({
      companyId: COMPANY,
      ownerId: OWNER,
      data: { name: "Cetes", kind: "INVESTMENT", currency: "MXN", openingBalance: 10000, expectedRate: 0.11 },
    });
    assert.equal(Number(createArgs.data.openingBalance), 10000);
    assert.equal(Number(createArgs.data.expectedRate), 0.11);
    const today = new Date().toISOString().slice(0, 10);
    const stored =
      createArgs.data.lastAccruedOn instanceof Date
        ? createArgs.data.lastAccruedOn.toISOString().slice(0, 10)
        : String(createArgs.data.lastAccruedOn).slice(0, 10);
    assert.equal(stored, today);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/wallets-service.test.js`
Expected: FAIL — `createArgs.data.expectedRate` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/wallets-service.js`, replace the `createWallet` `try` body (the `const isCredit ...` through the `prisma.pfmWallet.create({ ... })` call) with:

```js
      const isCredit = data.kind === "CREDIT";
      const isInvestment = data.kind === "INVESTMENT";
      const openingBalance = isCredit
        ? -(data.openingUsed ?? 0)
        : (data.openingBalance ?? 0);
      const todayDate = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
      const wallet = await prisma.pfmWallet.create({
        data: {
          companyId,
          ownerId,
          name: data.name,
          kind: data.kind,
          currency: data.currency ?? "MXN",
          openingBalance,
          color: data.color ?? null,
          icon: data.icon ?? null,
          ledgerAccountId: data.ledgerAccountId ?? null,
          reference: data.reference ?? null,
          creditLimit: isCredit ? (data.creditLimit ?? null) : null,
          statementDay: isCredit ? (data.statementDay ?? null) : null,
          paymentDueDay: isCredit ? (data.paymentDueDay ?? null) : null,
          expectedRate: isInvestment ? (data.expectedRate ?? null) : null,
          lastAccruedOn: isInvestment ? todayDate : null,
        },
      });
```

Then, in `updateWallet`, add `"expectedRate"` and `"lastAccruedOn"` to the whitelist `for (const key of [...])` array (after `"paymentDueDay"`).

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/wallets-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/__tests__/wallets-service.test.js
git commit -m "feat(pfm): createWallet persists expectedRate + lastAccruedOn for INVESTMENT"
```

---

## Task 5: `getWallet` attaches `accruedThisMonth` for INVESTMENT

**Files:**
- Modify: `apps/api/src/routes/pfm/wallets-service.js` (`getWallet`, near the `creditCycle` block)

No dedicated unit test (the existing `getWallet` tests stub `$queryRaw` and would need the extra response wired; this is a small additive read mirroring the `creditCycle` attach). It is exercised by Plan 2B manual QA.

- [ ] **Step 1: Implement**

In `apps/api/src/routes/pfm/wallets-service.js`, in `getWallet`, find the block:

```js
      const wallet = normalizeWalletRow(row);
      if (wallet.kind === "CREDIT" && wallet.statementDay) {
        const movs = await prisma.pfmMovement.findMany({
          where: { walletId, enabled: true, status: "POSTED" },
          select: { direction: true, amount: true, occurredOn: true, status: true },
        });
        wallet.creditCycle = computeCreditCycle(wallet, movs);
      }
      return wallet;
```

and insert, before `return wallet;`:

```js
      if (wallet.kind === "INVESTMENT") {
        const monthStart = `${new Date().toISOString().slice(0, 7)}-01`;
        const agg = await prisma.pfmMovement.aggregate({
          _sum: { amount: true },
          where: {
            walletId,
            enabled: true,
            status: "POSTED",
            isYield: true,
            occurredOn: {
              gte: new Date(`${monthStart}T00:00:00.000Z`),
            },
          },
        });
        wallet.accruedThisMonth = toPlainNumber(agg._sum.amount ?? 0);
      }
```

- [ ] **Step 2: Static check**

Run: `node --check apps/api/src/routes/pfm/wallets-service.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pfm/wallets-service.js
git commit -m "feat(pfm): getWallet reports accruedThisMonth for INVESTMENT wallets"
```

---

## Task 6: validators — `INVESTMENT` kind + `expectedRate`

**Files:**
- Modify: `apps/api/src/routes/pfm/validators.js`

- [ ] **Step 1: Edit `createWalletSchema`**

In `apps/api/src/routes/pfm/validators.js`, in `createWalletSchema`:

- change `kind: z.enum(["CASH", "DEBIT", "CREDIT"]),` to `kind: z.enum(["CASH", "DEBIT", "CREDIT", "INVESTMENT"]),`
- add after the `openingUsed` line:

```js
  expectedRate: z.number().min(0).max(1).optional().nullable(),
```

`updateWalletSchema` is `createWalletSchema.partial().omit({ ledgerAccountId: true, openingUsed: true }).extend({...})` — it picks up `expectedRate` automatically.

- [ ] **Step 2: Static check**

Run: `node --check apps/api/src/routes/pfm/validators.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pfm/validators.js
git commit -m "feat(pfm): wallet schema accepts INVESTMENT kind + expectedRate"
```

---

## Task 7: `investments-service.js` — `accrueYieldDue`

**Files:**
- Create: `apps/api/src/routes/pfm/investments-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/investments-service.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/api/src/routes/pfm/__tests__/investments-service.test.js`:

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createInvestmentsService } from "../investments-service.js";

const W = "01900000-0000-7000-8000-0000000000f1";
const CO = "01900000-0000-7000-8000-0000000000f2";
const OW = "01900000-0000-7000-8000-0000000000f3";

function isoDay(d) {
  return new Date(d).toISOString().slice(0, 10);
}

// Prisma stub: one INVESTMENT wallet, controllable movement history.
function makeprisma({ wallet, movements = [] }) {
  const inserted = [];
  const updated = [];
  const tx = {
    pfmMovement: {
      create: async ({ data }) => (inserted.push(data), { id: "m", ...data }),
    },
    pfmWallet: {
      update: async (args) => (updated.push(args), { id: W }),
    },
  };
  const prisma = {
    pfmWallet: {
      findMany: async () => (wallet ? [wallet] : []),
    },
    pfmMovement: {
      findMany: async () => movements,
    },
    $transaction: async (fn) => fn(tx),
  };
  return { prisma, inserted, updated };
}

describe("investments-service.accrueYieldDue", () => {
  it("books one compounding INCOME movement per un-accrued day and advances the cursor", async () => {
    // now = 2026-08-10; yesterday = 2026-08-09; cursor = 2026-08-06 -> days 07,08,09
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted, updated } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.3650", // daily 0.001
        lastAccruedOn: new Date("2026-08-06T00:00:00.000Z"),
      },
      movements: [],
    });
    const res = await createInvestmentsService({ prisma }).accrueYieldDue({ now });
    assert.equal(res.processed, 1);
    assert.equal(res.created, 3);
    assert.deepEqual(inserted.map((m) => isoDay(m.occurredOn)), ["2026-08-07", "2026-08-08", "2026-08-09"]);
    // compounding: day1 on 1000 -> 1.00; day2 on 1001 -> 1.00 (rounds to 1.00); day3 on ~1002 -> 1.00
    assert.equal(Number(inserted[0].amount), 1);
    assert.ok(Number(inserted[1].amount) >= 1);
    assert.equal(inserted[0].direction, "INCOME");
    assert.equal(inserted[0].isYield, true);
    assert.equal(inserted[0].status, "POSTED");
    assert.equal(inserted[0].walletId, W);
    assert.equal(isoDay(updated[0].data.lastAccruedOn), "2026-08-09");
  });

  it("does nothing when the cursor is already yesterday-or-later", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.1000",
        lastAccruedOn: new Date("2026-08-09T00:00:00.000Z"),
      },
    });
    const res = await createInvestmentsService({ prisma }).accrueYieldDue({ now });
    assert.equal(res.created, 0);
    assert.equal(inserted.length, 0);
  });

  it("caps the backfill window", async () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const { prisma, inserted } = makeprisma({
      wallet: {
        id: W,
        companyId: CO,
        ownerId: OW,
        openingBalance: "1000.00",
        expectedRate: "0.3650",
        lastAccruedOn: new Date("2020-01-01T00:00:00.000Z"),
      },
    });
    await createInvestmentsService({ prisma }).accrueYieldDue({ now, maxBackfillDays: 5 });
    assert.equal(inserted.length, 5);
    assert.equal(isoDay(inserted[0].occurredOn), "2026-08-05");
    assert.equal(isoDay(inserted[4].occurredOn), "2026-08-09");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/pfm/__tests__/investments-service.test.js`
Expected: FAIL — `Cannot find module '../investments-service.js'`.

- [ ] **Step 3: Implement**

Create `apps/api/src/routes/pfm/investments-service.js`:

```js
// apps/api/src/routes/pfm/investments-service.js
import { isTableNotFoundError, PfmServiceError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

function isoDay(d) {
  const s = d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
  return s;
}
function dateUTC(iso) {
  return new Date(`${iso}T00:00:00.000Z`);
}
function addDays(iso, n) {
  const d = dateUTC(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function round2(n) {
  return Math.round(n * 100) / 100;
}

export function createInvestmentsService({ prisma }) {
  // Books one compounding daily-yield INCOME movement per elapsed un-accrued day
  // for every INVESTMENT wallet with a positive expected rate. Idempotent via
  // pfm_wallet.last_accrued_on.
  async function accrueYieldDue({ now = new Date(), maxBackfillDays = 60 } = {}) {
    const todayIso = isoDay(now);
    const yesterdayIso = addDays(todayIso, -1);

    let wallets;
    try {
      wallets = await prisma.pfmWallet.findMany({
        where: {
          kind: "INVESTMENT",
          enabled: true,
          expectedRate: { gt: 0 },
          OR: [{ lastAccruedOn: null }, { lastAccruedOn: { lt: dateUTC(todayIso) } }],
        },
        select: {
          id: true,
          companyId: true,
          ownerId: true,
          openingBalance: true,
          expectedRate: true,
          lastAccruedOn: true,
        },
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }

    let processed = 0;
    let created = 0;

    for (const w of wallets) {
      processed += 1;
      try {
        const cursorIso = w.lastAccruedOn ? isoDay(w.lastAccruedOn) : addDays(todayIso, -1);
        let startIso = addDays(cursorIso, 1);
        // clamp the backfill window
        const earliestIso = addDays(yesterdayIso, -(maxBackfillDays - 1));
        if (startIso < earliestIso) startIso = earliestIso;
        // cursor already at/past yesterday -> nothing elapsed to accrue
        if (startIso > yesterdayIso) continue;

        const movs = await prisma.pfmMovement.findMany({
          where: { walletId: w.id, enabled: true, status: "POSTED" },
          select: { direction: true, amount: true, occurredOn: true },
        });
        const history = movs.map((m) => ({
          day: isoDay(m.occurredOn),
          signed: Number(m.amount) * (m.direction === "INCOME" ? 1 : -1),
        }));

        const opening = Number(w.openingBalance);
        const dailyRate = Number(w.expectedRate) / 365;
        const toInsert = [];
        for (let day = startIso; day <= yesterdayIso; day = addDays(day, 1)) {
          const balance =
            opening +
            history.filter((h) => h.day <= day).reduce((s, h) => s + h.signed, 0) +
            toInsert.filter((t) => t.day < day).reduce((s, t) => s + t.amount, 0);
          const amount = round2(balance * dailyRate);
          if (amount > 0) toInsert.push({ day, amount });
        }

        await prisma.$transaction(async (tx) => {
          for (const t of toInsert) {
            await tx.pfmMovement.create({
              data: {
                companyId: w.companyId,
                ownerId: w.ownerId,
                walletId: w.id,
                categoryId: null,
                direction: "INCOME",
                amount: t.amount,
                occurredOn: dateUTC(t.day),
                note: "Rendimiento",
                merchant: null,
                status: "POSTED",
                isYield: true,
              },
            });
          }
          await tx.pfmWallet.update({
            where: { id: w.id },
            data: { lastAccruedOn: dateUTC(yesterdayIso) },
          });
        });
        created += toInsert.length;
      } catch (err) {
        console.error("[atlas.pfm] accrueYieldDue failed", w.id, err?.message ?? err);
      }
    }

    return { processed, created };
  }

  return { accrueYieldDue, _toPlainNumber: toPlainNumber };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/pfm/__tests__/investments-service.test.js`
Expected: PASS — all 3 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/investments-service.js apps/api/src/routes/pfm/__tests__/investments-service.test.js
git commit -m "feat(pfm): investments-service accrueYieldDue (daily compound yield)"
```

---

## Task 8: wire the service into the router + worker

**Files:**
- Modify: `apps/api/src/routes/pfm/index.js`
- Modify: `apps/worker/src/index.js`

- [ ] **Step 1: Router wiring**

In `apps/api/src/routes/pfm/index.js`:

Add the import near the other `create*Service` imports:

```js
import { createInvestmentsService } from "./investments-service.js";
```

Instantiate near `const summary = createSummaryService({ prisma });`:

```js
  const investments = createInvestmentsService({ prisma });
```

Add it to the exposed services object:

```js
  app.pfmServices = { recurring, summary, receipts, budgets, goals, investments };
```

- [ ] **Step 2: Worker wiring**

In `apps/worker/src/index.js`:

Add the import next to the other pfm service imports (~line 30):

```js
import { createInvestmentsService as createPfmInvestmentsService } from '../../api/src/routes/pfm/investments-service.js'
```

After the `PFM_BUDGET_INTERVAL_MS` const block, add:

```js
const pfmInvestmentsService = createPfmInvestmentsService({ prisma })
const PFM_YIELD_INTERVAL_MS = 60 * 60 * 1000
```

Next to `runPfmBudgetTick` (or after the `runPfmRecurringTick` interval block), add:

```js
async function runPfmYieldTick() {
  try {
    const result = await pfmInvestmentsService.accrueYieldDue({ now: new Date() })
    if ((result?.created ?? 0) > 0) {
      console.log(
        `[worker] pfm yield ${formatLogTimestamp()} processed=${result.processed} created=${result.created}`,
      )
    }
  } catch (err) {
    console.error('[worker] pfm yield tick failed:', err?.message ?? err)
    if (isConnectionError(err)) await reconnect()
  }
}

runPfmYieldTick()
setInterval(() => {
  runPfmYieldTick()
}, PFM_YIELD_INTERVAL_MS)
```

- [ ] **Step 3: Static checks**

Run: `node --check apps/api/src/routes/pfm/index.js && node --check apps/worker/src/index.js`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/pfm/index.js apps/worker/src/index.js
git commit -m "feat(pfm): worker tick for daily investment yield accrual"
```

---

## Task 9: summary `investments` aggregate

**Files:**
- Modify: `apps/api/src/routes/pfm/summary-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/summary-service.test.js`

- [ ] **Step 1: Update the tests**

In `apps/api/src/routes/pfm/__tests__/summary-service.test.js`, in the first test (`"getOverview returns totals..."`):

- change the first `responses` entry to include `investments`:

```js
      [{ total_balance: "22000.00", spendable: "18000.00", credit_debt: "4000.00", investments: "9000.00" }],
```

- change the existing assertion `assert.equal(res.investments, 0);` to:

```js
    assert.equal(res.investments, 9000);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js`
Expected: FAIL — `res.investments` is `0` (hardcoded).

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/summary-service.js`, in the `balanceRows` query, add a third aggregate alongside `spendable` / `credit_debt`:

```sql
          COALESCE(SUM(bal) FILTER (WHERE kind = 'INVESTMENT'), 0) AS investments
```

(so the `SELECT` lists `total_balance`, `spendable`, `credit_debt`, `investments`).

In the returned object, change `investments: 0,` to:

```js
        investments: toPlainNumber(bal.investments),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/summary-service.js apps/api/src/routes/pfm/__tests__/summary-service.test.js
git commit -m "feat(pfm): summary investments total sums INVESTMENT wallet balances"
```

---

## Task 10: manifest bump + full sweep

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js`

- [ ] **Step 1: Bump**

In `apps/api/src/manifests/official/core-modules.js`, in `atlasPfmManifest`, change `version: "0.3.0",` to `version: "0.4.0",`.

- [ ] **Step 2: pfm test sweep**

Run:
```bash
node --test $(find apps/api/src/routes/pfm/__tests__ -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0`.

- [ ] **Step 3: Broader API sweep**

Run:
```bash
node --test $(find apps/api/src/services/__tests__ apps/api/src/routes -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0`.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js
git commit -m "chore(pfm): manifest 0.4.0"
```

---

## Self-Review

**Spec coverage:**
- `INVESTMENT` kind + `expectedRate` + `lastAccruedOn` + `isYield` columns → Task 1.
- DTO exposure of `expectedRate`/`lastAccruedOn` → Task 2; `isYield` → Task 3.
- `createWallet` INVESTMENT branch (rate + cursor = today, principal as-is) → Task 4; `updateWallet` accepts `expectedRate` → Task 4.
- `getWallet` `accruedThisMonth` → Task 5.
- Validators `INVESTMENT` + `expectedRate` (0–1) → Task 6.
- Daily compound accrual, one INCOME `is_yield` movement/day, cursor guard, backfill cap, per-wallet transaction, error isolation → Task 7.
- Router `app.pfmServices.investments` + worker hourly tick → Task 8.
- Summary real `investments` aggregate; yield already flows into monthIncome/trend (no change needed) → Task 9.
- Manifest 0.4.0 → Task 10.
- Two-migration split for the PG enum-value constraint → Task 1.

**Placeholder scan:** none. Every code step is a complete block or a precise textual change with its anchor shown.

**Type consistency:**
- `accrueYieldDue({ now, maxBackfillDays })` → same in Task 7 impl, tests, and Task 8 worker call (`{ now }` only; `maxBackfillDays` defaults to 60).
- Returns `{ processed, created }` → asserted in tests, logged by the worker.
- Movement insert shape (`isYield: true`, `direction: "INCOME"`, `status: "POSTED"`, `note: "Rendimiento"`, `categoryId: null`) is consistent with `normalizeMovement` (Task 3) and the DB columns (Task 1).
- `wallet.expectedRate` (fraction) / `wallet.lastAccruedOn` (ISO string) / `wallet.accruedThisMonth` (number) — the DTO field names Plan 2B consumes.
- `summary.investments` (number) → Plan 2B's existing "Inversiones" card reads it.
