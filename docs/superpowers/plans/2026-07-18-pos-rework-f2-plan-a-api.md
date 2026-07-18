# POS Rework F2 — Plan A (API): Modifiers Engine

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f2-comandero-design.md` (sections 10–14, 22–25)

**Goal:** Product modifier groups/options with server-computed line pricing and immutable per-line snapshots, exposed through admin CRUD + bulk menu endpoints, integrated into `addOrderLine` and kitchen/order hydration.

**Architecture:** New `pos-modifier-service.js` owns catalog CRUD and `resolveSelection` (validation + price math). `addOrderLine` calls `resolveSelection` whenever the product has enabled groups, prices the line as base+Σdeltas inside a `$transaction` with the snapshot rows, and hydration joins snapshots onto lines. Notes and seats already exist — untouched.

**Tech Stack:** Prisma 7 (raw SQL migration, snake_case type names — F1 lesson), Hono, Zod, node:test in-memory mocks (style of `pos-waiter-shift-service.test.js`).

**Conventions:** Work on `main`. Commits end with the `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` trailer. Spanish errors, English code.

---

## File Structure Map

- Create: `prisma/migrations/20260718120000_pos_rework_f2_modifiers/migration.sql`
- Modify: `prisma/schema.prisma` (3 new models)
- Create: `apps/api/src/routes/pos/pos-modifier-service.js`
- Create: `apps/api/src/routes/pos/__tests__/pos-modifier-service.test.js`
- Modify: `apps/api/src/routes/pos/pos-order-service.js` (addOrderLine + hydrateOrder + factory param)
- Modify: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js`
- Modify: `apps/api/src/routes/pos/pos-kitchen-service.js` (board lines include modifiers)
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`
- Modify: `packages/sdk/src/index.js`

---

### Task 1: Schema + forward migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260718120000_pos_rework_f2_modifiers/migration.sql`

- [ ] **Step 1: Add three models to `prisma/schema.prisma`** (after `PosProductConfig`):

```prisma
model PosModifierGroup {
  id        String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId String   @db.Uuid @map("company_id")
  productId String   @db.Uuid @map("product_id")
  name      String
  minSelect Int      @default(0) @map("min_select")
  maxSelect Int      @default(1) @map("max_select")
  required  Boolean  @default(false)
  position  Int      @default(0)
  enabled   Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  options PosModifierOption[]

  @@unique([companyId, productId, name])
  @@index([companyId, productId, enabled])
  @@map("pos_modifier_group")
}

model PosModifierOption {
  id         String   @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId  String   @db.Uuid @map("company_id")
  groupId    String   @db.Uuid @map("group_id")
  name       String
  priceDelta Decimal  @default(0.00) @db.Decimal(12, 2) @map("price_delta")
  position   Int      @default(0)
  enabled    Boolean  @default(true)
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  group PosModifierGroup @relation(fields: [groupId], references: [id], onDelete: Cascade)

  @@index([groupId, enabled])
  @@map("pos_modifier_option")
}

model PosOrderLineModifier {
  id         String  @id @default(dbgenerated("uuidv7()")) @db.Uuid
  companyId  String  @db.Uuid @map("company_id")
  lineId     String  @db.Uuid @map("line_id")
  optionId   String  @db.Uuid @map("option_id")
  groupName  String  @map("group_name")
  optionName String  @map("option_name")
  priceDelta Decimal @default(0.00) @db.Decimal(12, 2) @map("price_delta")

  line PosOrderLine @relation(fields: [lineId], references: [id], onDelete: Cascade)

  @@index([lineId])
  @@map("pos_order_line_modifier")
}
```

Add the back-relation `modifiers PosOrderLineModifier[]` to `model PosOrderLine`.

- [ ] **Step 2: Write `migration.sql`:**

