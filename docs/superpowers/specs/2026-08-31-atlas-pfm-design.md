# atlas.pfm — Finanzas personales — Design Spec

- Status: Approved (brainstorm 2026-08-31)
- Author: Raul Belloso Medina (with Claude Code)
- Related: `docs/superpowers/specs/2026-08-30-atlas-ledger-current-state.md`, `docs/superpowers/specs/2026-08-30-atlas-calendar-current-state.md`
- Implementation plans: `docs/superpowers/plans/2026-08-31-atlas-pfm-phase1-plan-a-api.md` (+ b-ui), phase2..phase4

## 1. Purpose

A personal-finance module for tracking real spending against real "wallets" (cash,
debit, credit), with fast form-based entry, spending categories, recurring charges
surfaced on the calendar, receipt-photo capture parsed by a vision LLM, monthly
budgets, savings goals, and a credit-card statement cycle. It is a simpler,
consumer-grade view of money movement — distinct from `atlas.ledger` (a
spreadsheet-shaped bank register) and from `atlas.finance` (double-entry business
accounting).

The design was validated in a brainstorming session. Key decisions:

- **CORE module**, Prisma-schema style like `atlas.ledger` (NOT an AME3 custom
  module): heavy domain logic (recurrence expansion, receipt pipeline, spending
  rollups, credit-card cycle math) and a bespoke UI make the AME3 generic renderer
  and `$queryRaw`-only constraint a net negative here.
- **Own tables** (`Pfm*`), not shared with `atlas.ledger`.
- Recurrences: **hybrid per rule** (`FIXED` may auto-post; `VARIABLE` always
  produces a `PENDING` movement to confirm).
- Sharing: **shared from v1** via `PfmWalletMember` (VIEWER/EDITOR) on native
  wallets; ledger-mirror wallets delegate access to `atlas.ledger`.
- Ledger link: **read-only mirror**. A wallet may point at a `LedgerAccount`; its
  movements are read from `atlas.ledger` and only enriched (category, receipt,
  note) by pfm. pfm never writes `ledger_transaction`.
- Calendar: **one recurring `CalendarEvent` per rule** using the native
  `recurrenceRule` Json field, `sourceModule = "atlas.pfm"`.
- Receipt OCR: **Groq (Llama Vision)** default, behind a swappable adapter, API key
  and model from env. Processed by a **worker tick**, not inline in the HTTP
  request.

## 2. Module shape

CORE module: `core: true`, `uninstallable: false`, `kind: CORE`. Depends on
`atlas.core` + `atlas.identity`. Consumes `atlas.files` (receipts) and
`atlas.calendar` (best-effort, degrades if absent — mirror the
`projects-calendar-bridge.js` pattern).

```
prisma/schema.prisma                      + Pfm* models + 1 forward migration per phase
apps/api/src/manifests/official/core-modules.js   + atlasPfmManifest
apps/api/src/routes/pfm/
  index.js                                thin root router
  wallets-routes.js      / wallets-service.js
  movements-routes.js    / movements-service.js
  categories-routes.js   / categories-service.js
  recurring-routes.js    / recurring-service.js
  receipts-routes.js     / receipts-service.js
  budgets-routes.js      / budgets-service.js
  goals-routes.js        / goals-service.js
  summary-service.js                      dashboard rollups
  pfm-calendar-bridge.js                  seeds CalendarEvent rows
  ledger-link-service.js                  reads atlas.ledger movements (read-only)
  service-helpers.js                      requireAnyPermission, access predicates
  validators.js
apps/api/src/services/vision-service.js   vision adapter (GroqVisionAdapter) — first AI service in repo
apps/worker/src/index.js                  + runPfmRecurringTick(), runPfmReceiptTick()
apps/desktop/src/modules/atlas.pfm/       React screens (@atlas/ui)
packages/sdk/                             + client.pfm group
packages/validators/                      + pfm.* Zod schemas
prisma/seed.js                            + atlas.pfm module row + system PfmCategory seed
apps/api/src/permission-catalog.js        + pfm.* permission keys
```

No source file exceeds 1000 lines; services are split by domain from the start.
Route files stay thin (delegate to services).

