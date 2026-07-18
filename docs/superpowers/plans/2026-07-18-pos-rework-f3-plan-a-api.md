# POS Rework F3 — Plan A (API): Session Attribution Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f3-caja-design.md` (sections 12, 23, 25.2)

**Goal:** `closeSession` reconciles the cut from payment-level attribution: payments by `PosPayment.sessionId`, plus cash movements IN − OUT, plus `WAITER_DELIVERY` deliveries. Zero migrations, zero new endpoints.

**Conventions:** Work on `main`; commit trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; Spanish errors; TDD.

## File Structure Map

- Modify: `apps/api/src/routes/pos/pos-session-service.js` (closeSession queries + expected math)
- Modify: `apps/api/src/routes/pos/__tests__/pos-session-service.test.js`

### Task 1: closeSession attribution (TDD)

- [ ] **Step 1: Failing tests** in `pos-session-service.test.js` (extend `makePrisma` as needed — payments store must support `findMany({ where: { companyId, status, sessionId } })`):

1. **Payments summed by payment.sessionId**: seed a CAPTURED cash payment with `sessionId: "session-1"` whose order has `sessionId: null` (comandero-created order charged at caja) → close with the right counted amount → `expectedCashAmount` includes it. Also seed a payment with `sessionId: "other-session"` → excluded.
2. **WAITER_DELIVERY counts as cash-in**: opening 500, cash payment 128, movement IN 50, movement OUT 20, movement WAITER_DELIVERY 35 → counted 693 → `expectedCashAmount === 693`, `differenceAmount === 0` (spec acceptance 2).
3. **Non-cash excluded**: a CAPTURED payment with method kind CARD and `sessionId: "session-1"` does not increase expected (existing `cashPaymentTotal` behavior — keep it working with the new query shape; note the include of `paymentMethod` must survive).

- [ ] **Step 2: Run to fail** — `node --test apps/api/src/routes/pos/__tests__/pos-session-service.test.js`.

- [ ] **Step 3: Implement** in `closeSession` (~line 111):

```js
    const [payments, movements] = await Promise.all([
      prisma.posPayment.findMany({
        where: {
          companyId: scopedCompanyId,
          status: "CAPTURED",
          sessionId,
        },
        include: { paymentMethod: true, order: true },
      }),
      prisma.posCashMovement.findMany({
        where: { companyId: scopedCompanyId, sessionId },
      }),
    ]);

    const expectedCashAmount = toMoney(
      Number(before.openingCashAmount ?? 0) +
        cashPaymentTotal(payments) +
        movementTotal(movements, "IN") -
        movementTotal(movements, "OUT") +
        movementTotal(movements, "WAITER_DELIVERY"),
    );
```

Read `movementTotal` first: if it filters strictly by `kind === direction`, the call with `"WAITER_DELIVERY"` works as-is; adjust only if its signature differs. If a session summary/read endpoint duplicates this math elsewhere in the file, apply the same two changes there and say so.

- [ ] **Step 4: Green** — target file, then full suite `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (all pass; report counts); `node --check` the service.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-session-service.js apps/api/src/routes/pos/__tests__/pos-session-service.test.js
git commit -m "fix(pos): reconcile session cuts from payment-level attribution and waiter deliveries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
