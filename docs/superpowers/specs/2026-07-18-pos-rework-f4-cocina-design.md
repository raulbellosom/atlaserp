# POS Rework F4 — Cocina: Ruteo con Fallback, Asignación Producto↔Estación y KDS Operativo

## 1. Feature title

atlas.pos F4: send-to-kitchen falls back to the outlet's default station, admins assign stations per product, and the Cocina post shows a working KDS (product names, modifiers, notes, ready flow).

## 2. Status

Approved (2026-07-18, product owner delegated approval this session)

## 3. Context

Final phase of master spec `2026-07-17-pos-role-based-rework-design.md`. Current state (verified): `sendOrderToKitchen` skips routing when zero stations exist; with stations, lines whose `PosProductConfig` lacks `stationId` produce a 400 whose toast points to a dead end (the Estaciones dialog only edits name/code/active — no product assignment exists anywhere, and no API manages `posProductConfig`). `PosOutlet.defaultStationId` exists since F1 but nothing reads it. `listTickets` (fixed in F2-A) includes lines + modifiers + note but not the product name; `KitchenStationBoard` expects `line.orderLine.productName`. F2's acceptance 6 (kitchen shows modifiers e2e) was deferred here by decision log `2026-07-18-pos-rework-f2-decision.md`.

## 4. Problem

A restaurant cannot actually operate its kitchen: sends fail unless every product was pre-assigned by hand in the database, there is no screen or API to do that assignment, and the KDS board cannot render what a line even is.

## 5. Goals

1. `sendOrderToKitchen` routes lines without a product station to the outlet's `defaultStationId`; the 400 remains only when neither exists (with its current actionable message).
2. Admins manage product preparation config from Administración → Estaciones: station per product, "requiere preparación" toggle.
3. The Cocina post renders tickets with product name, quantity, modifiers, and note per line, grouped/filtered by station, with the existing mark-ready flow working.
4. F2's deferred acceptance: a comanda with modifiers and note reaches the KDS showing both, end to end in the browser.

## 6. Non-goals