## 3. Data model

All ids UUID v7 (`@default(uuid(7)) @db.Uuid`). Every table has `companyId`
(`@db.Uuid`), `ownerId` (`@db.Uuid`), `createdAt`, `updatedAt`, and soft-delete
`enabled Boolean @default(true)` unless noted. Money is `Decimal @db.Decimal(15,2)`,
always stored positive; direction is a separate enum.

### 3.1 PfmWallet
| field | type | notes |
|---|---|---|
| name | String | |
| kind | String | `CASH` \| `DEBIT` \| `CREDIT` |
| currency | String | default `MXN` |
| openingBalance | Decimal(15,2) | default 0 |
| color | String? | hex |
| icon | String? | lucide name |
| ledgerAccountId | String? @db.Uuid | when set → read-only mirror of that `LedgerAccount` |
| creditLimit | Decimal(15,2)? | phase 4, `kind = CREDIT` |
| statementDay | Int? | 1–31, phase 4 |
| paymentDueDay | Int? | 1–31, phase 4 |
| enabled | Boolean | |

Index: `(companyId, ownerId, enabled)`, `(ledgerAccountId)`.

### 3.2 PfmWalletMember
`walletId @db.Uuid`, `userId @db.Uuid`, `role String` (`VIEWER` \| `EDITOR`),
`createdAt`. Unique `(walletId, userId)`. The wallet `ownerId` always has full
control and is never stored as a member row. Not used for ledger-mirror wallets.

### 3.3 PfmCategory
| field | type | notes |
|---|---|---|
| name | String | |
| kind | String | `EXPENSE` \| `INCOME` |
| color | String? | |
| icon | String? | |
| parentId | String? @db.Uuid | subcategory |
| ownerId | String? @db.Uuid | `NULL` = system category (seeded); non-null = personal |
| enabled | Boolean | |

Index: `(companyId, kind, enabled)`, `(ownerId)`. System categories are seeded in
`prisma/seed.js` (e.g. Comida, Transporte, Servicios, Renta, Salud, Ocio,
Educación, Ropa, Suscripciones, Ahorro, Sueldo, Otros ingresos).

### 3.4 PfmMovement
| field | type | notes |
|---|---|---|
| walletId | String @db.Uuid | native wallet only |
| categoryId | String? @db.Uuid | |
| direction | String | `EXPENSE` \| `INCOME` |
| amount | Decimal(15,2) | positive |
| occurredOn | Date | |
| note | String? | |
| merchant | String? | |
| status | String | `PENDING` \| `POSTED` \| `SKIPPED` |
| recurringRuleId | String? @db.Uuid | set when materialized from a rule |
| receiptId | String? @db.Uuid | |
| enabled | Boolean | |

**Balance counts `POSTED` rows only.** `PENDING` = forecast/awaiting confirm.
`SKIPPED` = "did not happen this cycle".

Index: `(walletId, status, occurredOn)`, `(walletId, occurredOn)`.
Partial unique: `(recurringRuleId, occurredOn) WHERE recurringRuleId IS NOT NULL`
— keeps the worker idempotent.

### 3.5 PfmLedgerEnrichment
For movements that live in `atlas.ledger` (mirror wallets): does NOT copy the
movement, only decorates it.
`ledgerTransactionId String @db.Uuid @unique`, `walletId @db.Uuid`,
`categoryId String? @db.Uuid`, `receiptId String? @db.Uuid`, `note String?`,
`ownerId`, `companyId`, timestamps. No `enabled` (row exists only when enriched;
delete to clear). Index `(ledgerTransactionId)`, `(walletId)`.

### 3.6 PfmRecurringRule
| field | type | notes |
|---|---|---|
| walletId | String @db.Uuid | |
| label | String | |
| categoryId | String? @db.Uuid | |
| direction | String | `EXPENSE` \| `INCOME` |
| amountMode | String | `FIXED` \| `VARIABLE` |
| amount | Decimal(15,2)? | required when `FIXED` |
| rrule | Json | `{ freq: 'MONTHLY'|'WEEKLY'|'YEARLY'|'DAILY', interval: 1, byMonthDay?: 15, byWeekday?: 'MO', ... }` |
| autoPost | Boolean | default false; only allowed when `amountMode = FIXED` |
| nextRunAt | DateTime | next occurrence to materialize |
| endOn | Date? | rule deactivates after this |
| calendarEventId | String? @db.Uuid | linked `CalendarEvent` |
| enabled | Boolean | |

