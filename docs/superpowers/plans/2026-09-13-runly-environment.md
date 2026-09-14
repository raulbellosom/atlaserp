# Runly environment migration

Date: 2026-09-13
Status: Complete (local stage 3b)
Mode: IMPLEMENTATION
Authorization: user requested continuing.
Spec: `docs/superpowers/specs/2026-09-13-runly-environment-design.md`

## File Structure Map

- `apps/desktop/scripts/native-firebase.test.mjs`

- `infra/installer/bootstrap-local.ps1`
- `infra/installer/bootstrap-external.ps1`

- `.env.example`
- `README.md`
- `apps/api/src/index.js`
- `apps/api/src/routes/calendar/calendar-routes.js`
- `apps/api/src/routes/calendar/google/google-calendar-import-recovery-service.js`
- `apps/api/src/services/__tests__/runly-env.test.js`
- `apps/api/src/services/dist-serve-service.js`
- `apps/api/src/services/email-templates.js`
- `apps/api/src/services/files/workspace.js`
- `apps/api/src/services/module-root-resolver.js`
- `apps/api/src/services/notification-delivery-worker.js`
- `apps/api/src/services/office/config.js`
- `apps/api/src/services/storefront-capture-service.js`
- `apps/api/src/services/sync-cleanup-worker.js`
- `apps/desktop/native-host/.env.example`
- `apps/desktop/public/runtime-config.js`
- `apps/desktop/scripts/native-firebase.mjs`
- `apps/desktop/scripts/native-host.mjs`
- `apps/desktop/scripts/publish-release.mjs`
- `apps/desktop/src-tauri/build.rs`
- `apps/desktop/src-tauri/src/mobile_host.rs`
- `apps/desktop/src/lib/__tests__/runtimeConfig.test.js`
- `apps/desktop/src/lib/appConfig.js`
- `apps/desktop/src/lib/runtimeConfig.js`
- `apps/desktop/src/lib/supabase.js`
- `apps/desktop/vite.config.js`
- `apps/worker/src/index.js`
- `docs/TASKS.md`
- `docs/ai-context/ame3-runtime-capabilities.md`
- `infra/docker/web.Dockerfile`
- `infra/installer/.env.external.example`
- `infra/installer/.env.local.example`
- `infra/installer/README.md`
- `infra/installer/bootstrap-external.sh`
- `infra/installer/bootstrap-local.sh`
- `infra/installer/docker-compose.yml`
- `infra/installer/lib/devkit-installer.mjs`
- `infra/installer/lib/env-compat.mjs`
- `infra/installer/lib/env-compat.test.mjs`
- `infra/installer/lib/firebase-config.mjs`
- `infra/installer/lib/office-config.mjs`
- `infra/installer/setup-external.mjs`
- `infra/installer/setup-local.mjs`
- `infra/nginx/web-entrypoint.sh`
- `packages/core/src/time.js`
- `scripts/__tests__/runly-env-config.test.js`
- `scripts/smoke-fleet-relational.mjs`
- `scripts/start-office-dev.mjs`
- Regenerate tracked `infra/installer/devkit-export/` from the authoring docs.

## Tasks

- [x] Runtime and browser fallbacks.
- [x] Installer normalization and preservation of values/secrets.
- [x] Compose, bootstrap and examples.
- [x] Focused tests, web build, lint, React Doctor and record evidence.

## Evidence

Verified locally on 2026-09-13:

- 88 distinct focused tests passed: 59 API/Office/module roots/email/time zone/browser configuration/native Firebase/installer helper/Dev Kit tests; 28 Compose/bootstrap/installer contract tests; 1 additional Vite build-time compatibility test. No skipped tests in those runs. Subsequent targeted reruns passed after final edits.
- Compose v5.1.4 validated local/external configurations with synthetic env files, Office enabled/disabled and Linux networking. Legacy image overrides remain accepted; Runly wins conflicting image/API-URL settings. Project/service/container identities remain unchanged. No containers started or stopped by these checks.
- Tested shell runtime-config rendering for legacy/current/conflicting/empty API URLs and verified that private environment values never enter the public config. Both runtime globals reference the same allowlisted object.
- Office configuration migrates managed assignments to canonical names, retaining a stable secret across reruns and legacy/current process overrides. Local regeneration preserves known and custom saved Runly/Atlas settings; only refreshed Supabase credentials retain their existing regeneration flow. The explicit public Supabase override is now saved for subsequent runs.
- `pnpm.cmd --filter @runly/desktop build:web` passed with existing large-chunk warnings. Vite env substitution tested separately for both names and canonical priority.
- Scoped ESLint checked 34 JavaScript/MJS files with zero errors; final changed-script checks also passed. `node --check` passed for both installers; `rustfmt --check apps/desktop/src-tauri/build.rs` and `git diff --check` passed.
- React Doctor: 357 files, 48/100, same 58 existing warnings as stage 3a (53 complexity, 1 duplicate JSX, 4 transition-all). No component/layout refactor in this stage.
- Regenerated the versioned Dev Kit export; exporter, snapshot and authoring-document contract tests passed.

Implementation notes: ordinary runtime readers use nullish Runly-first fallback and retain their existing defaults/validation. Installer sources normalize each spelling before merging, so process overrides beat stored values. Explicit empty values do not fall back to legacy values. Office's pre-existing first-setup secret generation remains; API runtime rejects an empty secret. Native build inputs accept new names while compiled metadata, app IDs and native globals keep existing contracts.

Compose fallback syntax verified against https://docs.docker.com/reference/compose-file/interpolation/ (nested defaults; absence versus empty semantics).

Limits: no actual installer execution, live DB query/migration/seed, customer env rewrite, native build, image build/push, npm publication or deployment. New canonical generated configuration requires compatible Runly images; legacy-only images may not understand it. Before a deployment, retain backups of the installation's env files for rollback. This local change needs no data rollback. Stage 4 (persistent module keys) and later stages remain pending.
