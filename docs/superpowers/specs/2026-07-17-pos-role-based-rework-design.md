# POS Role-Based Rework — Mostrador, Comandero, Cocina y Caja

## 1. Feature title

atlas.pos Role-Based Rework: restructure the POS module around work posts (Caja, Comandero, Cocina, Administración), decouple orders from cash sessions, and complete the restaurant command flow (seats, modifiers, notes, kitchen routing).

## 2. Status

Complete (F1–F4 shipped 2026-07-18; kitchen printing deferred to future by F4 spec `2026-07-18-pos-rework-f4-cocina-design.md` §6)

## 3. Context

atlas.pos was built in June 2026 (specs `2026-06-21-atlas-pos-core-design.md`, `2026-06-29-pos-waiter-split-bill.md`) around a single "terminal" experience: one device, one configuration wizard, one cash session, one screen for everything. The 2026-07-17 stabilization QA confirmed the backend works (31/31 tests; waiter auto-claim, split bill, payments, table lifecycle verified in browser), but the product owner's verdict is that the module "no ha terminado de funcionar" for either of its two real-world uses:

1. **Mostrador** (quick counter sale — taquería/cafetería): too many steps before selling.
2. **Restaurante** (comandas): waiters cannot operate — everything requires a terminal with an open cash session, there is no UI for guests/seats or product modifiers, and the kitchen flow is unusable.

A "two modules vs one" decision was evaluated during brainstorming (2026-07-17): mostrador and restaurante share ~80% of their machinery (products, orders, payments, cash sessions, cuts), so the decision is **one module** with role-based experiences. Approach approved: rework by roles, reusing the existing backend.

## 4. Problem

The module is terminal-centric, but a restaurant is people-centric. Concretely:

1. Every user hitting the module must "configure a terminal" and depends on an open cash session — meaningless for a waiter on their phone or a cook in the kitchen.
2. `PosOrder` requires a `PosSession` (cash session), coupling order-taking to cash handling.
3. There is no UI to set guests per order or assign lines to seats, making per-seat split billing (already working in backend) unreachable.
4. There are no product modifiers (sin cebolla, término, extras) nor per-line notes — a comanda cannot express what the kitchen needs.
5. Kitchen routing fails when products lack a station (400 on send-to-kitchen) and there is no print path; the KDS is not operational for real use.
6. The RESTAURANT/RETAIL mode is a single global setting, not per outlet.

## 5. Goals

1. Four role-based entry points — **Caja**, **Comandero**, **Cocina**, **Administración** — each usable immediately by the right person with the right permission, with no shared "terminal gate".
2. A waiter can take a complete comanda from their own phone (guests/seats, modifiers, per-line notes), send it to kitchen, request the bill, and — if the outlet allows it — charge at the table.
3. A counter employee (mostrador mode) can sell in one flow: tap products → charge → next customer.
4. Money is always reconciled: every payment lands either in a terminal cash session (`PosSession`) or a waiter shift (`PosWaiterShift`) which is later delivered to a cash session.
5. Kitchen receives every sent line, routed by station, via KDS and/or printed ticket, with a default station fallback (no more 400s).
6. Mode (MOSTRADOR / RESTAURANTE) and behavior flags are configured **per outlet**.

## 6. Non-goals

1. Customer self-service kiosk (autoservicio) — future module/experience.
2. Courses/"tiempos" (entrada / plato fuerte sequencing) — deferred, schema must not block it.
3. Advanced tip management (pooling, distribution) — tips remain the simple flag that exists today.
4. Inventory depletion integration with atlas.catalog/atlas.inventory — future.
5. Fiscal invoicing (CFDI) — future.
6. Offline POS operation — POS remains online-only in this version.
7. Deleting or rebuilding the existing backend: current services, tables, and tests are evolved, not replaced.

## 7. User stories

1. As a **mesero**, I open Atlas on my phone, tap Comandero, see my floor, open Mesa 4, register 3 guests, capture each person's items with modifiers and notes, and send to kitchen — without touching any terminal or cash session.
2. As a **mesero** in an outlet with cobro en mesa, I charge the table from my phone; at end of shift I hand my cash to the caja and my shift closes reconciled.
3. As a **cajero**, I open my cash session on the counter terminal, charge orders brought by waiters (full table or split by seat), and close with a cut that includes waiter deliveries.
4. As a **cajero de mostrador** (MOSTRADOR outlet), I tap products and charge in a single flow with no tables involved.
5. As a **cocinero**, I see incoming comandas on the kitchen screen for my station and mark them ready; the expo/mesero is notified.
6. As an **administrador**, I configure per outlet: mode, payment methods, stations (with default), modifier groups per product, and whether waiters may charge at the table.

## 8. UX requirements