Index: `(nextRunAt, enabled)`, `(walletId, enabled)`.

### 3.7 PfmReceipt
| field | type | notes |
|---|---|---|
| fileId | String @db.Uuid | atlas.files asset (private bucket) |
| status | String | `PROCESSING` \| `PARSED` \| `FAILED` \| `CONFIRMED` |
| provider | String | `groq` |
| model | String? | resolved model id |
| rawResponse | Json? | full provider payload |
| parsed | Json? | `{ merchant, total, currency, date, taxAmount, lines:[{description, amount}], confidence }` |
| movementId | String? @db.Uuid | set on confirm |
| errorReason | String? | |
| attempts | Int | default 0 |
| enabled | Boolean | |

Index: `(status, enabled)`, `(ownerId, createdAt)`.

### 3.8 PfmBudget (phase 4)
`categoryId @db.Uuid`, `walletId String? @db.Uuid` (null = all wallets),
`period String` (`MONTHLY`), `amount Decimal(15,2)`, `alertThreshold Decimal` (0–1,
default 0.8), `enabled`. Unique `(ownerId, categoryId, walletId, period)`.
**Always private to `ownerId`** — never visible to wallet members.

### 3.9 PfmGoal (phase 4)
`name String`, `targetAmount Decimal(15,2)`, `targetDate Date?`,
`walletId String? @db.Uuid`, `currentAmount Decimal(15,2)` default 0,
`color String?`, `enabled`. Private to `ownerId`.

## 4. Ledger integration — `ledger-link-service.js` (read-only)

Single public method:

```
getLinkedMovements({ walletId, ledgerAccountId, actorId, range, cursor })
```

- Verifies access by calling `canReadAccount({ companyId, accountId, actorId })`
  from a `createLedgerService({ prisma })` instance
  (`apps/api/src/routes/ledger/ledger-service.js`, same backend, direct import).
  Throws 403 otherwise.
- Reads `ledger_transaction` via `$queryRaw`, `LEFT JOIN pfm_ledger_enrichment`.
- Returns normalized rows:
  `{ source: 'ledger', id, occurredOn, direction (deposito→INCOME / retiro→EXPENSE),
     amount, merchant: nombre, note, categoryId (from enrichment),
     receiptId (from enrichment), editableInPfm: false }`.
- Setting a category/receipt/note on a ledger movement → `upsert` into
  `PfmLedgerEnrichment` keyed by `ledgerTransactionId`. Never touches
  `ledger_transaction`.
- Mirror-wallet balance = value returned by `atlas.ledger`'s existing
  `summary-service.js` (called, not reimplemented).
- Removing the link (`ledgerAccountId = null`) deletes the wallet's
  `PfmLedgerEnrichment` rows; movements vanish from pfm, untouched in ledger.

Recurrences, budgets, and the dashboard consume a **unified normalized movement
list** — native `PfmMovement` (`POSTED`) plus ledger-normalized rows — so
aggregation code is source-agnostic.

## 5. Recurrence engine + calendar bridge

### 5.1 Worker tick `runPfmRecurringTick()` (~1 h, pattern of `projects-recurring-service.js`)

1. `SELECT * FROM pfm_recurring_rule WHERE enabled AND next_run_at <= now()`.
2. For each due rule, while `next_run_at <= horizon` (today + 45 days), materialize:
   - `FIXED` + `autoPost` → `PfmMovement { status: POSTED, amount: rule.amount, recurringRuleId, occurredOn: next_run_at }`.
   - otherwise → `PfmMovement { status: PENDING, amount: rule.amount ?? 0, recurringRuleId, occurredOn: next_run_at }`.
   - advance `next_run_at` via `computeRruleNextAt(rule.rrule)` (reuse helper from
     `apps/api/src/routes/projects/tasks-service.js`; extend it if it lacks a
     needed `freq`).
   - if `next_run_at > endOn` → set `enabled = false`.
