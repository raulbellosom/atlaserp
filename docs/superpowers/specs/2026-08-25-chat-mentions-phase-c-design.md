# Chat Channels & Roles — Phase C: Mentions

Date: 2026-08-25
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-25-chat-mentions-phase-c-design.md
Plan files: docs/superpowers/plans/2026-08-25-chat-mentions-phase-c-plan-a-backend.md, docs/superpowers/plans/2026-08-25-chat-mentions-phase-c-plan-b-frontend.md

---

## 1. Feature title

Chat Channels & Roles — Phase C: Mentions (@user, @role, @everyone/@here)

## 2. Status

Draft

## 3. Context

Phases A and B built channels, roles, and their management UI. Atlas already has a **generic, reusable @mention UI component** (`packages/ui/src/components/MentionTextarea.jsx`) with autocomplete, a serialized storage format (`@[uuid:DisplayName]`), a renderer (`renderMentionText`), and an ID extractor (`parseMentionIds`) — already used by `atlas.projects` comments. Chat currently has neither: `MessageComposer.jsx` uses a plain `<textarea>` and `ChatMessageBubble.jsx` renders `message.body` as plain text.

## 4. Problem

A chat message cannot notify a specific person, a role's holders, or the whole channel — every recipient only learns about a new message through the generic "new message" notification, with no way to signal "this one is about you specifically."

## 5. Goals

1. Typing `@` in the message composer opens an autocomplete listing conversation members, this conversation's roles, and (only if the sender's role permits it) `@everyone`/`@here`.
2. Sending a message with a `@user` mention notifies that user specifically (a distinct, higher-signal notification, not just the generic new-message one).
3. Sending a message with a `@role` mention notifies every active member currently holding that role.
4. Sending a message with `@everyone` notifies every active member; `@here` is treated identically to `@everyone` for notification purposes in this phase (documented simplification — see Section 24 risk 2), but remains a visually/semantically distinct token gated by its own permission.
5. `@everyone`/`@here` are silently stripped of their notification effect (the message still sends, the text still renders as a mention chip) if the sender's role lacks the corresponding permission — never a hard rejection of the whole message.
6. Rendered messages show mention chips (`@Name`) instead of raw `@[uuid:Name]` tokens; a message that mentions the current viewer is visually distinguished (subtle highlight).

## 6. Non-goals

1. No mention search/jump-to-mentions inbox — future enhancement.
2. No unread-mention badge count in the topbar — future enhancement (already tracked as a pending item for `atlas.chat` generally).
3. No true presence-based `@here` (only currently-online members) — treated as `@everyone` for notification purposes this phase; a real distinction would require the backend's stateless message-send request to query live Realtime presence, which it doesn't have access to today.
4. No change to `packages/ui/src/components/MentionTextarea.jsx` itself — reused as-is. Roles and `@everyone`/`@here` are represented as synthetic entries in the same `members`-shaped list this component already accepts (see Section 8), not a component change.
5. No new database table — mention data is stored in `chat_messages.metadata.mentions` (JSONB, already an existing column), not a new join table.

## 7. User stories

- As a channel member, I want to type `@` and pick a teammate so they get a direct notification about my message.
- As a channel Admin, I want to `@everyone` for an important announcement, and know that only I (and other Admins/Owners) can do that — a base Member typing `@everyone` shouldn't be able to blast the whole channel.
- As any member, I want to see at a glance which messages mention me, without reading every message in a busy channel.

## 8. UX requirements

All labels in Spanish. Reuses `@atlas/ui`'s existing `MentionTextarea`, `renderMentionText`, `parseMentionIds` — no changes to that package.

- **Mention candidate list** (the `members` prop passed into `MentionTextarea`) is built per-conversation from three sources, in this display order: (1) real members (`{ id: userId, displayName, avatarUrl, email }`, excluding the sender), (2) this conversation's roles as pingable pseudo-members (`{ id: role.id, displayName: role.name, isRole: true }` — `MentionTextarea` doesn't care about extra fields, it only needs `id`/`displayName`/optional `avatarUrl`/`email`), (3) two synthetic entries with fixed sentinel UUIDs for `@everyone` and `@here`, included **only if** the sender's own role currently grants `mentions.everyone`/`mentions.here` respectively (computed client-side via the existing `chatPermissions.js` from Phase B — same "UI gating only, backend re-validates" contract already established there).
- **Composer**: `MessageComposer.jsx`'s existing plain `<textarea>` is replaced with `MentionTextarea`. The existing emoji-insert-at-cursor behavior degrades to "insert at end of text" when done through this component (`MentionTextarea` doesn't expose its internal textarea ref to the parent) — an accepted, documented UX simplification, not a regression serious enough to justify reimplementing the mention-picker mechanics from scratch.
- **Message rendering**: `ChatMessageBubble.jsx`'s plain-text render sites are replaced with `renderMentionText(message.body)`. A message whose `metadata.mentions` includes the current viewer's user id, or their current role id in this conversation, or `everyone`/`here` (each already resolved and gated server-side at send time, per Section 12) gets a subtle left-border/background highlight (`bg-[hsl(var(--primary)/0.05)] border-l-2 border-[hsl(var(--primary))]` or similar, matching existing bubble styling conventions).
- **Loading/empty states**: N/A — the mention candidate list reuses conversation/role data Phase B's hooks already fetch; no new loading state beyond what those hooks already provide.

