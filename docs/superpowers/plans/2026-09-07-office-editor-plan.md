# Office editor implementation plan

Date: 2026-09-07
Spec: ../specs/2026-09-07-office-editor-design.md
Status: Proposed sequencing only; implementation not started.

The user's latest instruction is to prepare a proposal first. It supersedes the
attachment's automatic execution. Do not execute this plan until the user requests
implementation. Resolve the distribution/edition question before final packaging
without silently changing Atlas licensing or the preferred provider.

## 0. Review proposal and validate protocol before large changes

- Review the product decisions and delivery gates in the revised spec.
- After implementation is requested, start with a disposable-document experiment
  against a real provider artifact, before committing to the final persistence schema.
- Demonstrate two-user collaboration, force-save/final-save ordering, correlated
  save requests, delayed/replayed callbacks, reconnect and provider restart.
- Select one first attachment integration by tracing its actual parent ACLs.
- Record remaining uncertainty and use the experiment to size the implementation.
- Keep the provider boundary small; do not add a general editor plugin system.

## 1. Resolve edition and runtime artifact

- Establish internal use, compatible open distribution or commercial agreement.
- Verify Community 9.4.0 image tag, architecture and immutable digest against the
  official registry; record exact artifact and license notices in the spec.
- Verify server JWT/private-network configuration against that artifact.
- Keep mobile expectations consistent with edition capabilities.

## 2. Extract Files routes and centralize authorization

- Extract existing handlers from `apps/api/src/index.js` to
  `apps/api/src/routes/files/index.js`; preserve existing contracts.
- Add `apps/api/src/services/file-access-service.js` with company and parent
  relation authorization; delegate to owning services, fail closed on unknown types.
- Update `apps/api/src/services/files-service.js` and batch signed URLs to use it.
- Add Hono/service tests in `apps/api/src/services/__tests__/` for current Files
  behavior, tenant isolation and parent access. Review actual parent adapters
  before expanding Office beyond standalone AtlasFile.

## 3. Add format and content validation

- Add `packages/core/src/file-formats.js`, export from its existing entry point.
- Consume in API upload, `apps/desktop/src/modules/atlas.files/lib/file-kind.js`
  and shared attachment type resolution; preserve existing media display types.
- Add bounded OOXML validation in `apps/api/src/lib/office-content.js`.
- Admit PPTX and canonical MIME while retaining the 10 MiB limit.
- Test representative DOCX/XLSX/PPTX fixtures, malformed ZIP, MIME mismatches,
  expansion limits and unsupported legacy editing.

## 4. Durable generations, revisions and saves

- Extend core `prisma/schema.prisma` with revision/session/participant/receipt
  state described in the spec; generate a new forward migration using the
  project's Prisma workflow, with UUIDv7 defaults, constraints and RLS.
- Add `apps/api/src/services/file-revisions-service.js` and
  `office-session-service.js`; keep functions inside injected factory closures.
- Implement one active generation, immutable objects, durable receipts, CAS and
  recovery retention; integrate lifecycle/cleanup paths before enabling editing.
- Verify against PostgreSQL, including parallel opens, stale writes, crash windows
  and idempotent retries. Regenerate Prisma client.

## 5. Provider and API

- Add `apps/api/src/services/office-provider-service.js` for configuration, cached
  official health, signing and bounded allowlisted output fetches.
- Add `apps/api/src/routes/files/office.js` for authenticated session/status and
  separately authenticated content/callback endpoints.
- Add shared validators under `packages/validators/src/` following core contracts.
- Implement status 1/2/3/4/6/7, attribution, lease expiry and audit events.
- Test Hono requests plus service failure injection. Verify no callback can
  elevate a view participant or replace another generation's asset.

## 6. SDK and reusable editor

- Add SDK methods in `packages/sdk/src/index.js` and request-contract tests.
- Add `packages/ui/src/components/OfficeDocumentEditor.jsx` and necessary small
  loader/state helpers; export in `packages/ui/src/index.js`.
- Integrate in shared `AttachmentsPanel.jsx` without leaving the parent module.
- Add `apps/desktop/src/modules/atlas.files/screens/OfficeEditorScreen.jsx`, route
  registration in the existing module outlet, and explorer/detail actions.
- Preserve AdvancedFileViewer and PDFViewer; avoid increasing oversized files.
- Test extracted session state logic and manually test keyboard, lifecycle,
  unavailable service, view mode, desktop browser/PWA and Tauri. Run React Doctor.

## 7. Installer and proxy

- Add `infra/installer/lib/office-config.mjs` and tests in
  `infra/installer/__tests__/office-installer.test.js`.
- Update Compose with optional `office` and tested pin; no Atlas startup dependency.
- Update `setup-local.mjs`, `setup-external.mjs`, bootstrap local/external `.sh` and
  `.ps1` download lists, stop flows and environment example generation.
- Generate/persist the Office secret; validate the three distinct URL directions.
- Reuse managed Caddy for HTTPS coexistence with LiveKit, or emit an external
  reverse-proxy example. Verify WebSocket and callback routing.
- Test disabled defaults, reruns, local/external, Linux networking, quick setup,
  bootstrap completeness and existing installer tests.

## 8. Documentation and acceptance

- Update `.env.example`, `README.md`, `infra/installer/README.md`,
  `docs/01_erp_architecture.md`, `docs/03_core_modules.md`, and
  `docs/ai-context/ame3-runtime-capabilities.md` only when behavior exists.
- Add deployment/troubleshooting documentation with exact tested commands.
- Run affected node:test suites, `pnpm lint` and `pnpm build`; fix attributable
  failures and report pre-existing failures separately.
- Exercise real XLSX edit/save/close/reopen and two-user collaboration; confirm
  read-only and tenant rejection, then stop Docs and confirm ordinary Files works.
- Review diff, secrets, parent ACLs, storage recovery, callback replay and installer
  networking. Preserve pre-existing chat edits.
- Record commands/results and remaining external blockers before marking complete.

## Execution record

- Repository entry points and current official provider documentation inspected.
- Spec and phased plan written.
- No implementation, migrations, service deployment or runtime tests performed.
- Revised proposal distinguishes editor autosave from Atlas durability, identifies
  callback-ordering and revocation gaps, and makes attachment rollout incremental.
- Proposal discussion is the current task; runtime implementation is intentionally
  paused at the user's request, not blocked by missing technical-phase approval.
