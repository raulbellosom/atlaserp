# Atlas Notifications - Master Implementation Plan

Date: 2026-06-01
Spec: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Status: Draft

> **For agentic workers:** Mode: IMPLEMENTATION. Execute one part at a time. Do not start the next part until the current part validation gate passes and user approves.

## Goal

Deliver `atlas.notifications` as a core module with strict separation from `atlas.activity`, starting with in-app notifications and scaling to email + web push in controlled phases.

## Architecture summary

The implementation is split into four sequential parts to reduce risk and keep each increment testable: backend foundation, inbox UI, module integration + email delivery, and web push. `activity` remains a broad audit/feed layer; `notifications` is actionable and policy-driven.

---

## Part Breakdown

1. Part A: Backend foundation (schema, API, SDK, permissions, tests).
2. Part B: Desktop inbox UX + topbar bell integration.
3. Part C: Core/custom publish integration + email channel worker flow.
4. Part D: Web push subscriptions + service worker + push delivery.

---

## Execution Order

1. Execute Part A plan: `docs/superpowers/plans/2026-06-01-atlas-notifications-core-part-a-foundation.md`
2. Execute Part B plan: `docs/superpowers/plans/2026-06-01-atlas-notifications-core-part-b-inbox-ui.md`
3. Execute Part C plan: `docs/superpowers/plans/2026-06-01-atlas-notifications-core-part-c-module-integration-email.md`
4. Execute Part D plan: `docs/superpowers/plans/2026-06-01-atlas-notifications-core-part-d-web-push.md`

---

## Stage Gates

Before moving between parts:

- [ ] All validation commands in current part executed and passed.
- [ ] API/UX smoke checks completed for current part scope.
- [ ] No blocking regression in existing modules (calendar/activity/core).
- [ ] User approval to continue to next part.

---

## Rollback Notes

1. If rollback is needed before migrations are applied: revert files only.
2. If rollback is needed after schema migrations: create a forward rollback migration, do not edit applied migrations.
3. If rollback is needed after API rollout: keep routes disabled by permission/manifest while data is preserved.

---

## Verification Gate

Before marking full feature complete:

- [ ] Part A, B, C, D gates all passed.
- [ ] Notification taxonomy behavior validated (activity-only vs notification-eligible).
- [ ] RBAC boundaries validated (`notifications.read`, `notifications.publish`).
- [ ] `docs/TASKS.md` updated with final verification entry.

