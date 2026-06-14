# Storefront Capture Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-limited first-party analytics, reliable public forms, and form-to-lead capture across Builder, uploaded `dist`, React, and plain HTML.

**Architecture:** `atlas.website` remains the owner of site and form configuration. The new official `atlas.growth` models own visitors, sessions, events, leads, activities, and daily metrics. Public routes live under the existing Storefront router; business logic remains in dedicated services. Raw data is aggregated and purged by the existing worker.

**Tech Stack:** Node.js, Hono, Prisma/PostgreSQL, Zod, React, `@atlas/ui`, Supabase Auth, Node `node:test`.

**Spec:** `docs/superpowers/specs/2026-06-14-storefront-capture-foundation-design.md`

---

## File Structure Map

### Create

- `prisma/migrations/20260614180000_add_storefront_capture_foundation/migration.sql`
- `apps/api/src/routes/storefront/storefront-capture-routes.js`
- `apps/api/src/routes/storefront/storefront-capture-validators.js`
- `apps/api/src/services/storefront-capture-service.js`
- `apps/api/src/services/growth-retention-worker.js`
- `apps/api/src/routes/storefront/__tests__/storefront-capture-routes.test.js`
- `apps/api/src/services/__tests__/storefront-capture-service.test.js`
- `apps/api/src/services/__tests__/growth-retention-worker.test.js`
- `packages/storefront-sdk/src/analytics.js`
- `packages/storefront-sdk/src/forms.js`
- `packages/storefront-sdk/src/react/useAnalytics.js`
- `packages/storefront-sdk/src/react/usePublicForm.js`
- `packages/storefront-sdk/src/__tests__/analytics.test.js`
- `packages/storefront-sdk/src/__tests__/forms.test.js`

### Modify

- `prisma/schema.prisma`
- `prisma/seed.js`
- `apps/api/src/manifests/official/feature-modules.js`
- `apps/api/src/manifests/official/core-modules.js`
- `apps/api/src/routes/storefront/storefront-router.js`
- `apps/api/src/routes/website/forms-public-routes.js`
- `apps/api/src/routes/website/validators.js`
- `apps/api/src/routes/website/website-service.js`
- `apps/api/src/services/dist-serve-service.js`
- `apps/api/src/public/atlas-sdk.js`
- `apps/api/src/index.js` (imports and router registration only)
- `apps/worker/src/index.js`
- `packages/storefront-sdk/src/index.js`
- `packages/storefront-sdk/src/core/request.js`
- `packages/storefront-sdk/src/react/index.js`
- `packages/storefront-sdk/package.json`
- `packages/storefront-sdk/README.md`
- `apps/desktop/src/website/atlasBlocks/contactFormBlock.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/FormFieldBuilder.jsx`
- `docs/ai-context/atlas-storefront-sdk.md`
- `docs/TASKS.md`

---

### Task 1: Prisma models and forward migration

**Files:** Prisma schema, migration, and seed.

- [ ] Write a schema contract test or migration SQL assertion covering all six Growth tables, Website columns, unique keys, company/site indexes, UUIDv7 defaults, and `ON DELETE` behavior.
- [ ] Run the test and confirm it fails because the models do not exist.
- [ ] Add the models and Website fields exactly as defined in Spec sections 10-11.
- [ ] Create a forward migration; do not edit existing migrations.
- [ ] Seed the complete Growth permission catalog.
- [ ] Run:

```bash
pnpm db:generate
node scripts/verify-permission-catalog.mjs
node scripts/enforce-uuid-policy.mjs
```

Expected: all commands exit 0.

- [ ] Commit:

```bash
git add prisma apps/api/src/manifests/official
git commit -m "feat(growth): add storefront capture data model"
```

### Task 2: Capture validators and service

**Files:** `storefront-capture-validators.js`, `storefront-capture-service.js`, service tests.

- [ ] Write failing tests for company/site resolution, origin rejection, DNT/consent, event property filtering, batch idempotency, client-clock normalization, form-field validation, honeypot, Turnstile-required failure, submission idempotency, open-lead reuse, and atomic submission/lead/activity creation.
- [ ] Run:

```bash
node --test apps/api/src/services/__tests__/storefront-capture-service.test.js
```

Expected: FAIL because the service is absent.

- [ ] Implement `createStorefrontCaptureService({ prisma, verifyTurnstile, now })`.
- [ ] Keep all service operations inside the factory closure.
- [ ] Use Prisma models because these are official core tables.
- [ ] Hash opaque visitor IDs with Node crypto before persistence; never store raw IP.
- [ ] Normalize email to lowercase and phone to digits/leading `+`.
- [ ] Make submission, lead reuse/create, and lead activity one Prisma transaction.
- [ ] Run the service tests and confirm all pass.
- [ ] Commit:

```bash
git add apps/api/src/routes/storefront/storefront-capture-validators.js apps/api/src/services/storefront-capture-service.js apps/api/src/services/__tests__/storefront-capture-service.test.js
git commit -m "feat(storefront): add capture and form submission service"
```

### Task 3: Public Storefront v1 routes and deprecated adapter

**Files:** Storefront router, capture routes, old public form route, API registration, route tests.

- [ ] Write failing route tests for the four v1 endpoints, body-size limit, 50-event limit, origin validation, `202`, `201`, idempotent `200`, `429`, and deprecation headers.
- [ ] Implement a bounded per-instance token-bucket limiter keyed by company/site/client address for events and forms separately.
- [ ] Mount capture routes from `storefront-router.js` at `/public/storefront/v1`.
- [ ] Change only import/router wiring in `apps/api/src/index.js`; keep route logic out of that file.
- [ ] Replace `forms-public-routes.js` internals with delegation to the new service and remove queries for nonexistent `notification_email`/`fields` columns.
- [ ] Run:

