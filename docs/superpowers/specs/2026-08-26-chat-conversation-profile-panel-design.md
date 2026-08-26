# Chat Conversation Profile Panel

Date: 2026-08-26
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-26-chat-conversation-profile-panel-design.md
Plan file: docs/superpowers/plans/2026-08-26-chat-conversation-profile-panel.md (created after spec approval)

---

## 1. Feature title

WhatsApp-style conversation profile panel for atlas.chat, plus a chat-reports moderation screen in atlas.identity.

## 2. Status

Draft

## 3. Context

atlas.chat already has an in-place "details" panel for group/channel conversations (`ChatMembersPanel`, built in a prior sub-project), with General / Members / Roles tabs, swapped into `ChatWindow`'s main content slot. Direct (1:1) conversations have no equivalent panel at all today — clicking the avatar or title in a direct chat does nothing.

Users are used to WhatsApp/Telegram-style conversation profiles: shared media, a mute toggle, and for direct chats specifically, "groups in common" and the ability to block or report a contact. None of this exists in atlas.chat yet.

## 4. Problem

1. There is no way to view a direct-chat contact's shared files, mute a conversation, see which groups you share with a contact, or block/report a user — none of these concepts exist in the data model or UI at all.
2. Group/channel conversations have a details panel, but it lacks a media tab and a mute control, so they are inconsistent with what direct chats will gain.
3. There is no moderation workflow for handling a report once filed — no admin can see or act on one.

## 5. Goals

1. Every conversation (direct, group, channel) has a profile panel reachable from both the main `ChatWindow` and the floating mini-chat windows.
2. Direct-chat profile panel shows: contact info, shared media, groups in common, a mute toggle, and Block/Report actions.
3. Group/channel profile panel gains a shared-media tab and a mute toggle, on top of its existing General/Members/Roles tabs.
4. Muting a conversation suppresses the new-message toast notification for it, without affecting unread counts/badges.
5. Blocking a user is enforced server-side: a blocked user cannot send the blocker new messages, in existing or new direct conversations, in either direction.
6. Reporting a user creates a record an admin can review and act on (dismiss, or disable the reported user's account) from a new screen under atlas.identity.

## 6. Non-goals

1. No admin ability to read the actual message content of a reported conversation — the report's reason/note is the only context surfaced to reviewers (no access-control bypass of chat's membership-based read model).
2. Blocking does not affect shared groups/channels — a blocked user's messages still appear normally in groups you're both in, matching WhatsApp. Block only affects direct 1:1 messaging.
3. Muting only suppresses the realtime toast popup. It does not change unread counts, badge numbers, or in-app sound (no sound exists today).
4. No push/desktop OS-level notifications are affected — none exist in this codebase today; only the existing in-app `sonner` toast in `RealtimeProvider.jsx` is in scope.
5. No rate-limiting or duplicate-report prevention — the same reporter can file multiple reports against the same user; the admin screen shows every report as its own row.
6. No email/notification to the reported user when they are disabled. Corrected during Task 4 code review — this spec originally also claimed "no in-app 'you have been blocked' indicator shown to the blocked user," which directly contradicted this same section's own enforcement design: `sendMessage` rejects a blocked user's message with an explicit 403 "No puedes enviar mensajes a este usuario" (Section 12), and `GET /chat/users/:userId/block-status` is symmetric by design — either party can query it, which is required so the profile panel's Block/Unblock button shows correctly no matter who opens the profile. Unlike WhatsApp's silent-delivery-failure model, blocking here is intentionally overt on both sides (the approach the user explicitly chose during brainstorming was "Block only, enforced," not a covert/silent block) — a blocked user finds out via a clear error when they try to message, not via delivery ambiguity. Building true covert blocking (messages appear to send but silently vanish, block-status only queryable by the blocker) would be a materially larger feature than what was scoped and is not part of this version.
7. This spec does not add "block" or "report" actions inside group/channel conversations — both are direct-chat-contact-scoped only, matching WhatsApp.

## 7. User stories

