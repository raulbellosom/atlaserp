# Growth Lead Inbox Verification

Date: 2026-06-14
Branch: `feature/growth-lead-inbox`

## Automated evidence

- Growth routes, service, files contract, SDK domains, and UI helpers: 42 tests passed.
- Prisma schema validation and UUID policy: passed.
- Full monorepo build: passed; produced the Vite web bundle, Windows executable, MSI, and NSIS installer.
- React Doctor: scanned 7 changed React files; `diagnostics.json` was empty.
- JavaScript syntax checks and `git diff --check`: passed.

## Known baseline issue

`pnpm.cmd rbac:verify-catalog` still reports 30 missing catalog entries from
Calendar, Catalog, and Inventory, plus two legacy platform extras. No Growth
permission is missing.

## Covered behavior

- Company-scoped list, detail, assignee, Contact, and file access.
- State transitions, terminal conversion, discarded reopen, disable/enable, and optimistic conflicts.
- Notes, audit records, assignee notifications, and transactional Contact conversion rollback.
- Permission guards for read, create, update, delete, assign, convert, and Contacts access.
- Lead inbox, manual creation, detail timeline, Contact picker, and `AttachmentsPanel`.

## Pending live verification

- Apply migration `20260614210000_add_growth_lead_inbox_fields`.
- Verify responsive inbox/detail with an authenticated company session.
- Exercise notification delivery preferences and email delivery.
- Upload, open, download, and remove a lead attachment against Supabase Storage.
- Convert to an existing Contact and create a new Contact against the live database.
- Confirm the known permission-catalog baseline issues outside Growth are resolved separately.
