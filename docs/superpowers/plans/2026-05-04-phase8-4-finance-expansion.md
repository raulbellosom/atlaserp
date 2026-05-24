# Phase 8.4-A (AR/AP Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build complete AR/AP core operations (invoices, notes, advances, payments, editable FIFO application, aging, and automatic journal posting) inside `atlas.finance` with real data only.

**Architecture:** Implement a unified finance document subledger in API with strict company and currency guards, then expose it through validators + SDK + route handlers. Desktop consumes new contracts via dedicated finance sidebar routes (`/finance/ar`, `/finance/ap`, `/finance/aging`, `/finance/applications`) using shared Atlas UI components and explicit pending/loading states.

**Tech Stack:** Prisma v6, Hono API, Zod validators, `@atlas/sdk`, React + TanStack Query, `@atlas/ui`, Supabase PostgreSQL.

---

## File Structure (planned changes)

### API / Domain

- Create: `apps/api/src/services/finance-documents-service.js`
  - Owner of AR/AP document CRUD, application preview/confirm, lifecycle/status transitions.
- Create: `apps/api/src/services/finance-posting-service.js`
  - Owner of journal posting generation + `FinanceDocumentAccountingLink` writes.
- Create: `apps/api/src/services/finance-aging-service.js`
  - Owner of bucket aggregation (`0-30`, `31-60`, `61-90`, `90+`).
- Create: `apps/api/src/services/finance-application-engine.js`
  - Pure functions for FIFO proposal + allocation validation (testable without DB).
- Modify: `apps/api/src/services/finance-service.js`
  - Keep existing 8.1/8.2/8.3 API stable; expose/compose 8.4-A services.
- Modify: `apps/api/src/index.js`
  - Add `/finance/documents*`, `/finance/aging`, `/finance/documents/:id/journal-links` routes.

### Data / Schema

- Modify: `prisma/schema.prisma`
  - Add `FinanceDocument`, `FinanceDocumentApplication`, `FinanceDocumentAccountingLink` (+ enums).
- Create: `prisma/migrations/<timestamp>_phase8_4_ar_ap_core/migration.sql`
  - Forward-only migration for new models/indexes.

### Contracts / SDK

- Modify: `packages/validators/src/index.js`
  - Add document create/update/application preview/apply/aging query schemas.
- Modify: `packages/sdk/src/index.js`
  - Add `atlas.finance` document + aging + journal-link methods.

### Desktop UX

- Modify: `packages/maps/src/feature-modules.js`
  - Add finance navigation items: `CxC`, `CxP`, `Aging`, `Aplicaciones`.
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
  - Route mappings for new finance screens.
- Create: `apps/desktop/src/modules/atlas.finance/hooks/useFinanceDocuments.js`
  - Shared query/mutation hooks for AR/AP documents and applications.
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceDocumentsToolbar.jsx`
  - Search/filter/sort controls using shared UI components.
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceDocumentFormSheet.jsx`
  - Create/edit document form (invoice/note/advance/payment).
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceApplySheet.jsx`
  - FIFO preview + editable allocation + confirm.
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceJournalLinksPanel.jsx`
  - Traceability panel for posted journal entries.
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceArScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceApScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceAgingScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceApplicationsScreen.jsx`

### Tests / Verification

- Create: `apps/api/src/services/__tests__/finance-application-engine.test.js`
  - Node test coverage for FIFO and allocation guards.
- Modify: `docs/TASKS.md`
  - Add Phase 8.4-A checklist and verification evidence line.

---

### Task 1: Prisma subledger models and migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp>_phase8_4_ar_ap_core/migration.sql`
- Test: `pnpm.cmd db:generate`, `pnpm.cmd db:migrate`

- [ ] **Step 1: Add new enums and models to schema**

```prisma
enum FinanceDocumentDirection {
  AR
  AP
}

enum FinanceDocumentType {
  INVOICE
  CREDIT_NOTE
  DEBIT_NOTE
  ADVANCE
  PAYMENT
}

enum FinanceDocumentStatus {
  OPEN
  PARTIAL
  PAID
  VOID
}

model FinanceDocument {
  id          String @id @default(uuid(7))
  companyId   String
  direction   FinanceDocumentDirection
  docType     FinanceDocumentType
  status      FinanceDocumentStatus @default(OPEN)
  contactId   String?
  currency    String @default("MXN")
  issueDate   DateTime
  dueDate     DateTime?
  reference   String?
  notesMarkdown String?
  totalAmount Decimal
  openAmount  Decimal
  metadata    Json?
  enabled     Boolean @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  company     Company @relation(fields: [companyId], references: [id], onDelete: Cascade)

  @@index([companyId, direction, status])
  @@index([companyId, issueDate])
  @@index([companyId, dueDate])
}
```