## 9. Routes/screens

No new routes or screens — modifies two existing components (`MessageComposer.jsx`, `ChatMessageBubble.jsx`) and adds one hook.

| Component/Hook | File | Module |
|---|---|---|
| `useMentionCandidates` | `apps/desktop/src/modules/atlas.chat/hooks/useMentionCandidates.js` | atlas.chat |

## 10. Data model

No new tables.

### Modified models

**`chat_messages`** (no schema change — `metadata` JSONB already exists): after this phase, a message that contains mentions has `metadata.mentions = { userIds: string[], roleIds: string[], everyone: boolean, here: boolean }` — the *resolved, permission-checked* mention set at send time (a point-in-time snapshot; if someone's role changes later, past messages' mention data is not retroactively updated — matches how every other chat platform treats historical mentions).

## 11. Prisma impact

New models: none. Modified models: none (JSONB field, not Prisma-modeled; chat tables are raw-SQL-managed). New migration required: No.

## 12. API contract

### POST /chat/conversations/:id/messages (modified behavior, same endpoint)

Auth/permission: unchanged.
Body: unchanged (`{ body, messageType, metadata, attachmentIds }` — mentions are embedded in `body`'s existing serialized text via the shared `@[uuid:name]` format, not a separate field).
New behavior: the server parses `@[id:name]` tokens out of `body` (via the existing, already-shared `apps/api/src/lib/mention-utils.js#parseMentionIds` — no new parsing logic needed), classifies each `id` as a real active member, a role in this conversation, the `@everyone` sentinel, or the `@here` sentinel (unrecognized/stale IDs are silently ignored), and:
- Writes the resolved set to the inserted message's `metadata.mentions`.
- If the sender lacks `mentions.everyone`/`mentions.here` and the corresponding sentinel was present, drops it from the resolved set (message still sends normally otherwise).
- Fires a `chat.mention.new` notification (distinct from the existing `chat.message.new`) to the union of: directly-mentioned users, active holders of any mentioned role, and (if applicable) all other active members for `@everyone`/`@here`. The existing generic `chat.message.new` notification's recipient list excludes anyone who already received a `chat.mention.new` for this message (no double notification).
Response shape: unchanged (`{ data: Message }`) — `metadata.mentions` is simply part of the already-returned `metadata` field.

No other endpoints change.

## 13. SDK contract

No new methods — mentions ride inside the existing `sendMessage`/`listMessages` request/response bodies via `metadata`.

## 14. Validator contract

No new schemas — `chatSendMessageSchema`'s existing `body`/`metadata` fields are unchanged in shape; mentions are encoded within the existing `body` string.

## 15. Module manifest impact

N/A.

## 16. Navigation impact

N/A.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

No new permission keys — `mentions.everyone` and `mentions.here` already exist in the channel-scoped permission catalog (Phase A, `CHAT_PERMISSIONS.MENTIONS_EVERYONE`/`MENTIONS_HERE`) but have never been enforced anywhere until this phase.

| Permission key | Enforced by |
|---|---|
| `mentions.everyone` | `sendMessage` — drops the `@everyone` sentinel from the resolved mention set (and thus from notification fan-out) if the sender's role lacks it |
| `mentions.here` | `sendMessage` — same, for `@here` |

`@role` and `@user` mentions require no special permission beyond ordinary conversation membership (already enforced by `assertMember`, unchanged) — mirrors that pinging a specific person or a named role is not a privileged action in comparable products (Discord, Slack); only mass-pinging the whole channel is.

## 19. Multi-company behavior

Unchanged — mentions only ever resolve within the sending conversation's existing member/role set, already company-scoped by Phase A/B.

## 20. Files/storage impact

N/A.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — mentions are a messaging feature, not an administrative action; no audit log entries are required (consistent with regular chat messages not being audited today).

## 23. Edge cases

1. **Mentioning a user who has since left the conversation**: `parseMentionIds` extracts the ID regardless; classification against "active members" excludes them, so they're silently dropped from the resolved set (no notification, no error) — the message still sends with the mention chip rendered (the display name was already baked into the token at compose time, so it still shows correctly even though the person is gone).
2. **Mentioning a role that gets deleted between compose and send** (rare race): same treatment — the ID doesn't match any active role, silently dropped.
3. **A message with only an unauthorized `@everyone`** (sender lacks the permission, no other real mentions): the message sends as plain text with the `@everyone` chip still visually rendered (since `renderMentionText` doesn't know about permissions, it just renders any valid token) but triggers zero mention notifications — the generic `chat.message.new` notification still fires to all members as it always has. This is intentional: the text is not censored, only the mass-notification side-effect is suppressed.
4. **Self-mention** (sender includes their own ID via a crafted token, or picks themselves — the composer's candidate list already excludes the sender, but a manually-typed token could still reference them): excluded from the notification recipient set (matches `sendMessage`'s existing `user_id != profileId` filter for the generic notification), no special-case needed since the same "exclude sender" logic reuses that filter.
5. **Duplicate mentions across categories** (e.g., `@everyone` plus an explicit `@user` mention of someone who's also covered by `@everyone`): the recipient union is deduplicated before dispatch — one notification per person regardless of how many ways they were mentioned in the same message.
6. **`@here`'s notification-parity-with-`@everyone`** is a deliberate, documented simplification (Section 6, non-goal 3) — not a bug to "fix" within this phase.

## 24. Risks

1. Risk: `MessageComposer.jsx`'s emoji-insert-at-cursor UX degrades to insert-at-end once it's driven by `MentionTextarea` (which doesn't expose its internal textarea ref externally). Mitigation: accepted, documented (Section 8) — emoji insertion is a minor convenience feature; most usage already appends near the end of in-progress text. Revisit only if user feedback specifically flags this as a regression.
2. Risk: `@here` treated identically to `@everyone` server-side could surprise a user who expected it to reach only online members. Mitigation: documented non-goal (Section 6.3); the permission gate (`mentions.here`, separate from `mentions.everyone`) still lets an org configure who may use it at all, even without the online-only targeting.
3. Risk: `ChatMessageBubble.jsx` is already at 886 lines (close to the 1000-line soft limit). Mitigation: the mention-rendering change is a small, localized swap of `message.body` → `renderMentionText(message.body)` at the existing render sites, not new bulk logic — should add well under 20 lines total. If a future phase needs to add more to this file, it should be split then, not deferred further.

## 25. Acceptance criteria

1. Given a channel member typing `@` in the composer, when they select a teammate, then the composer inserts a `@[uuid:Name]` token and displays it as `@Name`.
2. Given a message sent with a `@user` mention, when the mentioned user is an active member, then they receive a `chat.mention.new` notification distinct from the generic new-message one.
3. Given a message sent with a `@role` mention, when 3 active members hold that role, then all 3 receive a `chat.mention.new` notification (and, if any of them is also the sender, they are excluded).
4. Given a Member (position 0, no `mentions.everyone`) who sends a message containing `@everyone`, when the message is sent, then it succeeds (200/201) but no `chat.mention.new` notifications are dispatched to the wider channel — only any other explicit `@user`/`@role` mentions in the same message still resolve normally.
5. Given an Admin (has `mentions.everyone`) who sends `@everyone` in a 10-member channel, when the message is sent, then all 9 other active members receive exactly one `chat.mention.new` notification each (not also a separate `chat.message.new`).
6. Given a message that mentions the current viewer, when it renders in `ChatMessageBubble`, then it has a visually distinct highlight compared to a non-mentioning message.

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — new tests for mention parsing/classification/permission-gating in `sendMessage`.
- Manual browser QA (`pnpm dev:frontend`) at 390px and 1440px: type `@`, confirm autocomplete shows members + roles + (conditionally) everyone/here; send a mention; confirm the rendered chip and highlight.

## 27. Rollback plan

Backend change is additive (new parsing/notification logic inside `sendMessage`, a JSONB field usage — no schema change). Frontend swaps two existing components' render/input mechanics for the equivalent `@atlas/ui` primitives already used elsewhere in the app — revertable by reverting the commits with no data impact (mention data already stored in `metadata` simply stops being read/written, not corrupted).

## 28. Future enhancements

1. Mention search / "jump to my mentions" inbox.
2. Unread-mention badge (ties into the already-pending generic chat notification-integration backlog item).
3. True presence-based `@here` (online members only).
4. Per-user notification preferences for mentions (mute `@here` but not direct `@user` mentions) — already flagged as a Phase A future enhancement, applies here too.