1. **Kitchen printing** — `kitchenPrintEnabled` stays a dormant flag: no print-jobs API, no agent, no printable view in F4 (no printer hardware/agent exists to verify against; master spec's pull-model API moves to Future). This narrows the master spec's F4 by decision recorded here.
2. Variant-level station config (`variantId` handling beyond what `resolvePreparationConfig` already does).
3. KDS redesign — the existing `PosStationsScreen`/`KitchenStationBoard` are completed, not rebuilt.
4. New tables/migrations — `PosProductConfig` and outlet flags already exist; F4 is zero-migration.
5. Course sequencing, expo screens, SLA timers (future).

## 7. User stories

1. As an administrador, in Estaciones I see every POS product with its assigned station and can change it (or leave "Sin estación" and rely on the outlet default).
2. As a mesero, "Enviar a cocina" simply works when the outlet has a default station, even for products nobody assigned.
3. As a cocinero, each ticket line reads like a comanda: "1× Gordita de chicharron · Extra queso — aparte la salsa", and I mark lines/tickets ready.

## 8. UX requirements

Spanish labels ("Asignación de productos", "Estación", "Sin estación (usa la de la sucursal)", "Requiere preparación"). Product assignment lives inside the existing Estaciones tab under the station list. KDS lines show quantity ×, product name, modifiers as secondary lines prefixed "· ", note in italics. All `@atlas/ui`.

## 9. Routes/screens

No new routes. `PosSettingsScreen` → Estaciones tab gains `ProductStationsPanel` (new component file). `/pos/cocina` keeps mounting the stations board (wrapper unchanged); `KitchenStationBoard` is fixed to consume the enriched payload.

## 10. Data model

None new. Reads/writes `PosProductConfig` (upsert per `(companyId, productId, variantId=null)`), reads `PosOutlet.defaultStationId`.

## 11. Prisma impact

None.

## 12. API contract

- `GET /pos/product-configs` — guard `pos.admin.read`. Returns all `PosProductConfig` rows for the company (client pairs them with catalog products).
- `PUT /pos/products/:productId/config` — guard `pos.admin.update`. Body `{ stationId?: uuid|null, requiresPreparation?: boolean, availableInPos?: boolean }`; upserts the `(companyId, productId, variantId null)` row; validates the station belongs to the company. Audit `pos.productConfig.update`.
- `sendOrderToKitchen` (behavior change): when a line's config lacks `stationId`, resolve the order's outlet `defaultStationId` (one lookup per send) and route there; the 400 (same message) only fires when the outlet default is also null.
- `listTickets` (behavior change): each ticket line gains `orderLine: { productName, quantity }` (batch lookup of `posOrderLine` by the collected `orderLineId`s, same pattern as the modifiers join).

## 13. SDK contract

`atlas.pos.listProductConfigs(token)`, `atlas.pos.updateProductConfig(productId, data, token)`.

## 14. Validator contract

`updateProductConfigSchema`: `{ stationId: uuid nullable optional, requiresPreparation: boolean optional, availableInPos: boolean optional }` (at least one key required via refinement).

## 15-17. Manifest / Navigation / Blueprints

None. (Permissions reuse `pos.admin.read/update`, `pos.cocina.*` from F1.)

## 18. RBAC/permissions

GET configs `pos.admin.read`; PUT config `pos.admin.update`; KDS board reads stay on their existing guards (note: master spec maps cocina reading to `pos.cocina.read` — the existing board endpoints keep their current guards; unifying guard keys is out of scope).

## 19. Multi-company behavior

Company-scoped as everywhere; station ownership validated on upsert.

## 20-22. Files / Export / Audit

Files N/A; export N/A; audit: `pos.productConfig.update` with before/after.

## 23. Edge cases

1. Product with `requiresPreparation: false`: never routed (existing behavior), regardless of stations.
2. Outlet default station disabled/deleted: FK is `SetNull` on delete, so default becomes null → 400 path returns; admin UI shows the default station selector already (F1).
3. Config upsert with `stationId: null`: clears the product's own station (falls back to outlet default at send time).
4. Zero stations configured company-wide: current skip-routing behavior preserved (order SENT, no tickets).
5. Mixed send: some lines with own station, some falling back — one ticket per station, fallback lines grouped under the default station's ticket.
6. `listTickets` for legacy tickets whose order lines were deleted: `orderLine` resolves null → board renders "Producto" placeholder, never crashes.

## 24. Risks

1. Send-to-kitchen is transactional and money-adjacent (order status) — TDD on the fallback matrix (own station / fallback / neither / no stations at all).
2. Board component contract unknown in detail — the plan requires reading `KitchenStationBoard` before editing and adapting to the enriched payload with minimal diff.

## 25. Acceptance criteria

1. Given products without station config and an outlet with default station TACOS, when sending a comanda, then the send succeeds and creates a ticket on TACOS with those lines.
2. Given also no outlet default, when sending, then the 400 with the current Spanish message fires (no silent drop).
3. Given "Asignación de productos", when setting "Gordita de chicharron" → station TACOS, then a `PosProductConfig` upsert (PUT 200) persists and reloading shows it.
4. Given a sent comanda whose line has modifier "Extra queso" and note "aparte la salsa", when opening Cocina, then the board shows the line as product name + quantity with the modifier and note visible (F2 deferred criterion, now e2e).
5. Given the mark-ready action on that line/ticket, then the status updates (existing flow keeps working post-changes).

## 26. Verification plan

`node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (fallback matrix + config endpoints + listTickets join tests; all green); build; Playwright QA covering acceptance 1, 3, 4, 5 against dev data (El Pitillal has default station TACOS; "Salsa" group exists from F2 QA).

## 27. Rollback plan

Zero migrations — `git revert` of F4 commits.

## 28. Future enhancements

1. Kitchen printing (print-jobs pull API + local agent + ESC/POS matrix) — moved out of F4 by this spec.
2. Unify kitchen board guards onto `pos.cocina.*` keys.
3. Variant-level station overrides UI.
4. KDS timers/SLA colors, expo lane, bump bar support.