- [ ] **Step 2: Create migration and review SQL forward-only changes**

Run: `pnpm.cmd db:migrate`
Expected: Prisma creates new migration folder with `CREATE TABLE` + indexes for 8.4-A models.

- [ ] **Step 3: Regenerate Prisma client**

Run: `pnpm.cmd db:generate`
Expected: `? Generated Prisma Client`.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(finance): add AR/AP subledger prisma models"
```

### Task 2: Add validators for documents, applications, and aging

**Files:**
- Modify: `packages/validators/src/index.js`
- Test: `node --check packages/validators/src/index.js`

- [ ] **Step 1: Write failing import/use check in API route draft**

```js
import {
  financeDocumentCreateSchema,
  financeApplicationPreviewSchema,
} from "@atlas/validators";
```

Expected failure before implementation: export not found.

- [ ] **Step 2: Implement schemas**

```js
export const financeDocumentCreateSchema = z.object({
  direction: z.enum(["AR", "AP"]),
  docType: z.enum(["INVOICE", "CREDIT_NOTE", "DEBIT_NOTE", "ADVANCE", "PAYMENT"]),
  contactId: z.string().uuid().optional().nullable(),
  currency: z.string().min(3).max(3),
  issueDate: z.string().datetime(),
  dueDate: z.string().datetime().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  notesMarkdown: z.string().max(5000).optional().nullable(),
  totalAmount: z.number().positive(),
  metadata: z.record(z.any()).optional(),
});
```

- [ ] **Step 3: Validate parser file compiles**

Run: `node --check packages/validators/src/index.js`
Expected: no output, exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/index.js
git commit -m "feat(validators): add finance document and aging schemas"
```

### Task 3: Build pure FIFO allocation engine with node tests

**Files:**
- Create: `apps/api/src/services/finance-application-engine.js`
- Create: `apps/api/src/services/__tests__/finance-application-engine.test.js`
- Test: `node --test apps/api/src/services/__tests__/finance-application-engine.test.js`

- [ ] **Step 1: Write failing tests first**

```js
import test from "node:test";
import assert from "node:assert/strict";
import { buildFifoProposal } from "../finance-application-engine.js";

test("buildFifoProposal allocates oldest first", () => {
  const result = buildFifoProposal({ sourceOpen: 1000, targets: [{ id: "a", open: 400 }, { id: "b", open: 800 }] });
  assert.deepEqual(result.lines, [{ targetId: "a", amount: 400 }, { targetId: "b", amount: 600 }]);
});
```

- [ ] **Step 2: Run test to confirm failure**

Run: `node --test apps/api/src/services/__tests__/finance-application-engine.test.js`
Expected: FAIL `Cannot find export 'buildFifoProposal'`.

- [ ] **Step 3: Implement minimal engine + guards**

```js
export function buildFifoProposal({ sourceOpen, targets }) {
  let remaining = sourceOpen;
  const lines = [];
  for (const target of targets) {
    if (remaining <= 0) break;
    const amount = Math.min(remaining, target.open);
    if (amount > 0) {
      lines.push({ targetId: target.id, amount });
      remaining -= amount;
    }
  }
  return { lines, unapplied: remaining };
}
```

- [ ] **Step 4: Re-run tests**

Run: `node --test apps/api/src/services/__tests__/finance-application-engine.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/finance-application-engine.js apps/api/src/services/__tests__/finance-application-engine.test.js
git commit -m "test(finance): add FIFO allocation engine coverage"
```

### Task 4: Implement AR/AP document service + posting link integration

**Files:**
- Create: `apps/api/src/services/finance-documents-service.js`
- Create: `apps/api/src/services/finance-posting-service.js`
- Create: `apps/api/src/services/finance-aging-service.js`
- Modify: `apps/api/src/services/finance-service.js`
- Test: `node --check apps/api/src/services/finance-documents-service.js`

- [ ] **Step 1: Wire service contract and error class usage**

```js
export function createFinanceDocumentsService({ prisma, financeService }) {
  return {
    listDocuments,
    createDocument,
    getDocumentById,
    updateDocument,
    setDocumentEnabled,
    previewApplication,
    applyDocument,
    getAging,
    getJournalLinks,
  };
}
```

