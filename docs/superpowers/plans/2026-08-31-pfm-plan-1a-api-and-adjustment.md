# atlas.pfm Plan 1A — API: credit-card fields at creation + balance adjustment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `is_adjustment` movement flag + `POST /pfm/wallets/:id/adjust` reconciliation endpoint, accept credit-card fields (`creditLimit`, `statementDay`, `paymentDueDay`, `openingUsed`) on wallet creation, expose `spendable` / `creditDebt` / `investments` in the summary, and remove the now-redundant `PATCH /pfm/wallets/:id/credit` route.

**Architecture:** Node + Hono API, services under `apps/api/src/routes/pfm/`, Prisma-managed `pfm_*` tables (hand-authored forward migration). Adjustments are ordinary `pfm_movement` rows with `is_adjustment = true`; the balance formula `opening_balance + Σ(signed posted movements)` is unchanged, but summary aggregates for month expense/income/category/trend exclude adjustments. Spec: `docs/superpowers/specs/2026-08-31-pfm-credit-cards-and-balance-adjustment-design.md`.

**Tech Stack:** Node built-in test runner (`node --test`), Prisma 7, Zod, Hono, `@atlas/sdk`.

**Prerequisite for Plan 1B:** this plan must land first (1B consumes the endpoints and DTO fields defined here).

---

## File Structure

| File | Change | Task |
|---|---|---|
| `prisma/schema.prisma` (`model PfmMovement`) | add `isAdjustment Boolean @default(false) @map("is_adjustment")` | 1 |
| `prisma/migrations/20260831060000_pfm_movement_is_adjustment/migration.sql` | create — `ALTER TABLE` | 1 |
| `apps/api/src/routes/pfm/movements-service.js` | `normalizeMovement` surfaces `isAdjustment`; new `adjustWalletBalance` | 2, 5 |
| `apps/api/src/routes/pfm/validators.js` | extend `createWalletSchema`; add `adjustBalanceSchema`; remove `creditCardSchema` | 3, 4, 6 |
| `apps/api/src/routes/pfm/wallets-service.js` | `createWallet` credit fields + credit opening balance; `computeCreditCycle.utilization` | 4, 7 |
| `apps/api/src/routes/pfm/budgets-routes.js` | remove `PATCH /pfm/wallets/:id/credit` handler + import | 6 |
| `apps/api/src/routes/pfm/movements-routes.js` | add `POST /pfm/wallets/:id/adjust` | 5 |
| `apps/api/src/routes/pfm/summary-service.js` | `spendable` / `creditDebt` / `investments`; exclude adjustments | 8 |
| `packages/sdk/src/index.js` | remove `updateWalletCredit`; add `adjustWalletBalance` | 5, 6 |
| `apps/api/src/manifests/official/core-modules.js` | `atlas.pfm` version `0.2.0` → `0.3.0` | 9 |
| `apps/api/src/routes/pfm/__tests__/movements-service.test.js` | adjust tests | 5 |
| `apps/api/src/routes/pfm/__tests__/summary-service.test.js` | spendable/creditDebt/adjustment-exclusion tests | 8 |
| `apps/api/src/routes/pfm/__tests__/credit-cycle.test.js` | `utilization` assertion | 7 |
| `apps/api/src/routes/pfm/__tests__/wallets-service.test.js` | credit-create test | 4 |

---

## Task 1: `is_adjustment` column + migration

**Files:**
- Modify: `prisma/schema.prisma` (`model PfmMovement`, after the `status` line)
- Create: `prisma/migrations/20260831060000_pfm_movement_is_adjustment/migration.sql`

- [ ] **Step 1: Add the field to the Prisma model**

In `prisma/schema.prisma`, in `model PfmMovement`, add the line directly after `status  PfmMovementStatus  @default(POSTED)`:

```prisma
  isAdjustment    Boolean              @default(false) @map("is_adjustment")
```

- [ ] **Step 2: Create the forward migration**

