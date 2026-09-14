# Runly environment migration

Date: 2026-09-13
Status: Complete (local stage 3b)

## 1. Title

Runly environment names with Atlas compatibility (stage 3b).

## 2. Status

Complete locally; see implementation plan for evidence and rollout limits.

## 3. Context

Packages and visible branding already migrated.

## 4. Problem

A rename without fallbacks breaks installed configuration.

## 5. Goals

RUNLY_* and VITE_RUNLY_* inputs; legacy fallback; stable stored secrets and installer reruns.

## 6. Non-goals

No DB, auth, stored module keys, volumes, native app IDs, assets, publication or deployment changes. Existing storefront/native global contracts remain.

## 7. User stories

Existing installations work without editing env files; new installations document Runly.

## 8. UX

No layout changes.

## 9. Routes

Unchanged.

## 10. Data model

Unchanged.

## 11. Prisma

No migrations, seed or live queries.

## 12. API

Read RUNLY values before ATLAS; no HTTP header changes.

## 13. SDK

Browser runtime accepts new variables and legacy globals.

## 14. Validators

Retain existing validation/defaults. Explicit empty values never reuse an old value; API runtime rejects empty secrets and installer first-setup generation keeps its existing behavior.

## 15. Modules

Read new root/directory variables without renaming module keys.

## 16. Navigation

Unchanged.

## 17. Blueprints

Unchanged.

## 18. RBAC

No permission changes; internal-secret comparison keeps existing checks.

## 19. Tenancy

Unchanged.

## 20. Files

Only tracked templates/code; never read or rewrite real customer env files during development.

## 21. Import/export

Installer merges normalized sources: process overrides stored values; within each source Runly wins. Preserve legacy keys as needed for rollback.

## 22. Audit

Record verification in plan and TASKS.

## 23. Edge cases

Legacy-only/current-only/both/empty/false; installer reruns; same secret across toggle; nested Compose defaults; public config exposes only allowlisted values.

## 24. Risks

Accidental defaults overriding legacy settings; duplicate stale key values; process env versus file precedence; leaked server secrets.

## 25. Acceptance

Both scopes work; Runly wins conflicts; secrets and custom values survive preparation; builds pass.

## 26. Verification

Focused Node tests with synthetic files and mocked services; Compose config only if available; web build, lint and React Doctor; native input tests without native build.

## 27. Rollback

Restore only stage 3b tracked changes. Legacy names retained; no deployed state changed.

## 28. Future

Persistent keys/native identity migration, domain and publication, supplied assets.
