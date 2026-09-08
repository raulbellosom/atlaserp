# Collabora implementation validation — 2026-09-07

Implementation and deployment details: [Office operations](office-collabora.md).

## Evidence

- `pnpm db:generate` passed with Prisma 7.8.
- Applied the pre-change schema plus the actual Office migration to a disposable PostgreSQL 18 container. The configured Supabase database was not used.
- 25 affected tests passed, including actual PostgreSQL tests with two independently constructed services, lease visibility/restart/expiry, protected lifecycle changes, concurrent pointer swaps and preservation of previous bytes. The other tests cover token tampering/expiry, permissions/revocation/tenant isolation, read/edit/auto mode, native origin binding, HTTP protocol responses, discovery cache, invalid archives, failed Storage writes, SDK offline queue exclusion and message origin validation.
- Docker Compose validated all eight combinations of local/external, Office enabled/disabled, base/Linux override, using isolated dummy env files. Installer env tests verified secret preservation, disabling/re-enabling and avoiding secret exposure through Compose interpolation.
- Pulled and ran `collabora/code:26.04.2.4.1`; discovery responded, native image healthcheck worked, and the new `content_security_policy` environment configuration successfully embedded the editor.
- Used the actual shared React editor and SDK with CODE in headless Microsoft Edge. Opened an ExcelJS-generated XLSX, changed A1, clicked Atlas's back/save action, observed real WOPI LOCK/PUT/UNLOCK with 200 responses and a successful `Action_Save_Resp`; the stored workbook contained the change and its previous version remained available.
- Two separate browser contexts with distinct server-side user IDs shared the same WOPISrc and received the same live cell update. Reopened in read-only mode and visually confirmed the changed cell. CODE showed `Solo lectura`.
- Android/Pixel 7 emulation displayed the touch viewer inside a 412 x 795 CSS-pixel iframe without horizontal host overflow. This is browser emulation, not an Android device certification.
- Stopped CODE and downloaded the current XLSX through the authenticated Office download endpoint: HTTP 200, 6590 bytes. This confirms the download path has no dependency on a running editor.
- `pnpm lint` passed. `pnpm build` passed including Vite, Rust compilation, MSI and NSIS Windows installers. Vite reports existing large-chunk warnings. A final web build also passed after the dependency lockfile was narrowed to the two new direct dependencies and their transitive packages.
- React Doctor was run with `--diff`, then correctly scoped to `--scope changed --base HEAD --include-untracked`. The initial scan detected an unsafe minimum XML-parser version constraint; the minimum was raised to the verified installed `5.11.1` (archive reader minimum `3.4.0`). Final result: no errors, one complexity warning on the existing FilesScreen, score 72/100.
- `git diff --check` passed. No production secrets, generated session tokens or runtime artifacts were added to tracked files. Existing dependency versions were retained; `pnpm install --frozen-lockfile` passed.

## Boundaries of these results

Deployment follow-up: both installers now target Atlas/Calls explicitly for their existing forced restart and start Collabora separately without `--force-recreate`. The 22 installer tests passed, including the eight Compose profile/platform combinations and persisted Office settings. The VPS guide now separates image publication, bootstrap refresh, initial DNS/TLS configuration and subsequent updates. This follow-up was checked locally; it has not been deployed to a VPS.

Browser tests used actual CODE and the actual shared editor/SDK/WOPI service, with an isolated in-memory fixture implementing Prisma/Storage contracts. PostgreSQL was tested separately against the actual database engine/migration. No authenticated end-to-end test against live Supabase Auth/Storage or the complete installed Atlas shell was performed. The unchanged Supabase storage client calls are exercised through injected fixtures.

DOCX/XLSX/PPTX structure validation has automated coverage; the full browser editing/collaboration test used XLSX. Complex Word/PowerPoint fidelity, production fonts, heavy spreadsheets, load limits, real iOS Safari, real Android, installed PWA and the native Tauri WebView still need deployment acceptance. Tauri binaries were built, but their embedded editor was not interactively tested. Future mobile WebViews are not certified by these checks.

## Change map

| Area | Files |
|---|---|
| Protocol/provider/security | `apps/api/src/services/office/{config,tokens,discovery,access,validate-document,service,errors}.js`, `apps/api/src/routes/office.js` |
| Existing Files integration | Extracted `apps/api/src/routes/files.js`, API entry mounts, `services/files-service.js` |
| Database | `prisma/schema.prisma`, `prisma/migrations/20260907180000_office_wopi/migration.sql` |
| Shared contract/API | `packages/core/src/office-formats.js`, core exports, SDK files methods and online-only option |
| Editor/UI | Shared `OfficeDocumentEditor`, Office attachment action/context/message validation, `AttachmentsPanel`, desktop `OfficeProvider`, `OfficeEditorScreen`, FilesScreen/detail and route mapping |
| Installer | Compose base/Linux, local/external setup and stop scripts, four bootstraps, `lib/office-config.mjs`, environment examples |
| Documentation/tests | Collabora spec/plan, deployment/validation guides, README/core architecture references, API/SDK/UI/installer tests |

To deploy, build/publish API and web images containing these changes, apply the migration through the normal installer flow and enable/configure Office as documented. Older published Atlas images will not gain this integration merely by starting CODE.