- All UI in Spanish. Role entry points named: "Caja", "Comandero", "Cocina", "Administración".
- Comandero is **mobile-first** (waiter phones); Caja and Cocina are landscape tablet/desktop; Administración is desktop.
- Opening the module lands the user on the first post their permissions allow (priority: Caja → Comandero → Cocina → Administración); users with several see a post switcher in the module sidebar.
- Modifier selection opens as a bottom sheet (`Sheet`) on product tap when the product has modifier groups; respects `min/max` selection rules before allowing "Agregar".
- Seat management in the comanda: chips "Persona 1..N" + "Compartido"; every line belongs to one chip; adding a person is one tap.
- No native dialogs; `ConfirmDialog` for destructive actions (cancel order, close shift). All components from `@atlas/ui`.
- The current "Configurar terminal" wizard appears only inside Caja.

## 9. Routes/screens

Module `atlas.pos`, base `/app/m/atlas.pos`:

| Route | Screen | Replaces |
|---|---|---|
| `/pos/caja` | `CajaScreen` (session open/close, charge queue, mostrador quick-sale when outlet mode is MOSTRADOR) | `PosTerminalScreen` (cash side), `PosSessionsScreen` (operational part) |
| `/pos/comandero` | `ComanderoScreen` (floor → table → comanda editor) | `PosTablesScreen` + `PosTerminalScreen` (order side) |
| `/pos/cocina` | `CocinaScreen` (KDS per station) | `PosStationsScreen` board |
| `/pos/admin` | `PosAdminScreen` (tabs: general, sucursales/terminales, estaciones, métodos de pago, modificadores, planos) | `PosSettingsScreen`, `PosFloorPlannerScreen` (linked) |
| `/pos/orders` | `PosOrdersScreen` (history — existing route kept as is) | — |

`FloorOperationalCanvas`, `PaymentDialog`, `SplitBillDialog`, `SessionOpenDialog/CloseDialog`, `CashMovementDialog` are reused inside the new screens.

## 10. Data model

New entities:

- **PosWaiterShift** — waiter money shift: `id`, `companyId`, `outletId`, `waiterId` (UserProfile), `status` (OPEN/CLOSED), `openedAt`, `closedAt`, `expectedCashAmount` (accumulated from cash payments), `deliveredAmount`, `deliveredToSessionId` (PosSession, nullable until closed), `notes`. Opens implicitly on the waiter's first table charge of the day; closes by delivering to a caja.
- **PosModifierGroup** — `id`, `companyId`, `productId` (PosProduct), `name`, `minSelect` (default 0), `maxSelect` (default 1), `required` (bool), `position`, `enabled`.
- **PosModifierOption** — `id`, `groupId`, `name`, `priceDelta` (Decimal, default 0), `position`, `enabled`.
- **PosOrderLineModifier** — `id`, `lineId` (PosOrderLine), `optionId` (nullable FK for traceability), snapshot fields `name`, `priceDelta` (immutable copy at capture time).

Modified entities:

- **PosOrder**: `sessionId` is already nullable in the schema (verified 2026-07-17); the service layer already creates orders without a session. F1 documents this as the contract: order creation never requires a session.
- **PosPayment**: gains `sessionId` (nullable) and `waiterShiftId` (nullable) with a CHECK constraint (`NOT VALID`, so legacy session-less rows survive) that new rows set exactly one; line total computation includes modifier `priceDelta` sums.
- **PosOrderLine**: gains `notes` (text, nullable) if not present.
- **PosOutlet**: already has per-outlet `mode` using the existing `PosMode` enum (`RESTAURANT` | `RETAIL` | `HYBRID`); this spec maps UI labels "Restaurante" → RESTAURANT and "Mostrador" → RETAIL, and deprecates HYBRID and the global mode in PosSettings. Gains `allowTableCharge` (bool, default false), `defaultStationId` (nullable FK PosKitchenStation), `kitchenKdsEnabled` (bool, default true), `kitchenPrintEnabled` (bool, default false).

## 11. Prisma impact

New models: `PosWaiterShift`, `PosModifierGroup`, `PosModifierOption`, `PosOrderLineModifier`. Modified: `PosOrder`, `PosPayment`, `PosOrderLine`, `PosOutlet`. One forward migration per phase (F1: shift + decoupling + outlet flags; F2: modifiers + notes). Existing rows: orders keep their `sessionId`; new payment columns backfill from the order's session. Applied migrations are never edited.

## 12. API contract

All endpoints company-scoped, JWT auth, guarded by granular permissions (section 18). High-level (exact shapes defined per-phase in plans):

