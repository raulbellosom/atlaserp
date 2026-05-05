# Atlas ERP - Next Steps

## Current milestone

- Phase 5.5 stabilized: shell/module lifecycle behaviors are in place.
- Phase 6 complete (Contacts v1): blueprint-driven contacts UI + contacts service layer + contact picker API/UI.
- Phase 7 complete (Files v1): files service + signed URL delivery + files module UX + branding integration on shared file pipeline.
- Phase 7.1 complete (Files advanced UX): explorer multi-view, advanced viewer, origin navigation, rename, and bulk downloads.

## Next implementation cycle

### Phase 8.1 - Accounting core (double-entry)
- Company-scoped chart of accounts CRUD.
- Journal entry CRUD with balanced debit/credit lines.
- Guided capture flow plus advanced journal editor.
- Base account and consolidated balance derivation.

### Phase 8.2 - Full multi-currency
- Manual historical FX table (date + currency pair).
- Conversion traceability per journal line/transaction.
- Multi-currency balance visualization.

### Phase 8.3 - Financial analytics dashboard
- Operational and analytical widgets over active company data.
- Period trends and variance summaries.
- Optional relation against contacts through existing picker surface when module is installed.

### Phase 9 - Hardening and automation
- Add automated contract tests for module lifecycle, contacts, and files endpoints.
- Add UI regression smoke coverage for install/enable/disable/uninstall and files preview/download flows.
- Continue service-layer extraction for remaining API domains.

## Technical debt / hardening queue
- Incrementally move additional API domains to service-layer structure.
- Add automated regression checks for module lifecycle and contacts flows.
- Continue reconciling legacy docs that still describe pre-Phase-5 architecture.

## Documentation policy
- Mark checklist tasks as complete only with explicit verification evidence and concrete verification dates.
- Phase 8 design and execution references:
  - `docs/superpowers/specs/2026-05-04-phase8-finance-design.md`
  - `docs/superpowers/plans/2026-05-04-phase8-finance.md`
