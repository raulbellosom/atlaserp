# atlas.contacts — Single-Record Detail Route

Date: 2026-08-27
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-27-contacts-detail-route-design.md
Plan file: docs/superpowers/plans/2026-08-27-contacts-detail-route-plan.md

## 1. Feature title

atlas.contacts — Single-Record Detail Route

## 2. Status

Draft

## 3. Context

This is a small, preliminary fix that unblocks Phase F of the `atlas.chat` roadmap (chat messages referencing entities from other modules, e.g. "revisa este contacto"). Research for Phase F found that `Contact` is the only one of 4 candidate entity types (Contact, `FileAsset`, `LedgerAccount`, `HrEmployee`) that lacks both a `GET /:id` endpoint and a single-record URL a chat reference card could deep-link to — `ContactsScreen.jsx` opens contacts in a modal sheet on row click with no URL change at all. The user explicitly chose to add this before building Phase F, rather than scoping Phase F down to the 3 entity types that already work.

## 4. Problem

There's no way to link directly to one specific contact — not from chat, not from anywhere else (a browser back/forward/refresh loses which contact was open; no `GET /contacts/:id` exists for any future integration to fetch a single record).

## 5. Goals

1. `GET /contacts/:id` returns a single contact by id, company-scoped like every other contacts endpoint.
2. `/app/m/atlas.contacts/contacts/:id` opens that contact (reusing the existing `ContactFormSheet` — this is a plumbing fix, not a new "detail page" UI).
3. Existing row-click behavior (opening the sheet) starts also updating the URL, so the sheet's open state and the URL agree; closing the sheet returns to `/app/m/atlas.contacts/contacts`.

## 6. Non-goals

1. No new "detail page" UI (tabs, activity timeline, related records) — `HrEmployeeDetail`-style full detail views are out of scope; this reuses the existing edit sheet as the "detail view," matching what already exists for Contact today (the sheet already shows every field).
2. No changes to `ContactFormSheet.jsx` itself — it already renders correctly for an existing contact; this only wires a URL to opening/closing it.
3. No `/contacts/new` URL route — contact creation stays exactly as it is today (button opens the sheet with `editingContact: null`, no URL change), since Goal 2 only requires linking to an *existing* contact, not a creation flow.

## 7. User stories

- As a developer building the chat cross-reference feature (Phase F), I need a stable API endpoint and URL to fetch and link to one contact.
- As a user, if I'm given a direct link to a contact (e.g. from a future chat reference card), clicking it should open that exact contact.

## 8. UX requirements

No new UI. The existing `ContactFormSheet` (a `Sheet` from `@atlas/ui`) is reused unchanged. Spanish labels already in place, unchanged.

## 9. Routes/screens

New: `atlas.contacts:/contacts/:id` in `ModuleOutlet.jsx`'s `SCREEN_MAP`, resolved to the existing `ContactsScreen.jsx` (same component already serving `/` and `/contacts`) — matches the exact pattern `atlas.hr:/hr/employees/:id` and `atlas.files:/files/:id` already use (same screen component handles both list and single-record views, switching on a URL param).

## 10. Data model

N/A — no schema change. `Contact` (`prisma/schema.prisma:541-560`) already has every field needed.

## 11. Prisma impact

None.

## 12. API contract

### GET /contacts/:id (new)

Auth: required
Permission: `contacts.contacts.read` (existing key, same as `GET /contacts` and `GET /contacts/picker`)
Response: `{ data: Contact }`
Errors: 404 (`"Contacto no encontrado."`) if the id doesn't exist or belongs to a different company (existing `assertContactOwnership`-style company scoping, reused).

No other endpoints change.

## 13. SDK contract

`atlas.contacts.getById(id, token)` — new method in `packages/sdk/src/index.js`'s inline `contacts: { ... }` object (this SDK predates the per-domain-file pattern `atlas.chat` uses; follow this file's own existing inline convention, not chat's).

## 14. Validator contract

N/A — a GET-by-id with no body needs no Zod schema, consistent with every other parameterless GET in this codebase (e.g. `GET /files/:id`, `GET /hr/employees/:id` have none either).

## 15. Module manifest impact

N/A — `atlas.contacts` is a built-in module, no manifest change.

## 16. Navigation impact