Phase F1 (foundation):
- `POST /pos/waiter-shifts/open` · `GET /pos/waiter-shifts/current` · `POST /pos/waiter-shifts/:id/close` (body: `deliveredAmount`, `sessionId`) · `GET /pos/waiter-shifts?status=`
- `PATCH /pos/outlets/:id/settings` (mode + flags)
- Order creation no longer validates an open session; payment creation requires `sessionId` XOR `waiterShiftId` and validates `allowTableCharge` for shifts.

Phase F2 (comandero):
- `GET|POST /pos/products/:id/modifier-groups`, `PATCH /pos/modifier-groups/:id`, `POST /pos/modifier-groups/:id/options`, `PATCH /pos/modifier-options/:id`
- `POST /pos/orders/:id/lines` accepts `modifiers: [{optionId}]` and `notes`; line price = base + sum(priceDelta).
- Existing guest-seat endpoints (`POST /pos/orders/:id/guests`, seat assignment on lines) get UI consumers.

Phase F4 (cocina):
- `GET /pos/kitchen/board?stationId=` (exists, hardened), `POST /pos/kitchen/lines/:id/ready`
- `POST /pos/kitchen/print-jobs` + `GET /pos/kitchen/print-jobs?status=PENDING` (pull model for the printing agent; detailed in F4 plan).

Errors follow current `PosServiceError` pattern (message + HTTP status, Spanish messages).

## 13. SDK contract

`atlas.pos.*` gains: `waiterShifts.{open,current,close,list}`, `outlets.updateSettings`, `modifierGroups.{list,create,update}`, `modifierOptions.{create,update}`, `kitchen.{board,markReady,printJobs}`. Existing methods (orders, payments, floors, tables, seatTotals) unchanged.

## 14. Validator contract

Module-local `apps/api/src/routes/pos/validators.js` gains: `waiterShiftOpenSchema`, `waiterShiftCloseSchema`, `outletSettingsSchema` (mode enum MOSTRADOR|RESTAURANTE + flags), `modifierGroupSchema` (minSelect ≤ maxSelect refinement), `modifierOptionSchema`, extended `orderLineSchema` (modifiers array + notes ≤ 500 chars). `posModeSchema` global enum is deprecated.

## 15. Module manifest impact

`atlas.pos` manifest (official, `apps/api/src/manifests/official/core-modules.js`): navigation replaced by the 5 routes in section 9; permissions array extended (section 18); no new dependencies; version bump.

## 16. Navigation impact

| Label | Path | Icon | permissionKey |
|---|---|---|---|
| Caja | `/pos/caja` | CreditCard | `pos.caja.read` |
| Comandero | `/pos/comandero` | NotebookPen | `pos.comandas.read` |
| Cocina | `/pos/cocina` | ChefHat | `pos.cocina.read` |
| Órdenes | `/pos/orders` | ReceiptText | `pos.orders.read` (existing) |
| Administración | `/pos/admin` | Settings | `pos.admin.read` |

## 17. Blueprint impact

N/A — atlas.pos uses dedicated screens, not blueprint-driven CRUD.

## 18. RBAC/permissions

New granular keys (existing `pos.*` keys are kept; overlapping ones map in the plan):

```
pos.caja.read            — see Caja post; open/view session state
pos.caja.operate         — charge orders, register cash movements
pos.caja.close           — close session / cut
pos.comandas.read        — see Comandero post and own floor
pos.comandas.create      — create/edit comandas, send to kitchen
pos.comandas.charge      — charge at table (only effective if outlet allowTableCharge)
pos.cocina.read          — see kitchen board
pos.cocina.operate       — mark lines ready
pos.admin.read           — see Administración
pos.admin.update         — edit outlets, stations, methods, modifiers, floors
```

Each API endpoint guards with the matching key; navigation gates per section 16. Seeded in Spanish in the permission catalog.

## 19. Multi-company behavior

Unchanged from current POS: every table/query is `companyId`-scoped via `requireCompanyId`. `PosWaiterShift` and modifier tables carry `companyId`. Waiter shifts are additionally scoped by `outletId`.

## 20. Files/storage impact

None new. Product images continue via existing `FileAsset` flow.

## 21. Export/import requirements

Session cut (corte) remains on-screen; CSV export of session/shift summaries is deferred (Future enhancements).

## 22. Audit log requirements

Existing `writeAudit` pattern extends to: `pos.waiterShift.open/close` (before/after amounts), `pos.outlet.settings.update`, `pos.modifierGroup.create/update`, `pos.modifierOption.create/update`, `pos.kitchen.line.ready`. Actor = authenticated user.

## 23. Edge cases

