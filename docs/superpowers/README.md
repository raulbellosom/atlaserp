# docs/superpowers

This directory contains all Spec-Driven Development (SDD) artifacts for Atlas ERP: feature specifications, implementation plans, deviation decision logs, and reusable templates.

## Methodology

All new features and modules follow the SDD workflow. Read the full methodology before starting any feature work:

- `docs/spec-driven-development.md` — workflow stages, 28 required spec sections, module checklist, permission conventions, and agent mode rules.

## Directory structure

```
specs/       — feature specifications        (YYYY-MM-DD-feature-name-design.md)
plans/       — implementation plans          (YYYY-MM-DD-feature-name.md)
decisions/   — deviation decision logs       (YYYY-MM-DD-feature-name-decision.md)
templates/   — reusable document templates
```

## Quick start for a new feature

1. Read `docs/spec-driven-development.md`.
2. Run discovery: read related architecture docs and existing specs.
3. Copy `templates/feature-spec-template.md` to `specs/YYYY-MM-DD-feature-name-design.md`.
4. Answer all 28 sections. "N/A" is acceptable but must be explicit.
5. Get human approval on the spec.
6. Copy `templates/implementation-plan-template.md` to `plans/YYYY-MM-DD-feature-name.md`.
7. Fill in the File Structure Map and task list with validation commands.
8. Get human approval on the plan.
9. Declare `Mode: IMPLEMENTATION` and begin coding.
10. On completion, run the verification checklist and update `docs/TASKS.md` with evidence.

If the implementation deviates from the spec, write a decision log using `templates/decision-log-template.md`.

## Existing specs and plans

| Date | Feature | Spec | Plan |
|---|---|---|---|
| 2026-05-02 | Atlas ERP Architecture | [spec](specs/2026-05-02-atlas-erp-architecture-design.md) | [plan](plans/2026-05-02-atlas-erp-phase-0-1.md) |
| 2026-05-03 | Phase 2 Initialization State | — | [plan](plans/2026-05-03-phase2-initialization-state.md) |
| 2026-05-03 | Phase 3 Setup Wizard | [spec](specs/2026-05-03-phase3-setup-wizard-design.md) | [plan](plans/2026-05-03-phase3-setup-wizard.md) |
| 2026-05-03 | Phase 4 Auth | [spec](specs/2026-05-03-phase4-auth-design.md) | [plan](plans/2026-05-03-phase4-auth.md) |
| 2026-05-04 | Phase 5 Shell / Module Registry | [spec](specs/2026-05-04-phase5-shell-module-registry-design.md) | [plan](plans/2026-05-04-phase5-shell-module-registry.md) |
| 2026-05-04 | Phase 7 Files Module | [spec](specs/2026-05-04-phase7-files-module-design.md) | [plan](plans/2026-05-04-phase7-files-module.md) |
| 2026-05-04 | Phase 7 Files Advanced UX | [spec](specs/2026-05-04-phase7-files-module-advanced-ux-design.md) | [plan](plans/2026-05-04-phase7-files-module-advanced-ux.md) |
| 2026-05-04 | Phase 8 Finance | [spec](specs/2026-05-04-phase8-finance-design.md) | [plan](plans/2026-05-04-phase8-finance.md) |
| 2026-05-04 | Phase 8.4 Finance Expansion | [spec](specs/2026-05-04-phase8-4-finance-expansion-design.md) | [plan](plans/2026-05-04-phase8-4-finance-expansion.md) |
| 2026-05-05 | Phase 8.4-B Finance Reversal | [spec](specs/2026-05-05-phase8-4-b-finance-application-reversal-design.md) | [plan](plans/2026-05-05-phase8-4-b-finance-application-reversal.md) |
| 2026-05-05 | Phase 8.5 Finance Taxes | [spec](specs/2026-05-05-phase8-5-finance-taxes-withholdings-design.md) | [plan](plans/2026-05-05-phase8-5-finance-taxes-withholdings.md) |
| 2026-05-05 | Phase 8.6 Finance Operations UX | [spec](specs/2026-05-05-phase8-6-finance-operations-ux-design.md) | [plan](plans/2026-05-05-phase8-6-finance-operations-ux.md) |
| 2026-05-05 | Phase 9 HR | [spec](specs/2026-05-05-phase9-hr-design.md) | [plan](plans/2026-05-05-phase9-hr.md) |
| 2026-05-05 | Phase 9 HR v2 Org Chart | [spec](specs/2026-05-05-phase9-hr-v2-orgchart-design.md) | [plan](plans/2026-05-05-phase9-hr-v2-orgchart.md) |
| 2026-05-08 | RBAC Granular Phase 2 | [spec](specs/2026-05-08-rbac-granular-phase2-design.md) | [plan](plans/2026-05-08-rbac-granular-phase2.md) |
| 2026-05-08 | SDD Methodology | [spec](specs/2026-05-08-spec-driven-development-design.md) | — |
| 2026-05-09 | atlas.ledger — Cuentas y Movimientos | [spec](specs/2026-05-09-atlas-ledger-design.md) | — |
