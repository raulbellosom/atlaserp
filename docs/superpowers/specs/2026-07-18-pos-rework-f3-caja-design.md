# POS Rework F3 — Caja y Mostrador: Atribución de Dinero Correcta, Cortes y Venta Rápida

## 1. Feature title

atlas.pos F3: correct money attribution end to end (payments carry the caja session; cuts include waiter deliveries), a real Caja post (charge flow, waiter-shift reception, session history home), and per-outlet Mostrador quick-sale.

## 2. Status

Approved (2026-07-18, product owner delegated approval this session)

## 3. Context

Phase F3 of master spec `2026-07-17-pos-role-based-rework-design.md`. F1 introduced payment-level money containers (`PosPayment.sessionId` XOR `waiterShiftId`); F2 shipped the mobile comandero. Discovery (2026-07-18) found three attribution defects left behind by the F1 transition, plus two structural gaps assigned to F3 by the F2 decision log:

1. `PaymentDialog` never sends `sessionId` → every terminal/caja charge falls to the waiter-shift fallback (the cashier silently accrues a personal shift) or 409s in outlets with `allowTableCharge = false`.
2. `closeSession` sums payments via `order: { sessionId }` (legacy order-level join) instead of `PosPayment.sessionId`.
3. `WAITER_DELIVERY` cash movements are excluded from `expectedCashAmount` (`movementTotal` only counts kinds `IN`/`OUT`), so received waiter cuts don't reconcile.
4. `PosSessionsScreen` (historial de cajas) has no navigation home since F1-B (decision log D1).
5. There is no UI to receive/close waiter shifts (`closeWaiterShift` API + SDK exist since F1, unused).
6. The terminal reads the deprecated GLOBAL `PosSettings.mode` (`isRetail`) instead of the per-outlet `PosOutlet.mode`.

## 4. Problem

Money taken at the caja is misattributed (wrong container), cuts don't add waiter deliveries, waiters cannot hand over their shift through any screen, session history is unreachable, and mostrador behavior cannot differ per outlet. The Caja post is still a bare wrapper.

## 5. Goals

1. Every payment initiated from the Caja context records `sessionId` = the terminal's open session; comandero payments keep the shift path. No silent fallback for cashiers.
2. `closeSession` computes `expectedCashAmount` from `PosPayment.sessionId` (cash methods) + movements IN − OUT + `WAITER_DELIVERY` deliveries.
3. Caja shows the outlet's OPEN waiter shifts and can receive them ("Recibir corte": monto entregado, notas) closing the shift against the current session.
4. `PosSessionsScreen` is reachable at `/pos/caja/historial` (sub-path passes the nav gate under `/pos/caja`).
5. `CajaScreen` uses the per-outlet `mode`: `RETAIL` outlets get the quick-sale flow (no tables/mesas concepts), `RESTAURANT` outlets keep table-aware charging; the deprecated global mode is no longer read by the terminal.

## 6. Non-goals

1. Kitchen anything (F4): station fallback, product↔station UI, KDS joins.
2. New schema/migrations — F3 is zero-migration.
3. Rebuilding the terminal UX from scratch — `CajaScreen` evolves `PosTerminalScreen` internals surgically.
4. Tips, CSV exports of cuts, multi-caja transfers (future).
5. Removing the deprecated global `PosSettings.mode` field/API (stop reading it in the terminal only; full removal later).

## 7. User stories

1. As a cajero, when I charge any order (full or split), the payment lands in MY open cash session, and my corte at close matches: fondo inicial + efectivo cobrado + entradas − salidas + cortes de meseros recibidos.
2. As a cajero, I see "Cortes de meseros" with each open shift (mesero, efectivo esperado), tap "Recibir corte", confirm the delivered amount, and the shift closes into my session.
3. As a cajero, I open "Historial" and see past sessions with their cuts and cash movements (existing screen, now reachable).
4. As a cajero de mostrador (outlet RETAIL), I sell without any table concept: products → charge → next; the comandero post stays hidden for that outlet's flow.
5. As a mesero, nothing changes: my charges still go to my shift (F2 behavior).

## 8. UX requirements

- Spanish labels: "Cortes de meseros", "Recibir corte", "Monto entregado", "Historial de cajas".
- `CajaScreen` header keeps the session chip ("Caja abierta · HH:mm" / "Cerrar caja") and gains two header actions: "Cortes" (badge with open-shift count) and "Historial".
- "Recibir corte" is a `Dialog` with the shift's `expectedCashAmount` shown, `Input` monto entregado (prefilled with expected), optional notas, and a difference preview when amounts differ; `ConfirmDialog` semantics not needed (non-destructive, reversible by accounting convention — force-close of orphan shifts stays a later concern per master spec edge 1).
- Mostrador (RETAIL): identical to today's `isRetail` terminal behavior, driven by outlet.
- All `@atlas/ui`; no native inputs.

## 9. Routes/screens

| Route | Screen | Change |
|---|---|---|
| `/pos/caja` | `CajaScreen` | becomes real: renders evolved `PosTerminalScreen` internals (outlet-mode aware, session-attributed payments) + `WaiterShiftsPanel` (Sheet) + Historial link |
| `/pos/caja/historial` | `PosSessionsScreen` (existing, 126 lines) | new sub-route registration (nav-gate passes under `/pos/caja`) |

## 10. Data model

None — zero-migration phase. Uses existing `PosSession`, `PosWaiterShift`, `PosPayment.sessionId`, `PosCashMovement.kind = "WAITER_DELIVERY"`.

## 11. Prisma impact

None.

## 12. API contract

Modified behavior only (no new endpoints):

