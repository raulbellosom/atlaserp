# Spec — Notification de-duplication + smart chat email + email content overhaul

Date: 2026-09-06
Status: Approved (decisions captured from user Q&A on 2026-09-06)
Related: commit `17aa7c3a` (notification system enhancement) introduced the regressions.

## Problem statement

After `17aa7c3a`:

1. **Duplicate push notifications.** A single chat message produces 2–4 identical OS
   notifications on the same device (observed on iOS PWA).
2. **Email on every message.** `chat.message.new` / `chat.thread.reply` were switched to
   `["in_app","email","web_push"]`; every chat message now queues an email.
3. **Email content leaks internals.** The email (and the Gmail push preview that renders the
   plain-text part) shows `Tipo: chat.message.new`, `Origen: chat_conversation`,
   `Prioridad: Media`, `Generado: …` — raw enum/identifier tokens, no sender, no useful
   context. The header logo `<img>` is broken (points at an unreachable/internal URL).

## Root causes

### Duplicate push
- **Stale subscriptions never pruned.** `notification-delivery-worker.processPendingNotificationDeliveries`
  sends to every `enabled` `push_subscription` row for the user.
  `notification-service.subscribeWebPush` upserts on `endpoint`; browsers rotate the push
  `endpoint` (and every PWA reinstall / permission re-grant mints a new one), so each
  rotation creates a **new** row and the old one stays `enabled: true` unless the push
  service returns 404/410. Apple keeps old endpoints accepting pushes for a long time, so
  the worker delivers the same payload to 2–4 endpoints that all wake the same device.
  `tag`-based collapsing is unreliable on iOS PWA and the iOS branch sets `renotify: true`.
- **No atomic claim on delivery rows.** `processPendingNotificationDeliveries` selects
  `status:'queued'`, loops sending, then flips each to `sent`. No `FOR UPDATE SKIP LOCKED`,
  no "claim first". `apps/worker/src/index.js` fires `runDeliveryTick` on a bare
  `setInterval` with no in-flight guard, so a slow tick (dead-endpoint web-push calls,
  retry batches) overlaps the next tick, or a second/orphaned worker process runs, and both
  send the same rows.
- **Client raises the OS notification from two code paths** (desktop / backgrounded-alive
  tab): the SW `push` handler always calls `showNotification`, and `RealtimeProvider`'s
  `notification.new` handler also calls `showSystemNotification` when
  `document.hidden || isTauriRuntime()`. The `claimNotification` guard computes **different
  keys** on the two paths for chat messages (`…|<body-preview>` vs `…|<conversationId>`), so
  nothing collapses. The `notification.new` broadcast payload omits `dedupeKey`, so the
  reliable `dk:` key is never available.

### Email on every message
`publish()` takes one `channels` array for all recipients and only consults the on/off
preference; there is no "should this person get an email right now" logic. With `email` in
the channels array and the user's saved preference enabling it, one email fires per message.

### Email content
- `EVENT_TYPE_LABELS` / `SOURCE_TYPE_LABELS` in `notification-delivery-worker.js` have no
  entries for `chat.*` or the snake_case `chat_conversation` source; unmapped values fall
  through to the raw token.
- The email template always renders a Tipo/Prioridad/Generado/Origen table — noise for a
  chat message.
- Sender name and a message snippet are never passed from `chat-service` into the
  notification, so the email cannot show them.
- The logo `<img src>` resolves against the internal API base URL (or `localhost` in the
  worker); there is no public asset URL configured (see memory:
  `project_atlas_files_public_bucket`).

## Decisions (from user)

| Question | Decision |
|---|---|
| When does a plain chat message email? | **Recipient is away + throttled**: no recent read/activity in the conversation (2h) AND at most one email per conversation per recipient per 24h, reset when they open the conversation. Fixed constants, not env. |
| Do @mentions / channel-add keep emailing every time? | **Yes, always** (`chat.mention.new`, `chat.member.added` unchanged). Only plain messages + thread replies get the gate. |
| Duplicate-push fix scope | **Everything + one-time cleanup**: prune stale subs on subscribe, atomic claim + in-flight guard, fix client double-path, plus a cleanup script for existing duplicate rows. |
| Email content | Lead with sender + snippet for chat; drop the technical table for chat; never show raw enum tokens anywhere; logo comes from the company's `BrandingConfig` (signed for a week) or falls back to the company-name / Atlas wordmark — no env; fix the plain-text part (Gmail push preview). |

**No new env vars.** The away window (2 h) and the per-conversation throttle (24 h)
are fixed product behavior, defined as constants in `chat-service.js` /
`notification-service.js` (the way Meet / Teams do it), not configuration. The
email logo is resolved from `BrandingConfig.logoFileId` per company.

## Non-goals
- No server-side realtime presence system. "Away" is derived from
  `chat_conversation_members.last_read_at` + recent-sent-message check, not a live socket.
- No schema migration. `notification_delivery.status` is free-text; `'sending'` is added as
  a transient value. All needed columns already exist.
- No change to in-app (bell) behaviour or to `chat.call.incoming`.

## Acceptance criteria
1. Sending N messages to a conversation while the recipient's device has multiple push
   subscriptions produces exactly **one** OS notification per message per device.
2. Two concurrent delivery-worker passes over the same queued rows send each delivery
   **once** (atomic claim test).
3. A plain chat message to a recipient who read the conversation < 2h ago, or who already
   got a chat email for that conversation < 24h ago, queues **no** email. A message to a
   recipient who has been away ≥ 2h and is outside the 24h throttle queues **one** email.
4. `chat.mention.new` and `chat.member.added` still email every time.
5. The chat email shows the sender's name and a snippet, an "Abrir conversación" CTA, and
   **no** `Tipo:` / `Origen:` / `Prioridad:` block. The plain-text part reads as a sentence,
   not a field dump. The header shows the company's `BrandingConfig` logo when set;
   otherwise the company name, else a styled `Atlas ERP` wordmark. No `localhost`/internal
   `<img>` is ever emitted.
6. Non-chat emails never render a raw enum/identifier token (humanized fallback).
7. `node --env-file=.env scripts/dedupe-push-subscriptions.mjs` reports duplicate
   subscription groups; with `--apply` it disables all but the newest per `(userId,
   userAgent)` and any subscription stale > 60 days. No secrets printed.
8. `pnpm lint`, `pnpm build`, and the Node test suites for
   `apps/api/src/services/__tests__/` + `apps/api/src/routes/chat/__tests__/` pass.

## Rollout / ops
- Core change: deploy **API + worker + web**. `POST /modules/sync` does not ship it.
- After deploy, run `scripts/dedupe-push-subscriptions.mjs --apply` once.
- No new env vars. Away/throttle windows are constants; the email logo is the
  company's `BrandingConfig` logo.
