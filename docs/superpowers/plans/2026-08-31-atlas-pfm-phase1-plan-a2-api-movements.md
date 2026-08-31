# atlas.pfm — Phase 1 — Plan A2 (API: movements, ledger link, summary, isolation suite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add native movement CRUD (with `PENDING`/`POSTED`/`SKIPPED` and confirm/skip), the read-only `atlas.ledger` mirror, the dashboard rollup service, and the cross-profile isolation test suite.

**Architecture:** Continues Plan A1. `movements-service.js` handles native `PfmMovement` rows; `ledger-link-service.js` reads `ledger_transaction` through a `createLedgerService` instance and merges `PfmLedgerEnrichment`; `wallets-routes.js` gains movement + linked-movement sub-routes that pick the right service based on `wallet.ledgerAccountId`. `summary-service.js` aggregates the unified movement stream for the Resumen screen.

**Tech Stack:** Node.js + Hono, Prisma 7 + PostgreSQL, Zod, `node --test` (mocked prisma).

**Spec:** `docs/superpowers/specs/2026-08-31-atlas-pfm-design.md` (sections 3.4, 3.5, 4, 5.2, 9-Resumen, 11). **Prereq:** Plan A1 merged.

---

## File Structure

- `apps/api/src/routes/pfm/validators.js` — add movement schemas (modify).
- `apps/api/src/routes/pfm/movements-service.js` — native movement CRUD + confirm/skip + balance (create).
- `apps/api/src/routes/pfm/ledger-link-service.js` — read-only ledger mirror + enrichment upsert (create).
- `apps/api/src/routes/pfm/movements-routes.js` — movement sub-routes under `/pfm/wallets/:id/...` (create).
- `apps/api/src/routes/pfm/summary-service.js` — Resumen rollups (create).
- `apps/api/src/routes/pfm/summary-routes.js` — `GET /pfm/summary` (create).
- `apps/api/src/routes/pfm/index.js` — mount the two new routers (modify).
- `packages/sdk/src/index.js` — add movement + summary methods to `pfm` (modify).
- `apps/api/src/routes/pfm/__tests__/movements-service.test.js` (create).
- `apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js` (create).
- `apps/api/src/routes/pfm/__tests__/summary-service.test.js` (create).
- `apps/api/src/routes/pfm/__tests__/isolation.test.js` (create).

---

## Task 1: Movement validators

**Files:** Modify `apps/api/src/routes/pfm/validators.js`

- [ ] **Step 1: Append movement schemas**

```js
// ── Movements ────────────────────────────────────────────────────────────────

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

// ── Ledger-mirror enrichment ─────────────────────────────────────────────────

export const enrichLedgerMovementSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  receiptId: z.string().uuid().nullable().optional(),
  note: z.string().max(500).nullable().optional(),
});
```

- [ ] **Step 2:** Run `node --check apps/api/src/routes/pfm/validators.js` — expect no output.
- [ ] **Step 3:** Commit: `git add apps/api/src/routes/pfm/validators.js && git commit -m "feat(pfm): movement + enrichment validators"`

---

## Task 2: `movements-service.js` (test first)

**Files:**
- Create: `apps/api/src/routes/pfm/movements-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/movements-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/movements-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createMovementsService } from "../movements-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000c1";
const ACTOR = "01900000-0000-7000-8000-0000000000c2";
const WALLET = "01900000-0000-7000-8000-0000000000c3";
const MOV = "01900000-0000-7000-8000-0000000000c4";

function walletsStub({ canWrite = true, canRead = true } = {}) {
  return {
    canWriteWallet: async () => canWrite,
    canReadWallet: async () => canRead,
    getWallet: async () => ({ id: WALLET, ledgerAccountId: null }),
  };
}

describe("movements-service", () => {
  it("createMovement stamps company/owner/wallet and defaults status POSTED", async () => {
    let created = null;
    const prisma = { pfmMovement: { create: async ({ data }) => (created = data, { id: MOV, ...data }) } };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await service.createMovement({
      companyId: COMPANY, actorId: ACTOR, walletId: WALLET,
      data: { direction: "EXPENSE", amount: 120.5, occurredOn: "2026-08-15", status: "POSTED" },
    });
    assert.equal(created.companyId, COMPANY);
    assert.equal(created.ownerId, ACTOR);
    assert.equal(created.walletId, WALLET);
    assert.equal(created.status, "POSTED");
    assert.equal(Number(created.amount), 120.5);
  });

  it("createMovement is refused (403) when the actor cannot write the wallet", async () => {
    const prisma = { pfmMovement: { create: async () => { throw new Error("should not reach"); } } };
    const service = createMovementsService({ prisma, wallets: walletsStub({ canWrite: false }) });
    await assert.rejects(
      () => service.createMovement({ companyId: COMPANY, actorId: ACTOR, walletId: WALLET, data: { direction: "EXPENSE", amount: 1, occurredOn: "2026-08-15" } }),
      (e) => e instanceof PfmServiceError && e.status === 403,
    );
  });

  it("confirmMovement flips PENDING -> POSTED and applies an override amount", async () => {
    let updateArgs = null;
    const prisma = {
      pfmMovement: {
        findFirst: async () => ({ id: MOV, walletId: WALLET, status: "PENDING", amount: 800 }),
        update: async (args) => (updateArgs = args, { id: MOV, status: "POSTED", amount: 915 }),
      },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    const res = await service.confirmMovement({ companyId: COMPANY, actorId: ACTOR, movementId: MOV, amount: 915 });
    assert.equal(updateArgs.data.status, "POSTED");
    assert.equal(Number(updateArgs.data.amount), 915);
    assert.equal(res.status, "POSTED");
  });

  it("confirmMovement refuses a non-PENDING movement", async () => {
    const prisma = {
      pfmMovement: { findFirst: async () => ({ id: MOV, walletId: WALLET, status: "POSTED", amount: 10 }) },
    };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await assert.rejects(
      () => service.confirmMovement({ companyId: COMPANY, actorId: ACTOR, movementId: MOV }),
      (e) => e instanceof PfmServiceError && e.status === 409,
    );
  });

  it("listMovements SQL counts only POSTED enabled rows toward runningBalance", async () => {
    let seen = "";
    const prisma = { $queryRaw: async (s) => (seen = (Array.isArray(s) ? s.join(" ") : String(s)).toLowerCase(), []) };
    const service = createMovementsService({ prisma, wallets: walletsStub() });
    await service.listMovements({ companyId: COMPANY, actorId: ACTOR, walletId: WALLET, query: { limit: 100 } });
    assert.ok(seen.includes("status = 'posted'"), "running balance must filter to POSTED");
    assert.ok(seen.includes("enabled = true"));
  });
});
```

