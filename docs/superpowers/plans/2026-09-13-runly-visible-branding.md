# Runly - marca visible

Date: 2026-09-13
Spec: `docs/superpowers/specs/2026-09-13-runly-visible-branding-design.md`
Status: Complete (local implementation; deployment pending)
Mode: IMPLEMENTATION
Authorization: user requested continuing with the visible-branding stage after the distribution delivery.

## Goal

Replace product-owned display text with Runly while preserving customer names, existing assets and technical identities.

## Architecture summary

Update human-readable literals in existing components, templates and defaults. Preserve package names, exports, globals, URLs, headers, role/module keys, native identifiers and styling. Hash the emitted PWA manifest body for its ETag so returning clients receive the new brand without changing their installed app identity.

## File Structure Map

Create:

- `docs/superpowers/specs/2026-09-13-runly-visible-branding-design.md`
- `docs/superpowers/plans/2026-09-13-runly-visible-branding.md`

Modify:

- `.env.example`
- `apps/api/src/index.js`
- `apps/api/src/manifests/official/core-modules.js`
- `apps/api/src/manifests/official/feature-modules.js`
- `apps/api/src/permission-catalog.js`
- `apps/api/src/routes/__tests__/pwa.test.js`
- `apps/api/src/routes/chat/chat-moderation-service.js`
- `apps/api/src/routes/chat/meridian-service.js`
- `apps/api/src/routes/chat/meridian-tools.js`
- `apps/api/src/routes/documents/document-renderer.js`
- `apps/api/src/routes/fleet/__tests__/pdf-branding.test.js`
- `apps/api/src/routes/fleet/fleet-export-service.js`
- `apps/api/src/routes/fleet/report-pdf.js`
- `apps/api/src/routes/fleet/vehicle-pdf.js`
- `apps/api/src/routes/ledger/export-service.js`
- `apps/api/src/routes/pfm/assistant-service.js`
- `apps/api/src/routes/pwa.js`
- `apps/api/src/routes/settings-routes.js`
- `apps/api/src/routes/website/website-settings-routes.js`
- `apps/api/src/services/__tests__/email-templates.test.js`
- `apps/api/src/services/dist-serve-service.js`
- `apps/api/src/services/email-templates.js`
- `apps/api/src/services/hr-export-service.js`
- `apps/api/src/services/notification-delivery-worker.js`
- `apps/api/src/services/pdf-branding-service.js`
- `apps/api/src/services/web-push-service.js`
- `apps/desktop/index.html`
- `apps/desktop/native-host/media-smoke-server.mjs`
- `apps/desktop/native-host/shell/index.html`
- `apps/desktop/native-host/shell/shell.js`
- `apps/desktop/native-host/smoke-check.mjs`
- `apps/desktop/native-host/smoke-server.mjs`
- `apps/desktop/public/site.webmanifest`
- `apps/desktop/public/sw-notifications.js`
- `apps/desktop/src-tauri/Cargo.toml`
- `apps/desktop/src-tauri/Info.plist`
- `apps/desktop/src-tauri/gen/android/app/src/main/java/com/racoondevs/atlaserp/ScreenSharePlugin.kt`
- `apps/desktop/src-tauri/gen/android/app/src/main/res/values/strings.xml`
- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/mobile_host.rs`
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/src/app/AtlasApp.jsx`
- `apps/desktop/src/app/GoogleCalendarCallbackScreen.jsx`
- `apps/desktop/src/app/ServerSetup.jsx`
- `apps/desktop/src/auth/LoginScreen.jsx`
- `apps/desktop/src/components/ApiErrorScreen.jsx`
- `apps/desktop/src/components/AppLoader.jsx`
- `apps/desktop/src/components/AtlasLogoLoader.jsx`
- `apps/desktop/src/components/Topbar.jsx`
- `apps/desktop/src/hooks/usePushAutoSubscribe.js`
- `apps/desktop/src/hooks/usePwaManifest.js`
- `apps/desktop/src/modules/atlas.activity/ActivityFeedScreen.jsx`
- `apps/desktop/src/modules/atlas.calendar/components/GoogleCalendarCalendarPickerDialog.jsx`
- `apps/desktop/src/modules/atlas.catalog/screens/CatalogCategoriesScreen.jsx`
- `apps/desktop/src/modules/atlas.catalog/screens/CatalogInventoryScreen.jsx`
- `apps/desktop/src/modules/atlas.catalog/screens/CatalogProductsScreen.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/CallRoomLayout.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/guest/GuestCallScreen.jsx`
- `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/inviteResult.test.js`
- `apps/desktop/src/modules/atlas.chat/calls/lib/inviteResult.js`
- `apps/desktop/src/modules/atlas.company/screens/CompanyProfile.jsx`
- `apps/desktop/src/modules/atlas.contacts/screens/ContactsScreen.jsx`
- `apps/desktop/src/modules/atlas.core/screens/InstanceSettings.jsx`
- `apps/desktop/src/modules/atlas.core/screens/ModuleCatalog.jsx`
- `apps/desktop/src/modules/atlas.core/screens/Overview.jsx`
- `apps/desktop/src/modules/atlas.core/screens/SmtpSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.core/screens/WebPushSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/screens/DocumentTemplateEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/screens/DocumentTemplatesScreen.jsx`
- `apps/desktop/src/modules/atlas.documents/screens/GeneratedDocumentsScreen.jsx`
- `apps/desktop/src/modules/atlas.files/components/AdvancedFileViewer.jsx`
- `apps/desktop/src/modules/atlas.files/components/CreateDocumentDialog.jsx`
- `apps/desktop/src/modules/atlas.files/components/FileSharingDialog.jsx`
- `apps/desktop/src/modules/atlas.files/lib/file-origin-resolver.js`
- `apps/desktop/src/modules/atlas.files/screens/FilesScreen.jsx`
- `apps/desktop/src/modules/atlas.fleet/screens/CatalogsScreen.jsx`
- `apps/desktop/src/modules/atlas.fleet/screens/DriversScreen.jsx`
- `apps/desktop/src/modules/atlas.fleet/screens/InsuranceScreen.jsx`
- `apps/desktop/src/modules/atlas.fleet/screens/ReportsScreen.jsx`
- `apps/desktop/src/modules/atlas.fleet/screens/VehiclesScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/components/ConvertLeadDialog.jsx`
- `apps/desktop/src/modules/atlas.growth/components/GenerateDocumentDialog.jsx`
- `apps/desktop/src/modules/atlas.growth/lib/growth-leads.js`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthAnalyticsScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`
- `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadsScreen.jsx`
- `apps/desktop/src/modules/atlas.hr/screens/HrCatalogsScreen.jsx`
- `apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/ChatReportsScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/IdentityOverview.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/RoleEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/RolesScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/UserCreateScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/UserEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.identity/screens/UsersScreen.jsx`
- `apps/desktop/src/modules/atlas.inventory/screens/InventoryAssignmentsScreen.jsx`
- `apps/desktop/src/modules/atlas.inventory/screens/InventoryCatalogsScreen.jsx`
- `apps/desktop/src/modules/atlas.inventory/screens/InventoryScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/AccountsScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/GroupScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/GroupsScreen.jsx`
- `apps/desktop/src/modules/atlas.ledger/screens/MembershipsScreen.jsx`
- `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.notifications/NotificationsInboxScreen.jsx`
- `apps/desktop/src/modules/atlas.website/components/DistUploadPanel.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogPostEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteBlogScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteFormsScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteMenusScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteOverviewScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsitePageEditorScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsitePaymentsScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplateDetailScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteTemplatesScreen.jsx`
- `apps/desktop/src/modules/atlas.website/screens/WebsiteThemeScreen.jsx`
- `apps/desktop/src/modules/platform-settings/screens/SmtpSettingsScreen.jsx`
- `apps/desktop/src/native/NativeHostDiagnostics.jsx`
- `apps/desktop/src/native/index.js`
- `apps/desktop/src/native/notification-policy.js`
- `apps/desktop/src/setup/SetupWizard.jsx`
- `apps/desktop/src/setup/StepReview.jsx`
- `apps/desktop/src/shell/BlueprintCrudScreen.jsx`
- `apps/desktop/src/shell/PublicWebsiteEntry.jsx`
- `apps/desktop/src/website/EditorContextBar.jsx`
- `docs/TASKS.md`
- `packages/sdk/src/index.js`
- `packages/ui/src/components/AppShell.jsx`
- `packages/ui/src/components/BrandFooter.jsx`
- `packages/ui/src/components/ModuleSidebar.jsx`
- `packages/ui/src/components/OfficeDocumentEditor.jsx`
- `packages/ui/src/components/OfficeEditorHeader.jsx`
- `packages/ui/src/components/OfficeEditorLoading.jsx`
- `prisma/seed.js`
- `scripts/build-brand-assets.mjs`

## Task 1 - Product text [complete]

- [x] Replace human display text in the mapped files; preserve customer configuration and technical strings.
- [x] Update PWA and native display names, plus the manifest generator without running asset generation.
- [x] Inspect remaining Atlas references and changes for contract drift.

Validation: review diff, parse JSON manifests, compare technical tokens with the pre-stage snapshot.

## Task 2 - PWA cache [complete]

- [x] Calculate the manifest ETag from its serialized response body.
- [x] Verify legacy ETags receive the new body, existing app identity remains stable and subsequent revalidation returns 304.

Validation: `node --test apps/api/src/routes/__tests__/pwa.test.js`.

## Task 3 - Verification [complete]

- [x] Run targeted node:test suites for PWA, email, PDFs, notifications, invitations and manifests.
- [x] Run `pnpm.cmd --filter @atlas/desktop build:web`.
- [x] Run ESLint on modified JS/JSX and React Doctor via `npx.cmd -y react-doctor@latest . --verbose --diff`.
- [x] Record results, limitations and next stages in TASKS.md.

## Rollback Notes

Revert this stage only, preserving distribution changes. No migrations, sync, seed or resets are executed. Publishing web/API/worker and rebuilding native apps are separate deployment steps; persisted official metadata needs synchronization at deployment time.

## Evidence

Verified: 2026-09-13.

- `node --test` suites: `apps/api/src/routes/__tests__/pwa.test.js`, `apps/api/src/services/__tests__/email-templates.test.js`, `apps/api/src/routes/fleet/__tests__/pdf-branding.test.js`, `apps/api/src/manifests/official/__tests__/pwa-identities.test.js`, `apps/desktop/src/modules/atlas.chat/calls/lib/__tests__/inviteResult.test.js`, `apps/desktop/src/native/__tests__/notification-policy.test.js`, and `apps/desktop/src/lib/__tests__/{notification-worker,pwa-bootstrap,classifyError}.test.js`.
- 42 tests initially passed; the PWA suite could not import the broken local lucide-react link. `pnpm.cmd install --filter @atlas/api --frozen-lockfile --ignore-scripts` restored dependencies without changing package manifests or pnpm-lock.yaml. Rerunning the affected PWA suite passed all 8 tests: 50 passing tests in total, no outstanding failures.
- PWA regression verifies an old Atlas ETag receives HTTP 200 with Runly branding, the same app id/scope/start URL/icon version, then HTTP 304 with the new ETag.
- Existing PDF/Excel tests verify custom company names retain priority; email tests verify the Runly text in both HTML and plain text.
- `pnpm.cmd --filter @atlas/desktop build:web`: passed (12.70s). Existing large-chunk warning remains.
- ESLint on all modified JS/JSX/MJS files plus both extended test files: exit 0, no findings.
- `npx.cmd -y react-doctor@latest . --verbose --diff`: 124 files scanned, 52/100; 37 complexity warnings and one duplicated JSX warning in existing components. React changes in this stage only replace text; control flow and layouts remain unchanged. These refactors are outside the migration scope.
- Before/after comparison confirms package imports, ATLAS_* variables, atlas.* keys and paths, X-Atlas-* headers, exported Atlas-prefixed symbols, native identifiers, theme identifiers and color tokens are unchanged.
- JSON manifests parse; base PWA id/scope/start_url/icons/colors and Tauri identifier match their pre-stage values. Old technical strings, customer test data and image filenames remain intentional.
- `git diff --check`: passed. Changes from stage 1 are preserved.

Limits: no actual browser/device visual review, native build, emails/push to users, module sync, seed, database changes, domain changes, Docker publication or production deployment. Current image assets still carry the former logo. Saved customer/instance names are intentionally untouched; official stored metadata needs synchronization when the new API is deployed. New native display names require rebuilding the application.

