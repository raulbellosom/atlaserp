# Verification Checklist - Storefront Capture Foundation

Date: 2026-06-14
Feature: Storefront Capture Foundation
Spec: `docs/superpowers/specs/2026-06-14-storefront-capture-foundation-design.md`
Plan: `docs/superpowers/plans/2026-06-14-storefront-capture-foundation.md`

> This checklist distinguishes repository verification from deployment and
> production verification. Items are marked only when the recorded command or
> environment check actually ran.

## Build And Schema Checks

- [x] `pnpm.cmd exec prisma validate`
  - Result: exit 0; Prisma schema valid.
- [x] `pnpm.cmd db:generate`
  - Result: exit 0; Prisma Client generated.
- [x] `pnpm.cmd check:uuid-policy`
  - Result: exit 0.
- [x] `pnpm.cmd --filter @atlas/desktop build:web`
  - Result: exit 0; Vite transformed 4,936 modules.
- [x] `pnpm.cmd build`
  - Result: exit 0; web build, Rust release binary, MSI, and NSIS completed.
- [ ] `pnpm.cmd db:migrate` against the target environment
  - Result: not run; deployment approval and target database are outside this implementation session.
- [ ] `pnpm.cmd db:seed` against the target environment
  - Result: not run; must follow the target migration.

## Automated Contract Checks

- [x] Core schema, migration, official module, public API, IIFE, Website config,
  form capture, retention, and dist injection tests
  - Result: 58 passed, 0 failed.
- [x] `@raulbellosom/atlas-sdk` unit and React export tests
  - Result: 65 passed, 0 failed.
- [x] JavaScript syntax checks for IIFE, retention worker, and worker entrypoint
  - Result: exit 0.
- [x] React Doctor on files changed from `main`
  - Result: exit 0; diagnostics file was `[]`.
- [x] Permission catalog includes the new Growth permissions
  - Result: no Growth permission was missing. The repository-wide command still
    exits 1 for 30 pre-existing Calendar, Catalog, and Inventory catalog gaps.

## Behavioral Coverage

- [x] DNT and consent grant/deny behavior
  - Result: covered by SDK and capture service tests.
- [x] Origin checks, company/site isolation, payload limits, and rate limiting
  - Result: covered by route and service tests.
- [x] Honeypot, optional/required Turnstile outcomes, and idempotency
  - Result: covered by service and forms tests with mocked Turnstile responses.
- [x] Lead reuse by normalized email/phone and independent submission activity
  - Result: covered by service tests.
- [x] No raw IP or form values in analytics events
  - Result: covered by schema, validator, SDK, and IIFE tests.
- [x] Daily aggregation watermark and bounded 90-day/25-month purges
  - Result: covered by retention worker tests.
- [x] Builder, uploaded `dist`, React, and HTML/IIFE integration contracts
  - Result: covered by component build, dist injection tests, SDK tests, and fake-DOM IIFE tests.
- [ ] Live Builder and uploaded `dist` verification on public domains
  - Result: pending target deployment.
- [ ] Real Cloudflare Turnstile verification
  - Result: pending configured target site and credentials.
- [ ] Production-load observation up to the initial one-million-events/month target
  - Result: pending deployment and operational telemetry.

## Release Checks

- [ ] Publish `@raulbellosom/atlas-sdk` version `0.3.0`
  - Result: package version and API are implemented; registry publication was not run.
- [ ] Confirm migration, worker tick, aggregation, and retention in the target environment
  - Result: pending deployment.
- [ ] Obtain human approval before starting `growth-lead-inbox`
  - Result: pending; Spec B has not been started.

## Documentation Checks

- [x] Spec status records implementation with deployment verification pending.
- [x] Storefront SDK README documents v1 analytics, forms, and deprecation.
- [x] AI context documents the canonical Builder, `dist`, npm SDK, and IIFE contract.
- [x] `docs/TASKS.md` contains the phase and keeps operational work unchecked.

## Summary

Automated repository verification: PASS.

Deployment and production verification: PENDING.

Known unrelated repository issue: `pnpm.cmd rbac:verify-catalog` reports 30
pre-existing missing catalog entries in Calendar, Catalog, and Inventory. It
reports no missing Growth permissions.