- As a chat user, I want to open a direct chat's profile so I can see shared files and mute notifications from that person.
- As a chat user, I want to see which groups I share with a direct-chat contact, so I have context on how I know them.
- As a chat user, I want to mute a noisy group so I stop getting toast popups for it, without losing track of unread messages.
- As a chat user, I want to block someone who is harassing me so they can no longer message me.
- As a chat user, I want to report a user so an administrator can review the situation.
- As an identity administrator, I want to see all filed chat reports and either dismiss them or disable the offending user's account.
- As a chat user in a group, I want to see the group's shared files without leaving the conversation to open the full-screen files gallery.

## 8. UX requirements

All labels in Spanish, using `@atlas/ui` components exclusively (no native `<select>`/dialogs, per project policy).

**Panel structure** — a new `ConversationProfilePanel` component replaces `ChatMembersPanel` as the thing swapped into the content slot (same pattern: `Tabs`/`TabsList`/`TabsContent`, `flex-1 min-h-0 flex flex-col overflow-hidden` root). Tab set depends on `conversation.type`:

- **direct**: `Info` (avatar, name, online/last-seen — the info already in the header, plus this is where Block/Report live) · `Media` · `En comun` · `Notificaciones`.
- **group** / **channel**: existing `General` · `Miembros` · `Roles` (unchanged, permission-gated as today) · new `Media` · new `Notificaciones`.

**Media tab**: reuses the existing `ChatFilesGallery` rendering logic (grid of image thumbnails + file rows), scoped to the current conversation's attachments. Empty state: `EmptyState` with "Sin archivos compartidos."

**En comun tab** (direct only): list of group/channel conversations shared with the other member, each row showing avatar + `#`-prefixed channel name or group name, click navigates to that conversation. Empty state: "No comparten grupos en comun."

**Notificaciones tab**: a single toggle (`Checkbox` or a switch-styled control from `@atlas/ui`) labeled "Silenciar conversacion" with helper text "No recibiras notificaciones emergentes de mensajes nuevos en esta conversacion." Optimistic update via TanStack Query mutation.

**Info tab (direct only) — Block/Report section**: at the bottom, a visually separated "danger zone" with two actions:
- "Bloquear a [nombre]" / "Desbloquear a [nombre]" (toggles based on current block state) — uses `ConfirmDialog` before blocking (destructive-ish, reversible but consequential) but unblocking is a direct action, no confirm needed (matches the project's archive/unarchive precedent: undo doesn't need confirmation).
- "Reportar usuario" — opens a `Dialog` with a `SelectField` for reason (`Spam`, `Acoso o abuso`, `Contenido inapropiado`, `Otro`) and a `TextareaField` for an optional note, plus a `CheckboxField` "Tambien bloquear a este usuario". Submits via `POST /chat/reports`.

**Floating mini-chat window**: the "..." dropdown in `MiniChatWindow` gains a new "Ver perfil" item that swaps the mini-window's body (same message-list-replacement mechanism `ChatWindow` already uses for its own membersView/filesView, newly added to `MiniChatWindow`) to render the same `ConversationProfilePanel`, at the mini-window's existing fixed width (`WW` constant in `FloatingChatHub.jsx`). `@atlas/ui`'s `TabsList` (`packages/ui/src/components/Tabs.jsx`) is `inline-flex` with no built-in horizontal scroll — confirmed during spec review, not an existing capability to rely on. `ConversationProfilePanel`'s own `TabsList` wrapper must add `overflow-x-auto` explicitly so its up-to-5 tabs stay usable at the mini-window's narrow width; this applies to both surfaces for consistency, not just the mini-window.