3. Idempotency: the partial unique on `(recurringRuleId, occurredOn)` makes a
   re-tick a no-op (`ON CONFLICT DO NOTHING`).

### 5.2 Confirm flow

`PATCH /pfm/movements/:id/confirm` — optional body `{ amount }` for the variable
case (electricity, water). Flips `PENDING → POSTED`, recomputes balance.
`PATCH /pfm/movements/:id/skip` → `SKIPPED`.

### 5.3 `pfm-calendar-bridge.js` (best-effort)

- Guard `isCalendarAvailable()` (`typeof prisma.calendarCalendar?.create === 'function'`).
  Never blocks a pfm operation; wrap in try/catch and return null on failure.
- On the user's first rule → provision a dedicated calendar "Finanzas personales"
  (`prisma.calendarCalendar.create`, pattern of `syncProjectCalendar`), store id
  in `InstanceConfig` key `pfm.calendarId.<userId>`.
- Per rule → **one** `CalendarEvent`: `recurrenceRule` = the rule's RRULE Json,
  `allDay: true`, `title` = `label` + amount (or "monto variable"),
  `sourceModule: "atlas.pfm"`, `sourceEntityId: rule.id`, `color` = category color.
  Store `rule.calendarEventId`.
- Edit rule → `update` that event. Disable/delete rule → `delete` the event.
- Phase 4: credit-card payment-due date seeds its own monthly recurring event with
  a reminder 3 days before.

## 6. Receipt pipeline — `vision-service.js` (first AI in the repo)

```
createVisionService({ env }) -> { extractReceipt({ imageBuffer, mimeType }) }
```

- `GroqVisionAdapter`: POST to Groq's OpenAI-compatible endpoint
  (`${GROQ_BASE_URL}/openai/v1/chat/completions`), model from `PFM_VISION_MODEL`,
  image as a base64 `data:` URI in an `image_url` content part, `response_format`
  a strict JSON schema:
  `{ merchant: string|null, total: number|null, currency: string|null,
     date: string|null (ISO), taxAmount: number|null,
     lines: [{ description: string, amount: number }], confidence: number }`.
- Prompt: Spanish, default currency MXN, "if a field is not legible, return null".
- Retry once on 429/5xx with backoff. Terminal failure → throw a typed error.
- Env config (all read via `env`, documented in `.env.example`, `CLAUDE.md` setup
  block, and `docs/superpowers/specs/2026-08-30-dependencies-secrets-shared-infra-audit.md`
  key list):
  - `PFM_VISION_PROVIDER` (default `groq`)
  - `GROQ_API_KEY` (no default; absent → module still boots, receipt upload
    returns 503 "OCR no configurado", UI falls back to manual entry)
  - `GROQ_BASE_URL` (default `https://api.groq.com`)
  - `PFM_VISION_MODEL` (default a current Llama vision model id)
  - `PFM_VISION_TIMEOUT_MS` (default 20000)

### 6.1 Flow

1. `POST /pfm/receipts` (multipart) → upload image to `atlas.files` (private
   bucket), create `PfmReceipt { status: PROCESSING, attempts: 0 }`, respond
   `{ receiptId }`. No Groq call here.
2. **Worker tick `runPfmReceiptTick()`** (~30 s):
   `SELECT ... WHERE status = 'PROCESSING' AND attempts < 3`, download image from
   Storage, call `extractReceipt`, store `rawResponse` + `parsed`,
   `status → PARSED`; on terminal failure `status → FAILED, errorReason`.
   `attempts++` every attempt.
3. UI: after upload, a "Procesando ticket…" state polls `GET /pfm/receipts/:id`
   every 3 s (switch to realtime later if the shell exposes it).
4. `PARSED` → movement form **prefilled**: amount = `total`, date = `date`,
   merchant = `merchant`, suggested category via simple keyword rules over
   `merchant`, wallet = last used.
5. `POST /pfm/receipts/:id/confirm` with the movement body → create
   `PfmMovement { status: POSTED, receiptId }`, set
   `receipt.status → CONFIRMED, movementId`. If attached to a ledger movement →
   write `PfmLedgerEnrichment.receiptId` instead.