```sql
CREATE TABLE "pos_modifier_group" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "min_select" INTEGER NOT NULL DEFAULT 0,
    "max_select" INTEGER NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_modifier_group_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "pos_modifier_group_company_id_product_id_name_key" ON "pos_modifier_group"("company_id", "product_id", "name");
CREATE INDEX "pos_modifier_group_company_id_product_id_enabled_idx" ON "pos_modifier_group"("company_id", "product_id", "enabled");

CREATE TABLE "pos_modifier_option" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    "position" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "pos_modifier_option_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_modifier_option_group_id_enabled_idx" ON "pos_modifier_option"("group_id", "enabled");
ALTER TABLE "pos_modifier_option" ADD CONSTRAINT "pos_modifier_option_group_id_fkey"
    FOREIGN KEY ("group_id") REFERENCES "pos_modifier_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "pos_order_line_modifier" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "company_id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "group_name" TEXT NOT NULL,
    "option_name" TEXT NOT NULL,
    "price_delta" DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT "pos_order_line_modifier_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "pos_order_line_modifier_line_id_idx" ON "pos_order_line_modifier"("line_id");
ALTER TABLE "pos_order_line_modifier" ADD CONSTRAINT "pos_order_line_modifier_line_id_fkey"
    FOREIGN KEY ("line_id") REFERENCES "pos_order_line"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```

Before applying, verify the real order-line table name (`pos_order_line`) in `prisma/migrations/20260621190000_add_atlas_pos/migration.sql` — adjust if it differs.

- [ ] **Step 3: Validate + apply + regenerate**

```bash
pnpm.cmd exec prisma validate
pnpm.cmd db:migrate
pnpm.cmd db:generate
pnpm.cmd exec prisma migrate status
```

Expected: 52 migrations, "Database schema is up to date!". If `db:migrate` fails, STOP and report — do not edit after a partial apply.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260718120000_pos_rework_f2_modifiers/
git commit -m "feat(pos): add modifier group/option models and order-line modifier snapshots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Modifier service (TDD)

**Files:**
- Create: `apps/api/src/routes/pos/__tests__/pos-modifier-service.test.js`
- Create: `apps/api/src/routes/pos/pos-modifier-service.js`

- [ ] **Step 1: Write the failing tests** (mock-prisma style of `pos-waiter-shift-service.test.js` — Map stores for `posModifierGroup`/`posModifierOption` supporting findFirst/findMany/create/update with companyId/productId/groupId/enabled filters; `auditLog.create` collector):

```js
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createPosModifierService } from "../pos-modifier-service.js";
import { PosServiceError } from "../service-helpers.js";

// makePrisma(): stores groups/options in Maps; seed helper addGroup(product, {name, minSelect, maxSelect, required, enabled}, options[])

describe("pos-modifier-service", () => {
  it("createGroup rejects duplicate name per product with 409", async () => { /* create twice, expect PosServiceError 409 */ });

  it("listForProduct returns enabled groups with enabled options ordered by position", async () => { /* seed 2 groups (1 disabled) + options (1 disabled); expect only enabled, sorted */ });

  it("resolveSelection prices and snapshots a valid selection", async () => {
    // group "Salsa" min1 max2 required, options Verde(0), Roja(0), Queso(10)
    // resolveSelection({optionIds:[verde,queso]}) -> { totalDelta: 10, snapshots: [{groupName:"Salsa",optionName:"Verde",priceDelta:0}, {..."Extra queso",10}] }
  });

  it("resolveSelection rejects missing required group with Spanish 400", async () => {
    // no optionIds -> PosServiceError 400 message includes "Faltan modificadores requeridos: Salsa."
  });

  it("resolveSelection rejects out-of-range count with min/max message", async () => {
    // 3 options selected on max 2 -> 400 message includes "mín" y "máx" (from plan message "Selección inválida en Salsa (mín 1, máx 2).")
  });

  it("resolveSelection rejects an option from another product/company with 404", async () => {});

  it("resolveSelection skips a required group whose options are all disabled", async () => {
    // required group, all options disabled -> resolves with empty selection, no throw (edge case 2)
  });
});
```

