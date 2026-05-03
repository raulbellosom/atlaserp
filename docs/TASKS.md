# Atlas ERP Initial Tasks

## Phase 0 - Project bootstrap

- [x] Install dependencies with pnpm.
- [x] Start local-lite Docker stack.
- [x] Run Prisma migration.
- [x] Seed core modules.
- [x] Confirm API `/health`.
- [x] Confirm desktop web preview.

Verified by Codex on 2026-05-02 using PowerShell. Use `pnpm.cmd` instead of `pnpm` if Windows blocks the PowerShell shim. `pnpm.cmd db:generate` passes when no API process is holding the Prisma client DLL. `pnpm.cmd --filter @atlas/desktop build:web` also passes.

## Phase 1 - Core runtime

- [ ] Create proper route system in desktop app.
- [ ] Load navigation from API instead of static array.
- [ ] Render module navigation dynamically.
- [ ] Add module detail page.
- [ ] Add install module form using manifest JSON.
- [ ] Add logical uninstall/disable flow.

## Phase 2 - Identity

- [ ] Connect Supabase Auth.
- [ ] Create login screen.
- [ ] Sync `auth.users` with `UserProfile`.
- [ ] Create Company model screens.
- [ ] Create roles and permissions UI.
- [ ] Enforce permissions in API middleware.

## Phase 3 - Blueprints

- [ ] Create `FieldRenderer`.
- [ ] Create `DynamicForm`.
- [ ] Create `DynamicTable`.
- [ ] Render Contact blueprint from API.
- [ ] Add validation bridge from Zod to forms.

## Phase 4 - Contacts module

- [ ] Create contacts list page.
- [ ] Create contact form page/modal.
- [ ] Add contact picker component.
- [ ] Expose contact picker to other modules.

## Phase 5 - Files module

- [ ] Configure Supabase Storage driver.
- [ ] Create upload endpoint.
- [ ] Store metadata in `FileAsset`.
- [ ] Build reusable `FileUploader`.
- [ ] Build reusable `FileViewer`.

## Phase 6 - Finance module

- [ ] Create accounts CRUD.
- [ ] Create transactions CRUD.
- [ ] Add balances calculation.
- [ ] Add dashboard widgets.
- [ ] Allow optional contact relation.

## Phase 7 - Module marketplace local

- [ ] Define module package format.
- [ ] Add module manifest validation.
- [ ] Add version compatibility checks.
- [ ] Add dependency resolver.
- [ ] Add migration strategy per module.

## Phase 8 - Future modules

- [ ] Purchases
- [ ] Inventory
- [ ] HR
- [ ] Fleet
- [ ] Website builder / CMS
