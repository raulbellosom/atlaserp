# Phase 8.6 - Finance Operations UX Plan

Date: 2026-05-05
Spec: `docs/superpowers/specs/2026-05-05-phase8-6-finance-operations-ux-design.md`

## Objective

Deliver operational AR/AP usability improvements without introducing accounting complexity.

## Tasks

1. Add helper functions in Finance UI for operational status:
- detect overdue
- map display labels

2. Add AR/AP local filters by operational status:
- all, overdue, open, partial, paid, void

3. Update AR/AP status badges:
- show `Vencido` as destructive badge

4. Add quick action `Recordatorio` for enabled docs with open balance.

5. Run verification:
- desktop build
- smoke navigation in AR/AP sections

## Verification

- `pnpm.cmd --filter ./apps/desktop build:web`
