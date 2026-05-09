# Verification Checklist — [Feature Name]

Date: YYYY-MM-DD
Feature: [feature name]
Spec: docs/superpowers/specs/YYYY-MM-DD-feature-name-design.md
Plan: docs/superpowers/plans/YYYY-MM-DD-feature-name.md

> Run each check and record the actual result. Do not mark items complete by assumption.
> This checklist becomes the verification evidence for `docs/TASKS.md`.

---

## Build checks

- [ ] `pnpm build` exits 0 with no errors
  - Result: `[paste output or "exit 0"]`

- [ ] `pnpm db:generate` exits 0 — Prisma client regenerated cleanly
  - Result: `[paste output or "exit 0"]`

- [ ] `pnpm db:migrate` exits 0 — migration applied without errors
  - Result: `[paste output or "exit 0"]`

- [ ] `pnpm db:seed` exits 0 — new permissions and module seeded
  - Result: `[paste output or "exit 0"]`

---

## Functional checks

- [ ] `GET /health` returns 200 after changes
  - Result: `[200 OK / error]`

- [ ] Authenticated `GET /module/resource` returns 200 and a valid data array
  - Result: `[200 OK / error]`

- [ ] Authenticated `POST /module/resource` with valid body returns 201 and the created resource
  - Result: `[201 / error]`

- [ ] Authenticated `PUT /module/resource/:id` with valid body returns 200 and the updated resource
  - Result: `[200 / error]`

- [ ] Authenticated `PATCH /module/resource/:id/enabled` with `{ enabled: false }` returns 200
  - Result: `[200 / error]`

<!-- Add or remove endpoint checks to match the spec's API contract. -->

---

## Permission / RBAC checks

- [ ] A user WITHOUT `module.access` receives 403 on all module endpoints
  - Result: `[403 / error]`

- [ ] A user WITH `module.access` but WITHOUT `module.feature.read` receives 403 on GET endpoints
  - Result: `[403 / error]`

- [ ] A user WITH `module.feature.read` but WITHOUT `module.feature.create` receives 403 on POST
  - Result: `[403 / error]`

- [ ] Admin user with all permissions can perform full CRUD cycle without errors
  - Result: `[pass / error]`

- [ ] Navigation item for this module is visible to users with `module.feature.read`
  - Result: `[visible / not visible / error]`

- [ ] Navigation item is NOT visible to users without `module.feature.read`
  - Result: `[not visible / error]`

<!-- Add permission checks for any non-CRUD actions declared in the spec. -->

---

## Documentation checks

- [ ] Spec status updated to `Complete` (or `In Progress` if this is a partial phase)
- [ ] `docs/TASKS.md` has a new phase entry for this feature
- [ ] `docs/TASKS.md` entry is marked `[x]` only for tasks confirmed by this checklist
- [ ] `Verified: YYYY-MM-DD (commands/checks executed)` line added under the phase in TASKS.md

---

## Summary

Verification completed: YYYY-MM-DD

Commands executed:

```
pnpm build
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Outcome: [PASS / FAIL — describe any failures and actions taken]
