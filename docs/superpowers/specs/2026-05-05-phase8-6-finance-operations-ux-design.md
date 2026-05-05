# Phase 8.6 - Finance Operations UX (AR/AP daily workflow)

Date: 2026-05-05

## Goal

Improve day-to-day AR/AP operations with low-complexity, high-impact UX additions.

## Scope

1. Operational status layer for AR/AP documents with overdue detection.
2. Fast filtering by operational status on CxC and CxP lists.
3. Quick follow-up action (reminder marker) directly from row actions.
4. Keep backend contracts unchanged for this iteration (UI-first operational polish).

## Implemented in this cycle

1. Added derived status `OVERDUE` based on `dueDate`, `openAmount`, and active state.
2. Added status labels in Spanish (`Abierto`, `Parcial`, `Pagado`, `Anulado`, `Vencido`).
3. Added status filters in:
- `/finance/ar`
- `/finance/ap`
4. Added quick action `Recordatorio` in AR/AP row action menu for open balances.

## Next step (8.6-B)

1. Persist reminders as notifications (API-backed), instead of UI toast-only markers.
2. Add due-today and due-this-week filters.
3. Optional bulk reminder action by visible rows.
