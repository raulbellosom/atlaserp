# POS Rework F3 — Plan B (UI): Caja Real, Cortes de Meseros y Mostrador por Sucursal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-18-pos-rework-f3-caja-design.md` (sections 8, 9, 23, 25)
**Depends on:** Plan A (session math fixed).

**Goal:** Caja charges into its session, receives waiter cuts, links to session history, and obeys the per-outlet mode; comandero behavior untouched.

**Facts (verified this session):** `PaymentDialog.jsx` uses `useAddPosPayment` and passes `paymentMethodId` to `SplitBillDialog`; `PosTerminalScreen.jsx` (548 lines) reads global mode at lines 115-116 (`posMode`/`isRetail`) and has `currentSession` context (creates orders with `sessionId: currentSession?.id`); `usePosSession.js` (98 lines) holds session hooks; F1 SDK: `listWaiterShifts(query, token)`, `closeWaiterShift(id, data, token)`; `usePosOutlets()` returns outlets incl. `mode` and `allowTableCharge`; `PosSessionsScreen.jsx` (126 lines) exists; ModuleOutlet `atlas.pos` uses exact-match SCREEN_MAP keys + regex branch for params; ComandaScreen renders `PaymentDialog` WITHOUT session props (must stay that way).

## File Structure Map

- Modify: `apps/desktop/src/modules/atlas.pos/components/PaymentDialog.jsx` (+ optional `sessionId` prop)
- Modify: `apps/desktop/src/modules/atlas.pos/components/SplitBillDialog.jsx` (+ passthrough)
- Modify: `apps/desktop/src/modules/atlas.pos/screens/PosTerminalScreen.jsx` (session-attributed payments, outlet mode, caja tools props)
- Create: `apps/desktop/src/modules/atlas.pos/hooks/usePosWaiterShifts.js`
- Create: `apps/desktop/src/modules/atlas.pos/components/WaiterShiftsPanel.jsx`
- Modify: `apps/desktop/src/modules/atlas.pos/screens/CajaScreen.jsx` (real screen)
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx` (`/pos/caja/historial`)

### Task 1: Session-attributed payments

**Files:** `PaymentDialog.jsx`, `SplitBillDialog.jsx`, `PosTerminalScreen.jsx`

- [ ] Step 1: `PaymentDialog({ ..., sessionId = null })`: include `...(sessionId ? { sessionId } : {})` in the `addPayment.mutate` payload; pass `sessionId` down to `<SplitBillDialog sessionId={sessionId} ...>`.
- [ ] Step 2: `SplitBillDialog({ ..., sessionId = null })`: same conditional field in its `addPayment.mutate` call (`handleChargeSeat`).
- [ ] Step 3: `PosTerminalScreen` passes `sessionId={currentSession?.id ?? null}` to its `PaymentDialog`. VERIFY `ComandaScreen.jsx` passes nothing (grep) — comandero keeps the shift path.
- [ ] Step 4: build clean; commit `fix(pos): attribute caja payments to the open session` (+trailer).

### Task 2: Outlet-driven mode

**Files:** `PosTerminalScreen.jsx`

- [ ] Step 1: Replace the global-settings mode read (lines ~115-116): resolve the terminal's outlet from the existing outlet context (`usePosOutlets()` + the configured `outletId` the screen already holds) and compute `const isRetail = outlet?.mode === 'RETAIL'` (fallback to the old global value ONLY while outlet data is loading, to avoid flicker).
- [ ] Step 2: build clean; quick manual check that El Pitillal (RESTAURANT) still shows table-aware UI; commit `feat(pos): drive terminal mode from the outlet` (+trailer).

### Task 3: Waiter shifts panel + real CajaScreen + historial route

**Files:** `usePosWaiterShifts.js`, `WaiterShiftsPanel.jsx`, `PosTerminalScreen.jsx`, `CajaScreen.jsx`, `ModuleOutlet.jsx`

- [ ] Step 1: Hooks (conventions of `usePosModifiers.js`):

```js
export function useOpenWaiterShifts(outletId) { /* queryKey ['pos','waiter-shifts',outletId], atlas.pos.listWaiterShifts({ status: 'OPEN', outletId }, token), enabled: !!token && !!outletId, refetchInterval: 30000 */ }
export function useCloseWaiterShift() { /* mutation ({ id, data }) => atlas.pos.closeWaiterShift(id, data, token); invalidate ['pos','waiter-shifts'] and ['pos','sessions']; toasts */ }
```

- [ ] Step 2: `WaiterShiftsPanel.jsx` (≤200 lines): `Sheet` side right; props `{ open, onOpenChange, outletId, sessionId }`; lists open shifts (waiter name if present in payload else id short, `expectedCashAmount`, openedAt); per row "Recibir corte" → `Dialog` with expected shown, `Input` monto entregado (prefill expected), notas, difference preview, confirm → `useCloseWaiterShift({ id, data: { deliveredAmount, sessionId, notes } })`; disabled state with hint when `!sessionId` ("Abre una caja para recibir cortes"); `EmptyState` "Sin cortes abiertos".
- [ ] Step 3: `PosTerminalScreen` accepts optional `cajaTools = false`: when true, render next to the session chip two `Button`s — "Cortes" (opens the panel; count badge from `useOpenWaiterShifts`) and "Historial" (`useNavigate` → `/app/m/atlas.pos/pos/caja/historial`) — plus `<WaiterShiftsPanel outletId={outletId} sessionId={currentSession?.id ?? null} ...>`. Prop absent → zero visual change (legacy `/pos/terminal` identical).
- [ ] Step 4: `CajaScreen.jsx` → real component: `return <PosTerminalScreen cajaTools />;`
- [ ] Step 5: `ModuleOutlet.jsx`: add exact key `"atlas.pos:/pos/caja/historial"` → lazy `PosSessionsScreen.jsx` (static path; passes nav gate as sub-path of `/pos/caja`).
- [ ] Step 6: build clean; commit `feat(pos): waiter shift reception and session history in the Caja post` (+trailer).

### Task 4: QA + TASKS.md

- [ ] Step 1: Playwright (desktop 1440×900, harness pattern; recreate creds, delete after):
1. Caja → confirm "Cortes" and "Historial" buttons; Historial → sessions render (no "Acceso restringido").
2. Legacy check: nothing at `/pos/terminal` shows the new buttons.
3. Charge an order from Caja with the session open → POST /payments body contains `sessionId` (capture via `page.on('request')`).
4. Open "Cortes": the shift created by the F2 QA (expected $35) is listed → "Recibir corte" → confirm $35 → 200 + row gone.
5. Close the session → cut math includes the $35 delivery (screenshot of the close dialog totals).
6. Mobile comandero pay step re-run (F2 harness): payment WITHOUT sessionId still succeeds to a new shift.
- [ ] Step 2: `docs/TASKS.md`: mark the F3 pending item as `[x] F3 Caja/Mostrador: atribución de pagos a sesión, corte con entregas de meseros, recepción de cortes, historial de cajas en /pos/caja/historial, modo por sucursal` + `Verified:` line with real evidence; commit `docs(tasks): record POS rework F3 completion` (+trailer).