Create `prisma/migrations/20260831060000_pfm_movement_is_adjustment/migration.sql`:

```sql
-- atlas.pfm: mark reconciliation ("Ajustar saldo") movements so summary
-- aggregates can exclude them while balances still count them.
ALTER TABLE "pfm_movement" ADD COLUMN "is_adjustment" BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 3: Apply + regenerate the client**

Run: `pnpm db:migrate`
Expected: output ends with `All migrations have been successfully applied.` (or "No pending migrations" if already applied) followed by a successful `prisma generate`.

Run: `pnpm db:generate`
Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260831060000_pfm_movement_is_adjustment/
git commit -m "feat(pfm): pfm_movement.is_adjustment column + migration"
```

---

## Task 2: Surface `isAdjustment` in the movement DTO

**Files:**
- Modify: `apps/api/src/routes/pfm/movements-service.js` (`normalizeMovement`, ~line 145)
- Test: `apps/api/src/routes/pfm/__tests__/movements-service.test.js`

- [ ] **Step 1: Write the failing test**

Add inside `describe("movements-service", ...)` in `apps/api/src/routes/pfm/__tests__/movements-service.test.js`:

```js
  it("listMovements exposes isAdjustment on each row", async () => {
    const prisma = {
      $queryRaw: async () => [
        {
          id: MOV,
          wallet_id: WALLET,
          direction: "INCOME",
          amount: "300.00",
          occurred_on: "2026-08-20",
          status: "POSTED",
          is_adjustment: true,
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
    assert.equal(data[0].isAdjustment, true);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: FAIL — `data[0].isAdjustment` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/movements-service.js`, in `normalizeMovement`, add before `editableInPfm: true,`:

```js
    isAdjustment: Boolean(row.is_adjustment ?? row.isAdjustment ?? false),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/movements-service.js apps/api/src/routes/pfm/__tests__/movements-service.test.js
git commit -m "feat(pfm): expose isAdjustment on movement DTO"
```

---

## Task 3: Wallet + adjust validators

**Files:**
- Modify: `apps/api/src/routes/pfm/validators.js`

- [ ] **Step 1: Extend `createWalletSchema` and add `adjustBalanceSchema`**

In `apps/api/src/routes/pfm/validators.js`, replace the `createWalletSchema` / `updateWalletSchema` block (lines ~18–34) with:

```js
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
```

Then add, at the end of the file (replacing the existing `creditCardSchema` export from line ~170):

```js
export const adjustBalanceSchema = z.object({
  targetBalance: z.number().max(9_999_999_999),
  note: z.string().max(500).optional().nullable(),
  occurredOn: isoDateSchema.optional(),
});
```

Delete the `creditCardSchema` export entirely (it is replaced by Task 6).

- [ ] **Step 2: Static check**

Run: `node --check apps/api/src/routes/pfm/validators.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/pfm/validators.js
git commit -m "feat(pfm): wallet create accepts credit fields; add adjustBalanceSchema"
```

---

## Task 4: `createWallet` handles credit fields + opening used

**Files:**
- Modify: `apps/api/src/routes/pfm/wallets-service.js` (`createWallet`, ~line 136)
- Test: `apps/api/src/routes/pfm/__tests__/wallets-service.test.js`

- [ ] **Step 1: Write the failing test**

The file uses `describe`/`it` and defines `COMPANY` / `OWNER` UUID constants. Add a new `describe` block at the end of the file:

```js
describe("wallets-service — createWallet credit fields", () => {
  it("CREDIT wallet stores credit fields and negative opening balance from openingUsed", async () => {
    let createArgs = null;
    const prisma = {
      pfmWallet: {
        create: async (args) => {
          createArgs = args;
          return { id: "01900000-0000-7000-8000-00000000c0de", ...args.data };
        },
      },
    };
    const service = createWalletsService({ prisma });
    await service.createWallet({
      companyId: COMPANY,
      ownerId: OWNER,
      data: {
        name: "Amex",
        kind: "CREDIT",
        currency: "MXN",
        openingBalance: 0,
        creditLimit: 50000,
        statementDay: 4,
        paymentDueDay: 22,
        openingUsed: 12000,
      },
    });
    assert.equal(Number(createArgs.data.openingBalance), -12000);
    assert.equal(Number(createArgs.data.creditLimit), 50000);
    assert.equal(createArgs.data.statementDay, 4);
    assert.equal(createArgs.data.paymentDueDay, 22);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/wallets-service.test.js`