6. `FAILED` → UI offers "Reintentar" (reset to `PROCESSING`, attempts 0) or
   "Capturar a mano" (empty form with the image attached).

The receipt image is always attached to the movement via `atlas.files`, visible
in its detail view.

## 7. Sharing model (from v1)

- **Native wallets**: `PfmWalletMember` role `VIEWER` (sees movements + balance) or
  `EDITOR` (also creates/edits/confirms movements, attaches receipts). Only the
  `ownerId` manages members, edits wallet settings, creates recurring rules,
  deletes the wallet.
- **Ledger-mirror wallets**: access is governed by `atlas.ledger` (its
  groups/collaborators). `PfmWalletMember` does not apply; delegate to
  `canReadAccount` / `canWriteAccount`. Sharing a mirror wallet is done in ledger.
- **Category privacy**: on a shared wallet, a `PfmCategory` with another user's
  `ownerId` is returned as `{ name: "Personal", color: neutral }`.
- **Budgets and goals are always private to `ownerId`**, never visible to members.
- **Strict per-profile isolation** in every query: filter by `companyId` +
  (`ownerId` = actor OR row in `PfmWalletMember` OR ledger access). Copy the
  hardened `atlas.ledger` pattern (NO `owner_id IS NULL` fallback anywhere). If
  pfm later enters the offline sync cache, use the `atlas.calendar` sync-service
  pattern, never the generic company-wide `makeHandler()`.
- Tests assert user B cannot see user A's wallets / movements / receipts /
  budgets / goals via any endpoint.

## 8. Permissions

`permission-catalog.js` + manifest `permissions`/`acl` + `prisma/seed.js`:

`pfm.wallets.read` / `.create` / `.update` / `.delete`,
`pfm.movements.read` / `.create` / `.update` / `.delete`,
`pfm.recurring.read` / `.manage`,
`pfm.receipts.read` / `.manage`,
`pfm.categories.read` / `.manage`,
`pfm.budgets.manage`, `pfm.goals.manage`,
`pfm.members.manage`.

GET routes accept read OR manage via `requireAnyPermission` (pattern from the
recent ledger fix). RBAC permission = "may use the module"; `PfmWalletMember` /
ledger access = "may see THIS wallet" — the two are independent gates.

## 9. UI / screens

`apps/desktop/src/modules/atlas.pfm/`, mobile-first, `@atlas/ui` only (no native
form elements or browser dialogs; `ConfirmDialog` for destructive actions).
Every screen starts with `PageHeader`; `EmptyState` / `ErrorState` for those
states. QA at 390px and 1440px with the 14-aspect checklist before closing a
phase.

Manifest navigation (4 items):

- **Resumen** `/app/m/atlas.pfm/overview` — the "see my spending easily" screen:
  month selector; stat cards (total balance, month income, month expense, vs
  previous month ▲/▼ %); expense-by-category donut (Recharts, `hsl(var(--*))`
  tokens for dark mode) with an amount legend; 6-month spend trend bar; "Próximos
  cargos" (next 7–14 days: `PENDING` movements + rules, each with a **Confirmar**
  button). Phase 4 adds budget bars and goal rings.
- **Carteras** `/app/m/atlas.pfm/wallets` — card grid per wallet (icon, color,
  balance, kind). Detail `/wallets/:id`: balance, filters (month, category, text),
  movement list (native = editable; ledger-mirror = "Libro de cuentas" badge, only
  category/receipt editable), FAB **+ Movimiento**. Under `sm` the list is cards
  and editing is a bottom sheet.
- **Recurrencias** `/app/m/atlas.pfm/recurring` — rule list with next charge,
  amount (or "variable"), wallet, "Auto" / "Requiere confirmar" badge.
  Create/edit form: `CreatableComboboxField` category, `SelectField` frequency,
  `DateField` start/end, "Registrar automático" toggle (disabled when amount is
  variable).
- **Tickets** `/app/m/atlas.pfm/receipts` — **Subir ticket** button (camera on
  mobile), thumbnail grid with status (Procesando / Listo para revisar / Error /
  Registrado). Tapping a "Listo" opens the prefilled form.

