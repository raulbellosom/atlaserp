# atlas.pos — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.pos` (CORE — restaurant point of sale). Manifest in `core-modules.js`.
**Status:** Post-audit reference (2026-08-30 pass). Module was paused mid-work
July 2026; a refund flow does not exist yet.

---

## 1. Layout

```
apps/api/src/routes/pos/
  pos-routes.js            (806 — > 800 proactive-split threshold, split pending)
  service-helpers.js       requireCompanyId / assertEditableOrder / toMoney / writeAudit
  pos-order-service.js     (674)  orders, lines, guests (split-bill), payments
  pos-session-service.js   (191)  cash sessions (open/close/reconcile)
  pos-waiter-shift-service.js (92) per-waiter cash cuts
  pos-floor-service.js (416)  pos-kitchen-service.js (340)  pos-modifier-service.js (147)
  pos-reservation-service.js (227)  pos-settings-service.js (221)
  __tests__/  7 files (66 tests)
apps/desktop/src/modules/atlas.pos/  Terminal, Tables, FloorPlanner, Comanda, Caja, Sessions, Settings
```

## 2. Access control

`requireCompanyId(companyId)` guards every service method (throws on missing).
Every query is `companyId`-scoped. FK references are validated against the
company (`loadCatalogSnapshot` → product/variant; `addPayment` →
`posPaymentMethod`, `posSession`, `posOutlet`). 67 routes, **67
`requirePermission`** (1:1). 22 granular permission keys
(`pos.orders.{read,create,update,cancel}`, `pos.payments.create`,
`pos.sessions.{read,manage}`, `pos.cash.manage`, `pos.floor.*`, `pos.stations.*`,
`pos.caja.{read,operate,close}`, `pos.comandas.*`, `pos.settings.manage`,
`pos.external.manage`, `pos.terminal.use`) — all in `permission-catalog.js`.

## 3. Money handling (hardened 2026-08-30)

- **`addPayment` is now transactional + concurrency-safe.** The payment row, the
  order's `paidAmount`/`status`, the waiter-shift cash total (`{ increment }`)
  and the table status are written in one `prisma.$transaction`. The order
  update is a conditional `updateMany({ where: { id, companyId, paidAmount:
  <the value read>, status: { notIn: [CANCELLED, REFUNDED, PAID] } } })` — a
  concurrent payment that already committed makes `count === 0`, so it 409s
  ("modificacion concurrente") instead of over-charging. Overpayment vs the
  remaining balance is still rejected 400.
  _Before:_ 4 separate writes with no transaction and no CAS — a partial failure
  left the payment recorded but the order un-updated (re-payable → double
  charge), and two concurrent calls could both pass the balance check.
- **`closeSession` is now a conditional close.** `updateMany({ where: { id,
  companyId, status: 'OPEN' } })` + `count` check → 409 if already closed
  (was a plain `update` after a read).
- `createOrder`, `addOrderLine`, and the floor / kitchen / reservation services
  already use `$transaction`.

## 4. Known gaps / follow-ups (backlog)

- **POS2** — cancelling a **partially-paid** order (`status: OPEN`,
  `paidAmount > 0`) is allowed and does not reverse the captured `posPayment`
  rows. There is **no refund flow at all** (`REFUNDED` is checked, never set; no
  `refundOrder`). Needs either: block cancel when `paidAmount > 0`, or a proper
  refund/void path. — _feature, not a quick fix_
- **POS5** — `pos-routes.js` 806 lines → split by domain (orders / floor /
  kitchen / sessions / settings / reservations).
- `cancelOrder` / `closeSession` still do a second write (table status) outside
  the transaction — no money, low priority.
- Desktop: `PosFloorPlannerScreen.jsx` (898), `PosSettingsScreen.jsx` (837) —
  approaching the 1000-line limit.
- Browser QA of the split-bill / waiter / caja flows (memory notes this was
  pending since the July pause).

## 5. Verification (2026-08-30)

- `node --check pos-order-service.js` / `pos-session-service.js` — pass.
- `node --test routes/pos/__tests__/*.test.js` — 66/66 (added a
  concurrent-payment 409 test; updated `$transaction` / `updateMany` mocks).
- Full API dirs — 782 / 0.
