# Chat Channels & Roles — Phase E: Threads

Date: 2026-08-26
Status: Draft
Author: Claude (agent)
Spec file: docs/superpowers/specs/2026-08-26-chat-threads-phase-e-design.md
Plan files: docs/superpowers/plans/2026-08-26-chat-threads-phase-e-plan-a-backend.md, docs/superpowers/plans/2026-08-26-chat-threads-phase-e-plan-b-frontend.md

Note on process: per the user's standing instruction ("adelante y no pares hasta terminar") covering this entire 6-phase roadmap, this spec was authored directly rather than through interactive brainstorming Q&A — design decisions below are judgment calls, each with its rationale stated inline so they can be challenged/revised on review rather than re-litigated from scratch.

---

## 1. Feature title

Chat Channels & Roles — Phase E: Threads

## 2. Status

Draft

## 3. Context

Phases A–D built channels, roles, mentions, pinning, and reactions. Every message today is a flat, top-level entry in its conversation's timeline. A side conversation about one specific message (e.g. "wait, what did you mean by X?") currently has no home except either replying inline (burying the original context) or starting a new message that loses the link entirely.

## 4. Problem

There's no way to have a focused side-conversation anchored to one message without cluttering the main channel timeline for everyone else.

## 5. Goals

1. Any member can reply "in thread" to a message in a `channel`/`group` conversation, creating (implicitly, on first reply) a flat, one-level-deep thread rooted at that message.
2. The root message shows a lightweight "N respuestas" indicator in the main timeline; the replies themselves do NOT appear inline in the main timeline (Slack/Discord convention — keeps the main channel readable during a side-discussion).
3. Clicking the indicator (or "Responder en hilo" from the message's action menu) opens a panel showing the root message, all its replies in order, and a composer scoped to that thread.
4. Only thread participants (the root's author + everyone who has replied) and anyone explicitly @-mentioned get notified of a new reply — not the whole channel, which would defeat the point of moving a side-discussion out of the main timeline.

## 6. Non-goals

1. No nested threads (a reply to a reply). Attempting to reply to a message that is itself already a thread reply transparently redirects the new reply to that message's own root (auto-flatten) — same effective behavior as Slack, no error surfaced to the user.
2. No "also send to channel" checkbox (Slack has this; skipped for MVP — a real feature that can be added later without a data-model change, since it would just mean a thread reply message could ALSO be visible in the main timeline, an additive flag).
3. No thread support in `direct`/`external_support` conversations — a 1:1 conversation already is a single thread; there's no separate "channel" for it to be siloed away from. Consistent with Phase D's `messages.pin`/pinned-messages-sheet scoping decision.
4. No participant-avatar stack on the reply-count indicator (Slack shows small avatars of repliers next to the count) — the count + last-reply relative time is enough for MVP; avatars are a pure visual enhancement, listed as a future enhancement.
5. No thread-level "mute"/notification-preference override — thread notifications follow the same channel/global notification settings as any other chat notification (no new preference surface).
6. No permission gate beyond existing conversation membership — replying in a thread requires the same membership check as sending any other message in that conversation; no new `CHAT_PERMISSIONS` key.

## 7. User stories

- As a channel member, I want to reply to one specific message without flooding the channel with back-and-forth that only two of us care about.
- As a channel member, I want to see at a glance which messages have an active side-conversation, without having every reply clutter my main view.
- As a thread participant, I want to be notified when someone replies in a thread I'm part of, without needing to be @-mentioned every time.

## 8. UX requirements

Spanish labels, `@atlas/ui` primitives only.

- **Message action menu** (`MessageActions` in `ChatMessageBubble.jsx`): a new "Responder en hilo" item (icon: `MessageSquare` or `Reply` from `lucide-react` — pick whichever isn't already used for something else in this file's imports), visible only for `channel`/`group` conversations, on any non-deleted message that is NOT itself already a thread reply (i.e. `message.threadRootId` is falsy — a reply's own action menu never offers to start a nested reply; per Non-goal 1, clicking it on a reply would just have to redirect anyway, so hiding it entirely is simpler and avoids implying nesting exists).
- **Reply-count indicator**: when `message.threadReplyCount > 0`, render a small pill/button below the message body (same visual tier as the reaction-pill row Phase D added, positioned after it) reading "💬 N respuestas · hace Xm" (relative time from `message.threadLastReplyAt`, reusing `formatMessageTime`/existing relative-time helpers already in this module). Clicking it opens `ThreadPanel` for that message.
- **`ThreadPanel`**: a `Sheet` (same pattern as `PinnedMessagesSheet`/`ChannelDetailsSheet`), right side, showing: the root message (rendered read-only-ish — reuse `ChatMessageBubble` but without its own thread-reply affordances, since you can't reply-in-thread to a thread's own root from inside the panel a second time in a meaningful new way — its action menu can stay limited to react/copy/pin/delete), a scrollable list of replies (also `ChatMessageBubble`, each WITHOUT a "Responder en hilo" item per the UX rule above), and a `MessageComposer` pinned to the bottom of the panel that sends with `threadRootId` set to the root's id.
- **Loading/empty states**: `ThreadPanel` uses `Skeleton` while loading the reply list; an empty thread (root has zero replies yet, panel opened via the message-action menu before anyone has replied) shows a short prompt ("Se el primero en responder.") rather than `EmptyState`'s usual iconography (this is an expected, common first-open state, not an error/empty condition worth a heavyweight empty state).

## 9. Routes/screens

No new top-level routes. New component: `ThreadPanel` (`apps/desktop/src/modules/atlas.chat/components/ThreadPanel.jsx`), opened from `ChatMessageBubble`'s reply-count indicator or `MessageActions`' "Responder en hilo" item — both routes converge on the same panel-open state, owned by `ChatWindow` (same ownership pattern already used for `showDetails`/`showPinned`).

## 10. Data model

### Modified models

**`chat_messages`**: three new columns.
- `thread_root_id` (UUID, nullable, FK → `chat_messages.id` ON DELETE CASCADE) — set on a reply, pointing at the root message. NULL for every top-level message, including a message that has replies (a message becomes a "thread root" implicitly, the first time another message points `thread_root_id` at it — no separate boolean flag needed).
- `thread_reply_count` (INT, NOT NULL DEFAULT 0) — denormalized counter on the root message only (always 0 on a reply itself), incremented when a reply is created, decremented when a reply is soft-deleted. Avoids an N+1 `COUNT(*)` per message when rendering the main timeline's reply-count pills.
- `thread_last_reply_at` (TIMESTAMPTZ, nullable) — denormalized on the root message only, set to the reply's `created_at` on each new reply (not touched on delete — matches how `chat_conversations.last_message_at` isn't rewound when the last message is deleted elsewhere in this module).

No new table. `ON DELETE CASCADE` on `thread_root_id` means hard-deleting a root message's row would cascade-delete its replies — consistent with this module's existing FK convention (`chat_attachments.message_id`, `chat_message_reactions.message_id` both cascade the same way), even though in practice this module only ever soft-deletes messages (`deleted_at`), never hard-deletes.

## 11. Prisma impact

New models: none. `chat_messages` is raw-SQL-managed (not a Prisma model), same as every other chat table.
New migration required: **Yes** — `chat_messages` gains 3 columns.
Migration safety notes: all three columns are nullable-or-zero-defaulted, safe to add to a live table with no backfill needed (every existing row is implicitly "not part of a thread," which is exactly what `thread_root_id IS NULL, thread_reply_count = 0, thread_last_reply_at = NULL` already means).

## 12. API contract

### POST /chat/conversations/:id/messages (existing `sendMessage` endpoint — extended)

New optional body field: `threadRootId` (UUID). When present:
- The target message must exist, belong to the same conversation, and not be soft-deleted — else 404 ("Mensaje no encontrado.", consistent with this module's existing "don't leak details" convention for cross-conversation/nonexistent IDs).
- Auto-flatten (Non-goal 1): if the target message's own `thread_root_id` is non-null, the reply is actually rooted at THAT ancestor instead — resolved server-side, transparent to the caller.
- On insert: sets `thread_root_id` to the resolved root id; increments that root's `thread_reply_count` and sets its `thread_last_reply_at` to the new message's `created_at`, both in the same logical operation as the insert (wrapped in a transaction — see Section 24 Risk 2).
- Does NOT call `updateConversationLastMessage` (Section 8 Goal 2 — thread replies never bump the conversation's sidebar preview/last-message-at).
- Mentions inside a thread reply still resolve exactly as they do for any other message (Phase C's `chat-mentions-service.js` is reused unmodified) — a thread reply can `@mention` someone not otherwise in the thread, and that person still gets `chat.mention.new` per Phase C's existing behavior, on top of (not instead of) the thread-reply notification logic below.
- **Notification contract (differs from a normal send)**: when `threadRootId` is present, `sendMessage` does NOT fan out the generic `chat.message.new` notification to every conversation member (Goal 4 — that would defeat the purpose of moving a side-discussion out of the main timeline). Instead it publishes a new `chat.thread.reply` event: title "Nueva respuesta en un hilo", recipients = the distinct set of `{root message's sender_user_id} UNION {sender_user_id of every existing reply under this root}`, minus the actor who just replied, minus anyone already in that send's `mentionResult.notifyUserIds` (they get `chat.mention.new` instead, same precedence rule Phase C already applies between `chat.message.new` and `chat.mention.new`). `dedupeKey: chat.thread.reply:${msg.id}`, same `priority: "medium"` tier as `chat.message.new`. The realtime broadcast (`broadcaster.broadcastToUsers`) is unchanged in shape — still fires `chat.message.new` over the websocket layer to every conversation member (that channel is cheap, idempotent, and already something every open `ChatWindow`/`FloatingChatHub` listens to for cache invalidation), but now carries a `threadRootId` field in its payload so the frontend can distinguish "invalidate the main message list because a top-level message arrived" from "invalidate the main message list (to refresh the pill's count) AND, if this thread's panel happens to be open, invalidate the thread query too" — this is a payload addition to an existing broadcast, not a new realtime event type.

Response: unchanged shape (`{ data: Message }`), with the new `threadRootId`/`threadReplyCount`/`threadLastReplyAt` fields populated per Section 14.

### GET /chat/messages/:id/thread (new)

Auth: required
Permission: caller must be a member of the root message's conversation (existing `assertMember` pattern) — same membership check as reading any other message in that conversation, no new permission key.
Response: `{ data: { root: Message, replies: Message[] } }` — `replies` ordered by `created_at ASC` (oldest first, chronological reading order, unlike the main timeline's `DESC` + reverse-on-client convention — a thread reads top-to-bottom like a mini-conversation, no "load more" pagination for MVP given expected reply volumes are small; see Non-goal-adjacent scope note in Section 24).
Errors: 404 if `:id` doesn't exist, is soft-deleted, or the caller isn't a member of its conversation (same non-leaking 404 convention as pinning). If `:id` refers to a message that is itself a reply (has its own `thread_root_id`), the endpoint transparently resolves to and returns that ancestor's thread (same auto-flatten behavior as sending) rather than erroring — so a stale client reference to a reply's id still opens the right panel.

### GET /chat/conversations/:id/messages (existing `listMessages` — filter added)

Adds `AND m.thread_root_id IS NULL` to the WHERE clause — thread replies are excluded from the main timeline (Section 8 Goal 2). This is the single most important line of this phase; see Section 24 Risk 1 for the full enumerated list of other call sites that read `chat_messages` and had to each be individually checked for whether they need the same filter.

No other endpoints gain new required fields; `getMessageFull`/`listMessages` both gain the three new fields per Section 14 (present, zero/null-valued, on every message that isn't a thread reply's root).

## 13. SDK contract

Domain: `chat` — `sendMessage(conversationId, { ..., threadRootId }, token)` (extends the existing options object, no new SDK method), `getThread(messageId, token)` (new, maps to `GET /chat/messages/:id/thread`).

## 14. Validator contract

`chatSendMessageSchema` (existing, in `packages/validators/src/chat.js`) gains one new optional field: `threadRootId: z.string().uuid().optional()`.

No new schema for the thread-read endpoint (GET, no body).

Response shape addition (not a validator, but documented here since it's a contract both sides share): every `Message` object gains `threadRootId` (string | null), `threadReplyCount` (number, always present, 0 by default), `threadLastReplyAt` (string | null, ISO timestamp).

## 15. Module manifest impact

N/A — `atlas.chat` is a built-in module, not AME3.

## 16. Navigation impact

N/A — reached entirely from within the existing chat window.

## 17. Blueprint impact

N/A.

## 18. RBAC/permissions

No new permission keys. Replying in a thread requires the same conversation membership every message send already requires; `channel`/`group`-only scoping (Non-goal 3) is a UI-level + read/write-endpoint-level type check, not a new RBAC permission — consistent with how Phase D scoped pinning's UI (permission-gated) differently from reactions (unprivileged, membership-only) depending on whether the action needed rank-based gating. Threads need no rank gating: any member who can send a message can reply in a thread.

| Permission key | Guards |
|---|---|
| (none new) | Thread replies use the same implicit membership check as any message send |

## 19. Multi-company behavior

Unchanged pattern — every new/modified query scopes through the message's `conversation_id` and the existing `assertMember` pattern; no cross-company access paths introduced. The auto-flatten resolution (Section 12) explicitly re-validates the resolved root belongs to the SAME `conversationId` the caller is posting into, closing an otherwise-possible cross-conversation `threadRootId` injection (e.g. a caller passing a `threadRootId` from a different conversation they're also a member of) — rejected as 404, not silently redirected across conversations.

## 20. Files/storage impact

N/A — thread replies are ordinary `chat_messages` rows and can carry attachments exactly like any other message (existing attachment-upload flow, unmodified); no new storage interaction.

## 21. Export/import requirements

N/A.

## 22. Audit log requirements

N/A — consistent with every other message-level action in this module (send/edit/delete/pin/react), none of which are audited today (Phase A's audit table covers role/permission changes only).

## 23. Edge cases

1. **Replying to a message in a conversation the caller isn't a member of**: 404, not 403 (existing convention).
2. **Replying to a soft-deleted message**: 404 ("Mensaje no encontrado.") — a deleted message can't spawn a new thread, and can't receive new replies if it was already a thread root (existing replies remain visible/soft-deleted-placeholder as normal, per Section 12's "no other endpoints gain new required fields" — deleting a root does NOT cascade-soft-delete its replies, only a hard-delete would cascade at the FK level, which this module never does).
3. **Replying to a reply** (Non-goal 1): auto-flattens to the ancestor root, no error.
4. **Deleting a reply**: the root's `thread_reply_count` is decremented (Section 10) so the pill's count reflects only currently-visible (non-deleted) replies — matching how `chat_conversations`' `unread_count`/`last_message` subqueries already exclude soft-deleted messages elsewhere in this module. The deleted reply itself remains in `GET /chat/messages/:id/thread`'s `replies` array (soft-delete convention: deleted messages stay in list responses as placeholders — `listMessages` already does this, no `deleted_at IS NULL` filter there today — so the thread reply list follows the same precedent for consistency, rendering "Mensaje eliminado" via the frontend's existing `isDeleted` handling, not disappearing entirely).
5. **Deleting a root message that has replies**: the root becomes a soft-deleted placeholder like any other deleted message (existing `deleteMessage` behavior, unmodified) but its replies and `thread_reply_count`/`thread_last_reply_at` are left untouched — the thread remains fully readable via `GET /chat/messages/:id/thread` (the endpoint works by message id regardless of the root's own `deleted_at`), it's only the reply-count pill in the now-placeholder-text main-timeline bubble that becomes moot (still rendered if `threadReplyCount > 0`, still clickable, still opens the thread — a deleted root doesn't prevent existing side-discussion from being read).
6. **Pinning a thread reply**: allowed, unmodified `pinMessage` behavior (Section 12 of Phase D's spec already treats "any message by id" uniformly) — a pinned reply appears in `PinnedMessagesSheet` like any other pinned message; no special-casing needed, though clicking "Ver en el chat" on a pinned reply (Phase D's `onJumpToMessage`/`scrollToMessage` mechanism) will fail to find it in the main timeline's DOM (replies aren't rendered there) — see Section 24 Risk 3 for how this is handled.
7. **Reacting to a thread reply**: unmodified, allowed (reactions are unprivileged and message-shape-agnostic already).

## 24. Risks

1. **Risk (the central risk of this phase, learned from Phase D's own review cycle)**: multiple existing SQL call sites read `chat_messages` and each had to be individually audited for whether "main timeline" semantics (thread replies excluded) apply to it. Enumerated during spec authorship by reading every `FROM chat_messages`/`chat_messages m` occurrence in `chat-service.js`:
   - `listMessages` (main channel query) — **needs the filter** (`AND m.thread_root_id IS NULL`), this is the core requirement.
   - `listConversations`' `unread_count` subquery — **needs the filter** (a thread reply that never renders in the main timeline shouldn't inflate the "unread" badge for a conversation, which would otherwise show e.g. "3 unread" while only 1 new message is actually visible when the conversation is opened).
   - `listConversations`' `last_message` preview subquery — **needs the filter** (a thread reply shouldn't become the sidebar's "last message" preview text for the whole conversation; Slack/Discord convention is that side-thread activity doesn't surface there).
   - `getMessageFull` (single message by id) — **does NOT need the filter** — it's an id lookup, used both for main-timeline messages and for fetching thread replies themselves; filtering here would break the thread-read endpoint that explicitly wants replies.
   - `editMessage`/`deleteMessage` (by id) — **do NOT need the filter** — id-scoped mutations work identically regardless of thread membership (deleteMessage gains the counter-decrement logic from Section 10/23-4, which is additive, not a "which messages to touch" filter).
   - `pinMessage`/`listPinnedMessages` — **do NOT need the filter** — pinning is orthogonal to thread membership (Edge case 6).
   - `listExternalInbox`'s message-count/unread/last-message subqueries — **do NOT need the filter** — threads are scoped out of `external_support` conversations entirely (Non-goal 3), so no row there will ever have `thread_root_id` set; adding a no-op filter would be dead code.
   - Client-side message search (`ChatWindow.jsx`'s `searchMode`) — **needs no separate fix**: it's a pure client-side filter over whatever `listMessages` already returned, so once the backend excludes thread replies from that response, search is automatically consistent with no additional change.

   Mitigation: this enumeration IS the mitigation — Plan A's backend tasks must touch exactly the two identified call sites (`listMessages`, `listConversations`) and explicitly leave the others alone, with each decision justified inline in the plan (not left to implementer discretion) — mirroring Phase D's spec risk 3 mitigation strategy of enumerating render/query sites up front rather than fixing the primary path and treating the rest as an afterthought.

2. **Risk**: the reply-insert + root-counter-update must not diverge (e.g. the reply is inserted but the counter update fails, leaving the pill undercounting; or vice versa). Mitigation: wrap both operations in a single `prisma.$transaction`, matching the precedent already established in `createConversation`'s transactional role-seeding (Phase A) for exactly this class of "two related writes must succeed or fail together" risk.

3. **Risk**: Phase D's `scrollToMessage`/"Ver en el chat" jump mechanism (from a pinned message or, potentially, a search match) assumes the target message exists somewhere in the currently-rendered main-timeline DOM (`querySelector('[data-msg-id="..."]')`). A pinned thread reply will never be found this way, since replies never render in the main timeline. Mitigation: this is a real, narrow gap but not new — Phase D's own implementation already silently no-ops when a target isn't found in the DOM (documented at the time as an accepted limitation for un-paginated-in older messages). This phase doesn't need to fix that pre-existing limitation, but Plan B should make the failure mode slightly better for this specific new case: if `PinnedMessagesSheet`'s "Ver en el chat" target turns out to be a thread reply (`threadRootId` present on the pinned message), open `ThreadPanel` for its root instead of attempting a main-timeline scroll that can never succeed. This is a small, targeted improvement over silently doing nothing, not a full fix of the general pagination gap (out of scope, matches Phase D's own documented boundary).

4. **Risk**: `ChatMessageBubble.jsx` is already ~999 lines after Phase D (right at the proactive-split guidance threshold). Mitigation: the reply-count pill is a tiny addition (a handful of lines, similar footprint to the existing pinned-indicator icon), but `ThreadPanel`'s root-message-plus-reply-list rendering must NOT be inlined into `ChatMessageBubble.jsx` — it's a new, separate component from the start (same discipline Phase D applied to `MessageReactions`/`MessageReactionPicker`), reusing `ChatMessageBubble` as a child component rather than duplicating its rendering logic.

## 25. Acceptance criteria

1. Given a member of a channel, when they choose "Responder en hilo" on a message and send a reply, then that reply does NOT appear in the main channel timeline, and the root message's "N respuestas" pill shows count 1.
2. Given a thread with 2 existing replies, when a third member (not yet a thread participant) sends a reply, then the root author and both prior repliers are notified (`chat.thread.reply`), and the whole channel is NOT notified via `chat.message.new`.
3. Given a thread reply that also contains `@mention`, when it's sent, then the mentioned user receives `chat.mention.new` in addition to (not instead of) the thread-reply notification logic for existing participants.
4. Given a user attempts to reply to a message that is itself already a thread reply, when the send completes, then the new message's `threadRootId` is the ORIGINAL root's id, not the reply's id (auto-flatten, verified server-side).
5. Given a reply is deleted, when the root message's `threadReplyCount` is next read, then it has decremented by 1.
6. Given a conversation with an unread thread reply, when the conversation's unread badge is computed, then that reply does NOT count toward it.

## 26. Verification plan

- `pnpm build` — no build errors.
- `node --test apps/api/src/routes/chat/__tests__/` (explicit filenames) — new coverage for: main-timeline exclusion, unread-count exclusion, auto-flatten resolution, cross-conversation `threadRootId` rejection, counter increment/decrement, thread-reply notification recipient set (participants, not whole channel).
- Manual browser QA if a session is available: reply in a thread, confirm it's absent from the main timeline and the pill appears; delete a reply, confirm the count drops.

## 27. Rollback plan

New migration (3 additive columns on `chat_messages`, no new table) — revertable via a new forward migration dropping all three if ever needed; no data-destructive risk to existing columns/rows. The `listMessages`/`listConversations` filter additions are pure `AND thread_root_id IS NULL` clauses — trivially revertable by removing them (would just mean threads reappear inline, not a data-loss risk).

## 28. Future enhancements

1. "Also send to channel" checkbox when replying in a thread.
2. Participant-avatar stack on the reply-count pill.
3. Thread-level notification mute.
4. Paginated thread reply loading for very long threads.