Expected: FAIL — `createArgs.data.openingBalance` is `0`, `creditLimit` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/wallets-service.js`, replace the body of `createWallet` (the `try` block up to the `return normalizeWalletRow(...)`) with:

```js
    if (!ownerId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    try {
      const isCredit = data.kind === "CREDIT";
      const openingBalance = isCredit
        ? -(data.openingUsed ?? 0)
        : (data.openingBalance ?? 0);
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
        },
      });
      return normalizeWalletRow({
        ...wallet,
        current_balance: Number(wallet.openingBalance),
        is_owner: true,
        can_write: true,
      });
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/wallets-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/__tests__/wallets-service.test.js
git commit -m "feat(pfm): createWallet persists credit fields + opening used"
```

---

## Task 5: `adjustWalletBalance` service + route + SDK

**Files:**
- Modify: `apps/api/src/routes/pfm/movements-service.js` (add function + export)
- Modify: `apps/api/src/routes/pfm/movements-routes.js` (add route)
- Modify: `packages/sdk/src/index.js` (add `adjustWalletBalance`)
- Test: `apps/api/src/routes/pfm/__tests__/movements-service.test.js`

- [ ] **Step 1: Write the failing tests**

Add inside `describe("movements-service", ...)`:

```js
  it("adjustWalletBalance on a cash wallet books a positive delta as an INCOME adjustment", async () => {
    let created = null;
    const prisma = {
      pfmMovement: { create: async ({ data }) => ((created = data), { id: MOV, ...data }) },
    };
    const wallets = {
      ...walletsStub(),
      getWallet: async () => ({ id: WALLET, kind: "CASH", currency: "MXN", currentBalance: 800 }),
    };
    const service = createMovementsService({ prisma, wallets });
    await service.adjustWalletBalance({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      data: { targetBalance: 950, note: "interes" },
    });
    assert.equal(created.isAdjustment, true);
    assert.equal(created.direction, "INCOME");
    assert.equal(Number(created.amount), 150);
    assert.equal(created.status, "POSTED");
    assert.equal(created.categoryId, null);
    assert.equal(created.note, "interes");
  });

  it("adjustWalletBalance on a credit wallet treats targetBalance as saldo ocupado", async () => {
    let created = null;
    const prisma = {
      pfmMovement: { create: async ({ data }) => ((created = data), { id: MOV, ...data }) },
    };
    const wallets = {
      ...walletsStub(),
      // owes 100 -> currentBalance -100
      getWallet: async () => ({ id: WALLET, kind: "CREDIT", currency: "MXN", currentBalance: -100 }),
    };
    const service = createMovementsService({ prisma, wallets });
    await service.adjustWalletBalance({
      companyId: COMPANY,
      actorId: ACTOR,
      walletId: WALLET,
      data: { targetBalance: 150 }, // real used balance is 150 -> internal target -150
    });
    assert.equal(created.direction, "EXPENSE");
    assert.equal(Number(created.amount), 50);
  });

  it("adjustWalletBalance rejects a no-op with 400", async () => {
    const prisma = { pfmMovement: { create: async () => { throw new Error("should not reach"); } } };
    const wallets = {
      ...walletsStub(),
      getWallet: async () => ({ id: WALLET, kind: "CASH", currency: "MXN", currentBalance: 500 }),
    };
    const service = createMovementsService({ prisma, wallets });
    await assert.rejects(
      () =>
        service.adjustWalletBalance({
          companyId: COMPANY,
          actorId: ACTOR,
          walletId: WALLET,
          data: { targetBalance: 500 },
        }),
      (err) => err instanceof PfmServiceError && err.status === 400,
    );
  });

  it("adjustWalletBalance is refused (403) without write access", async () => {
    const prisma = { pfmMovement: { create: async () => { throw new Error("nope"); } } };
    const service = createMovementsService({
      prisma,
      wallets: { ...walletsStub({ canWrite: false }), getWallet: async () => ({ id: WALLET, kind: "CASH", currentBalance: 0 }) },
    });
    await assert.rejects(
      () =>
        service.adjustWalletBalance({
          companyId: COMPANY,
          actorId: ACTOR,
          walletId: WALLET,
          data: { targetBalance: 10 },
        }),
      (err) => err instanceof PfmServiceError && err.status === 403,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: FAIL — `service.adjustWalletBalance is not a function`.

- [ ] **Step 3: Implement the service function**

In `apps/api/src/routes/pfm/movements-service.js`, add this function inside `createMovementsService` after `createMovement` (it uses the existing `assertWritable` helper):

```js
  async function adjustWalletBalance({ companyId, actorId, walletId, data }) {
    await assertWritable({ companyId, walletId, actorId });
    let wallet;
    try {
      wallet = await wallets.getWallet({ companyId, walletId, actorId });
    } catch (err) {
      if (err instanceof PfmServiceError) throw err;
      throw err;
    }
    const current = Number(wallet.currentBalance ?? 0);
    const internalTarget =
      wallet.kind === "CREDIT" ? -Number(data.targetBalance) : Number(data.targetBalance);
    const delta = Math.round((internalTarget - current) * 100) / 100;
    if (delta === 0) {
      throw new PfmServiceError("El saldo ya coincide con el registrado.", 400);
    }
    const occurredOn = data.occurredOn
      ? new Date(`${data.occurredOn}T00:00:00.000Z`)
      : new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    try {
      const created = await prisma.pfmMovement.create({
        data: {
          companyId,
          ownerId: actorId,
          walletId,
          categoryId: null,
          direction: delta > 0 ? "INCOME" : "EXPENSE",
          amount: Math.abs(delta),
          occurredOn,
          note: data.note ?? null,
          merchant: null,
          status: "POSTED",
          isAdjustment: true,
        },
      });
      return normalizeMovement(created);
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }
```

Add `adjustWalletBalance` to the returned object at the bottom of `createMovementsService`:

```js
  return {
    createMovement,
    adjustWalletBalance,
    updateMovement,
    setMovementEnabled,
    confirmMovement,
    skipMovement,
    listMovements,
  };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Add the route**

In `apps/api/src/routes/pfm/movements-routes.js`:

Add `adjustBalanceSchema` to the validators import block at the top:

```js
import {
  createMovementSchema,
  updateMovementSchema,
  confirmMovementSchema,
  listMovementsQuerySchema,
  enrichLedgerMovementSchema,
  enabledSchema,
  adjustBalanceSchema,
} from "./validators.js";
```

Add this route immediately after the `app.post("/pfm/wallets/:id/movements", ...)` handler:

```js
  app.post("/pfm/wallets/:id/adjust", requirePermission("pfm.movements.create"), async (c) => {
    try {
      const parsed = adjustBalanceSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const movement = await movements.adjustWalletBalance({
        companyId: getCompanyId(c),
        actorId: getActorId(c),
        walletId: c.req.param("id"),
        data: parsed.data,
      });
      return c.json({ data: movement }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo ajustar el saldo.");
    }
  });
```

- [ ] **Step 6: Add the SDK method**

In `packages/sdk/src/index.js`, inside the `pfm: { ... }` object, add after `createWalletMovement`:

```js
      adjustWalletBalance: (walletId, data, token) =>
        request(`/pfm/wallets/${encodeURIComponent(walletId)}/adjust`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
```

- [ ] **Step 7: Static checks**

Run: `node --check apps/api/src/routes/pfm/movements-routes.js && node --check packages/sdk/src/index.js`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/routes/pfm/movements-service.js apps/api/src/routes/pfm/movements-routes.js apps/api/src/routes/pfm/__tests__/movements-service.test.js packages/sdk/src/index.js
git commit -m "feat(pfm): POST /pfm/wallets/:id/adjust balance reconciliation"
```

---

## Task 6: Remove the redundant `PATCH /pfm/wallets/:id/credit` route

**Files:**
- Modify: `apps/api/src/routes/pfm/budgets-routes.js` (remove handler + import)
- Modify: `packages/sdk/src/index.js` (remove `updateWalletCredit`)

- [ ] **Step 1: Remove the route handler**

In `apps/api/src/routes/pfm/budgets-routes.js`:

- Delete `creditCardSchema` from the import from `./validators.js` (leave the other names).
- Delete the entire block starting at the comment `// ── Credit-card settings (reuses wallets.updateWallet) ──` through the closing `});` of the `app.patch("/pfm/wallets/:id/credit", ...)` handler.

- [ ] **Step 2: Remove the SDK method**

In `packages/sdk/src/index.js`, delete the `updateWalletCredit: (id, data, token) => request(...)` property from the `pfm` object.

- [ ] **Step 3: Verify nothing else references it**

Run:
```bash
grep -rn "updateWalletCredit\|creditCardSchema\|wallets/:id/credit\|/credit\`" apps/api/src packages/sdk
```
Expected: no matches (Plan 1B removes the `useUpdateWalletCredit` desktop hook separately; it is fine for that to still exist at this point — it just becomes dead until 1B).

- [ ] **Step 4: Static check**

Run: `node --check apps/api/src/routes/pfm/budgets-routes.js && node --check packages/sdk/src/index.js`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/budgets-routes.js packages/sdk/src/index.js
git commit -m "refactor(pfm): drop PATCH /pfm/wallets/:id/credit (folded into wallet update)"
```

---

## Task 7: `computeCreditCycle` reports `utilization`

**Files:**
- Modify: `apps/api/src/routes/pfm/wallets-service.js` (`computeCreditCycle` return, ~line 311)
- Test: `apps/api/src/routes/pfm/__tests__/credit-cycle.test.js`

- [ ] **Step 1: Write the failing test**

Add to `apps/api/src/routes/pfm/__tests__/credit-cycle.test.js` (it already imports `computeCreditCycle`):

```js
test("computeCreditCycle reports utilization = totalOwed / creditLimit", () => {
  const wallet = { kind: "CREDIT", statementDay: 4, creditLimit: 10000 };
  const movements = [
    { direction: "EXPENSE", amount: 2500, occurredOn: "2026-08-01", status: "POSTED" },
  ];
  const c = computeCreditCycle(wallet, movements, new Date("2026-08-20T00:00:00.000Z"));
  assert.equal(c.utilization, 0.25);
});

test("computeCreditCycle utilization is null without a credit limit", () => {
  const wallet = { kind: "CREDIT", statementDay: 4, creditLimit: null };
  const c = computeCreditCycle(wallet, [], new Date("2026-08-20T00:00:00.000Z"));
  assert.equal(c.utilization, null);
});
```

(If the file uses `describe`/`it` instead of bare `test`, match that; the assertions are the same.)

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/api/src/routes/pfm/__tests__/credit-cycle.test.js`
Expected: FAIL — `c.utilization` is `undefined`.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/wallets-service.js`, in `computeCreditCycle`, change the returned object to add `utilization` (right after `availableCredit`):

```js
  return {
    statementDay: wallet.statementDay,
    paymentDueDay: wallet.paymentDueDay ?? null,
    creditLimit,
    lastStatementDate: lastCut.toISOString().slice(0, 10),
    totalOwed,
    periodSpend,
    availableCredit: creditLimit != null ? creditLimit - totalOwed : null,
    utilization: creditLimit != null && creditLimit > 0 ? totalOwed / creditLimit : null,
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/api/src/routes/pfm/__tests__/credit-cycle.test.js`
Expected: PASS (all tests in the file).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/wallets-service.js apps/api/src/routes/pfm/__tests__/credit-cycle.test.js
git commit -m "feat(pfm): computeCreditCycle reports utilization ratio"
```

---

## Task 8: Summary — `spendable` / `creditDebt` / `investments` + exclude adjustments

**Files:**
- Modify: `apps/api/src/routes/pfm/summary-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/summary-service.test.js`

- [ ] **Step 1: Write the failing tests**

The existing first test in `summary-service.test.js` stubs `$queryRaw` with an ordered `responses` array (balance, totals, byCategory, trend). This task changes the **first** query to also return `spendable` / `credit_debt`. Update that test's first response entry and add assertions, and add a new test:

Replace the first `responses` entry in the existing `"getOverview returns totals..."` test:

```js
      [{ total_balance: "22000.00", spendable: "18000.00", credit_debt: "4000.00" }],
```

Add after the existing assertions in that test:

```js
    assert.equal(res.spendable, 18000);
    assert.equal(res.creditDebt, 4000);
    assert.equal(res.investments, 0);
```

Add a new test:

```js
  it("month/category/trend queries exclude adjustments; balance query does not", async () => {
    const seen = [];
    const prisma = {
      $queryRaw: async (strings) => {
        seen.push(strings.join("?").toLowerCase());
        return [];
      },
    };
    await createSummaryService({ prisma }).getOverview({
      companyId: COMPANY,
      actorId: ACTOR,
      month: "2026-08",
    });
    // queries 2,3,4 (totals, byCategory, trend) must filter adjustments out
    assert.ok(seen[1].includes("is_adjustment = false"));
    assert.ok(seen[2].includes("is_adjustment = false"));
    assert.ok(seen[3].includes("is_adjustment = false"));
    // query 1 (balances) must NOT
    assert.ok(!seen[0].includes("is_adjustment = false"));
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js`
Expected: FAIL — `res.spendable` is `undefined`; the new test fails on the `is_adjustment` assertions.

- [ ] **Step 3: Implement**

In `apps/api/src/routes/pfm/summary-service.js`:

Replace the `balanceRows` query with one that also returns per-kind aggregates:

```js
      const balanceRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(bal), 0) AS total_balance,
          COALESCE(SUM(bal) FILTER (WHERE kind IN ('CASH','DEBIT')), 0) AS spendable,
          COALESCE(SUM(GREATEST(0, -bal)) FILTER (WHERE kind = 'CREDIT'), 0) AS credit_debt
        FROM (
          SELECT w.kind,
            w.opening_balance + COALESCE(SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
              FILTER (WHERE m.enabled = true AND m.status = 'POSTED'), 0) AS bal
          FROM pfm_wallet w
          LEFT JOIN pfm_movement m ON m.wallet_id = w.id
          WHERE w.company_id = ${companyId}::uuid AND w.enabled = true
            AND (w.owner_id = ${actorId}::uuid
                 OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
          GROUP BY w.id
        ) s
      `;
```

In the `totalsRows` query, add `AND m.is_adjustment = false` to each of the three `FILTER (WHERE ...)` predicates (month_expense, month_income, prev_expense). For example month_expense becomes:

```sql
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'
            AND m.is_adjustment = false
            AND m.occurred_on >= ${monthStart}::date
            AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')), 0) AS month_expense,
```

Apply the same `AND m.is_adjustment = false` to `month_income` and `prev_expense`.

In the `byCategoryRows` query, add to the `WHERE`:

```sql
          AND m.is_adjustment = false
```

In the `trendRows` query, add `AND m.is_adjustment = false` to the `LEFT JOIN pfm_movement m ON ...` join condition.

Finally, extend the returned object:

```js
      const totals = totalsRows[0] ?? {};
      const bal = balanceRows[0] ?? {};
      return {
        month,
        totalBalance: toPlainNumber(bal.total_balance),
        spendable: toPlainNumber(bal.spendable),
        creditDebt: toPlainNumber(bal.credit_debt),
        investments: 0,
        monthExpense: toPlainNumber(totals.month_expense),
        monthIncome: toPlainNumber(totals.month_income),
        prevMonthExpense: toPlainNumber(totals.prev_expense),
        byCategory: byCategoryRows.map((r) => ({
```

(keep the rest of the return unchanged.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js`
Expected: PASS (all tests in the file). If the "every aggregate query is scoped to the actor" test counts queries, confirm it still sees `>= 4`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pfm/summary-service.js apps/api/src/routes/pfm/__tests__/summary-service.test.js
git commit -m "feat(pfm): summary exposes spendable/creditDebt/investments, excludes adjustments"
```

---

## Task 9: Bump the manifest version

**Files:**
- Modify: `apps/api/src/manifests/official/core-modules.js:1377`

- [ ] **Step 1: Bump**

In `apps/api/src/manifests/official/core-modules.js`, in `atlasPfmManifest`, change:

```js
  version: "0.2.0",
```
to
```js
  version: "0.3.0",
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/manifests/official/core-modules.js
git commit -m "chore(pfm): manifest 0.3.0"
```

---

## Task 10: Full pfm API test sweep

**Files:** none (verification only)

- [ ] **Step 1: Run every pfm service test**

Run:
```bash
node --test $(find apps/api/src/routes/pfm/__tests__ -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0`. All existing + new tests pass.

- [ ] **Step 2: Broader API test sweep (guard against cross-module breakage)**

Run:
```bash
node --test $(find apps/api/src/services/__tests__ apps/api/src/routes -name "*.test.js" | tr '\n' ' ')
```
Expected: `# fail 0` (or the same failures that exist on `main` before this plan — diff against a clean run if unsure).

- [ ] **Step 3: Commit (only if a fixup was needed)**

```bash
git add -A && git commit -m "test(pfm): plan 1a verification fixups"
```

---

## Self-Review

**Spec coverage:**
- `isAdjustment` column + migration → Task 1; DTO exposure → Task 2.
- Adjustment = delta movement, direction from sign, category null, POSTED, credit sign flip, no-op 400, write-perm → Task 5.
- Credit fields (`creditLimit`/`statementDay`/`paymentDueDay`/`openingUsed`) on `createWalletSchema`; `openingBalance = -openingUsed` for CREDIT → Tasks 3, 4.
- `updateWalletSchema` carries credit fields, not `openingUsed` → Task 3.
- Remove `/credit` route + `creditCardSchema` + SDK `updateWalletCredit` → Task 6.
- `computeCreditCycle.utilization` → Task 7.
- Summary `spendable` / `creditDebt` / `investments: 0`; adjustments excluded from month/category/trend, included in balances → Task 8.
- Adjustments excluded from trend specifically → Task 8 Step 3 (trend join condition).
- Manifest 0.3.0 → Task 9.
- Migration applied via `pnpm db:migrate` + `pnpm db:generate` → Task 1 Step 3.

**Placeholder scan:** none. Every code step shows the full replacement text. The `wallets-service.test.js` test note allows for the file's existing UUID constants because that file was not read in full while planning; the assertions are self-contained.

**Type consistency:**
- `adjustWalletBalance({ companyId, actorId, walletId, data })` — same signature in Task 5 def, route call, and tests.
- Service returns `normalizeMovement(created)` → carries `isAdjustment` (Task 2).
- Summary keys `spendable` / `creditDebt` / `investments` — same in Task 8 impl and tests, and consumed by Plan 1B.
- SDK `adjustWalletBalance(walletId, data, token)` → matches Plan 1B's `useAdjustWalletBalance` call shape.
- Validator `adjustBalanceSchema` fields `targetBalance` / `note` / `occurredOn` — same in Task 3 and route (Task 5 Step 5).