**Admin reports screen** (`ChatReportsScreen.jsx` under atlas.identity): `PageHeader` "Reportes de chat", an `AtlasTable`/`DataTable`-style list with columns Reportante, Usuario reportado, Motivo, Nota, Conversacion, Fecha, Estado. Row actions via `DropdownMenu`: "Desestimar" and "Deshabilitar usuario" (the latter behind `ConfirmDialog`, since it's a real account-disabling action). Filter by status (`Abierto` / `Resuelto`) via `SelectField`. Empty state via `EmptyState`.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| /app/m/atlas.identity/identity/chat-reports | ChatReportsScreen | atlas.identity | Admin review list for filed chat reports |

No new route for the profile panel itself — it's a content-slot swap within the existing `/app/m/atlas.chat/chat/inbox/:id` route (`ChatScreen`/`ChatWindow`), and within the floating hub (no route at all).

## 10. Data model

### New models

**`chat_conversation_members.muted_at`** (modification, not new table) — nullable `TIMESTAMPTZ`. Set = muted, `NULL` = not muted. Mirrors the existing `archived_at` column's shape exactly.

**`chat_blocks`** — one row per block relationship.
- `id` UUID, default `uuidv7()`, PK
- `blocker_user_id` UUID, references the blocking user's profile
- `blocked_user_id` UUID, references the blocked user's profile
- `created_at` TIMESTAMPTZ, default `now()`
- Unique constraint on `(blocker_user_id, blocked_user_id)`

**`chat_reports`** — one row per filed report.
- `id` UUID, default `uuidv7()`, PK
- `reporter_user_id` UUID
- `reported_user_id` UUID
- `conversation_id` UUID, nullable (the direct conversation the report originated from, if any)
- `reason` TEXT, one of `spam` / `abuse` / `inappropriate` / `other`
- `note` TEXT, nullable
- `status` TEXT, default `'open'`, one of `open` / `dismissed` / `user_disabled`
- `reviewed_by_user_id` UUID, nullable
- `reviewed_at` TIMESTAMPTZ, nullable
- `created_at` TIMESTAMPTZ, default `now()`

### Modified models

`chat_conversation_members` — add `muted_at` as described above.

## 11. Prisma impact

New models: None (chat tables are managed via raw SQL migrations and `$queryRaw`, not Prisma models — matches the existing pattern for every other `chat_*` table, which are intentionally absent from `prisma/schema.prisma`).
Modified models: None (same reason).
New migration required: Yes — a single new forward migration `add_chat_moderation` creating `chat_blocks`, `chat_reports`, and adding `chat_conversation_members.muted_at` with an index mirroring `chat_conversation_members_archived_idx`.
Migration safety notes: All changes are additive (new tables, one new nullable column) — no data backfill needed, safe to apply without downtime.

## 12. API contract

All new endpoints added to `apps/api/src/routes/chat/index.js`, backed by a new `apps/api/src/routes/chat/chat-moderation-service.js` (mirroring the existing per-area service file convention in that directory).

### PATCH /chat/conversations/:id/mute

Auth: required
Permission: `chat.conversations.read` (any active member of the conversation may mute their own membership row)
Body: `{ muted: boolean }`
Response: `{ data: { conversationId: string, muted: boolean } }`
Errors: none — corrected during Task 4 code review. The original draft promised "403 if not a member; 404 if not found," but the codebase's own `archiveConversation`/`unarchiveConversation` (`chat-service.js`, which this endpoint was explicitly designed to mirror — see Section 10) don't enforce membership either: both scope their `UPDATE` to `WHERE conversation_id = ... AND user_id = <caller's own resolved profile id> AND left_at IS NULL` and silently no-op if that row doesn't exist, always returning success. `muteConversation` follows that same established pattern intentionally, not as an oversight. This is safe: the `WHERE` clause is always scoped to the caller's own `user_id`, so a non-member can never affect another user's row or learn anything about a conversation they can't already see — at worst, a non-member's mute call is a harmless no-op.

### GET /chat/users/:userId/block-status

Auth: required
Permission: `chat.access`
Response: `{ data: { blockedByMe: boolean, blockedByThem: boolean } }`

### POST /chat/users/:userId/block

Auth: required
Permission: `chat.access`
Response: `{ data: { blocked: true } }`
Errors: 400 if `userId` equals the caller's own profile id.

### DELETE /chat/users/:userId/block

Auth: required
Permission: `chat.access`
Response: `{ data: { blocked: false } }`

### GET /chat/users/:userId/groups-in-common

Auth: required
Permission: `chat.conversations.read`
Response: `{ data: Array<{ id, type, title, avatarUrl, avatarEmoji }> }` — group/channel conversations where both the caller and `userId` are active members (`left_at IS NULL`).

### POST /chat/reports

Auth: required
Permission: `chat.access`
Body: `{ reportedUserId: string, conversationId?: string, reason: "spam"|"abuse"|"inappropriate"|"other", note?: string, alsoBlock?: boolean }`
Response: `{ data: { id: string, status: "open" } }`
Errors: 400 if `reportedUserId` equals caller's own profile id; 400 on invalid `reason`.
Side effect: if `alsoBlock` is true, also performs the block (same effect as `POST /chat/users/:userId/block`).

### GET /chat/reports

Auth: required
Permission: `identity.chat_reports.read`
Query: `?status=open|dismissed|user_disabled` (optional filter)
Response: `{ data: Array<{ id, reporterUserId, reporterDisplayName, reportedUserId, reportedDisplayName, conversationId, reason, note, status, createdAt, reviewedByUserId, reviewedAt }> }`

### PATCH /chat/reports/:id/resolve

Auth: required
Permission: `identity.chat_reports.manage`
Body: `{ action: "dismiss" | "disable_user" }`
Response: `{ data: { id: string, status: string } }`
Side effect for `disable_user`: sets the reported user's `UserProfile.enabled = false` (same field/semantics `PATCH /identity/users/:id` already uses — no new disable mechanism).
Errors: 404 if report not found; 400 if report already resolved.

## 13. SDK contract

Domain: `atlas.chat` (`packages/sdk/src/domains/chat.js`)

- `muteConversation(conversationId, muted, token)` — `PATCH /chat/conversations/:id/mute` — returns `{ data: { conversationId, muted } }`
- `getBlockStatus(userId, token)` — returns `{ data: { blockedByMe, blockedByThem } }`
- `blockUser(userId, token)` — returns `{ data: { blocked: true } }`
- `unblockUser(userId, token)` — returns `{ data: { blocked: false } }`
- `getGroupsInCommon(userId, token)` — returns `{ data: Conversation[] }`
- `createReport(payload, token)` — returns `{ data: { id, status } }`
- `listReports(query, token)` — returns `{ data: Report[] }`
- `resolveReport(reportId, action, token)` — returns `{ data: { id, status } }`

## 14. Validator contract

Corrected during self-review: chat's existing schemas actually live in `packages/validators/src/chat.js` (e.g. `chatCreateConversationSchema`, `chatSendMessageSchema`), re-exported from `@atlas/validators` — not module-local. New schemas follow that same file and naming convention:

- `chatMuteConversationSchema` — `{ muted: z.boolean() }`
- `chatCreateReportSchema` — `{ reportedUserId: z.string().uuid(), conversationId: z.string().uuid().optional(), reason: z.enum(["spam","abuse","inappropriate","other"]), note: z.string().max(2000).optional(), alsoBlock: z.boolean().optional() }`
- `chatResolveReportSchema` — `{ action: z.enum(["dismiss","disable_user"]) }`

## 15. Module manifest impact

**atlas.chat** (`apps/api/src/manifests/official/feature-modules.js`): no new permissions needed — mute/block/report/groups-in-common all reuse the existing `chat.access` and `chat.conversations.read` permissions already declared in its manifest.

**atlas.identity** (`apps/api/src/manifests/official/core-modules.js`): add to its existing `permissions` array:
- `{ key: "identity.chat_reports.read", name: "Read Chat Reports" }`
- `{ key: "identity.chat_reports.manage", name: "Manage Chat Reports" }`

Add to its `navigation` array:
- `{ label: "Reportes de chat", path: "/identity/chat-reports", icon: "Flag", layout: "main", permissionKey: "identity.chat_reports.read" }`

Add to its `acl.actions` map: `"identity.chat_reports.read": "identity.chat_reports.read"`, `"identity.chat_reports.manage": "identity.chat_reports.manage"`.

Dependencies: unchanged for both modules.

## 16. Navigation impact

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Reportes de chat | /identity/chat-reports | Flag | main | identity.chat_reports.read |

## 17. Blueprint impact

N/A — atlas.chat and atlas.identity are both pre-AME3 modules using hand-written screens, not blueprint-driven CRUD renderers, matching how their existing screens (`ChatWindow`, `UsersScreen`) are already built.

## 18. RBAC/permissions

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| chat.access | POST/DELETE /chat/users/:id/block, GET .../block-status, POST /chat/reports | No |
| chat.conversations.read | PATCH /chat/conversations/:id/mute, GET /chat/users/:id/groups-in-common | No |
| identity.chat_reports.read | GET /chat/reports | Yes (Reportes de chat) |
| identity.chat_reports.manage | PATCH /chat/reports/:id/resolve | No |

`identity.chat_reports.read` and `.manage` are declared in atlas.identity's manifest/permission-catalog (they gate an atlas.identity navigation item and screen), even though the endpoints they guard live in atlas.chat's route files. This is a deliberate cross-module permission ownership choice, consistent with the user's decision to place the review screen under atlas.identity rather than atlas.chat — permission ownership follows the UI surface it gates, not the data's owning module.

## 19. Multi-company behavior

All new queries join through `chat_conversation_members`/`chat_conversations`, which are already company-scoped via existing `company_id` filtering in `chat-service.js`. Blocks and reports are between individual users (not conversation-scoped for blocks), so they are NOT company-scoped — a block or report follows the user across companies, consistent with `UserProfile` being a cross-company identity in this system. The admin reports screen shows all reports regardless of company (an `identity.chat_reports.read` holder is assumed to be a platform-level administrator, matching how `identity.users.read` already exposes all users, not company-filtered).

## 20. Files/storage impact

N/A — the Media tab reads existing `chat_attachments`/`FileAsset` records already produced by the existing upload flow; no new storage bucket or object-key convention is introduced.

## 21. Export/import requirements

N/A

## 22. Audit log requirements

Corrected during Plan A self-review: no route in `apps/api/src/routes/chat/` or in `apps/api/src/routes/users-routes.js` (including the existing `enabled` disable path) writes to `AuditLog` today — this module has no audit-logging precedent to extend, so the original draft's claim of "reuses the existing audit entry" was inaccurate; there is no existing entry.

N/A for this version — consistent with the rest of atlas.chat and the existing user-disable path, neither of which are audited today. Adding `AuditLog` writes for only these four new actions, while nothing else in either module is audited, would introduce an inconsistent, one-off pattern rather than following an established one. Deferred to Future Enhancements (Section 28) as a module-wide concern, not specific to this feature.

## 23. Edge cases

1. Blocking someone you already blocked: `POST /chat/users/:id/block` is idempotent (unique constraint, upsert semantics) — returns success either way.
2. Reporting a user who reports you back: independent rows, no special handling needed.
3. Muting a conversation you're not (or no longer) a member of: silent no-op, matching `archiveConversation`/`unarchiveConversation`'s established behavior (see the corrected Section 12) — not 403/404.
4. Sending a message to a conversation where the recipient blocked you AFTER the conversation already existed: `sendMessage` checks `chat_blocks` on every send (not just at conversation creation), so the block takes effect immediately on the next message attempt, not just for new conversations.
5. Either party blocking the other stops messages in both directions: `sendMessage`'s check must reject if a `chat_blocks` row exists for `(sender, recipient)` OR `(recipient, sender)`, not just one direction.
6. "Groups in common" while the other user has left a shared group: excluded, since the query filters `left_at IS NULL` for both members.
7. Disabling a user via report resolution who is already disabled: no-op, still marks the report `user_disabled`.
8. A report referencing a `conversation_id` that has since been deleted/archived: the report row keeps the id regardless (no FK cascade delete); the admin screen shows the id or "Conversacion eliminada" if the lookup join returns nothing.
9. Muted conversation's toast suppression must not affect the `notification.new` general notification channel — only the `chat.message.new` toast in `RealtimeProvider.jsx` is scoped by mute; the separate in-app notifications list is unaffected (out of scope per Non-goals).
10. Opening the profile panel for a guest/external-support conversation (`type` outside direct/group/channel): panel renders no tabs beyond what's safe — Block/Report/groups-in-common only apply to `type === "direct"` with a real `UserProfile` member, not guest sessions; guard accordingly.

## 24. Risks

1. Risk: Adding a `Media` and `Notificaciones` tab to every group/channel conversation duplicates the existing standalone `ChatFilesGallery` full-screen toggle, creating two ways to see the same files. Mitigation: keep the header's existing "Ver archivos" full-screen toggle as-is (it's already muscle-memory and works for both types); the new Media tab is a convenience view within the profile panel, not a replacement — no removal of the existing toggle in this spec.
2. Risk: `ChatWindow.jsx` is already near the project's 1000-line soft limit (829 lines confirmed during investigation). Adding `MiniChatWindow`'s new swap-slot and wiring may push related files over the limit. Mitigation: `ConversationProfilePanel` and its tabs are new, separate files (following the existing `ChannelGeneralTab.jsx`/`ChannelMembersTab.jsx` pattern) — no tab content is added inline into `ChatWindow.jsx` or `FloatingChatHub.jsx` itself, only the swap-slot state and a render call.
3. Risk: Cross-module permission ownership (identity.* permissions guarding chat.* endpoints) could confuse future maintainers. Mitigation: documented explicitly in Section 18 above; the implementation plan must include a code comment at the permission check site referencing this spec.
4. Risk: Blocking enforcement only in `sendMessage`/`createConversation` could be bypassed by other message-creation paths (e.g. system messages, guest messages). Mitigation: block checks only apply when both parties are real `UserProfile` users (not guest sessions or `sender_type: system`), and the implementation plan must enumerate every code path that inserts into `chat_messages` to confirm coverage.