Write these as REAL tests (full arrange/act/assert following the sibling file's conventions), not comments.

- [ ] **Step 2: Run to fail** — `node --test apps/api/src/routes/pos/__tests__/pos-modifier-service.test.js` (module not found).

- [ ] **Step 3: Implement `pos-modifier-service.js`:**

```js
import { PosServiceError, requireCompanyId, writeAudit } from "./service-helpers.js";

export function createPosModifierService({ prisma }) {
  async function listForProduct({ companyId, productId, includeDisabled = false }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const groups = await prisma.posModifierGroup.findMany({
      where: {
        companyId: scopedCompanyId,
        productId,
        ...(includeDisabled ? {} : { enabled: true }),
      },
      orderBy: { position: "asc" },
    });
    const result = [];
    for (const group of groups) {
      const options = await prisma.posModifierOption.findMany({
        where: { groupId: group.id, ...(includeDisabled ? {} : { enabled: true }) },
        orderBy: { position: "asc" },
      });
      result.push({ ...group, options });
    }
    return result;
  }

  async function listByProducts({ companyId, productIds }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const map = {};
    for (const productId of productIds) {
      const groups = await listForProduct({ companyId: scopedCompanyId, productId });
      if (groups.length > 0) map[productId] = groups;
    }
    return map;
  }

  async function createGroup({ companyId, actorId, productId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const duplicate = await prisma.posModifierGroup.findFirst({
      where: { companyId: scopedCompanyId, productId, name: data.name },
    });
    if (duplicate) throw new PosServiceError("Ya existe un grupo con ese nombre para el producto.", 409);
    const group = await prisma.posModifierGroup.create({
      data: {
        companyId: scopedCompanyId,
        productId,
        name: data.name,
        minSelect: data.minSelect ?? 0,
        maxSelect: data.maxSelect ?? 1,
        required: data.required ?? false,
        position: data.position ?? 0,
      },
    });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierGroup", entityId: group.id,
      action: "pos.modifierGroup.create", after: group,
    });
    return group;
  }

  async function updateGroup({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posModifierGroup.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!before) throw new PosServiceError("Grupo de modificadores no encontrado.", 404);
    const group = await prisma.posModifierGroup.update({ where: { id }, data });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierGroup", entityId: id,
      action: "pos.modifierGroup.update", before, after: group,
    });
    return group;
  }

  async function createOption({ companyId, actorId, groupId, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const group = await prisma.posModifierGroup.findFirst({ where: { id: groupId, companyId: scopedCompanyId } });
    if (!group) throw new PosServiceError("Grupo de modificadores no encontrado.", 404);
    const option = await prisma.posModifierOption.create({
      data: {
        companyId: scopedCompanyId,
        groupId,
        name: data.name,
        priceDelta: data.priceDelta ?? 0,
        position: data.position ?? 0,
      },
    });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierOption", entityId: option.id,
      action: "pos.modifierOption.create", after: option,
    });
    return option;
  }

  async function updateOption({ companyId, actorId, id, data }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const before = await prisma.posModifierOption.findFirst({ where: { id, companyId: scopedCompanyId } });
    if (!before) throw new PosServiceError("Opción de modificador no encontrada.", 404);
    const option = await prisma.posModifierOption.update({ where: { id }, data });
    await writeAudit(prisma, {
      actorId, entityType: "PosModifierOption", entityId: id,
      action: "pos.modifierOption.update", before, after: option,
    });
    return option;
  }

  // Validates a selection for a product; returns price delta + immutable snapshots.
  async function resolveSelection({ companyId, productId, optionIds = [] }) {
    const scopedCompanyId = requireCompanyId(companyId);
    const groups = await listForProduct({ companyId: scopedCompanyId, productId });
    if (groups.length === 0) {
      if (optionIds.length > 0) throw new PosServiceError("Opción de modificador no encontrada.", 404);
      return { totalDelta: 0, snapshots: [] };
    }
    const optionIndex = new Map();
    for (const group of groups) {
      for (const option of group.options) optionIndex.set(option.id, { group, option });
    }
    const perGroupCount = new Map();
    const snapshots = [];
    let totalDelta = 0;
    for (const optionId of optionIds) {
      const hit = optionIndex.get(optionId);
      if (!hit) throw new PosServiceError("Opción de modificador no encontrada.", 404);
      perGroupCount.set(hit.group.id, (perGroupCount.get(hit.group.id) ?? 0) + 1);
      totalDelta += Number(hit.option.priceDelta ?? 0);
      snapshots.push({
        optionId,
        groupName: hit.group.name,
        optionName: hit.option.name,
        priceDelta: Number(hit.option.priceDelta ?? 0),
      });
    }
    for (const group of groups) {
      const count = perGroupCount.get(group.id) ?? 0;
      const hasEnabledOptions = group.options.length > 0;
      const min = group.required ? Math.max(1, group.minSelect) : group.minSelect;
      if (group.required && count < min && hasEnabledOptions) {
        throw new PosServiceError(`Faltan modificadores requeridos: ${group.name}.`, 400);
      }
      if (count > 0 && (count < group.minSelect || count > group.maxSelect)) {
        throw new PosServiceError(
          `Selección inválida en ${group.name} (mín ${group.minSelect}, máx ${group.maxSelect}).`, 400,
        );
      }
      if (count > group.maxSelect) {
        throw new PosServiceError(
          `Selección inválida en ${group.name} (mín ${group.minSelect}, máx ${group.maxSelect}).`, 400,
        );
      }
    }
    return { totalDelta, snapshots };
  }

  return { listForProduct, listByProducts, createGroup, updateGroup, createOption, updateOption, resolveSelection };
}
```

- [ ] **Step 4: Run to green** — the modifier test file passes; then full suite `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` stays green.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-modifier-service.js apps/api/src/routes/pos/__tests__/pos-modifier-service.test.js
git commit -m "feat(pos): add modifier service with selection resolution and price deltas

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: addOrderLine integration + hydration (TDD)

**Files:**
- Modify: `apps/api/src/routes/pos/__tests__/pos-order-service.test.js`
- Modify: `apps/api/src/routes/pos/pos-order-service.js`

- [ ] **Step 1: Failing tests** (extend the order-service mock with `posModifierGroup`/`posModifierOption`/`posOrderLineModifier` stores and a `$transaction: async (fn) => fn(prismaMock)` passthrough if absent):

1. `addOrderLine` on a product with required group and no `modifiers` → PosServiceError 400 "Faltan modificadores requeridos".
2. `addOrderLine` with valid `modifiers` → line `unitPrice === base + Σ deltas`, `posOrderLineModifier` store has the snapshots with `lineId`.
3. Tamper: `data.unitPrice: 1` + valid modifiers → stored unitPrice is still base+deltas (client price ignored when modifiers/groups present).
4. Hydrated order (`getOrder`/`hydrateOrder` result) lines include `modifiers` array with `groupName/optionName/priceDelta`.

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement in `pos-order-service.js`:**

1. Factory: `createPosOrderService({ prisma, waiterShifts, modifiers })` with `const modifierSvc = modifiers ?? createPosModifierService({ prisma });` (add import).
2. In `addOrderLine` (line ~347), after `loadCatalogSnapshot`:

```js
    const selection = await modifierSvc.resolveSelection({
      companyId: scopedCompanyId,
      productId: snapshot.productId,
      optionIds: (data.modifiers ?? []).map((m) => m.optionId),
    });
    const unitPrice = selection.snapshots.length > 0 || selection.totalDelta > 0
      ? toMoney(Number(snapshot.unitPrice) + selection.totalDelta)
      : snapshot.unitPrice;
```

Then use `unitPrice` in `lineAmounts` and the line `data`, and wrap line creation + snapshots in a transaction:

```js
    const line = await prisma.$transaction(async (tx) => {
      const created = await tx.posOrderLine.create({ data: { /* as today, with unitPrice */ } });
      if (selection.snapshots.length > 0) {
        await tx.posOrderLineModifier.createMany({
          data: selection.snapshots.map((s) => ({
            companyId: scopedCompanyId,
            lineId: created.id,
            optionId: s.optionId,
            groupName: s.groupName,
            optionName: s.optionName,
            priceDelta: s.priceDelta,
          })),
        });
      }
      return created;
    });
```

IMPORTANT: when the product has NO groups and NO modifiers sent, behavior must remain byte-identical to today (snapshot.unitPrice, no transaction change needed but keeping the transaction wrapper is fine).
3. In `hydrateOrder` (line ~44), after loading `lines`, load snapshots in one query and attach:

```js
    const lineIds = lines.map((l) => l.id);
    const lineModifiers = lineIds.length
      ? await db.posOrderLineModifier.findMany({ where: { lineId: { in: lineIds } } })
      : [];
    const modifiersByLine = new Map();
    for (const m of lineModifiers) {
      if (!modifiersByLine.has(m.lineId)) modifiersByLine.set(m.lineId, []);
      modifiersByLine.get(m.lineId).push({ groupName: m.groupName, optionName: m.optionName, priceDelta: m.priceDelta });
    }
    const linesWithModifiers = lines.map((l) => ({ ...l, modifiers: modifiersByLine.get(l.id) ?? [] }));
```

and return `lines: linesWithModifiers`.

- [ ] **Step 4: Run to green** — order suite + full suite.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/pos/pos-order-service.js apps/api/src/routes/pos/__tests__/pos-order-service.test.js
git commit -m "feat(pos): price order lines with modifier deltas and persist immutable snapshots

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Kitchen board lines include modifiers + note

**Files:**
- Modify: `apps/api/src/routes/pos/pos-kitchen-service.js`

- [ ] **Step 1:** Locate where the kitchen board/ticket payload builds its line objects (search `productName` / ticket lines in `pos-kitchen-service.js`). Join `posOrderLineModifier` rows (one `findMany` with `lineId: { in: [...] }`, grouped as in Task 3) and attach `modifiers` (array of `{ groupName, optionName }`) and the line `note` to each board line if not already present.
- [ ] **Step 2:** If a kitchen test file covers the board shape, extend it with one assertion: a line with snapshots exposes `modifiers[0].optionName`. If none covers it, add the assertion to `pos-floor-kitchen-service.test.js` following its conventions.
- [ ] **Step 3:** `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` green; commit:

```bash
git add apps/api/src/routes/pos/pos-kitchen-service.js apps/api/src/routes/pos/__tests__/pos-floor-kitchen-service.test.js
git commit -m "feat(pos): expose line modifiers and notes on kitchen board payloads

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Validators + routes

**Files:**
- Modify: `apps/api/src/routes/pos/validators.js`
- Modify: `apps/api/src/routes/pos/pos-routes.js`

- [ ] **Step 1: Validators:**

```js
export const createModifierGroupSchema = z
  .object({
    name: z.string().min(1).max(80),
    minSelect: z.coerce.number().int().min(0).default(0),
    maxSelect: z.coerce.number().int().min(1).default(1),
    required: z.boolean().default(false),
    position: z.coerce.number().int().min(0).default(0),
  })
  .refine((v) => v.minSelect <= v.maxSelect, { message: "minSelect no puede ser mayor que maxSelect." });

export const updateModifierGroupSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  minSelect: z.coerce.number().int().min(0).optional(),
  maxSelect: z.coerce.number().int().min(1).optional(),
  required: z.boolean().optional(),
  position: z.coerce.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});

