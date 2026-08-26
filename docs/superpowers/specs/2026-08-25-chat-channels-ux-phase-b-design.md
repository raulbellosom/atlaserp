# Chat Channels & Roles — Phase B: Channel/Group UX

Date: 2026-08-25
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-25-chat-channels-ux-phase-b-design.md
Plan files: docs/superpowers/plans/2026-08-25-chat-channels-ux-phase-b-plan-a-backend.md, docs/superpowers/plans/2026-08-25-chat-channels-ux-phase-b-plan-b-frontend.md

---

## 1. Feature title

Chat Channels & Roles — Phase B: Channel/Group UX

## 2. Status

Draft

## 3. Context

Phase A (complete, `2026-08-25-chat-channels-roles-phase-a-design.md`) built the data model, permission engine, and API for channels/roles, but shipped **no UI**. Nobody can create a channel, browse the directory, manage members, or manage roles today — the feature is invisible. This phase builds that UI on top of the existing `apps/desktop/src/modules/atlas.chat/` screens (`ChatScreen`, `ChatSidebar`, `ChatWindow`, `CreateChatModal`), following their established patterns (TanStack Query hooks per concern, `atlas.chat.*` SDK calls, `@atlas/ui` primitives, Realtime cache invalidation via `useRealtimeContext().on(...)`).

## 4. Problem

A user cannot: create a channel, discover/join a public channel, see who has which role in a channel/group, add or remove members through a permission-aware UI, or create/edit/delete roles. The backend enforces all of this correctly (Phase A), but the frontend has no way to exercise it, and — critically — `GET /chat/conversations/:id`'s existing `members` array doesn't even expose each member's `role_id`, so the client can't render role badges or gate UI actions on the current user's own permissions.

## 5. Goals