## 25. Acceptance criteria

1. Given a direct conversation, when the user opens its profile panel, then Info/Media/En comun/Notificaciones tabs are shown.
2. Given a group conversation, when the user opens its profile panel, then General/Miembros/Roles (if permitted)/Media/Notificaciones tabs are shown.
3. Given a muted conversation, when a new message arrives via realtime broadcast, then no toast is shown, but the conversation's unread count still increments.
4. Given user A has blocked user B, when user B attempts to send A a message, then the API returns 403 and the message is not created.
5. Given user A has blocked user B, when user B tries to start a new direct conversation with A, then the API returns 403.
6. Given user A unblocks user B, when B sends A a message, then it succeeds.
7. Given a filed report, when an admin with `identity.chat_reports.manage` dismisses it, then its status becomes `dismissed` and it no longer appears in the default "Abierto" filter.
8. Given a filed report, when an admin disables the reported user, then that user's `UserProfile.enabled` becomes `false` and they can no longer authenticate (existing disable behavior), and the report status becomes `user_disabled`.
9. Given a user without `identity.chat_reports.read`, when they navigate to `/app/m/atlas.identity/identity/chat-reports`, then the navigation item is not shown and the route itself denies access.
10. Given two direct-chat users who share two groups, when either opens "En comun" in the other's profile panel, then both shared groups are listed.