1. Waiter with an OPEN shift logs out / shift left open overnight: shifts stay open until closed against a session; Caja UI lists orphan open shifts and can force-close them (`pos.caja.close`), recording difference.
2. Outlet switches RESTAURANTE → MOSTRADOR with open table orders: block the switch while open dine-in orders exist (validation error listing them).
3. `allowTableCharge` disabled while a waiter has an open shift: existing shift can still be delivered/closed; new charges blocked.
4. Payment on an order whose lines change afterward: current rule kept — paid orders lock lines; partial payments allow adding lines but `remaining` recomputes (already backend behavior, now including modifier deltas).
5. Product with required modifier group (`required: true`, `minSelect ≥ 1`): line cannot be added without satisfying selection; enforced in API, not only UI.
6. Modifier option disabled after being used: historical lines unaffected (snapshot); new selections exclude it.
7. Send-to-kitchen with no stations at all: falls back to `defaultStationId`; if null, comanda is accepted and marked "sin estación" visible in KDS "General" lane — never a 400.
8. Legacy orders with `sessionId` set: remain valid; reports must treat both payment paths (session-attached legacy vs payment-attached new).
9. Two devices editing the same order (waiter phone + caja): optimistic — last write wins per line operation; line-level operations are independent inserts/updates so collisions are rare; revisit if QA shows conflicts.
10. Mostrador outlet: orders are created with `fulfillmentType` TAKEAWAY/COUNTER and no table; comandero post hidden entirely.

## 24. Risks

1. **Money-model migration** (order↔session decoupling) touches the most sensitive invariant. Mitigation: F1 is a small, heavily tested phase; CHECK constraint guarantees every payment has exactly one money container; existing tests extended before UI changes.
2. **Scope creep** — four experiences is a lot. Mitigation: phases F1–F4 each ship independently usable value; tiempos/kiosko explicitly out.
3. **Printing** depends on local hardware. Mitigation: pull-based print-jobs API keeps the server hardware-agnostic; the printing agent (Tauri-side or small local service) is isolated in F4 and can slip without blocking F1–F3.
4. **Realtime load** on KDS/comandero sync. Mitigation: reuse the unified realtime layer (2026-06-28) channels; polling fallback as today.
5. **Migration of habits** — existing client(s) use the current terminal flow. Mitigation: `/pos/terminal` route redirects to Caja; data is untouched.

## 25. Acceptance criteria

1. Given a user with only `pos.comandas.*`, when they open atlas.pos on a phone, then they land on Comandero with no terminal wizard and can create, send, and (if outlet allows) charge a comanda.
2. Given an order created by a waiter with no cash session open anywhere, when it is charged at a caja, then the payment records that caja's `sessionId` and the order closes normally.
3. Given `allowTableCharge = true`, when a waiter charges a table in cash, then a `PosWaiterShift` exists/opens for them and `expectedCashAmount` increases by the cash amount; and when the shift is closed against a session, the session's cut includes the delivered amount.
4. Given a product with a required modifier group (min 1), when adding it without selecting an option, then the API rejects with a Spanish validation error; selecting "extra queso (+$10)" prices the line base+10 and the modifier prints/shows in kitchen and in the comanda.
5. Given an order with 3 guests and lines assigned per seat from the Comandero UI, when opening "Dividir cuenta" at Caja, then each seat card shows its own total (no "Sin asignar" degenerate case).
6. Given a product without station in an outlet with `defaultStationId` set, when sending to kitchen, then the send succeeds and the line appears in the default station's KDS lane.
7. Given a MOSTRADOR outlet, when a cashier with an open session taps 2 products and confirms payment, then the whole flow takes ≤ 3 interactions after product selection and no table/guest concepts appear.
8. Given the existing June dataset, when F1's migration runs, then `prisma migrate status` is clean and all pre-existing orders/payments remain queryable with identical totals.

## 26. Verification plan

Per phase: `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (suite extended per phase, all green); `pnpm.cmd exec prisma migrate status` after each migration; `pnpm.cmd --filter @atlas/desktop build:web`; Playwright browser QA replaying the stabilization harness flows plus the new acceptance criteria (1–7); `rbac:verify-catalog` reports no missing keys.

## 27. Rollback plan

Each phase is one forward migration + code. Rollback = `git revert` of the phase's commits plus a new forward migration reversing schema additions (columns/tables are additive; the only riskier change is `PosOrder.sessionId` nullable — reverting requires backfilling, documented in F1 plan). Never edit applied migrations.

## 28. Future enhancements

1. Tiempos (course sequencing) on comandas.
2. Customer self-service kiosk experience.
3. Tip pooling/distribution and advanced propina reports.
4. CSV/PDF export of session and shift cuts.
5. Inventory depletion (atlas.catalog stock) per sale.
6. CFDI/fiscal invoicing integration.
7. Offline-tolerant comandero (queue mutations while offline).
8. True kitchen print hardware certification matrix (ESC/POS models).
