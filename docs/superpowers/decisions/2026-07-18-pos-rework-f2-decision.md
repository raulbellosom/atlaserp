# Decision Log — POS Rework F2 (Comandero Móvil)

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f2-comandero-design.md`
**Date:** 2026-07-18
**Author:** Implementation session (subagent-driven), approved direction by product owner during F1/F2 execution.

## Decision 1 — Legacy POS routes are navigation-gate blocked; accepted as end state

**Spec said (acceptance 7):** `/pos/tables` keeps navigating to the terminal exactly as before F2.

**Reality found during F2-B QA:** `isPathAllowedByNavigation` in `ModuleOutlet.jsx` only allows paths present in (or nested under) the module's manifest navigation. F1-B replaced the POS navigation with the five role posts, so `/pos/tables`, `/pos/terminal`, `/pos/sessions`, `/pos/settings`, `/pos/floor-planner`, `/pos/stations` now render "Acceso restringido" when opened by URL. The F1-B verification that reported legacy routes as working was performed against stale cached navigation (offline/Dexie query persistence); with a fresh cache the gate blocks them.

**Decision:** Accept the block as the intended end state of the role-post rework. The screens remain registered in `SCREEN_MAP` (wrappers mount them: Caja→terminal, Comandero→floor, Cocina→stations board, Administración→settings), so no functionality is lost except direct legacy URLs — which the new information architecture deliberately replaces. `PosTablesScreen.comanderoMode` keeps the default terminal-target behavior intact for its Caja-side usage.

**Follow-up required (F3):** `PosSessionsScreen` (historial de cajas / cortes) currently has NO navigation home — F3 (Caja) must mount session history inside the Caja post (or Administración). Recorded in `docs/TASKS.md`.

## Decision 2 — Kitchen end-to-end (acceptance 6) deferred to F4

**Spec said (acceptance 6):** kitchen board data for a sent comanda includes modifier names and note.

**Reality:** `sendOrderToKitchen` still requires each product to have a station via `posProductConfig`, there is NO admin UI nor API endpoint to assign product↔station (the error toast points to Estaciones, whose dialog only edits name/code/active — dead end), and the outlet `defaultStationId` fallback is F4 scope (the kitchen service does not read it yet). Therefore the browser QA could not exercise a successful send.

**What was verified instead:** unit level — `pos-kitchen-service.listTickets` now attaches `modifiers` + `note` per board line (test added in F2-A Task 4, 51/51 suite green). The 400 path shows a correct, actionable Spanish error.

**Decision:** Acceptance 6 (end-to-end) moves to F4's verification plan, which must implement: (a) `defaultStationId` fallback in send-to-kitchen, (b) product↔station assignment UI/API (`posProductConfig` management), and (c) `orderLine`/`productName` join on board lines (consumer `KitchenStationBoard` expects `line.orderLine.productName`, currently unfulfilled by `listTickets`).

## Decision 3 — addOrderLine prices modifier lines from `catalogPrice`, not `snapshot.unitPrice`

**Spec/plan said:** `unitPrice = base + Σ priceDelta` where the plan's pseudocode used `snapshot.unitPrice` as base.

**Reality:** `loadCatalogSnapshot` honors a client-sent `unitPrice` override (legitimate for the no-modifiers flow). Using it as the modifier base would let a tampered client price flow into modifier-priced lines, violating the spec's own tamper-resistance requirement (edge case 4).

**Decision:** `loadCatalogSnapshot` now also returns `catalogPrice` (true DB price); modifier-priced lines compute `toMoney(catalogPrice + totalDelta)` and ignore the client price entirely. Products without groups keep today's behavior byte-identical. Covered by the tamper test in `pos-order-service.test.js`.