## 26. Verification plan

- `pnpm build` — no build errors across `apps/api` and `apps/desktop`
- `pnpm db:migrate` — new migration applies cleanly against the Supabase instance
- `pnpm db:seed` — new `identity.chat_reports.read`/`.manage` permissions are seeded
- `node --test apps/api/src/routes/chat/__tests__/` — existing chat test suite still passes, plus new tests for block-enforcement in `sendMessage` and `createConversation`
- Manual: mute a group conversation, trigger a message from another account, confirm no toast appears but unread count increments
- Manual: block a user, attempt to message from the blocked account, confirm 403
- Manual: file a report, confirm it appears in `/identity/chat-reports` for an admin account, dismiss it, confirm status updates
- Manual: disable a reported user via the resolve action, confirm that user can no longer log in
- Manual (both viewports per project convention): open the profile panel at 390px and 1440px, confirm tabs and Media grid remain usable at both sizes, in both `ChatWindow` and the floating mini-window

## 27. Rollback plan

The new migration (`add_chat_moderation`) is purely additive (two new tables, one nullable column, one index) — rollback is a new forward migration dropping `chat_blocks`, `chat_reports`, and the `muted_at` column/index if the feature must be reverted. No existing data is modified, so this is safe at any point. Frontend changes can be reverted independently of the migration (the new UI simply stops being reachable; the schema can stay in place harmlessly). No feature flag is introduced — reversion is via git revert of the relevant commits plus the rollback migration if schema removal is desired.

## 28. Future enhancements

1. Report categories beyond the fixed four reasons (custom/admin-configurable reason list).
2. Blocking a user also hides their messages in shared groups (WhatsApp does not do this either, but some users may expect it).
3. Muting a conversation for a fixed duration (WhatsApp's "8 hours / 1 week / always" options) instead of only an indefinite on/off toggle.
4. Push/desktop OS-level notifications, and muting extending to them once they exist.
5. Admin ability to view reported conversation content, with a proper audited access-override mechanism (deferred due to the security sensitivity noted in Non-goals).
6. "Groups in common" for group/channel conversations too (e.g. showing overlap between two groups), not just direct chats.
7. `AuditLog` integration for atlas.chat and the identity user-disable path generally — a module-wide gap discovered during this spec's review, not specific to moderation actions.
