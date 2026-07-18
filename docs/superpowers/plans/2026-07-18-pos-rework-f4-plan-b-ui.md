# POS Rework F4 — Plan B (UI): Asignación de Productos y KDS Operativo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f4-cocina-design.md` (sections 8, 9, 25.3-5)
**Depends on:** Plan A.

**Facts:** `PosSettingsScreen` Estaciones tab lists stations with edit dialog; products via `usePosCatalogProducts()`; stations via the hook the tab already uses; `KitchenStationBoard.jsx` consumes tickets from the kitchen board hook (`usePosKitchen.js`) and expects `line.orderLine.productName` (unfulfilled until Plan A); `/pos/cocina` = `CocinaScreen` wrapper over `PosStationsScreen`. Sentinel convention `'__none__'` for null selects.

## File Structure Map

- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosProductConfigs.js`
- Create: `apps/desktop/src/modules/atlas.pos/components/ProductStationsPanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosSettingsScreen.jsx` (mount panel in Estaciones tab)
- Modify: `apps/desktop/src/modules/atlas.pos/components/KitchenStationBoard.jsx` (render enriched lines; minimal diff)

### Task 1: Product assignment panel

- [ ] Step 1: Hooks file (conventions of `usePosModifiers.js`): `useProductConfigs()` (query `['pos','product-configs']`, `atlas.pos.listProductConfigs`), `useUpdateProductConfig()` (mutation `(productId, data)`, invalidates the key, toasts).
- [ ] Step 2: `ProductStationsPanel.jsx` (≤200 lines): heading "Asignación de productos" + helper "Los productos sin estación usan la estación por defecto de la sucursal."; rows = `usePosCatalogProducts()` paired client-side with configs by `productId`; per row: product name + `SelectField` estación (options: "Sin estación (usa la de la sucursal)" `'__none__'` + stations from the tab's stations query) firing `useUpdateProductConfig(productId, { stationId })` on change, + `SwitchField` "Requiere preparación" (`requiresPreparation`, default true when no config row). Optimistic-enough via invalidation; row-level pending state.
- [ ] Step 3: Mount under the station list in the Estaciones tab (`PosSettingsScreen.jsx`), keep the screen <1000 lines.
- [ ] Step 4: build clean; commit `feat(pos): assign preparation stations per product from Estaciones` (+trailer).

### Task 2: KDS renders real comanda lines

- [ ] Step 1: READ `KitchenStationBoard.jsx` + `usePosKitchen.js`. Adapt line rendering to the enriched payload: `1× {orderLine?.productName ?? 'Producto'}` (quantity from `orderLine?.quantity ?? line.quantity`), modifiers as "· {optionName}" secondary lines, `note` italic. Keep mark-ready actions untouched. Minimal diff; report what the component previously rendered.
- [ ] Step 2: build clean; commit `fix(pos): render product names, modifiers and notes on kitchen tickets` (+trailer).

### Task 3: QA + docs closure

- [ ] Step 1: Playwright (harness pattern; creds recreated then deleted):
1. Admin → Estaciones → panel visible; set "Gordita de chicharron" → TACOS → PUT 200 → persists on reload (acceptance 3).
2. Clear it back to "Sin estación" (leaves fallback exercised in step 3).
3. Mobile comandero: Mesa 1 → comanda → Gordita with "Extra queso" + note "aparte la salsa" → "Enviar a cocina" → SUCCESS this time (fallback to TACOS; acceptance 1; F2's old 400 gone).
4. Desktop `/pos/cocina`: ticket visible on TACOS with "1× Gordita de chicharron", "· Extra queso", note (acceptance 4) → mark ready → status changes (acceptance 5). Screenshots.
5. Pay/close the test order and mark the table lista (leave dev data tidy).
- [ ] Step 2: `docs/TASKS.md`: `[x] F4 Cocina: fallback a estación default en send-to-kitchen, asignación producto↔estación (API+UI), KDS con nombres/modificadores/notas` + Verified line (evidence + commits) + REMOVE/annotate the old F4-pending bullet; also mark the master rework: add line `- [x] POS role-based rework F1–F4 COMPLETE (specs 2026-07-17/18)` and update master spec `2026-07-17-pos-role-based-rework-design.md` Status → `Complete (F1–F4 shipped 2026-07-18; printing deferred per F4 spec)`. Commit `docs(tasks): record POS rework F4 completion — rework complete` (+trailer).