1. `GET /chat/conversations/:id` includes each member's role (`roleId`, `roleName`, `roleColor`, `rolePosition`, `roleIsSystem`) so the frontend can render badges and compute the current user's own effective permissions client-side (for optimistic UI gating — the backend remains the enforcement authority regardless).
2. A user with `chat.conversations.create` can create a channel (title, description, public/private, slug) from the chat sidebar.
3. A user can browse a directory of public channels in their company and join one with a single action.
4. Any member can view a channel/group's member list with role badges; a member with `members.manage` can add/remove members from that same view.
5. A member with `roles.manage` can view, create, edit, and delete roles for a channel/group, and assign a role to a member.
6. Existing `group` conversations (already backfilled with roles in Phase A's migration) work identically to new channels in all of the above — no separate code path.

## 6. Non-goals

1. No mentions, pinned messages, reactions, threads, or cross-module references — later phases.
2. No channel deletion/archival UI beyond what already exists for conversations generically (existing archive/unarchive flow is untouched).
3. No bulk role-permission editor with every permission spelled out in the UI as a polished matrix — a straightforward checkbox list per `CHAT_PERMISSIONS` key is sufficient for this phase.
4. No change to `direct`/`external_support` conversation UI — untouched.
5. No transfer-ownership dedicated flow — assigning the Owner role to someone else (as an existing Owner) uses the same generic "assign role" UI as any other role.

## 7. User stories

- As an employee with `chat.conversations.create`, I want to create a channel from the chat sidebar so my team has a persistent place to talk.
- As any employee, I want to browse public channels I haven't joined and join one with a click.
- As a channel Owner/Admin, I want to see a member list with role badges and remove/add members without leaving the chat window.
- As a channel Owner/Admin, I want to create a custom role (e.g. "Soporte") with a specific permission set and assign it to a member.
- As a Member with no management permissions, I want the UI to simply not show me actions I can't perform, rather than showing them and failing.

## 8. UX requirements

All labels in Spanish. Reuse `@atlas/ui` primitives exclusively — no native `<select>`/dialogs (`Dialog`, `Sheet`, `SelectField`/`CreatableComboboxField`, `ConfirmDialog`, `PageHeader`, `EmptyState`, `DropdownMenu`, `Badge`).

- **Sidebar**: `ChatSidebar`'s "+" button opens a menu (via `DropdownMenu`) with two options: "Nueva conversación" (existing `CreateChatModal`, unchanged) and "Crear canal" (new `CreateChannelModal`). A new "Explorar canales" entry (icon button or menu item) opens the directory (`ChannelDirectorySheet`).
- **Create Channel Modal**: title (required), description (optional, textarea), a public/private `Switch` ("Cualquiera en tu empresa puede unirse" description text), slug (auto-derived from title via slugify, shown as read-only preview text `#slug-generado` unless the user edits it — editable via a small "Editar" toggle), and the same user-picker UX as `CreateChatModal` for optional initial members. On success, navigate to the new channel like `CreateChatModal` does.
- **Channel Directory**: a `Sheet` (side panel) listing public channels not yet joined, each row showing title + description + member count if available, with a "Unirse" button. Cursor-paginated ("Cargar más" button at the bottom, matching existing patterns — no infinite scroll needed for v1). `EmptyState` when nothing to show.
- **Chat window header**: for `channel`/`group` conversations only, add a small member-count badge/button (e.g. "8 miembros") next to the existing header controls, opening a `Sheet`: **"Detalles del canal"** with two tabs — "Miembros" and "Roles" (roles tab only rendered if the current user's own role has `roles.manage`, computed client-side from Goal 1's data — the backend still enforces this regardless of what the UI shows).
  - **Miembros tab**: list of active members with avatar, name, role badge (colored per role's `color`, or a neutral default if none). If the current user has `members.manage`: a `DropdownMenu` per row with "Cambiar rol" (only for roles the current user's position exceeds — filter the picker options client-side; backend re-validates) and "Eliminar" (`ConfirmDialog`, self-removal always available even without `members.manage`, matching backend semantics exactly). An "Añadir miembros" button reuses the same user-picker pattern as `CreateChatModal`.
  - **Roles tab**: list of roles ordered by position (highest first), each showing name, color swatch, and a `Badge` for "Sistema" if `isSystem`. A "Crear rol" button opens a role editor (name, color picker — reuse existing color patterns from `CarColorPickerField` if applicable, or a simple hex input — position number input capped below the actor's own position, and a checkbox list of `CHAT_PERMISSIONS` keys with Spanish labels). Editing/deleting a role reuses the same editor/`ConfirmDialog`; the Owner role row shows no edit/delete actions (system role).
- **Loading/empty/error states**: every new list (directory, members, roles) uses `Skeleton` while loading and `EmptyState`/`ErrorState` for the empty/error case — never blank space.

## 9. Routes/screens

No new top-level routes — everything is modal/sheet-based within the existing `/app/m/atlas.chat/chat/inbox` screen (`ChatScreen.jsx`), matching how `CreateChatModal` already works.

| Component | File | Module |
|---|---|---|
| `CreateChannelModal` | `apps/desktop/src/modules/atlas.chat/components/CreateChannelModal.jsx` | atlas.chat |
| `ChannelDirectorySheet` | `apps/desktop/src/modules/atlas.chat/components/ChannelDirectorySheet.jsx` | atlas.chat |
| `ChannelDetailsSheet` (Miembros + Roles tabs) | `apps/desktop/src/modules/atlas.chat/components/ChannelDetailsSheet.jsx` | atlas.chat |
| `RoleEditorDialog` | `apps/desktop/src/modules/atlas.chat/components/RoleEditorDialog.jsx` | atlas.chat |

## 10. Data model

No new tables. `chat_conversation_members`'s existing `role_id` (Phase A) is exposed through `getConversation`'s SQL for the first time.

### Modified models

**`chat_conversations`** (no schema change): `getConversation`'s SQL is extended to also join `chat_channel_roles` per member and expose role fields in the `members` array.

## 11. Prisma impact

New models: none.
Modified models: none — this is a query-shape change only (`chat-service.js`'s `getConversation`, raw SQL, not Prisma-modeled).
New migration required: No.

## 12. API contract

### GET /chat/conversations/:id (modified response shape, same endpoint)

Auth: required (unchanged)
Permission: unchanged
Response: `{ data: Conversation }` where each entry in `data.members[]` gains 4 new fields: `roleId`, `roleName`, `roleColor`, `rolePosition`, `roleIsSystem` (all `null` for `direct`/`external_support` members, exactly as `role_id` already is).

No other endpoints change — Phase A already built everything else this phase's UI needs (`POST /chat/channels`, `GET /chat/channels/directory`, `POST /chat/conversations/:id/join`, `GET/POST /chat/conversations/:id/roles`, `PATCH/DELETE /chat/conversations/:id/roles/:roleId`, `PATCH /chat/conversations/:id/members/:memberId/role`, plus the already-existing `POST/DELETE .../members`).

## 13. SDK contract

No new SDK methods — Phase A already added everything (`createChannel`, `listChannelDirectory`, `joinChannel`, `listChannelRoles`, `createChannelRole`, `updateChannelRole`, `deleteChannelRole`, `assignMemberRole`). `getConversation`'s existing SDK method (`atlas.chat.getConversation`) is unchanged — it just returns richer data now.

## 14. Validator contract

No new schemas — Phase A's `chatCreateChannelSchema`, `chatCreateChannelRoleSchema`, `chatUpdateChannelRoleSchema`, `chatAssignMemberRoleSchema` are reused as-is by the new UI.

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in module, not AME3.

## 16. Navigation impact

N/A — no new navigation items; everything is reached from the existing Chat screen.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

No new permission keys (global or channel-scoped) — this phase is pure UI on top of Phase A's already-complete and already-enforced permission model. The UI computes "can I see this button" from the current user's own role (found in `getConversation`'s member list by matching `userId` against the logged-in user's profile id) purely for UX polish (hiding actions that would 403); the backend remains the sole source of truth and re-validates every mutation exactly as it does today.

## 19. Multi-company behavior

Unchanged from Phase A — the directory is already company-scoped server-side; the UI just renders what the API returns.

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — Phase A already defines audit log entries for the underlying mutations (`chat.role.create`, etc.); this phase adds no new mutating logic, only UI that calls existing endpoints.

## 23. Edge cases

1. **Current user's own role not found** (e.g., data inconsistency, or a `direct` conversation where role fields are all `null`): treat as "no management permissions" — hide all gated actions, never crash. `roleHasPermission`-equivalent client helper must default to `false` on missing/null role data.
2. **Role picker in "Cambiar rol"**: must exclude roles at or above the current user's own position (mirrors backend hierarchy — matches exactly what the backend would reject anyway, but hiding the option is better UX than letting the user pick it and see a 403).
3. **Assigning/self-granting Owner**: only shown as an option in the role picker if the current user's own role `isSystem` is `true` (mirrors the backend's "only an Owner can grant Owner" rule).
4. **Deleting a role that members hold**: after the mutation succeeds, invalidate both the roles list AND the conversation/members query (the backend reassigns affected members to "Member" — the member list's role badges must refresh to reflect that, not show a stale role name).
5. **Channel slug uniqueness (400 from the API)**: `CreateChannelModal` must surface the API's error message inline (matching `CreateChatModal`'s existing inline-error pattern), not a generic toast.
6. **Joining a channel already joined (400) or a channel that became private/was deleted between listing and joining (404)**: `ChannelDirectorySheet` must remove the row from its local list and surface a friendly message, not crash the sheet.
7. **Empty roles tab for a role-less conversation** (a `direct`/`external_support` conversation somehow opened in `ChannelDetailsSheet` — shouldn't happen since the header button only renders for `channel`/`group`, but defensively): render `EmptyState` rather than an error if `GET .../roles` is ever called for a conversation with no roles.

## 24. Risks

1. Risk: Client-side permission gating drifts from the backend's actual enforcement (e.g., a future backend permission-key rename isn't mirrored in the frontend's hardcoded checks) leaving stale/wrong buttons visible (that then correctly 403 on click, but confusingly). Mitigation: centralize the permission-key strings and the `roleHasPermission`-equivalent check in one small shared JS module (`apps/desktop/src/modules/atlas.chat/lib/chatPermissions.js`) mirroring the exact keys from `apps/api/src/routes/chat/chat-permissions-service.js`'s `CHAT_PERMISSIONS`, with a comment cross-referencing that file, so a future rename is easy to grep for.
2. Risk: `ChannelDetailsSheet` becomes a large file mixing two unrelated tabs (Members, Roles) — CLAUDE.md's file-size discipline. Mitigation: split into `ChannelMembersTab.jsx` and `ChannelRolesTab.jsx` sub-components from the start, with `ChannelDetailsSheet.jsx` only handling the tab shell.

## 25. Acceptance criteria

1. Given a user with `chat.conversations.create`, when they use "Crear canal" with a title and mark it public, then the channel appears in the sidebar and they hold the Owner role.
2. Given a public channel the user hasn't joined, when they open "Explorar canales" and click "Unirse", then the channel appears in their sidebar and they hold the Member role.
3. Given a channel member with `members.manage`, when they open "Detalles del canal" → Miembros and remove another member (not the last Owner, not themselves), then that member disappears from the list.
4. Given a channel member WITHOUT `members.manage`, when they open Miembros, then no remove/add actions are visible for other members, but a "Salir" (leave) action for themselves is always visible.
5. Given a channel Owner, when they create a custom role with `position: 50` and assign it to a member, then that member's badge updates to show the new role's name/color.
6. Given a Member (position 0, no `roles.manage`), when they open "Detalles del canal", then no "Roles" tab is rendered at all.

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --check` on any new/modified backend file (`chat-service.js`'s `getConversation` change).
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — existing suite still passes; add coverage for the extended `getConversation` shape.
- Manual browser QA (`pnpm dev:frontend`) at 390px and 1440px per the project's UI checklist: create a channel, join a public channel from another test user's session, verify role badges, verify permission-gated buttons hide correctly for a low-rank member, verify role CRUD.

## 27. Rollback plan

Backend change (Plan A) is additive-only to a SELECT's shape — no migration, trivially revertable by reverting the commit. Frontend (Plan B) is new components not wired into any critical path other than the chat sidebar's "+" menu — revertable by reverting those commits with no data impact.

## 28. Future enhancements

1. A richer role-permission matrix UI (grouped by category, with descriptions) instead of a flat checkbox list.
2. Bulk member management (multi-select add/remove).
3. Channel avatar upload (currently text-only).
4. Everything already deferred in Phase A's own Future Enhancements (multi-role per member, owner-transfer flow, etc.) — unaffected by this phase.