- [ ] **Step 2: Implement create/update with status/openAmount rules**

```js
const openAmount = totalAmountCents;
const status = openAmount === 0 ? "PAID" : "OPEN";
```

- [ ] **Step 3: Implement `applyDocument` transactional flow**

```js
await prisma.$transaction(async (tx) => {
  // validate balances + currency + direction
  // insert FinanceDocumentApplication lines
  // recalc source/target openAmount + status
  // create FinanceJournalEntry + FinanceDocumentAccountingLink
});
```

- [ ] **Step 4: Implement aging buckets query**

```js
const buckets = { b0_30: 0, b31_60: 0, b61_90: 0, b90_plus: 0 };
```

- [ ] **Step 5: Syntax checks**

Run:
- `node --check apps/api/src/services/finance-documents-service.js`
- `node --check apps/api/src/services/finance-posting-service.js`
- `node --check apps/api/src/services/finance-aging-service.js`

Expected: all exit 0.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/finance-*.js
git commit -m "feat(finance): implement AR/AP documents, applications, and aging services"
```

### Task 5: Add Hono routes for document workflows

**Files:**
- Modify: `apps/api/src/index.js`
- Test: `node --check apps/api/src/index.js`

- [ ] **Step 1: Add new endpoints with validator parsing**

```js
app.get("/finance/documents", authMiddleware, async (c) => { ... });
app.post("/finance/documents", authMiddleware, async (c) => { ... });
app.post("/finance/documents/:id/apply-preview", authMiddleware, async (c) => { ... });
app.post("/finance/documents/:id/apply", authMiddleware, async (c) => { ... });
app.get("/finance/aging", authMiddleware, async (c) => { ... });
```

- [ ] **Step 2: Add Spanish error mapping**

```js
if (err instanceof FinanceServiceError) {
  return c.json({ error: err.message }, err.status);
}
return c.json({ error: "No se pudo procesar la operacion financiera." }, 500);
```

- [ ] **Step 3: Run syntax check**

Run: `node --check apps/api/src/index.js`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/index.js
git commit -m "feat(api): expose finance AR/AP document routes"
```

### Task 6: Extend SDK finance domain

**Files:**
- Modify: `packages/sdk/src/index.js`
- Test: `node --check packages/sdk/src/index.js`

- [ ] **Step 1: Add document methods**

```js
listDocuments: (token, params = {}) => request(query ? `/finance/documents?${query}` : "/finance/documents", { headers: withAuthHeaders(token) }),
createDocument: (payload, token) => request("/finance/documents", { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(payload) }),
previewApplication: (id, payload, token) => request(`/finance/documents/${encodeURIComponent(id)}/apply-preview`, { method: "POST", headers: withAuthHeaders(token), body: JSON.stringify(payload) }),
```

- [ ] **Step 2: Add aging and journal-links methods**

```js
getAging: (token, params = {}) => request(path, { headers: withAuthHeaders(token) }),
getDocumentJournalLinks: (id, token) => request(`/finance/documents/${encodeURIComponent(id)}/journal-links`, { headers: withAuthHeaders(token) }),
```

- [ ] **Step 3: Verify syntax**

Run: `node --check packages/sdk/src/index.js`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add packages/sdk/src/index.js
git commit -m "feat(sdk): add finance document and aging client methods"
```

### Task 7: Add finance sidebar routes and manifests

**Files:**
- Modify: `packages/maps/src/feature-modules.js`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Test: `pnpm.cmd --filter ./apps/desktop build:web`

- [ ] **Step 1: Extend module navigation**

```js
{ label: "CxC", path: "/finance/ar", icon: "HandCoins", layout: "main" },
{ label: "CxP", path: "/finance/ap", icon: "Receipt", layout: "main" },
{ label: "Aging", path: "/finance/aging", icon: "CalendarDays", layout: "main" },
{ label: "Aplicaciones", path: "/finance/applications", icon: "ArrowRightLeft", layout: "main" },
```

- [ ] **Step 2: Map new routes in `ModuleOutlet`**

```js
"atlas.finance:/finance/ar": lazy(() => import("../modules/atlas.finance/screens/FinanceArScreen.jsx")),
"atlas.finance:/finance/ap": lazy(() => import("../modules/atlas.finance/screens/FinanceApScreen.jsx")),
```

- [ ] **Step 3: Build desktop**

Run: `pnpm.cmd --filter ./apps/desktop build:web`
Expected: build success.

- [ ] **Step 4: Commit**

```bash
git add packages/maps/src/feature-modules.js apps/desktop/src/app/ModuleOutlet.jsx
git commit -m "feat(desktop): add finance AR/AP sidebar routes"
```

### Task 8: Build AR/AP screens and shared document components

**Files:**
- Create: `apps/desktop/src/modules/atlas.finance/hooks/useFinanceDocuments.js`
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceDocumentsToolbar.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceDocumentFormSheet.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceApplySheet.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/components/FinanceJournalLinksPanel.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceArScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceApScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceAgingScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.finance/screens/FinanceApplicationsScreen.jsx`
- Test: `pnpm.cmd --filter ./apps/desktop build:web`