```bash
node --test apps/api/src/routes/storefront/__tests__/storefront-capture-routes.test.js
node --test apps/api/src/services/__tests__/storefront-capture-service.test.js
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add apps/api/src/routes/storefront apps/api/src/routes/website/forms-public-routes.js apps/api/src/index.js
git commit -m "feat(storefront): expose versioned capture endpoints"
```

### Task 4: Website configuration and injected public config

**Files:** Website validators/service/settings/forms and `dist-serve-service.js`.

- [ ] Write failing tests for `injectAtlasConfig` including `siteId`, analytics mode, Turnstile public key, and absence of the secret.
- [ ] Extend Website create/update contracts for site and form capture settings.
- [ ] Add semantic field selection to `FormFieldBuilder`.
- [ ] Add tracking mode and Turnstile controls to Website settings using `SelectField`, `TextField`, `SwitchField`, `PageHeader`, and proper error states.
- [ ] Add lead/assignee/antispam controls to Website forms; assignee options come from active company users.
- [ ] Run:

```bash
node --test apps/api/src/services/__tests__/dist-serve-service.test.js
pnpm --filter @atlas/desktop build:web
```

Expected: tests and build pass.

- [ ] Commit:

```bash
git add apps/api/src/routes/website apps/api/src/services/dist-serve-service.js apps/desktop/src/modules/atlas.website
git commit -m "feat(website): configure capture and lead-enabled forms"
```

### Task 5: Storefront SDK analytics and forms

**Files:** SDK namespaces, request core, React hooks, exports, tests, version.

- [ ] Write failing analytics tests for consent storage, DNT, 30-minute session rotation, queue bounds, automatic pageview, tagged `data-atlas-event`, batching, backoff, `sendBeacon`, flush, and stop.
- [ ] Write failing forms tests for definition fetch, submit headers, idempotency key, typed errors, and no analytics form-value leakage.
- [ ] Extend `createRequestCore` to accept response/body options required for `202` and custom headers without breaking auth retry.
- [ ] Implement `createAnalyticsNamespace` and `createFormsNamespace`.
- [ ] Add `siteId` to client options and return `{ analytics, forms }`.
- [ ] Implement `useAnalytics`, `usePageView`, and `usePublicForm`; export them from React entrypoint.
- [ ] Bump package version from `0.2.0` to `0.3.0`.
- [ ] Run:

```bash
node --test packages/storefront-sdk/src/__tests__/
```

Expected: all SDK tests pass.

- [ ] Commit:

```bash
git add packages/storefront-sdk
git commit -m "feat(sdk): add storefront analytics and public forms"
```

### Task 6: IIFE widget and Builder integration

**Files:** `atlas-sdk.js`, contact form block, relevant tests/docs.

- [ ] Add a Node test harness for IIFE analytics/form public surface using a minimal fake DOM/fetch/localStorage environment.
- [ ] Implement `window.AtlasERP.analytics` with the same consent and event semantics as the npm SDK.
- [ ] Implement `renderForm(target, { formId, onSuccess, onError, theme, labels })` with namespaced `_ae-` styles and accessible controls.
- [ ] Refactor `ContactFormBlock` to fetch and render the actual public form definition and submit through the v1 endpoint.
- [ ] Ensure Builder emits form lifecycle events without values.
- [ ] Run IIFE tests and:

```bash
pnpm --filter @atlas/desktop build:web
```

Expected: pass.

- [ ] Commit:

```bash
git add apps/api/src/public/atlas-sdk.js apps/desktop/src/website/atlasBlocks/contactFormBlock.jsx
git commit -m "feat(website): unify builder and embedded form capture"
```

### Task 7: Aggregation and retention worker

**Files:** Growth retention worker, worker entrypoint, tests.

- [ ] Write failing tests for idempotent daily aggregation, watermark behavior, 90-day raw-event purge, 25-month metric/session purge, and lead/submission preservation.
- [ ] Implement `createGrowthRetentionWorker({ prisma, now })` with small bounded batches.
- [ ] Register one startup tick and a configurable hourly interval in `apps/worker/src/index.js`.
- [ ] Run:

```bash
node --test apps/api/src/services/__tests__/growth-retention-worker.test.js
```

Expected: all tests pass.

- [ ] Commit:

```bash
git add apps/api/src/services/growth-retention-worker.js apps/api/src/services/__tests__/growth-retention-worker.test.js apps/worker/src/index.js
git commit -m "feat(growth): aggregate and retain capture data"
```

### Task 8: Documentation and full verification

- [ ] Update Storefront README and AI context with v1 endpoints, SDK contracts, consent examples, `data-atlas-event`, widget usage, and deprecated endpoint deadline.
- [ ] Add a TASKS phase entry without marking it complete.
- [ ] Run:

```bash
pnpm db:generate
node --test apps/api/src/services/__tests__/storefront-capture-service.test.js
node --test apps/api/src/routes/storefront/__tests__/storefront-capture-routes.test.js
node --test apps/api/src/services/__tests__/growth-retention-worker.test.js
node --test packages/storefront-sdk/src/__tests__/
pnpm --filter @atlas/desktop build:web
pnpm build
```

- [ ] Manually verify Builder, uploaded `dist`, React hooks, plain IIFE widget, DNT, consent grant/revoke, Turnstile-required failure, and multi-company isolation.
- [ ] Fill the verification checklist and record exact evidence in `docs/TASKS.md`.
- [ ] Commit documentation and evidence.

## Rollback Notes

- Before migration deployment: revert code and migration.
- After deployment: disable public capabilities and worker ticks, retain data, and use a new forward migration for schema rollback.