- `POST /pos/orders/:id/payments`: unchanged contract; callers from Caja now include `sessionId` (F1 validator already accepts it).
- `POST /pos/sessions/:id/close` (`closeSession` service): payments queried by `{ sessionId }` on `PosPayment` (not `order.sessionId`); `expectedCashAmount` adds `WAITER_DELIVERY` movement totals as cash-in. Response shape unchanged.
- `GET /pos/waiter-shifts?status=OPEN&outletId=` (exists, F1): consumed by the new panel.
- `POST /pos/waiter-shifts/:id/close` (exists, F1): consumed by "Recibir corte".

## 13. SDK contract

No new methods (F1 shift methods + existing sessions/payments cover everything). `atlas.pos.addPayment` already passes arbitrary body fields.

## 14. Validator contract

None new. `createPaymentSchema` already accepts optional `sessionId`; `closeWaiterShiftSchema` exists.

## 15. Module manifest impact

None (routes nest under existing nav entries; permissions reuse `pos.caja.*` from F1).

## 16. Navigation impact

None in the manifest. In-screen links: Caja header → Historial (`/pos/caja/historial`).

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

Existing keys: panel + historial gated by `pos.caja.read`; receive cut by `pos.caja.close` (matches the F1 route guard on `waiter-shifts/:id/close`); charging by `pos.payments.create` (existing guard on payments). No changes.

## 19. Multi-company behavior

Unchanged; all queries stay company-scoped. Waiter-shift panel scopes by the session's `outletId`.

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A (cut export deferred, master spec future #4).

## 22. Audit log requirements

Existing audits suffice (`pos.waiterShift.close` from F1, `pos.session.close` existing). No new actions.

## 23. Edge cases

1. Caja charges while NO session is open: `PaymentDialog` in Caja context must not fall back silently — the Cobrar action is disabled without an open session (the terminal already gates operation on session; keep that gate authoritative) and the API 404s on a closed/foreign session.
2. Legacy payments (pre-F1 backfill) have `sessionId` populated by the F1 migration; sessions spanning the transition reconcile correctly under the new query. Sessions closed BEFORE this fix keep their stored (possibly lower) `expectedCashAmount` — historical rows are not recomputed.
3. A shift closed against session A while the cashier's open session is B: the dialog always uses the CURRENT open session of the terminal; if none is open, "Recibir corte" is disabled.
4. Delivered amount ≠ expected: allowed; difference is visible in the dialog preview and traceable via the shift row (`deliveredAmount` vs `expectedCashAmount`). No blocking.
5. Two cajas open in the same outlet: the panel lists the outlet's open shifts in both; first to receive wins; the second gets the F1 409 ("El corte ya fue cerrado.") surfaced as toast.
6. RETAIL outlet with `allowTableCharge = true` (nonsensical combo): mostrador flow ignores shifts; comandero remains permission-gated; no special handling.
7. Card (non-cash) payments: attributed to the session for traceability but excluded from `expectedCashAmount` (existing `cashPaymentTotal` behavior preserved).
8. `WAITER_DELIVERY` recorded with amount 0 (waiter had only card charges): movement exists for traceability, adds 0 to the cut.

## 24. Risks

1. **Touching closeSession math** — money report. Mitigation: TDD on `pos-session-service` covering the three sources (payments by sessionId, IN/OUT, WAITER_DELIVERY); existing tests keep passing.
2. **PaymentDialog is shared** by Caja and Comandero. Mitigation: optional `sessionId` prop threaded (absent → comandero path unchanged); SplitBillDialog gets the same optional prop passthrough.
3. **PosTerminalScreen evolution** could disturb the F2 comandero (it reuses PaymentDialog). Mitigation: comandero passes no sessionId; build + the F2 QA happy path re-run.

## 25. Acceptance criteria

1. Given an open session at Caja, when charging an order (full or "Dividir cuenta"), then the created `PosPayment` rows have `sessionId` = that session and `waiterShiftId` NULL.
2. Given a session with $500 opening, $128 cash charged at caja, one IN $50, one OUT $20, and a received waiter cut of $35, when closing with counted $693, then expected = 500+128+50−20+35 = $693 and difference = 0.
3. Given an open waiter shift with expected $35, when Caja taps "Recibir corte" and confirms $35, then the shift is CLOSED with `deliveredToSessionId` = current session and a `WAITER_DELIVERY` movement of $35 exists on it.
4. Given `/pos/caja/historial`, when opened by a user with `pos.caja.read`, then the sessions history renders (no "Acceso restringido").
5. Given an outlet with `mode = RETAIL`, when its terminal loads Caja, then no table/mesa UI appears and orders default to the retail flow — regardless of the global deprecated setting; a RESTAURANT outlet shows table-aware behavior.
6. Given the comandero (F2), when a waiter charges at the table, then the payment still lands in their waiter shift (no regression; re-run of the F2 QA pay step passes).

## 26. Verification plan

`node --test "apps/api/src/routes/pos/__tests__/*.test.js"` (session-service tests extended; expect 51+new, all green); `pnpm.cmd --filter @atlas/desktop build:web`; Playwright QA: desktop Caja flow (open session → charge order 15/whatever with sessionId visible in POST body → receive waiter cut → close session with expected math per criterion 2 → historial route renders) + mobile comandero pay step re-run (criterion 6).

## 27. Rollback plan

Zero migrations — pure `git revert` of the F3 commits restores prior behavior.

## 28. Future enhancements

1. Force-close of orphan waiter shifts from Caja (master spec edge 1) with difference recording.
2. Cut export (CSV/PDF) and X/Z reports.
3. Retire global `PosSettings.mode` (API + Admin General tab) once all outlets carry their own mode.
4. Multi-session concurrency guards per terminal (already one-per-terminal server-side).