export const createModifierOptionSchema = z.object({
  name: z.string().min(1).max(80),
  priceDelta: moneySchema.min(0).default(0),
  position: z.coerce.number().int().min(0).default(0),
});

export const updateModifierOptionSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  priceDelta: moneySchema.min(0).optional(),
  position: z.coerce.number().int().min(0).optional(),
  enabled: z.boolean().optional(),
});
```

Extend `addOrderLineSchema` with:

```js
  modifiers: z.array(z.object({ optionId: uuidSchema })).max(30).optional(),
```

(`updateOrderLineSchema` stays without `modifiers` — edge case 5.)

- [ ] **Step 2: Routes** in `pos-routes.js` (import service + schemas; `const modifierSvc = createPosModifierService({ prisma });` and pass `modifiers: modifierSvc` into `createPosOrderService`):

```js
  app.get("/pos/products/:productId/modifier-groups", requirePermission("pos.orders.read"), async (c) => {
    try {
      return c.json({
        data: await modifierSvc.listForProduct({
          ...context(c),
          productId: c.req.param("productId"),
          includeDisabled: c.req.query("includeDisabled") === "true",
        }),
      });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los modificadores.");
    }
  });

  app.get("/pos/modifier-groups", requirePermission("pos.orders.read"), async (c) => {
    try {
      const productIds = (c.req.query("productIds") ?? "").split(",").filter(Boolean);
      return c.json({ data: await modifierSvc.listByProducts({ ...context(c), productIds }) });
    } catch (err) {
      return handleError(c, err, "No se pudieron consultar los modificadores.");
    }
  });

  app.post("/pos/products/:productId/modifier-groups", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, createModifierGroupSchema);
      return c.json({
        data: await modifierSvc.createGroup({ ...context(c), productId: c.req.param("productId"), data }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear el grupo de modificadores.");
    }
  });

  app.patch("/pos/modifier-groups/:id", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, updateModifierGroupSchema);
      return c.json({ data: await modifierSvc.updateGroup({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar el grupo de modificadores.");
    }
  });

  app.post("/pos/modifier-groups/:id/options", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, createModifierOptionSchema);
      return c.json({
        data: await modifierSvc.createOption({ ...context(c), groupId: c.req.param("id"), data }),
      }, 201);
    } catch (err) {
      return handleError(c, err, "No se pudo crear la opción de modificador.");
    }
  });

  app.patch("/pos/modifier-options/:id", requirePermission("pos.admin.update"), async (c) => {
    try {
      const data = await parseBody(c, updateModifierOptionSchema);
      return c.json({ data: await modifierSvc.updateOption({ ...context(c), id: c.req.param("id"), data }) });
    } catch (err) {
      return handleError(c, err, "No se pudo actualizar la opción de modificador.");
    }
  });
