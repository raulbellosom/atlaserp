# atlas.notes — share picker: filter to users with notes-module access

Date: 2026-08-30
Status: code complete (browser QA pending)

## Problem

`NoteShareModal` populates its user picker from `atlas.identity.listUsers`, which
returns **every** company user (SDK smoke-test accounts, storefront test users,
etc.) and also requires the acting user to hold `identity.users.read` — a
permission unrelated to sharing a note. Users who can share notes but lack
`identity.users.read` get an empty picker (the fetch fails silently).

## Decision

Dedicated notes endpoint that returns only users who can actually use the notes
module, gated by `notes.shares.create` (the permission you already need to open
the share flow). Also enforce the same rule server-side in `shareNote` so the
filter isn't purely cosmetic.

"Has notes-module access" = shares a company with the actor AND, in that
company, their (enabled) role is an admin role (`atlas.admin` / `system.admin`)
or grants `notes.notes.read` (`permission.active = true`).

## Tasks

- [x] **T1 — `shares-service.js`**
  - `_assertTargetHasNotesAccess(actorUserId, targetUserId)` — raises
    `SharesServiceError(403)` if the target has no notes access.
  - `listShareableUsers({ actorUserId, search })` — `DISTINCT` users matching the
    rule above, `search` ILIKE on `display_name` / `email`, `ORDER BY
    display_name`, `LIMIT 20`, self excluded. Returns
    `{ id, displayName, email, avatarUrl: null }` (initials fallback — the
    service has no storage client to sign avatar URLs).
  - Call `_assertTargetHasNotesAccess` in `shareNote` after
    `_assertShareableTarget`.
  - Export both from the service object.
- [x] **T2 — `notes/index.js`**: `internal.get('/shareable-users',
  requirePermission('notes.shares.create'), …)` — registered BEFORE `/:id`
  (same reason as `/folders`, `/tags`).
- [x] **T3 — SDK**: `atlas.notes.listShareableUsers(search, token)` →
  `GET /notes/shareable-users?search=`.
- [x] **T4 — `NoteShareModal.jsx`**: swap the three `atlas.identity.listUsers`
  calls for `atlas.notes.listShareableUsers`; adapt to `{ users }` with
  `displayName` (was `firstName`/`lastName`).
- [x] **T5 — tests** (`notes-access.test.js`): `listShareableUsers` SQL includes
  the admin-role / `notes.notes.read` predicate and excludes self; `shareNote`
  rejects a target without notes access (403).
- [x] **T6 — verify**: `node --test notes-access.test.js`, `pnpm --filter
  @atlas/desktop build:web`.

## Out of scope

- Generalising this to a reusable `?withPermission=` param on
  `GET /identity/users` (chat / projects / calendar pickers have the same need)
  — separate change.
- Retroactive validation of existing `note_shares` rows.
