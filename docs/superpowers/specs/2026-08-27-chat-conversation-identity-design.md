# Chat UI — Conversation Identity & Member Accessibility

Date: 2026-08-27
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-27-chat-conversation-identity-design.md
Plan files: docs/superpowers/plans/2026-08-27-chat-conversation-identity-plan-a-backend.md, docs/superpowers/plans/2026-08-27-chat-conversation-identity-plan-b-frontend.md

First of three sub-projects from a user-requested chat UI pass (screenshots + feedback, 2026-08-27). The other two — member management as an in-place panel, and media quality/composer previews — are separate specs.

---

## 1. Feature title

Chat UI — Conversation Identity & Member Accessibility

## 2. Status

Draft

## 3. Context

The chat sidebar and header render every conversation identically regardless of type — a direct message, a group, and a channel all look like "an avatar + a name," even though channels and groups are meaningfully different under the hood (channels have roles/permissions and a public join directory; groups are simpler ad-hoc multi-person chats; both differ from a 1:1 direct chat). The user explicitly said they couldn't tell from the UI whether groups and channels are the same thing. Separately, member count is shown as a plain "1 miembro" text buried in the header, and there's no way to give a group or channel a distinctive look (every one renders as a colored circle with its first letter).

## 4. Problem

1. No visual signal distinguishes a channel, a group, and a direct chat anywhere in the UI.
2. Every channel/group looks identical (initial-letter avatar) — no way to make one recognizable at a glance.
3. Member count/access is a small text label with no preview of who's actually in the conversation.

## 5. Goals

1. A small icon badge on the avatar signals conversation type: `#` for channels, a people icon for groups, nothing for direct chats — in the sidebar list and the chat header.
2. A channel/group can be given a custom avatar: either an uploaded image or an emoji, admin's choice. Direct chats are unaffected (their "avatar" is, and stays, the other person's real photo).
3. The chat header shows an overlapping stack of member avatars (3-4 faces + a "+N" bubble for the rest) instead of "N miembro(s)" text, clickable to open the member view.

## 6. Non-goals

1. No avatar customization for direct chats — a 1:1 conversation's identity is the other person; this doesn't change.
2. Does not change *how* the member view opens (sheet vs. in-place panel) — that's the next sub-project (member management panel). This spec only wires the avatar stack's click handler to whatever the current member-viewing entry point is, through a prop the next sub-project can swap without touching this one.
3. No animated/GIF avatars, no avatar cropping/editing tool — a plain image upload (existing `atlas.files` pattern, no crop step) or an emoji, nothing fancier.
4. Doesn't touch `ChannelRolesTab`/role management UI — out of scope, unrelated to identity.

## 7. User stories

- As a member scanning my conversation list, I want to immediately tell which entries are channels, which are groups, and which are 1:1 chats.
- As a channel/group admin, I want to set a recognizable icon so members can find it at a glance among many conversations.
- As a member opening a channel, I want to see at a glance roughly who's in it without opening a separate view.

## 8. UX requirements

Spanish labels, `@atlas/ui` primitives only.

- **Type badge**: a small (≈14px) circular badge on the bottom-right corner of the avatar — `Hash` icon (channels), `Users` icon (groups), from `lucide-react`; omitted entirely for direct chats. Applied wherever a conversation avatar renders: `ChatConversationItem` (sidebar), `ChatWindow`'s header, `FloatingChatHub`'s mini-window header (the same reached-every-surface discipline established throughout this project's chat work — enumerated explicitly in Section 24).
- **Avatar customization**: `ChannelDetailsSheet` gains a new first tab, "General" (before "Miembros"/"Roles"), with: current avatar preview (badge included), a "Cambiar imagen" button (opens the OS file picker, uploads via the existing `atlas.files` pattern) and a "Cambiar emoji" button (opens an emoji picker popover, same `emoji-picker-react` library already used elsewhere in this module) — both visible to everyone, but only enabled (not hidden — a disabled control communicates "you can't do this here" better than an absent one, consistent with how `MessageActions` already handles permission-gated items elsewhere in this module) when the viewer has `channel.manage`. Setting one clears the other (a conversation has at most one avatar source: uploaded image OR emoji, never both) — selecting an emoji after an image was set replaces it, and vice versa. A "Quitar" (remove) action clears both, reverting to the initial-letter fallback.
- **Member avatar stack**: replaces the current "N miembro(s)" text in `ChatWindow`'s header — up to 4 overlapping circular avatars (`-ml-2` overlap, ring border matching the header background so they read as a stack) plus, if there are more than 4 members, a "+N" bubble in the same style. The whole stack is one clickable button; `onClick` is a prop (`onOpenMembers`) passed down from `ChatWindow`, currently wired to open `ChannelDetailsSheet` (unchanged from today's entry point) — the next sub-project may change what that prop does, not this component.
- **Fallback avatar** (no image, no emoji set): unchanged existing behavior — a colored circle with the conversation's first initial letter.

## 9. Routes/screens

No new routes. `ChannelDetailsSheet` gains one new tab ("General"). No new top-level screens.

## 10. Data model