```

ROUTE ORDER: register `GET /pos/modifier-groups` (bulk) BEFORE `PATCH /pos/modifier-groups/:id` group; Hono matches by method+path so collisions are unlikely, but keep the bulk GET first for clarity.

- [ ] **Step 3:** `node --check` both files; full suite green; commit:

```bash
git add apps/api/src/routes/pos/validators.js apps/api/src/routes/pos/pos-routes.js
git commit -m "feat(pos): expose modifier catalog routes and line modifiers validator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js` (pos domain)

- [ ] **Step 1:** Add, following the domain's existing conventions (`toQueryString`, `withAuthHeaders`, `JSON.stringify` bodies — same as the F1 waiter-shift methods):

```js
      listProductModifierGroups: (productId, query, token) =>
        request(`/pos/products/${encodeURIComponent(productId)}/modifier-groups${toQueryString(query)}`, {
          headers: withAuthHeaders(token),
        }),
      listModifierGroups: (query, token) =>
        request(`/pos/modifier-groups${toQueryString(query)}`, { headers: withAuthHeaders(token) }),
      createModifierGroup: (productId, data, token) =>
        request(`/pos/products/${encodeURIComponent(productId)}/modifier-groups`, {
          method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data),
        }),
      updateModifierGroup: (id, data, token) =>
        request(`/pos/modifier-groups/${encodeURIComponent(id)}`, {
          method: "PATCH", headers: withAuthHeaders(token), body: JSON.stringify(data),
        }),
      createModifierOption: (groupId, data, token) =>
        request(`/pos/modifier-groups/${encodeURIComponent(groupId)}/options`, {
          method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(data),
        }),
      updateModifierOption: (id, data, token) =>
        request(`/pos/modifier-options/${encodeURIComponent(id)}`, {
          method: "PATCH", headers: withAuthHeaders(token), body: JSON.stringify(data),
        }),
```

- [ ] **Step 2:** `node --check packages/sdk/src/index.js`; commit:

```bash
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add pos modifier catalog client methods

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Full verification + TASKS.md

- [ ] **Step 1:** `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` — all green (report counts). `pnpm.cmd exec prisma migrate status` — up to date.
- [ ] **Step 2:** Boot `pnpm dev:api`, `curl -s http://localhost:4010/health` → 200, `curl -s -o /dev/null -w "%{http_code}" http://localhost:4010/pos/modifier-groups` → 401 (guarded route registered). Stop the server.
- [ ] **Step 3:** Add to `docs/TASKS.md` atlas.pos section:

```markdown
- [x] F2-A Modifiers engine: modifier group/option models + migration, selection resolution with server-side pricing, line snapshots, kitchen payload modifiers, catalog routes + SDK
```

with a `Verified:` line (real command outputs + commit SHAs). Commit:

```bash
git add docs/TASKS.md
git commit -m "docs(tasks): record POS rework F2-A completion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
