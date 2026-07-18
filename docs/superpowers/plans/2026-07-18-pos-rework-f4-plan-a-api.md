# POS Rework F4 — Plan A (API): Kitchen Fallback + Product Config

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f4-cocina-design.md` (sections 12-14, 23, 25.1-2)

**Goal:** Kitchen sends fall back to the outlet default station; `posProductConfig` becomes manageable via API; board payload lines carry `orderLine: { productName, quantity }`. Zero migrations.

**Conventions:** `main`; trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`; Spanish errors; TDD; mock-prisma style of existing pos tests.

## File Structure Map

- Modify: `apps/api/src/routes/pos/pos-kitchen-service.js` (fallback + orderLine join + new config functions OR a small `pos-product-config-service.js` — implementer's call, report it)
- Modify: `apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js`
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`
- Modify: `packages/sdk/src/index.js`

### Task 1: Fallback + orderLine join + config functions (TDD)

- [ ] **Step 1: Failing tests** (extend the kitchen test harness):
1. Line without product station + order's outlet has `defaultStationId: "st-tacos"` → send succeeds, ticket created on `st-tacos` with the line.
2. Line without product station + outlet default null → PosServiceError 400 with the existing "no tienen estación" message.
3. Mixed: line A with own station st-1, line B fallback → two tickets or one per distinct station, line B under `st-tacos`.
4. `listTickets` line exposes `orderLine.productName` and `orderLine.quantity` from the source `posOrderLine` (batch join); missing order line → `orderLine: null`.
5. `updateProductConfig` upserts `(companyId, productId, variantId null)`: creates when absent, updates when present, validates station company ownership (404 "Estación de preparación no encontrada." on foreign station), audits `pos.productConfig.update`.
6. `listProductConfigs` returns the company's rows.

- [ ] **Step 2:** Run to fail.
- [ ] **Step 3: Implement.**
  - In `sendOrderToKitchen`: after collecting `missingStationLineIds`, load the order's outlet once (`tx.posOutlet.findFirst({ where: { id: order.outletId, companyId } })`); if `outlet?.defaultStationId`, move those lines into `byStation` under it and clear the missing list; else keep the existing throw.
  - In `listTickets`: alongside the modifiers join, batch `tx/prisma.posOrderLine.findMany({ where: { id: { in: orderLineIds } } })` and attach `orderLine: line ? { productName: line.productName, quantity: line.quantity } : null`.
  - Config functions (in kitchen service or a new `pos-product-config-service.js`): `listProductConfigs({ companyId })`; `updateProductConfig({ companyId, actorId, productId, data })` upserting via `findFirst` + create/update (variantId null scope), station validation, `writeAudit`.
- [ ] **Step 4:** Green target file; full suite `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (report counts); `node --check` touched services.
- [ ] **Step 5:** Commit `feat(pos): kitchen fallback to outlet default station and product config management` (+trailer), only the service+test files.

### Task 2: Validators + routes + SDK

- [ ] **Step 1: Validator:**

```js
export const updateProductConfigSchema = z
  .object({
    stationId: uuidSchema.nullable().optional(),
    requiresPreparation: z.boolean().optional(),
    availableInPos: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nada que actualizar." });
```

- [ ] **Step 2: Routes** (file conventions): `GET /pos/product-configs` guard `pos.admin.read` → `listProductConfigs`; `PUT /pos/products/:productId/config` guard `pos.admin.update` → parse + `updateProductConfig`. Wire whichever service holds the functions.
- [ ] **Step 3: SDK** (pos domain, sibling conventions): `listProductConfigs(token)`, `updateProductConfig(productId, data, token)` (PUT).
- [ ] **Step 4:** `node --check` all touched; full suite green; commit `feat(pos): product config routes and SDK` (+trailer).