**Quick-add movement** — a global sheet reachable from the FAB on any screen:
large amount field at top (numeric keypad on mobile), Gasto/Ingreso toggle,
`CreatableComboboxField` category, wallet, date (today by default), note,
"Adjuntar ticket" button. Single scroll, no tabs.

New generic components (e.g. `StatCard`, `CategoryDonut`) go to `@atlas/ui` and
`docs/ai-context/ame3-runtime-capabilities.md`, not hardcoded in the module.

SDK: `packages/sdk` gains a `pfm` group (`wallets`, `movements`, `categories`,
`recurring`, `receipts`, `budgets`, `goals`, `summary`).

## 10. Implementation phases

Each phase is its own plan; API-heavy phases split into Plan A (API) + Plan B (UI)
per the project's "split large plans" rule.

### Phase 1 — Núcleo (Plan A + Plan B)
Models `PfmWallet`, `PfmWalletMember`, `PfmCategory`, `PfmMovement`,
`PfmLedgerEnrichment` + forward migration + system-category seed + module row +
`pfm.*` permission keys. Routes: wallets, movements, categories.
`ledger-link-service` (read-only mirror). Native-wallet sharing. SDK `pfm`.
Screens: Carteras + detail + quick-add + basic Resumen (balances, donut, trend).
Per-profile isolation + A/B leak tests. Manifest registered, nav wired.

### Phase 2 — Recurrencias + calendario (Plan A + Plan B)
`PfmRecurringRule` + migration. `recurring-service` + worker tick +
`computeRruleNextAt` (extend if needed). `PENDING`/`POSTED`/confirm/skip flow.
`pfm-calendar-bridge` (dedicated calendar + one recurring event per rule).
Screens: Recurrencias + "Próximos cargos" block in Resumen.

### Phase 3 — Tickets con IA (Plan A + Plan B)
`vision-service` + `GroqVisionAdapter`. `PfmReceipt` + migration.
`receipts-routes` + `runPfmReceiptTick` worker tick.
`.env` / `.env.example` / `CLAUDE.md` / secrets-audit doc updated with
`GROQ_API_KEY` + `PFM_VISION_*`. Screens: Tickets + upload + poll + prefilled form
+ attach to movement (native and mirror).

### Phase 4 — Presupuestos, metas, ciclo de tarjetas (Plan A + Plan B)
`PfmBudget`, `PfmGoal` + credit fields on `PfmWallet` + migration.
Budget alerts via the existing notification service. Statement/payment cycle +
reminder event. Expanded Resumen (budget bars, goal rings, credit-card panel).

## 11. Testing

`node --test` (native runner). Per service:

- `wallets-service` — balance = POSTED only; mirror normalization.
- `movements-service` — create/edit/soft-delete; confirm/skip transitions.
- `ledger-link-service` — respects `canReadAccount`; never writes
  `ledger_transaction`; enrichment upsert keyed by `ledgerTransactionId`.
- `recurring-service` — idempotent materialization, FIXED/VARIABLE hybrid, RRULE
  advance, cutoff at `endOn`.
- `pfm-calendar-bridge` — degrades with no calendar; one event per rule;
  update/delete propagation.
- `vision-service` — adapter with a mocked response; timeout; 429 → retry;
  no API key → 503.
- `receipts-service` — state machine PROCESSING→PARSED→CONFIRMED / →FAILED→retry.
- `summary-service` — rollups, previous-month comparison.
- `budgets-service` — threshold and overage (phase 4).

Plus A/B per-profile isolation tests on every list endpoint (wallets, movements,
receipts, budgets, goals). `pnpm build` and `pnpm lint` clean. Browser QA at
390px and 1440px with the 14-aspect checklist per phase.

## 12. Out of scope (v1)

- Writing back to `atlas.ledger` from pfm.
- Multi-currency conversion / FX (each wallet is single-currency; totals are
  per-currency).
- Bank/CSV import into pfm (use `atlas.ledger` + a mirror wallet).
- Offline SQLite cache for pfm (can be added later using the `atlas.calendar`
  sync pattern).
- Investment / net-worth tracking.
