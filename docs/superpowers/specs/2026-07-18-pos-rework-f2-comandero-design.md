# POS Rework F2 — Comandero Móvil: Modificadores, Asientos y Editor de Comandas

## 1. Feature title

atlas.pos F2: product modifiers (groups/options with price deltas), guest-seat UI, and the mobile-first Comandero comanda editor that replaces the F1 wrapper.

## 2. Status

Proposed

## 3. Context

Phase of the approved master spec `2026-07-17-pos-role-based-rework-design.md` (F2). F1 shipped the role-post navigation, the money containers (`PosWaiterShift`, payment session/shift attribution), and per-outlet flags (El Pitillal dev outlet already has `allowTableCharge = true`). Discovery (2026-07-18) found the backend is further along than the master spec assumed: `addOrderLineSchema` already accepts `guestSeatId` (nullable) and `note` (≤500), `updateOrderLineSchema` accepts `guestSeatId`, and `POST /pos/orders/:id/guests` exists. Products enter POS via `PosProductConfig` (company-scoped mapping over shared `CatalogProduct`/variant, no FK — the repo's pattern for shared entities).

## 4. Problem

1. A comanda cannot express product variations (sin cebolla, término, extras con precio) — no modifier concept exists anywhere.
2. Seats exist in the backend but no screen can create guests or assign lines to them, so per-seat split billing is unreachable (stabilization QA 2026-07-17 confirmed the degenerate "Sin asignar" case is the only one reachable).
3. The Comandero post is still the F1 wrapper over the tables floor: tapping a table sends the waiter to the desktop terminal, which is not usable on a phone and forces the caja context.

## 5. Goals

1. Admins define modifier groups per POS product (name, min/max selection, required) with priced options, from Administración.
2. Order lines carry immutable modifier snapshots; the line price is `base + Σ priceDelta`, computed and validated server-side (required groups enforced in API, not only UI).
3. A waiter on a phone can: open their floor, tap a table, manage guests ("Persona 1..N" + "Compartido"), add products with modifiers/notes per seat, send to kitchen, request the bill, and charge (full or per seat) when the outlet allows table charging.
4. The kitchen ticket and the comanda line list show modifiers and notes under each line.

## 6. Non-goals

1. Kitchen KDS/printing changes (F4) — tickets keep flowing exactly as today.
2. Caja/Mostrador UX (F3).
3. Tiempos (courses), tip flows, offline — master spec non-goals.
4. Modifier editing on an existing line — in F2, changing modifiers = remove line + re-add (edge case 5).
5. Variant-level modifier groups (`variantId` scoping) — product-level only in F2.

## 7. User stories

1. As an administrador, I open Administración → Modificadores, pick "Gordita de chicharron", create group "Salsa" (min 0, max 2) with options "Verde +$0", "Roja +$0", "Extra queso +$10".
2. As a mesero, I tap Mesa 4 in Comandero, add "Persona 1" and "Persona 2", tap a product, pick modifiers and a note ("aparte la salsa"), assign it to Persona 2, and send the comanda to cocina — all from my phone.
3. As a mesero in an outlet with cobro en mesa, I charge Persona 1's seat from the same screen; the payment lands in my waiter shift.
4. As a cocinero, I see "Gordita de chicharron — Extra queso — aparte la salsa" on the ticket exactly as captured.

## 8. UX requirements

- Comandero is mobile-first (min 360px wide); desktop simply centers the same column. All text Spanish.
- Comanda editor layout: header (mesa + estado + volver), seat chips row (horizontal scroll: `Compartido`, `Persona 1..N`, `+` to add), line list grouped by seat, sticky bottom bar (total + "Enviar a cocina" + "Cobrar"/"Pedir cuenta").
- Active seat chip = where new products land; tapping a chip activates it; "Compartido" = `guestSeatId: null`.
- Product picker: reuse `ProductGrid` visual language in a mobile grid; tapping a product with modifier groups opens `ModifierSheet` (bottom `Sheet`): groups with checkbox/radio semantics from min/max (`maxSelect 1` → radio; else checkboxes), running price preview, quantity stepper, note `TextareaField`, seat pre-selected to the active chip; "Agregar" disabled until every `required` group satisfies `minSelect`.
- Products without modifier groups add directly to the active seat on tap; their note/seat can be adjusted afterwards via the existing `LineEditSheet` (extended with seat select).
- Charging reuses `PaymentDialog`/`SplitBillDialog` unchanged (no `sessionId` → waiter-shift path from F1). If the outlet forbids table charging, the "Cobrar" button is replaced by "Pedir cuenta" only.
- `ConfirmDialog` for destructive actions (cancel order, remove line). All components from `@atlas/ui`; no native inputs.

## 9. Routes/screens

Module `atlas.pos`, base `/app/m/atlas.pos`:

| Route | Screen | Notes |
|---|---|---|
| `/pos/comandero` | `ComanderoScreen` | becomes real: floor view where table tap navigates to the comanda editor (not the terminal) |
| `/pos/comandero/mesa/:tableId` | `ComandaScreen` (new) | mobile comanda editor |
| `/pos/admin` | `PosSettingsScreen` + new `PosModifiersTab` component | new "Modificadores" tab |

`ComanderoScreen` stops being a re-export: it renders the floor (reusing `FloorOperationalCanvas`/grid pieces from `PosTablesScreen` via a shared extraction if needed) with navigation target overridden to the comanda editor. Legacy `/pos/tables` keeps its current terminal-oriented behavior untouched.

## 10. Data model

New entities (F2 migration, all company-scoped, following the `PosProductConfig` no-FK pattern for the shared catalog product):

- **PosModifierGroup**: `id`, `companyId`, `productId` (CatalogProduct id, no FK), `name`, `minSelect` (int ≥0, default 0), `maxSelect` (int ≥1, default 1), `required` (bool, default false), `position` (int, default 0), `enabled` (bool, default true), timestamps. Unique `(companyId, productId, name)`. Index `(companyId, productId, enabled)`.
- **PosModifierOption**: `id`, `groupId` (FK PosModifierGroup, Cascade), `companyId`, `name`, `priceDelta` (Decimal(12,2), default 0), `position`, `enabled`, timestamps. Index `(groupId, enabled)`.
- **PosOrderLineModifier**: `id`, `companyId`, `lineId` (FK PosOrderLine, Cascade), `optionId` (uuid, no FK — survives option deletion), `groupName`, `optionName`, `priceDelta` (Decimal(12,2)) — immutable snapshot. Index `(lineId)`.

Modified: none — `PosOrderLine` already has `note` and `guestSeatId`; `unitPrice` already exists and will store base+deltas.

Semantics: `required: true` means the group must reach `minSelect` (with `minSelect` coerced to ≥1 when required); `minSelect ≤ maxSelect` enforced by validator refinement.

## 11. Prisma impact

New models: `PosModifierGroup`, `PosModifierOption`, `PosOrderLineModifier`. One forward migration `20260718*_pos_rework_f2_modifiers`. No changes to existing models. Enum names in raw SQL must use the mapped snake_case names (lesson from F1).

## 12. API contract

All company-scoped, JWT, `PosServiceError` Spanish errors.

Modifier catalog (Administración):
- `GET /pos/products/:productId/modifier-groups` — guard `pos.orders.read` (terminal + comandero + admin all need it). Returns groups with nested enabled options, ordered by `position`.
- `POST /pos/products/:productId/modifier-groups` — guard `pos.admin.update`. Body: `{ name, minSelect?, maxSelect?, required?, position? }`.
- `PATCH /pos/modifier-groups/:id` — guard `pos.admin.update`. Partial update incl. `enabled`.
- `POST /pos/modifier-groups/:id/options` — guard `pos.admin.update`. Body: `{ name, priceDelta?, position? }`.
- `PATCH /pos/modifier-options/:id` — guard `pos.admin.update`. Partial update incl. `enabled`.
- Bulk fetch for menus: `GET /pos/modifier-groups?productIds=a,b,c` — guard `pos.orders.read`; returns map keyed by productId (single round-trip for the product grid).

Order lines (existing endpoint, extended):
- `POST /pos/orders/:id/lines` body gains `modifiers: [{ optionId }]` (optional array). Server loads the product's enabled groups/options, validates: every option belongs to an enabled group of that product; per-group count within `[minSelect(required ? ≥1 : 0), maxSelect]`; required groups present. On success: `unitPrice = basePrice + Σ priceDelta` (ignoring any client-sent unitPrice when modifiers are present), creates the line plus `PosOrderLineModifier` snapshots in the same transaction.
- Line hydration (order detail, seat totals, kitchen ticket payloads) includes `modifiers: [{ groupName, optionName, priceDelta }]` per line.
- `DELETE /pos/orders/:id/lines/:lineId` — unchanged (cascade removes snapshots).

Errors: 400 "Faltan modificadores requeridos: <grupo>.", 400 "Selección inválida en <grupo> (mín X, máx Y).", 404 "Opción de modificador no encontrada.".

## 13. SDK contract

`atlas.pos.*` gains: `listProductModifierGroups(productId, token)`, `listModifierGroups(query, token)` (bulk), `createModifierGroup(productId, data, token)`, `updateModifierGroup(id, data, token)`, `createModifierOption(groupId, data, token)`, `updateModifierOption(id, data, token)`. `addOrderLine` passes `modifiers` through its existing `data` param (no signature change).

## 14. Validator contract

Module-local `validators.js`: `createModifierGroupSchema` (name 1..80, minSelect ≥0, maxSelect ≥1, refinement `minSelect ≤ maxSelect`), `updateModifierGroupSchema` (partial + enabled), `createModifierOptionSchema` (name 1..80, priceDelta money ≥0 default 0), `updateModifierOptionSchema`; `addOrderLineSchema` extended with `modifiers: z.array(z.object({ optionId: uuidSchema })).max(30).optional()`.

## 15. Module manifest impact

None — permissions reuse F1's `pos.admin.update`/`pos.comandas.*` plus existing `pos.orders.read`/`pos.orders.update`. No new navigation (Comandero entry exists).

## 16. Navigation impact

None (routes under the existing Comandero/Administración entries; `/pos/comandero/mesa/:tableId` is a sub-route gated by the same `pos.comandas.read`).

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

No new keys. Guards per section 12. `ComandaScreen` actions map: view `pos.comandas.read`, create/edit lines + guests + send to kitchen `pos.comandas.create` (routes for lines/guests currently guard with `pos.orders.update`; the comandero role must therefore hold `pos.orders.create`/`pos.orders.update`/`pos.orders.read` too — the plan seeds a "Mesero" role example in docs, but no route guards change in F2).

## 19. Multi-company behavior

All new tables carry `companyId` and every query scopes by it (repo pattern `requireCompanyId`). Modifier groups reference catalog products of the same company only (validated on create by checking `PosProductConfig`/catalog product company).

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

`writeAudit` on: `pos.modifierGroup.create/update`, `pos.modifierOption.create/update` (before/after). Line creation keeps its existing audit behavior (snapshot rows ride along in `after`).

## 23. Edge cases

1. Option disabled/deleted after being ordered: snapshots keep historical lines intact; validation only accepts currently-enabled options for new lines.
2. Product with a `required` group whose options are ALL disabled: line creation would be impossible — validation treats a required group with zero enabled options as non-blocking (skipped) and the admin UI warns when disabling the last option of a required group.
3. `maxSelect` reduced below existing typical selections: only affects new lines (snapshots immutable).
4. Client sends `unitPrice` AND `modifiers`: server ignores the client price and computes base+deltas (prevents price tampering).
5. Editing modifiers on an existing line: not supported in F2 — UI offers "Quitar" + re-add; `PATCH lines/:lineId` rejects a `modifiers` key if sent (validator omits it).
6. Guest removed while lines point to it: existing backend behavior governs (`guestSeatId` lines fall back to "Sin asignar" in seat totals); Comandero UI hides seat deletion when the seat has lines.
7. Duplicate group names per product blocked by the unique index → 409 Spanish error.
8. Table tap in Comandero when the table has no open order: create flow identical to terminal's (F1 behavior: creation auto-claims table + waiter); when occupied by another waiter, show the existing claim/reassign panel behavior.
9. Order in a non-editable status (PAID/CANCELLED): editor renders read-only with status banner.
10. Concurrent line adds from caja and comandero: line inserts are independent; totals recompute server-side on each mutation (existing behavior).

## 24. Risks

1. **Price integrity** — modifiers change money math. Mitigation: server-side computation + tamper test (edge 4) + seat-total tests extended with deltas.
2. **Comandero screen scope creep** — the editor touches floor, seats, products, payment. Mitigation: Plan B decomposes into ≤300-line components (`ComandaScreen` orchestrator, `SeatChips`, `ModifierSheet`, `ComandaLineList`); reuses `PaymentDialog`/`SplitBillDialog`/`LineEditSheet` as-is or minimally extended.
3. **Menu latency on phones** — per-product modifier fetches would be N+1. Mitigation: bulk `GET /pos/modifier-groups?productIds=` loaded once with the product grid and cached by TanStack Query.
4. **File size limits** — `PosSettingsScreen` at 818 lines cannot absorb a Modificadores tab. Mitigation: new tab is its own component file from the start.

## 25. Acceptance criteria

1. Given a product with group "Salsa" (min 1, max 2, required) with 3 options, when adding a line without modifiers via API, then 400 "Faltan modificadores requeridos: Salsa."; when adding with 3 options, then 400 with the mín/máx message; with 1-2 options, the line's `unitPrice` equals base + Σ deltas and snapshots exist.
2. Given the admin UI, when creating a group and two options on a product, then they appear in the product's `ModifierSheet` in the comandero without reload (query invalidation).
3. Given a phone-sized viewport (390px), when a waiter opens `/pos/comandero`, taps an available table, adds Persona 2, selects it, and adds a product with an "Extra queso +$10" option and note, then the line renders under "Persona 2" showing the modifier and note, and the sticky total includes the +$10.
4. Given lines assigned to two seats, when opening "Cobrar → Dividir cuenta", then each seat card shows its own total including modifier deltas (no degenerate single "Sin asignar" card).
5. Given an outlet with `allowTableCharge = false`, when the waiter opens the comanda editor, then no "Cobrar" action is offered (only "Pedir cuenta"), and a direct API payment without `sessionId` still returns 409 (F1 behavior).
6. Given a sent comanda with modifiers/notes, when viewing the kitchen ticket data (`GET` kitchen board), then each line includes its modifier names and note.
7. Given `/pos/tables` (legacy), when tapping a table, then it still navigates to the terminal exactly as before F2.

## 26. Verification plan

Per plan: `node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (new modifier + line-pricing tests; all green), `pnpm.cmd exec prisma migrate status`, `pnpm.cmd --filter @atlas/desktop build:web`, Playwright QA at 390×844 viewport replaying acceptance criteria 2–5 against the dev outlet (El Pitillal, `allowTableCharge` ON), `node --check` on touched files.

## 27. Rollback plan

Additive migration (3 new tables) → revert = `git revert` of F2 commits + forward migration dropping the 3 tables. No existing-table changes, so rollback cannot strand data beyond the new tables themselves.

## 28. Future enhancements

1. Variant-scoped modifier groups (`variantId`).
2. Editing modifiers in place on a line.
3. Modifier templates shared across products (copy tool exists only as create-per-product in F2).
4. Tiempos, kitchen routing per modifier (e.g. "para llevar").
5. Comandero offline queue (master spec future #7).