N/A — no new sidebar/nav entry; reached only by URL (typed, linked from elsewhere, or via the existing list's row click once it starts updating the URL).

## 17. Blueprint impact

N/A. (Note for future readers: `contacts.contact.entity`, the ENTITY blueprint for `Contact`, is documentation/metadata only today — it is not the live source of routing, per Phase F's own research. This feature does not change that; it adds a real route independent of the blueprint.)

## 18. RBAC/permissions

| Permission key | Guards |
|---|---|
| `contacts.contacts.read` (existing) | `GET /contacts/:id` |

No new permission keys.

## 19. Multi-company behavior

`GET /contacts/:id` scopes by `companyId` exactly like every other contacts service function (`getCompanyContext` → `prisma.contact.findFirst({ where: { id, companyId } })`) — a contact belonging to a different company returns 404, not the record, same non-leaking convention already established (and repeatedly enforced by review) in `atlas.chat`'s work this session.

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — reading a single contact is not an audit-relevant action (consistent with `GET /contacts`/`GET /contacts/picker`, neither of which are audited today).

## 23. Edge cases

1. **Contact id doesn't exist or belongs to another company**: `GET /contacts/:id` returns 404. In the UI, `ContactsScreen` shows a toast error and navigates back to the list rather than opening an empty/broken sheet.
2. **Navigating directly to `/app/m/atlas.contacts/contacts/:id` without the contact already loaded in the list** (e.g. a fresh page load from a pasted/chat-referenced link): `ContactsScreen` must fetch the contact via the new endpoint rather than assuming it's already in its loaded `contacts` rows — the list query and the single-contact fetch are independent.
3. **Closing the sheet**: navigates back to `/app/m/atlas.contacts/contacts` (list), regardless of whether the sheet was opened via URL or via a row click — a single, consistent close behavior.
4. **User lacks `contacts.contacts.read`**: existing `requirePermission` middleware already blocks this before the handler runs, same as every other contacts route — no new logic needed.

## 24. Risks

1. Risk: `ContactsScreen.jsx` currently has no `useParams`/`useNavigate` URL-awareness at all for its detail state (unlike `HrScreen.jsx`, which already parses a wildcard route param). Mitigation: this is the entire scope of this feature — add exactly that, following `HrScreen.jsx`'s existing regex-match-on-wildcard pattern (`apps/desktop/src/modules/atlas.hr/screens/HrScreen.jsx:95-106`) rather than inventing a new convention.
2. Risk: fetching a contact that isn't in the currently-loaded list page (pagination) could look like "not found" if the code mistakenly only checks the loaded rows. Mitigation: Edge case 2 above — always fetch by id independently of the list query, never fall back to "search the loaded rows first."

## 25. Acceptance criteria

1. Given a valid contact id, `GET /contacts/:id` (as an authenticated user with `contacts.contacts.read` in that contact's company) returns `{ data: { id, name, ... } }`.
2. Given a contact id from a different company, `GET /contacts/:id` returns 404.
3. Given a browser navigates to `/app/m/atlas.contacts/contacts/:id` for a valid, existing contact, the `ContactFormSheet` opens pre-filled with that contact's data.
4. Given the sheet (opened via URL) is closed, the URL returns to `/app/m/atlas.contacts/contacts`.
5. Given a user clicks a contact row in the existing list (unchanged trigger), the URL now also updates to `/app/m/atlas.contacts/contacts/:id` (previously it did not change at all).

## 26. Verification plan

- `pnpm build` — no build errors.
- Manual browser QA if a session is available: open a contact from the list (confirm URL updates), copy that URL, open it in a fresh reload (confirm the sheet reopens with the right contact), close it (confirm URL returns to the list).
- No backend test file exists yet for `contacts-service.js` (checked: `apps/api/src/services/__tests__/` has no `contacts-service.test.js`) — add one covering `getById`'s company-scoping (mirrors this session's established `node --test` convention for other services, even though this module didn't have prior coverage to extend).

## 27. Rollback plan

Purely additive (one new endpoint, one new route entry, one new SDK method) — revertable by removing those three additions; no data or schema change to roll back.

## 28. Future enhancements

1. A real `ContactDetail.jsx` page (tabs, related records, activity timeline) if Contact ever needs the same depth `HrEmployeeDetail` already has for employees — explicitly out of scope here (Non-goal 1).