### Modified models

**`chat_conversations`**: two new nullable columns.
- `avatar_file_id` (UUID, nullable) — references a `FileAsset.id` when the admin uploaded an image. Not a foreign key at the DB level (this table isn't Prisma-managed and already has no FK to `file_asset` for any other purpose) but conceptually points to one, same non-enforced-but-intentional relationship pattern already used for `chat_attachments`' avatar-adjacent lookups elsewhere in this module.
- `avatar_emoji` (TEXT, nullable, max ~16 chars to comfortably fit multi-codepoint emoji/ZWJ sequences — same length rationale already used for `chatToggleReactionSchema`'s emoji field in Phase D) — the plain unicode emoji character, stored and rendered as text (matching `atlas.notes`' `note.icon` pattern exactly — no special encoding).

The existing `avatar_url` TEXT column (present since the very first chat migration) is left untouched but is, and remains, dead: `chatUpdateConversationSchema` currently validates an `avatarUrl` field that `updateConversation` silently never persists (confirmed by reading the service function — the field passes validation and is then dropped on the floor). This spec does not attempt to revive `avatar_url` as a live raw-URL column — persisting a real, permanent URL for a private-bucket image is the wrong approach (Supabase signed URLs expire; the correct pattern, matching this app's own `atlas.company` branding-logo flow, is to store the `FileAsset` id and resolve a fresh signed URL server-side on every read, which is what `avatar_file_id` does). The validator's dead `avatarUrl` field is removed as part of this change (Section 24 Risk 2) rather than left alongside two new, actually-wired fields — it was never functional, so removing it breaks nothing that currently works.

## 11. Prisma impact

None — `chat_conversations` is raw-SQL-managed, not a Prisma model, same as every other chat table.
New migration required: **Yes** — 2 additive nullable columns, no data migration needed (every existing row already has neither set, which is exactly the "fallback to initial letter" state).

## 12. API contract

### PATCH /chat/conversations/:id (existing `updateConversation` — extended)

New optional body fields: `avatarFileId` (UUID or `null` to clear), `avatarEmoji` (string, max 16, or `null` to clear). Setting one clears the other server-side (Section 8 — mutual exclusivity enforced in the service function, not just the UI, so a direct API call can't leave both set). Removed field: `avatarUrl` (dead, never functional — see Section 10).

Permission: unchanged — `channel.manage` for `channel`/`group` types (existing enforcement in `updateConversation`, already covers `title`/`status`; extended to also cover the two new fields, same gate).

Response: unchanged shape (`{ data: Conversation }`), with `avatarFileId`/`avatarEmoji` reflected, and — for a conversation with `avatar_file_id` set — an additionally-resolved `avatarUrl` field in the response (a FRESH signed URL, resolved server-side the same way `getConversation`/`listConversations` already batch-resolve member avatar URLs via the existing `batchSignAvatarUrls` helper in `chat-service.js`; this response-shape `avatarUrl` is compute-on-read, not the dead stored column of the same visual name — same field name, different mechanism, documented explicitly here to avoid confusion with Section 10's dead column).

No other endpoints change. `listConversations`/`getConversation` (existing) both gain the same resolved `avatarUrl`/`avatarEmoji` fields per conversation row, reusing the exact `batchSignAvatarUrls` call already made in both functions for member avatars (the file-id batch just needs to also include each conversation's own `avatar_file_id` alongside the member avatar file ids already being collected).

## 13. SDK contract

`updateConversation(id, { avatarFileId, avatarEmoji, ... }, token)` — extends the existing method, no new SDK method. Image upload itself reuses the existing generic `atlas.files.upload(formData, token)` (same call `CompanyBranding.jsx` already makes) — not a chat-specific upload endpoint.

## 14. Validator contract

`chatUpdateConversationSchema` (existing, `packages/validators/src/chat.js`):
```javascript
export const chatUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  avatarFileId: z.string().uuid().nullable().optional(),
  avatarEmoji: z.string().max(16).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```
(`avatarUrl: z.string().url().optional()` removed — dead field, see Section 10.)

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in module, not AME3.

## 16. Navigation impact

N/A — no new nav entries; the new "General" tab lives inside the existing `ChannelDetailsSheet` entry point.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

No new permission keys. `channel.manage` (existing, Phase A) now also gates `avatarFileId`/`avatarEmoji` updates, same as it already gates `title`/`status`.

| Permission key | Guards |
|---|---|
| `channel.manage` (existing) | `PATCH /chat/conversations/:id` — now also for `avatarFileId`/`avatarEmoji`, in addition to the fields it already covered |

## 19. Multi-company behavior

Unchanged pattern — `updateConversation` already scopes through `assertMember`/`assertChannelPermission` on the specific `conversationId`; no new cross-company query path introduced. The uploaded `FileAsset` itself goes through the existing `atlas.files.upload` flow, which already enforces its own company-scoped storage/permission model (unchanged, reused as-is).

## 20. Files/storage impact

A new use of the existing `atlas.files` upload flow — an uploaded conversation avatar becomes a normal `FileAsset` row (private bucket, same as every other chat attachment), resolved to a signed URL on read (Section 12). No new bucket, no new storage code path.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — consistent with every other conversation-metadata edit in this module (title/description changes aren't audited today either).

## 23. Edge cases

1. **Setting an emoji when an image was already set (or vice versa)**: the previous one is cleared server-side in the same request — never both set at once (Section 12).
2. **Uploading a very large/wrong-type image**: reuses `atlas.files.upload`'s existing validation (file size/type limits already enforced by that generic endpoint) — no new validation needed here.
3. **A member without `channel.manage` opens the "General" tab**: sees the current avatar and the disabled "Cambiar imagen"/"Cambiar emoji" buttons (Section 8 — disabled, not hidden).
4. **A direct conversation somehow receives an `avatarFileId`/`avatarEmoji` via a stray direct API call**: `updateConversation`'s existing type check only invokes `assertChannelPermission("channel.manage")` for `channel`/`group` types (Phase A's existing behavior) — for `direct`, there's no role system to check against, same gap already accepted for `title`/`status` on direct conversations today (not worsened by this change, not fixed by it either — out of scope, matches existing precedent).
5. **More than 4 members in the header stack**: shows the first 4 (by `joined_at`, matching the existing member-list ordering convention already used elsewhere in this module) + a "+N" bubble for the rest, not a scrollable list — clicking still opens the full member view.

## 24. Risks

1. **Risk (the central risk, learned from every prior phase of this project)**: a new visual element (the type badge) has to reach every place a conversation's avatar renders, not just the sidebar. Enumerated up front: `ChatConversationItem.jsx` (sidebar), `ChatWindow.jsx`'s header, `FloatingChatHub.jsx`'s mini-window header (`getAvatarUrl`/`AvatarCircle` helpers already exist there per this file's own code). `ExternalInboxScreen.jsx` is correctly excluded — it only ever shows `external_support` conversations, direct-chat-shaped and guest-facing, no channel/group badge ever applies there. Mitigation: Plan B must wire the badge into all 3 real surfaces from the start, not just `ChatWindow`.
2. **Risk**: removing `chatUpdateConversationSchema`'s dead `avatarUrl` field could theoretically break a caller relying on it. Mitigation: confirmed by reading `updateConversation`'s actual service code that this field has never been persisted — it passes Zod validation and is silently dropped before the SQL `UPDATE`, so no caller could ever have observed it taking effect; removing it changes nothing about observable behavior, only removes an already-broken promise.
3. **Risk**: adding `avatar_file_id` to the same file-id batch-resolution pass already used for member avatars (`batchSignAvatarUrls`) in `listConversations`/`getConversation` could, if implemented carelessly, accidentally leak a member's own avatar as a conversation's avatar or vice versa (id collision/mixup in the batch map). Mitigation: Plan A must key the resolved-URL map by file id (already how `batchSignAvatarUrls` returns its map — `{ [fileId]: signedUrl }`), then look up each need (conversation avatar vs. each member avatar) independently by its own file id — no shared/ambiguous key.
4. **Risk**: `ChannelDetailsSheet.jsx` gains a new tab — check its current line count doesn't push past this project's file-size guidance after this addition; if it does, the new "General" tab content should live in its own `ChannelGeneralTab.jsx` file from the start (matching the existing `ChannelMembersTab.jsx`/`ChannelRolesTab.jsx` extraction pattern already established for this exact sheet in Phase B), not inlined into the sheet itself.

## 25. Acceptance criteria

1. Given a channel, its avatar (wherever rendered) shows a small `#` badge; given a group, a people-icon badge; given a direct chat, no badge.
2. Given a member with `channel.manage` uploads an image as a channel's avatar, then every surface rendering that conversation (sidebar, header, floating mini-window) shows the new image within a normal cache-refresh cycle.
3. Given an emoji is set after an image was previously set, the image is cleared and the emoji renders instead — never both.
4. Given a channel with 6 members, the header shows 4 avatars + a "+2" bubble; clicking the stack opens the existing member view.
5. Given a member without `channel.manage` opens the General tab, the avatar-change buttons are visibly present but disabled, not absent.

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — new coverage for the mutual-exclusivity server-side enforcement (Edge case 1) and the removed dead `avatarUrl` field no longer being accepted (or simply ignored as an unknown key, per Zod's default strip-unknown-keys behavior — confirm which and assert it explicitly).
- Manual browser QA if a session is available: set an image avatar, confirm it appears in the sidebar; switch to an emoji, confirm the image is replaced; check all 3 conversation types show the correct type badge.

## 27. Rollback plan

New migration (2 additive nullable columns) — revertable via a new forward migration dropping both if ever needed; no data-destructive risk (every existing row already has neither set). The validator field removal (`avatarUrl`) is trivially revertable by re-adding it, though there's no reason to since it was never functional.

## 28. Future enhancements

1. Image cropping/positioning before upload (out of scope here — plain upload only, per Non-goal 3).
2. Animated avatar support.
3. A dedicated "who's online" indicator woven into the member avatar stack (small green dot per avatar) — deferred, not requested, would need presence data threaded into this specific component.
