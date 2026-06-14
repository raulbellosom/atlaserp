# Growth Lead Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure Growth lead inbox with qualification, ownership, notes, notifications, attachments, and transactional conversion to Contacts.

**Architecture:** A dedicated Hono router/service owns Growth lead operations and uses the models created by Storefront Capture Foundation. Official React screens consume a new internal SDK domain. Contact conversion remains explicit and checks both Growth and Contacts permissions.

**Tech Stack:** Hono, Prisma, Zod, React Query, `@atlas/ui`, `@atlas/sdk`, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-14-growth-lead-inbox-design.md`

---

## File Structure Map

### Create

- `apps/api/src/routes/growth/growth-router.js`
- `apps/api/src/routes/growth/growth-lead-routes.js`
- `apps/api/src/routes/growth/growth-lead-service.js`
- `apps/api/src/routes/growth/growth-validators.js`
- `apps/api/src/routes/growth/__tests__/growth-lead-service.test.js`
- `apps/api/src/routes/growth/__tests__/growth-lead-routes.test.js`
- `packages/sdk/src/domains/website.js`
- `packages/sdk/src/domains/growth.js`
- `packages/sdk/src/__tests__/growth-domain.test.js`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadsScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/components/LeadStatusBadge.jsx`
- `apps/desktop/src/modules/atlas.growth/components/LeadActivityTimeline.jsx`

### Modify

- `apps/api/src/index.js` (router import/registration only)
- `apps/api/src/manifests/official/feature-modules.js`
- `apps/api/src/services/files-service.js`
- `packages/validators/src/index.js`
- `packages/sdk/src/index.js`
- `apps/desktop/src/app/ModuleOutlet.jsx`
- `docs/TASKS.md`

---

### Task 1: Extract internal Website SDK domain

- [ ] Write a contract test proving `atlas.website` retains its current methods after extraction.
- [ ] Create `packages/sdk/src/domains/website.js` as a factory receiving the shared request helpers.
- [ ] Replace the inline Website object in `packages/sdk/src/index.js` with the factory.
- [ ] Run existing SDK tests and the new contract test.
- [ ] Commit `refactor(sdk): extract website domain`.

### Task 2: Growth service state machine

- [ ] Write failing tests for list scoping, filters, manual creation, allowed transitions, converted terminal state, discarded reopen, optimistic update conflict, assignee membership, note activity, and disabled records.
- [ ] Implement validators with exact status/priority enums.
- [ ] Implement `createGrowthLeadService({ prisma, notificationService })`; keep service functions in the factory.
- [ ] Publish `growth.lead.created` notifications to the assignee using existing notification preferences.
- [ ] Run:

```bash
node --test apps/api/src/routes/growth/__tests__/growth-lead-service.test.js
```

- [ ] Commit `feat(growth): add lead qualification service`.

### Task 3: Transactional Contact conversion

- [ ] Add failing tests for linking an existing Contact, creating a Contact, duplicate concurrent conversion, cross-company rejection, missing Contacts permission, and rollback.
- [ ] Implement conversion in one Prisma transaction.
- [ ] Require `growth.leads.convert` plus `contacts.contacts.read` or `contacts.contacts.create` according to mode.
- [ ] Write `GrowthLeadActivity` and `AuditLog` after the Contact mutation inside the transaction.
- [ ] Run service tests.
- [ ] Commit `feat(growth): convert leads to contacts`.

### Task 4: Growth routes and RBAC

- [ ] Write route tests proving fail-closed permission behavior for every endpoint.
- [ ] Implement thin routes with Zod validation and consistent `{ data }`/`{ error }` responses.
- [ ] Register `growthRouter` from `apps/api/src/index.js` without placing business logic there.
- [ ] Update manifest ACL/navigation and permission seed.
- [ ] Run:

```bash
node --test apps/api/src/routes/growth/__tests__/growth-lead-routes.test.js
node scripts/verify-permission-catalog.mjs
```

- [ ] Commit `feat(growth): expose protected lead API`.

### Task 5: Internal Growth SDK domain

- [ ] Write failing request-shape tests for all Growth methods.
- [ ] Implement `packages/sdk/src/domains/growth.js`.
- [ ] Export `atlas.growth` from the SDK client while reducing `index.js` size.
- [ ] Run all internal SDK tests.
- [ ] Commit `feat(sdk): add growth lead domain`.

### Task 6: Lead inbox screen

- [ ] Build `GrowthLeadsScreen` with `PageHeader`, four `StatCard`s, `FilterBar`, `SearchInput`, `DataTable`, pagination, loading, empty, and error states.
- [ ] Gate create, assign, update, delete, and convert UI actions by permissions.
- [ ] Add route imports to `ModuleOutlet`.
- [ ] Run desktop build and React Doctor.
- [ ] Commit `feat(growth): add lead inbox`.

### Task 7: Lead detail, timeline, conversion, and attachments

- [ ] Build detail cards for identity, attribution, ownership, and related submissions.
- [ ] Add `LeadActivityTimeline`, note form, status/priority/assignee controls, and `ContactPicker`.
- [ ] Add conversion dialog supporting existing/new Contact.
- [ ] Add `AttachmentsPanel` with `entityType=GrowthLead`.
- [ ] Add `GrowthLead` to files allowlist and test file scoping.
- [ ] Run desktop build, React Doctor, and API tests.
- [ ] Commit `feat(growth): add lead detail and conversion workflow`.

### Task 8: Verification

- [ ] Run:

```bash
node --test apps/api/src/routes/growth/__tests__/
node --test packages/sdk/src/__tests__/growth-domain.test.js
pnpm --filter @atlas/desktop build:web
pnpm build
```

- [ ] Manually verify responsive inbox/detail, every RBAC boundary, reopen, disable/enable, notification delivery, both conversion modes, and rollback.
- [ ] Fill verification checklist and record evidence in TASKS.

## Rollback Notes

Remove Growth navigation and route registration while preserving captured lead data. Any schema correction uses a new forward migration.