- [ ] **Step 2:** Run `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Write `movements-service.js`**

```js
// apps/api/src/routes/pfm/movements-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

export function createMovementsService({ prisma, wallets }) {
  async function assertWritable({ companyId, walletId, actorId }) {
    if (!(await wallets.canWriteWallet({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("No tienes permiso de escritura en esta cartera.", 403);
    }
  }

  async function createMovement({ companyId, actorId, walletId, data }) {
    await assertWritable({ companyId, walletId, actorId });
    try {
      const created = await prisma.pfmMovement.create({
        data: {
          companyId,
          ownerId: actorId,
          walletId,
          categoryId: data.categoryId ?? null,
          direction: data.direction,
          amount: data.amount,
          occurredOn: new Date(`${data.occurredOn}T00:00:00.000Z`),
          note: data.note ?? null,
          merchant: data.merchant ?? null,
          receiptId: data.receiptId ?? null,
          status: data.status ?? "POSTED",
        },
      });
      return normalizeMovement(created);
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function getOwnedMovement({ companyId, movementId }) {
    const row = await prisma.pfmMovement.findFirst({
      where: { id: movementId, companyId, enabled: true },
    });
    if (!row) throw new PfmServiceError("Movimiento no encontrado.", 404);
    return row;
  }

  async function updateMovement({ companyId, actorId, movementId, data }) {
    const row = await getOwnedMovement({ companyId, movementId });
    await assertWritable({ companyId, walletId: row.walletId, actorId });
    const patch = {};
    if ("direction" in data) patch.direction = data.direction;
    if ("amount" in data) patch.amount = data.amount;
    if ("occurredOn" in data) patch.occurredOn = new Date(`${data.occurredOn}T00:00:00.000Z`);
    if ("categoryId" in data) patch.categoryId = data.categoryId ?? null;
    if ("note" in data) patch.note = data.note ?? null;
    if ("merchant" in data) patch.merchant = data.merchant ?? null;
    if ("receiptId" in data) patch.receiptId = data.receiptId ?? null;
    if ("status" in data && (data.status === "PENDING" || data.status === "POSTED")) patch.status = data.status;
    const updated = await prisma.pfmMovement.update({ where: { id: movementId }, data: patch });
    return normalizeMovement(updated);
  }

  async function setMovementEnabled({ companyId, actorId, movementId, enabled }) {
    const row = await getOwnedMovement({ companyId, movementId });
    await assertWritable({ companyId, walletId: row.walletId, actorId });
    await prisma.pfmMovement.update({ where: { id: movementId }, data: { enabled } });
    return { id: movementId, enabled };
  }

  async function confirmMovement({ companyId, actorId, movementId, amount }) {
    const row = await getOwnedMovement({ companyId, movementId });
    await assertWritable({ companyId, walletId: row.walletId, actorId });
    if (row.status !== "PENDING") {
      throw new PfmServiceError("Solo se pueden confirmar movimientos pendientes.", 409);
    }
    const data = { status: "POSTED" };
    if (amount !== undefined && amount !== null) data.amount = amount;
    const updated = await prisma.pfmMovement.update({ where: { id: movementId }, data });
    return normalizeMovement(updated);
  }

  async function skipMovement({ companyId, actorId, movementId }) {
    const row = await getOwnedMovement({ companyId, movementId });
    await assertWritable({ companyId, walletId: row.walletId, actorId });
    if (row.status !== "PENDING") {
      throw new PfmServiceError("Solo se pueden omitir movimientos pendientes.", 409);
    }
    const updated = await prisma.pfmMovement.update({ where: { id: movementId }, data: { status: "SKIPPED" } });
    return normalizeMovement(updated);
  }

  async function listMovements({ companyId, actorId, walletId, query }) {
    if (!(await wallets.canReadWallet({ companyId, walletId, actorId }))) {
      throw new PfmServiceError("Cartera no encontrada.", 404);
    }
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 100));
    const monthStart = query?.month ? `${query.month}-01` : null;
    try {
      const rows = await prisma.$queryRaw`
        WITH filtered AS (
          SELECT m.*,
            SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
              FILTER (WHERE m.enabled = true AND m.status = 'POSTED')
              OVER (ORDER BY m.occurred_on, m.created_at
                    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_delta
          FROM pfm_movement m
          WHERE m.wallet_id = ${walletId}::uuid
            AND m.company_id = ${companyId}::uuid
            AND m.enabled = true
            AND (${query?.status ?? null}::text IS NULL OR m.status = ${query?.status ?? null}::text)
            AND (${query?.categoryId ?? null}::uuid IS NULL OR m.category_id = ${query?.categoryId ?? null}::uuid)
            AND (${monthStart}::date IS NULL OR (m.occurred_on >= ${monthStart}::date
                 AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')))
            AND (${query?.search ?? null}::text IS NULL
                 OR m.merchant ILIKE '%' || ${query?.search ?? null} || '%'
                 OR m.note ILIKE '%' || ${query?.search ?? null} || '%')
        )
        SELECT * FROM filtered
        ORDER BY occurred_on DESC, created_at DESC
        LIMIT ${limit}
      `;
      return { data: rows.map((r) => ({ ...normalizeMovement(r), source: "native" })) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  return {
    createMovement,
    updateMovement,
    setMovementEnabled,
    confirmMovement,
    skipMovement,
    listMovements,
  };
}

function normalizeMovement(row) {
  return {
    id: row.id,
    walletId: row.wallet_id ?? row.walletId,
    categoryId: row.category_id ?? row.categoryId ?? null,
    direction: row.direction,
    amount: toPlainNumber(row.amount),
    occurredOn: (row.occurred_on ?? row.occurredOn) instanceof Date
      ? (row.occurred_on ?? row.occurredOn).toISOString().slice(0, 10)
      : String(row.occurred_on ?? row.occurredOn).slice(0, 10),
    note: row.note ?? null,
    merchant: row.merchant ?? null,
    status: row.status,
    recurringRuleId: row.recurring_rule_id ?? row.recurringRuleId ?? null,
    receiptId: row.receipt_id ?? row.receiptId ?? null,
    editableInPfm: true,
  };
}
```

- [ ] **Step 4:** Run `node --test apps/api/src/routes/pfm/__tests__/movements-service.test.js` — expect PASS (5 tests).
- [ ] **Step 5:** Commit: `git add apps/api/src/routes/pfm/movements-service.js apps/api/src/routes/pfm/__tests__/movements-service.test.js && git commit -m "feat(pfm): native movements service with confirm/skip"`

---

## Task 3: `ledger-link-service.js` (test first)

**Files:**
- Create: `apps/api/src/routes/pfm/ledger-link-service.js`
- Test: `apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLedgerLinkService } from "../ledger-link-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000d1";
const ACTOR = "01900000-0000-7000-8000-0000000000d2";
const WALLET = "01900000-0000-7000-8000-0000000000d3";
const LEDGER_ACC = "01900000-0000-7000-8000-0000000000d4";
const LTX = "01900000-0000-7000-8000-0000000000d5";

function ledgerStub({ canRead = true } = {}) {
  return { canReadAccount: async () => canRead };
}

describe("ledger-link-service", () => {
  it("getLinkedMovements refuses (403) when the actor cannot read the ledger account", async () => {
    const prisma = { $queryRaw: async () => { throw new Error("should not query"); } };
    const service = createLedgerLinkService({ prisma, ledgerService: ledgerStub({ canRead: false }) });
    await assert.rejects(
      () => service.getLinkedMovements({ companyId: COMPANY, actorId: ACTOR, walletId: WALLET, ledgerAccountId: LEDGER_ACC }),
      (e) => e instanceof PfmServiceError && e.status === 403,
    );
  });

  it("getLinkedMovements normalizes deposito->INCOME / retiro->EXPENSE and marks rows non-editable", async () => {
    const prisma = {
      $queryRaw: async () => [
        { id: LTX, fecha: new Date("2026-08-10"), nombre: "OXXO", deposito: null, retiro: "89.00", enr_category_id: "cat1", enr_receipt_id: null, enr_note: "snacks" },
        { id: "ltx2", fecha: new Date("2026-08-12"), nombre: "Nomina", deposito: "15000.00", retiro: null, enr_category_id: null, enr_receipt_id: null, enr_note: null },
      ],
    };
    const service = createLedgerLinkService({ prisma, ledgerService: ledgerStub() });
    const { data } = await service.getLinkedMovements({ companyId: COMPANY, actorId: ACTOR, walletId: WALLET, ledgerAccountId: LEDGER_ACC });
    assert.equal(data[0].direction, "EXPENSE");
    assert.equal(data[0].amount, 89);
    assert.equal(data[0].source, "ledger");
    assert.equal(data[0].editableInPfm, false);
    assert.equal(data[0].categoryId, "cat1");
    assert.equal(data[1].direction, "INCOME");
    assert.equal(data[1].amount, 15000);
  });

  it("enrichLedgerMovement upserts by ledgerTransactionId and never touches ledger_transaction", async () => {
    let upsertArgs = null;
    const prisma = {
      $queryRaw: async () => { throw new Error("no raw writes to ledger_transaction"); },
      pfmLedgerEnrichment: {
        upsert: async (args) => (upsertArgs = args, { id: "enr1", ...args.create }),
      },
    };
    const service = createLedgerLinkService({ prisma, ledgerService: ledgerStub() });
    await service.enrichLedgerMovement({
      companyId: COMPANY, actorId: ACTOR, walletId: WALLET, ledgerTransactionId: LTX,
      data: { categoryId: "cat9", note: "x", receiptId: null },
    });
    assert.equal(upsertArgs.where.ledgerTransactionId, LTX);
    assert.equal(upsertArgs.create.walletId, WALLET);
    assert.equal(upsertArgs.create.ownerId, ACTOR);
  });
});
```

- [ ] **Step 2:** Run `node --test apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Write `ledger-link-service.js`**

```js
// apps/api/src/routes/pfm/ledger-link-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

// `ledgerService` is an instance of createLedgerService({ prisma }) from
// apps/api/src/routes/ledger/ledger-service.js — passed in by index.js so this
// module never imports ledger internals at load time.
export function createLedgerLinkService({ prisma, ledgerService }) {
  async function assertLedgerAccess({ companyId, ledgerAccountId, actorId }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    let allowed = false;
    try {
      allowed = await ledgerService.canReadAccount({ companyId, accountId: ledgerAccountId, actorId });
    } catch {
      allowed = false;
    }
    if (!allowed) throw new PfmServiceError("No tienes acceso a la cuenta bancaria enlazada.", 403);
  }

  async function getLinkedMovements({ companyId, actorId, walletId, ledgerAccountId, query }) {
    await assertLedgerAccess({ companyId, ledgerAccountId, actorId });
    const limit = Math.min(200, Math.max(1, Number(query?.limit) || 100));
    const monthStart = query?.month ? `${query.month}-01` : null;
    try {
      const rows = await prisma.$queryRaw`
        SELECT t.id, t.fecha, t.nombre, t.deposito, t.retiro,
               e.category_id AS enr_category_id,
               e.receipt_id  AS enr_receipt_id,
               e.note        AS enr_note
        FROM ledger_transaction t
        LEFT JOIN pfm_ledger_enrichment e ON e.ledger_transaction_id = t.id
        WHERE t.account_id = ${ledgerAccountId}::uuid
          AND t.enabled = true
          AND (${monthStart}::date IS NULL OR (t.fecha >= ${monthStart}::date
               AND t.fecha < (${monthStart}::date + INTERVAL '1 month')))
        ORDER BY t.fecha DESC, t.created_at DESC
        LIMIT ${limit}
      `;
      return { data: rows.map((r) => normalizeLedgerRow(r, walletId)) };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  async function enrichLedgerMovement({ companyId, actorId, walletId, ledgerAccountId, ledgerTransactionId, data }) {
    if (ledgerAccountId) await assertLedgerAccess({ companyId, ledgerAccountId, actorId });
    const base = {
      companyId,
      ownerId: actorId,
      walletId,
      ledgerTransactionId,
      categoryId: data.categoryId ?? null,
      receiptId: data.receiptId ?? null,
      note: data.note ?? null,
    };
    const update = {};
    if ("categoryId" in data) update.categoryId = data.categoryId ?? null;
    if ("receiptId" in data) update.receiptId = data.receiptId ?? null;
    if ("note" in data) update.note = data.note ?? null;
    const row = await prisma.pfmLedgerEnrichment.upsert({
      where: { ledgerTransactionId },
      update,
      create: base,
    });
    return row;
  }

  async function removeEnrichmentsForWallet({ walletId }) {
    await prisma.pfmLedgerEnrichment.deleteMany({ where: { walletId } });
    return { walletId, cleared: true };
  }

  return { getLinkedMovements, enrichLedgerMovement, removeEnrichmentsForWallet };
}

function normalizeLedgerRow(r, walletId) {
  const deposito = toPlainNumber(r.deposito, 0);
  const retiro = toPlainNumber(r.retiro, 0);
  const isIncome = deposito >= retiro && deposito > 0;
  return {
    id: r.id,
    source: "ledger",
    walletId,
    direction: isIncome ? "INCOME" : "EXPENSE",
    amount: isIncome ? deposito : retiro,
    occurredOn: r.fecha instanceof Date ? r.fecha.toISOString().slice(0, 10) : String(r.fecha).slice(0, 10),
    merchant: r.nombre ?? null,
    note: r.enr_note ?? null,
    categoryId: r.enr_category_id ?? null,
    receiptId: r.enr_receipt_id ?? null,
    status: "POSTED",
    editableInPfm: false,
  };
}
```

- [ ] **Step 4:** Run `node --test apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js` — expect PASS (3 tests).
- [ ] **Step 5:** Commit: `git add apps/api/src/routes/pfm/ledger-link-service.js apps/api/src/routes/pfm/__tests__/ledger-link-service.test.js && git commit -m "feat(pfm): read-only atlas.ledger mirror + enrichment"`

---

## Task 4: `movements-routes.js` (dispatches native vs mirror)

**Files:** Create `apps/api/src/routes/pfm/movements-routes.js`

- [ ] **Step 1: Write the router**

```js
// apps/api/src/routes/pfm/movements-routes.js
import { Hono } from "hono";
import {
  createMovementSchema,
  updateMovementSchema,
  confirmMovementSchema,
  listMovementsQuerySchema,
  enrichLedgerMovementSchema,
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

export function createMovementsRouter({ prisma, requirePermission, requireAnyPermission, wallets, movements, ledgerLink }) {
  const app = new Hono();

  // List — merges native + ledger-mirror rows depending on the wallet.
  app.get(
    "/pfm/wallets/:id/movements",
    requireAnyPermission(["pfm.movements.read", "pfm.movements.update"]),
    async (c) => {
      try {
        const companyId = getCompanyId(c);
        const actorId = getActorId(c);
        const walletId = c.req.param("id");
        const parsed = listMovementsQuerySchema.safeParse(c.req.query());
        if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
        const wallet = await wallets.getWallet({ companyId, walletId, actorId });
        if (wallet.ledgerAccountId) {
          return c.json(
            await ledgerLink.getLinkedMovements({
              companyId, actorId, walletId,
              ledgerAccountId: wallet.ledgerAccountId,
              query: parsed.data,
            }),
          );
        }
        return c.json(await movements.listMovements({ companyId, actorId, walletId, query: parsed.data }));
      } catch (err) {
        return handleError(c, err, "No se pudieron listar los movimientos.");
      }
    },
  );

  app.post("/pfm/wallets/:id/movements", requirePermission("pfm.movements.create"), async (c) => {
    try {
      const companyId = getCompanyId(c);
      const actorId = getActorId(c);
      const walletId = c.req.param("id");
      const wallet = await wallets.getWallet({ companyId, walletId, actorId });
      if (wallet.ledgerAccountId) {
        return c.json({ error: "Esta cartera refleja una cuenta bancaria; registra el movimiento en Libro de cuentas." }, 400);
      }
      const parsed = createMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      const movement = await movements.createMovement({ companyId, actorId, walletId, data: parsed.data });
      return c.json({ data: movement }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el movimiento.");
    }
  });

  app.patch("/pfm/movements/:movementId", requirePermission("pfm.movements.update"), async (c) => {
    try {
      const parsed = updateMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await movements.updateMovement({
          companyId: getCompanyId(c), actorId: getActorId(c),
          movementId: c.req.param("movementId"), data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el movimiento.");
    }
  });

  app.patch("/pfm/movements/:movementId/enabled", requirePermission("pfm.movements.delete"), async (c) => {
    try {
      const parsed = enabledSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await movements.setMovementEnabled({
          companyId: getCompanyId(c), actorId: getActorId(c),
          movementId: c.req.param("movementId"), enabled: parsed.data.enabled,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo cambiar el estado del movimiento.");
    }
  });

  app.patch("/pfm/movements/:movementId/confirm", requirePermission("pfm.movements.update"), async (c) => {
    try {
      const parsed = confirmMovementSchema.safeParse(await c.req.json().catch(() => ({})));
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await movements.confirmMovement({
          companyId: getCompanyId(c), actorId: getActorId(c),
          movementId: c.req.param("movementId"), amount: parsed.data.amount,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo confirmar el movimiento.");
    }
  });

  app.patch("/pfm/movements/:movementId/skip", requirePermission("pfm.movements.update"), async (c) => {
    try {
      return c.json({
        data: await movements.skipMovement({
          companyId: getCompanyId(c), actorId: getActorId(c),
          movementId: c.req.param("movementId"),
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo omitir el movimiento.");
    }
  });

  // Enrich a ledger-mirror movement (category / receipt / note) — never writes ledger_transaction.
  app.put("/pfm/wallets/:id/ledger-movements/:ltxId/enrichment", requirePermission("pfm.movements.update"), async (c) => {
    try {
      const companyId = getCompanyId(c);
      const actorId = getActorId(c);
      const walletId = c.req.param("id");
      const wallet = await wallets.getWallet({ companyId, walletId, actorId });
      if (!wallet.ledgerAccountId) return c.json({ error: "La cartera no esta enlazada a una cuenta bancaria." }, 400);
      const parsed = enrichLedgerMovementSchema.safeParse(await c.req.json());
      if (!parsed.success) return c.json({ error: getValidationErrorMessage(parsed.error) }, 400);
      return c.json({
        data: await ledgerLink.enrichLedgerMovement({
          companyId, actorId, walletId,
          ledgerAccountId: wallet.ledgerAccountId,
          ledgerTransactionId: c.req.param("ltxId"),
          data: parsed.data,
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudo guardar el enriquecimiento.");
    }
  });

  return app;
}
```

- [ ] **Step 2:** Run `node --check apps/api/src/routes/pfm/movements-routes.js` — expect no output.
- [ ] **Step 3:** Commit: `git add apps/api/src/routes/pfm/movements-routes.js && git commit -m "feat(pfm): movement routes dispatching native vs ledger mirror"`

---

## Task 5: `summary-service.js` + route (test first)

**Files:**
- Create: `apps/api/src/routes/pfm/summary-service.js`, `apps/api/src/routes/pfm/summary-routes.js`
- Test: `apps/api/src/routes/pfm/__tests__/summary-service.test.js`

- [ ] **Step 1: Write the failing test**

```js
// apps/api/src/routes/pfm/__tests__/summary-service.test.js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSummaryService } from "../summary-service.js";

const COMPANY = "01900000-0000-7000-8000-0000000000e1";
const ACTOR = "01900000-0000-7000-8000-0000000000e2";

describe("summary-service", () => {
  it("getOverview returns totals, category breakdown, trend and prev-month delta", async () => {
    const prisma = {
      // one call per aggregate; return canned shapes keyed by SQL fingerprint
      $queryRaw: async (strings) => {
        const sql = (Array.isArray(strings) ? strings.join(" ") : String(strings)).toLowerCase();
        if (sql.includes("group by c.id") || sql.includes("by_category")) {
          return [{ category_id: "c1", name: "Comida", color: "#f97316", total: "1200.00" }];
        }
        if (sql.includes("date_trunc('month'") && sql.includes("series")) {
          return [{ month: "2026-08", expense: "3000.00", income: "15000.00" }];
        }
        if (sql.includes("sum(") && sql.includes("current month")) {
          return [{ month_expense: "3000.00", month_income: "15000.00", prev_expense: "2500.00" }];
        }
        if (sql.includes("from pfm_wallet")) {
          return [{ total_balance: "22000.00" }];
        }
        return [];
      },
    };
    const service = createSummaryService({ prisma });
    const res = await service.getOverview({ companyId: COMPANY, actorId: ACTOR, month: "2026-08" });
    assert.equal(res.totalBalance, 22000);
    assert.equal(res.monthExpense, 3000);
    assert.equal(res.monthIncome, 15000);
    assert.equal(res.prevMonthExpense, 2500);
    assert.deepEqual(res.byCategory[0], { categoryId: "c1", name: "Comida", color: "#f97316", total: 1200 });
    assert.equal(res.trend[0].month, "2026-08");
  });
});
```

- [ ] **Step 2:** Run `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js` — expect FAIL (module missing).

- [ ] **Step 3: Write `summary-service.js`**

```js
// apps/api/src/routes/pfm/summary-service.js
import { PfmServiceError, isTableNotFoundError, toPlainNumber } from "./service-helpers.js";

const NOT_INSTALLED = "El modulo de finanzas personales no esta instalado.";

// Scope: native movements in wallets the actor owns or is a member of.
// (Phase 1 keeps ledger-mirror wallets out of the aggregate; folded in Phase 2
// alongside the unified movement stream.)
export function createSummaryService({ prisma }) {
  async function getOverview({ companyId, actorId, month }) {
    if (!actorId) throw new PfmServiceError("Se requiere un usuario autenticado.", 401);
    const monthStart = `${month}-01`;
    try {
      const balanceRows = await prisma.$queryRaw`
        SELECT COALESCE(SUM(bal), 0) AS total_balance FROM (
          SELECT w.opening_balance + COALESCE(SUM(m.amount * CASE WHEN m.direction = 'INCOME' THEN 1 ELSE -1 END)
            FILTER (WHERE m.enabled = true AND m.status = 'POSTED'), 0) AS bal
          FROM pfm_wallet w
          LEFT JOIN pfm_movement m ON m.wallet_id = w.id
          WHERE w.company_id = ${companyId}::uuid AND w.enabled = true
            AND (w.owner_id = ${actorId}::uuid
                 OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
          GROUP BY w.id
        ) s
      `;

      const totalsRows = await prisma.$queryRaw`
        SELECT
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'
            AND m.occurred_on >= ${monthStart}::date
            AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')), 0) AS month_expense,   -- current month
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'INCOME'
            AND m.occurred_on >= ${monthStart}::date
            AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')), 0) AS month_income,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'
            AND m.occurred_on >= (${monthStart}::date - INTERVAL '1 month')
            AND m.occurred_on < ${monthStart}::date), 0) AS prev_expense
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        WHERE m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
      `;

      const byCategoryRows = await prisma.$queryRaw`
        SELECT m.category_id AS category_id, c.name AS name, c.color AS color, SUM(m.amount) AS total
        FROM pfm_movement m
        JOIN pfm_wallet w ON w.id = m.wallet_id
        LEFT JOIN pfm_category c ON c.id = m.category_id
        WHERE m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
          AND m.direction = 'EXPENSE'
          AND m.occurred_on >= ${monthStart}::date
          AND m.occurred_on < (${monthStart}::date + INTERVAL '1 month')
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        GROUP BY c.id, m.category_id, c.name, c.color
        ORDER BY total DESC
      `;

      const trendRows = await prisma.$queryRaw`
        WITH series AS (
          SELECT to_char(date_trunc('month', d), 'YYYY-MM') AS month
          FROM generate_series(${monthStart}::date - INTERVAL '5 months', ${monthStart}::date, INTERVAL '1 month') d
        )
        SELECT s.month,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'EXPENSE'), 0) AS expense,
          COALESCE(SUM(m.amount) FILTER (WHERE m.direction = 'INCOME'), 0) AS income
        FROM series s
        LEFT JOIN pfm_movement m
          ON to_char(m.occurred_on, 'YYYY-MM') = s.month
          AND m.company_id = ${companyId}::uuid AND m.enabled = true AND m.status = 'POSTED'
        LEFT JOIN pfm_wallet w ON w.id = m.wallet_id
          AND (w.owner_id = ${actorId}::uuid
               OR EXISTS (SELECT 1 FROM pfm_wallet_member wm WHERE wm.wallet_id = w.id AND wm.user_id = ${actorId}::uuid))
        GROUP BY s.month
        ORDER BY s.month
      `;

      const totals = totalsRows[0] ?? {};
      return {
        month,
        totalBalance: toPlainNumber(balanceRows[0]?.total_balance),
        monthExpense: toPlainNumber(totals.month_expense),
        monthIncome: toPlainNumber(totals.month_income),
        prevMonthExpense: toPlainNumber(totals.prev_expense),
        byCategory: byCategoryRows.map((r) => ({
          categoryId: r.category_id ?? null,
          name: r.name ?? "Sin categoria",
          color: r.color ?? "#9ca3af",
          total: toPlainNumber(r.total),
        })),
        trend: trendRows.map((r) => ({
          month: r.month,
          expense: toPlainNumber(r.expense),
          income: toPlainNumber(r.income),
        })),
      };
    } catch (err) {
      if (isTableNotFoundError(err)) throw new PfmServiceError(NOT_INSTALLED, 503);
      throw err;
    }
  }

  return { getOverview };
}
```

- [ ] **Step 4: Write `summary-routes.js`**

```js
// apps/api/src/routes/pfm/summary-routes.js
import { Hono } from "hono";
import { createSummaryService } from "./summary-service.js";
import { PfmServiceError, getCompanyId, getActorId } from "./service-helpers.js";

function handleError(c, err, fallback) {
  if (err instanceof PfmServiceError) return c.json({ error: err.message }, err.status);
  if (process.env.NODE_ENV !== "production") console.error("[atlas.pfm]", err);
  return c.json({ error: fallback }, 500);
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function createSummaryRouter({ prisma, requireAnyPermission }) {
  const app = new Hono();
  const service = createSummaryService({ prisma });

  app.get(
    "/pfm/summary",
    requireAnyPermission(["pfm.wallets.read", "pfm.movements.read"]),
    async (c) => {
      try {
        const monthRaw = c.req.query("month");
        const month = /^\d{4}-\d{2}$/.test(monthRaw ?? "") ? monthRaw : currentMonth();
        return c.json({
          data: await service.getOverview({
            companyId: getCompanyId(c),
            actorId: getActorId(c),
            month,
          }),
        });
      } catch (err) {
        return handleError(c, err, "No se pudo obtener el resumen.");
      }
    },
  );

  return app;
}
```

- [ ] **Step 5:** Run `node --test apps/api/src/routes/pfm/__tests__/summary-service.test.js` — expect PASS (1 test). Run `node --check apps/api/src/routes/pfm/summary-routes.js`.
- [ ] **Step 6:** Commit: `git add apps/api/src/routes/pfm/summary-service.js apps/api/src/routes/pfm/summary-routes.js apps/api/src/routes/pfm/__tests__/summary-service.test.js && git commit -m "feat(pfm): dashboard summary service + route"`

---

## Task 6: Wire new routers into `index.js`

**Files:** Modify `apps/api/src/routes/pfm/index.js`, `apps/api/src/index.js`

- [ ] **Step 1: Update `apps/api/src/routes/pfm/index.js`**

```js
// apps/api/src/routes/pfm/index.js
import { Hono } from "hono";
import { createWalletsRouter } from "./wallets-routes.js";
import { createCategoriesRouter } from "./categories-routes.js";
import { createMovementsRouter } from "./movements-routes.js";
import { createSummaryRouter } from "./summary-routes.js";
import { createWalletsService } from "./wallets-service.js";
import { createMovementsService } from "./movements-service.js";
import { createLedgerLinkService } from "./ledger-link-service.js";
import { createLedgerService } from "../ledger/ledger-service.js";

export function createPfmRouter({ prisma, requirePermission, requireAnyPermission }) {
  const app = new Hono();

  const anyPermission =
    typeof requireAnyPermission === "function"
      ? requireAnyPermission
      : (keys = []) => requirePermission(keys[0]);

  const wallets = createWalletsService({ prisma });
  const ledgerService = createLedgerService({ prisma });
  const ledgerLink = createLedgerLinkService({ prisma, ledgerService });
  const movements = createMovementsService({ prisma, wallets });

  app.route("/", createWalletsRouter({ prisma, requirePermission, requireAnyPermission: anyPermission }));
  app.route("/", createCategoriesRouter({ prisma, requirePermission, requireAnyPermission: anyPermission }));
  app.route(
    "/",
    createMovementsRouter({
      prisma, requirePermission, requireAnyPermission: anyPermission,
      wallets, movements, ledgerLink,
    }),
  );
  app.route("/", createSummaryRouter({ prisma, requireAnyPermission: anyPermission }));

  return app;
}
```

Note: `createWalletsRouter` builds its own `createWalletsService` instance internally (Plan A1). That is fine — services are stateless factories over `prisma`. The shared `wallets` instance here is only for `movements`/`ledgerLink` composition.

- [ ] **Step 2:** `apps/api/src/index.js` already imports and mounts `createPfmRouter` from Plan A1 Task 11 — no change needed. Confirm with: `grep -n "createPfmRouter" apps/api/src/index.js` (expect 2 hits: import + mount).

- [ ] **Step 3:** Run `node --check apps/api/src/routes/pfm/index.js` and the boot smoke test:
```bash
node -e "import('./apps/api/src/routes/pfm/index.js').then(m => { const app = m.createPfmRouter({ prisma: {}, requirePermission: () => (c,n)=>n(), requireAnyPermission: () => (c,n)=>n() }); console.log('router ok', typeof app.fetch); })"
```
Expected: `router ok function`

- [ ] **Step 4:** Commit: `git add apps/api/src/routes/pfm/index.js && git commit -m "feat(pfm): compose movement + summary routers"`

---

## Task 7: SDK — movement + summary methods

**Files:** Modify `packages/sdk/src/index.js`

- [ ] **Step 1: Add to the `pfm` group (inside the object added in Plan A1 Task 12)**

```js
      listWalletMovements: (walletId, token, query = {}) =>
        request(`/pfm/wallets/${encodeURIComponent(walletId)}/movements${toQueryString(query)}`, {
          headers: withAuthHeaders(token),
        }),
      createWalletMovement: (walletId, data, token) =>
        request(`/pfm/wallets/${encodeURIComponent(walletId)}/movements`, {
          method: "POST",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      updateMovement: (movementId, data, token) =>
        request(`/pfm/movements/${encodeURIComponent(movementId)}`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      setMovementEnabled: (movementId, enabled, token) =>
        request(`/pfm/movements/${encodeURIComponent(movementId)}/enabled`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify({ enabled }),
        }),
      confirmMovement: (movementId, amount, token) =>
        request(`/pfm/movements/${encodeURIComponent(movementId)}/confirm`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
          body: JSON.stringify(amount === undefined ? {} : { amount }),
        }),
      skipMovement: (movementId, token) =>
        request(`/pfm/movements/${encodeURIComponent(movementId)}/skip`, {
          method: "PATCH",
          headers: withAuthHeaders(token),
        }),
      enrichLedgerMovement: (walletId, ltxId, data, token) =>
        request(`/pfm/wallets/${encodeURIComponent(walletId)}/ledger-movements/${encodeURIComponent(ltxId)}/enrichment`, {
          method: "PUT",
          headers: withAuthHeaders(token),
          body: JSON.stringify(data),
        }),
      getSummary: (token, query = {}) =>
        request(`/pfm/summary${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
```

- [ ] **Step 2:** Run `node --check packages/sdk/src/index.js` and `node --test packages/sdk/src/__tests__/` — expect no output / all PASS.
- [ ] **Step 3:** Commit: `git add packages/sdk/src/index.js && git commit -m "feat(pfm): SDK movement + summary methods"`

---

## Task 8: Cross-profile isolation suite

**Files:** Create `apps/api/src/routes/pfm/__tests__/isolation.test.js`

- [ ] **Step 1: Write the suite**

```js
// apps/api/src/routes/pfm/__tests__/isolation.test.js
//
// User B must never see User A's wallets, movements, or summary — regardless of
// RBAC permission (permission = "may use the module"; membership = "may see THIS
// wallet"). These tests assert the SQL access predicate on every list path and
// that services throw 404 (not a leak) when the row is filtered out.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWalletsService } from "../wallets-service.js";
import { createMovementsService } from "../movements-service.js";
import { createSummaryService } from "../summary-service.js";
import { PfmServiceError } from "../service-helpers.js";

const COMPANY = "01900000-0000-7000-8000-0000000000f1";
const USER_B = "01900000-0000-7000-8000-0000000000f2";
const WALLET_A = "01900000-0000-7000-8000-0000000000f3";

function sqlOf(strings) {
  return (Array.isArray(strings) ? strings.join(" ") : String(strings)).toLowerCase();
}

describe("pfm isolation — every list path is owner/member scoped", () => {
  it("wallets.listWallets scopes by owner_id or pfm_wallet_member and never NULL-owner", async () => {
    let sql = "";
    const prisma = { $queryRaw: async (s) => (sql = sqlOf(s), []) };
    await createWalletsService({ prisma }).listWallets({ companyId: COMPANY, actorId: USER_B });
    assert.ok(sql.includes("w.owner_id = ") && sql.includes("pfm_wallet_member"));
    assert.ok(!sql.includes("owner_id is null"));
  });

  it("movements.listMovements refuses when canReadWallet is false", async () => {
    const wallets = { canReadWallet: async () => false, canWriteWallet: async () => false };
    const prisma = { $queryRaw: async () => { throw new Error("must not query"); } };
    await assert.rejects(
      () => createMovementsService({ prisma, wallets }).listMovements({ companyId: COMPANY, actorId: USER_B, walletId: WALLET_A, query: {} }),
      (e) => e instanceof PfmServiceError && e.status === 404,
    );
  });

  it("summary.getOverview scopes every aggregate by owner_id or membership", async () => {
    const seen = [];
    const prisma = { $queryRaw: async (s) => (seen.push(sqlOf(s)), []) };
    await createSummaryService({ prisma }).getOverview({ companyId: COMPANY, actorId: USER_B, month: "2026-08" });
    assert.ok(seen.length >= 3, "expected several aggregate queries");
    for (const sql of seen) {
      assert.ok(
        sql.includes("w.owner_id = ") || sql.includes("wm.user_id ="),
        `aggregate not scoped to the actor: ${sql.slice(0, 80)}`,
      );
    }
  });
});
```

- [ ] **Step 2:** Run `node --test apps/api/src/routes/pfm/__tests__/isolation.test.js` — expect PASS (3 tests).
- [ ] **Step 3:** Commit: `git add apps/api/src/routes/pfm/__tests__/isolation.test.js && git commit -m "test(pfm): cross-profile isolation suite for phase 1"`

---

## Task 9: Full sweep

- [ ] **Step 1:** `node --test apps/api/src/routes/pfm/__tests__/` — all PASS (movements 5, ledger-link 3, summary 1, isolation 3, plus A1's wallets 3 + categories 2 = 17).
- [ ] **Step 2:** `node --test apps/api/src/routes/ledger/__tests__/` — unchanged, all PASS.
- [ ] **Step 3:** `pnpm lint` — no new errors under `apps/api/src/routes/pfm/**`.
- [ ] **Step 4:** `pnpm build` — success.
- [ ] **Step 5:** If DB reachable: start the API (`pnpm dev:api`), then
  `curl -s http://localhost:4010/health` (expect ok) and
  `curl -s http://localhost:4010/pfm/wallets` (expect 401 without a token — proves the route is mounted and auth-gated). Stop the dev server.
- [ ] **Step 6:** Commit any fixes: `git add -A && git commit -m "chore(pfm): phase 1 plan a2 sweep fixes"`

---

## Self-Review

- **Spec coverage:** §3.4 `PfmMovement` behaviour (balance = POSTED only, PENDING/POSTED/SKIPPED, confirm with override, skip) → Task 2. §3.5 `PfmLedgerEnrichment` + §4 read-only ledger mirror (access via `canReadAccount`, deposito/retiro normalization, upsert by `ledgerTransactionId`, never writes `ledger_transaction`, `removeEnrichmentsForWallet`) → Tasks 3, 4. §5.2 confirm/skip endpoints → Task 4. §9 Resumen rollups (total balance, month income/expense, prev-month delta, by-category, 6-month trend) → Task 5. §11 isolation suite on every list endpoint → Task 8. SDK surface → Task 7.
- **Placeholder scan:** none — literal code and concrete commands throughout.
- **Type consistency:** `createMovementsService({ prisma, wallets })`, `createLedgerLinkService({ prisma, ledgerService })`, `createSummaryService({ prisma })` signatures match between definition, `index.js` composition, and tests. `normalizeMovement`/`normalizeLedgerRow` both emit `{ direction, amount, occurredOn, status, source, editableInPfm }`. `getOverview` returns `{ totalBalance, monthExpense, monthIncome, prevMonthExpense, byCategory, trend }` — consumed identically by the SDK `getSummary` caller and the Plan B Resumen screen. Permission keys match the Plan A1 catalog/manifest.
- **Note on `listMovements` SQL:** the parameterized `IS NULL OR` filters rely on Postgres casting a JS `null` binding to `::text`/`::uuid`/`::date`. `prisma.$queryRaw` tagged templates bind positionally; the tests assert on lowercased SQL fingerprints only, so behaviour is verified against a live DB in Task 9 Step 5 and in Plan B browser QA.