- [ ] **Step 1: Implement data hooks with query keys/mutations**

```js
useQuery({ queryKey: ["finance-documents", direction, filters], queryFn: ... })
useMutation({ mutationFn: (payload) => atlas.finance.createDocument(payload, token), onSuccess: () => queryClient.invalidateQueries(...) })
```

- [ ] **Step 2: Implement document form sheet with shared fields**

```jsx
<SelectField label="Tipo" ... />
<SelectField label="Moneda" ... />
<CurrencyField label="Monto total" ... />
<MarkdownField label="Observaciones" ... />
```

- [ ] **Step 3: Implement apply sheet with FIFO preview + editable lines**

```jsx
<Button onClick={onGeneratePreview}>Generar propuesta FIFO</Button>
<Input value={line.amount} onChange={...} />
<Button loading={applyMutation.isPending}>Confirmar aplicacion</Button>
```

- [ ] **Step 4: Implement AR/AP screens with action hierarchy**

```jsx
<Button>Nueva factura</Button>
<Button variant="outline">Registrar pago</Button>
<ActionMenu items={[{ label: "Aplicar" }, { label: "Ver polizas" }]} />
```

- [ ] **Step 5: Implement aging and applications history screens**

```jsx
<StatCard label="0-30" value={...} />
<StatCard label="31-60" value={...} />
```

- [ ] **Step 6: Build desktop**

Run: `pnpm.cmd --filter ./apps/desktop build:web`
Expected: build success.

- [ ] **Step 7: Commit**

```bash
git add apps/desktop/src/modules/atlas.finance
git commit -m "feat(finance-ui): add AR/AP, aging, and application workflows"
```

### Task 9: Integration verification and docs closure

**Files:**
- Modify: `docs/TASKS.md`
- Modify (if needed): `docs/09_next_steps.md`

- [ ] **Step 1: Run full verification commands**

Run:
- `pnpm.cmd db:generate`
- `node --test apps/api/src/services/__tests__/finance-application-engine.test.js`
- `node --check apps/api/src/services/finance-documents-service.js`
- `node --check apps/api/src/index.js`
- `node --check packages/sdk/src/index.js`
- `pnpm.cmd --filter ./apps/desktop build:web`

Expected: all pass.

- [ ] **Step 2: Manual smoke checklist**

1. Create AR invoice, register payment, apply FIFO edited line, verify `PARTIAL/PAID` transitions.
2. Create AP invoice, register supplier advance, apply against invoice.
3. Validate journal links from document detail.
4. Validate aging totals against open balances.

- [ ] **Step 3: Update roadmap evidence**

```md
## Phase 8.4-A - Finance Expansion (AR/AP Core)
- [x] Unified document subledger
- [x] FIFO editable applications
- [x] Automatic journal links
Verified: 2026-05-04 (commands...)
```

- [ ] **Step 4: Commit**

```bash
git add docs/TASKS.md docs/09_next_steps.md
git commit -m "docs(finance): close Phase 8.4-A checklist with verification evidence"
```

---

## Self-Review Checklist

1. **Spec coverage:**
   - Unified AR/AP subledger: Tasks 1, 4.
   - FIFO editable allocation: Tasks 3, 4, 8.
   - Automatic accounting links: Task 4.
   - API/SDK/UI routes: Tasks 5, 6, 7, 8.
   - Aging: Tasks 4, 8.
2. **Placeholder scan:**
   - No `TODO`, `TBD`, or deferred implementation markers inside executable tasks.
3. **Type consistency:**
   - Document enums (`direction`, `docType`, `status`) are aligned across schema, validators, API, SDK, and UI.

