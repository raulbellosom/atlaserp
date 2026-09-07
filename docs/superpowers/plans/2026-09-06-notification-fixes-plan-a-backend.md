# Plan A (backend) — Notification dedup + smart chat email + email content

Spec: `docs/superpowers/specs/2026-09-06-notification-dedup-and-chat-email-design.md`
Scope: `apps/api`, `apps/worker`, `packages/core`, `scripts/`. No schema migration.
Execute directly on `main`.

## A1. Gate chat-message email — `apps/api/src/routes/chat/chat-service.js`

- Add module-level consts (fixed product behavior — Meet/Teams style, NOT env):
  - `CHAT_EMAIL_AWAY_MS = 2 * 60 * 60 * 1000` (2 h)
  - `CHAT_EMAIL_THROTTLE_MS = 24 * 60 * 60 * 1000` (24 h)
- New helper inside `createChatService`:
  `async function resolveChatEmailRecipients({ conversationId, candidateIds, now = new Date() })`
  - Returns `string[]` — subset of `candidateIds` eligible for an email. Empty fast-path when
    `!candidateIds.length`.
  - One `$queryRaw` keyed by `candidateIds` (`= ANY(${candidateIds}::uuid[])`):
    - `m.last_read_at IS NULL OR m.last_read_at < ${new Date(now - CHAT_EMAIL_AWAY_MS)}`
    - AND NOT EXISTS (recent message sent by that member in this conversation since
      `now - CHAT_EMAIL_AWAY_MS`) — `chat_messages` where `sender_user_id = m.user_id`
      AND `conversation_id = ${conversationId}` AND `created_at >= …`
    - AND NOT EXISTS (email delivery in the throttle window): `notification n
      JOIN notification_delivery d ON d.notification_id = n.id`
      where `n.user_id = m.user_id AND n.source_type = 'chat_conversation'
      AND n.source_id = ${conversationId} AND d.channel = 'email'
      AND n.created_at >= ${new Date(now - CHAT_EMAIL_THROTTLE_MS)}`
  - `left_at IS NULL` on the member row.
- In the `setImmediate` notification block:
  - `chat.message.new` main publish: channels back to `["in_app", "web_push"]`.
  - `chat.thread.reply` main publish: channels back to `["in_app", "web_push"]`.
  - After the main publish, compute
    `const emailIds = await resolveChatEmailRecipients({ conversationId, candidateIds: <recipientIds or threadRecipientIds> })`
    and for the non-thread path, for **each** `uid` of `emailIds`, call
    `notificationService.publish` once with:
    - `recipients: { userIds: [uid] }`, `channels: ["email"]`, `eventType: "chat.message.new"`
    - `title`: sender-aware — `senderName` from `fullMsg?.sender?.displayName`.
      - group/channel (`conv.title`): `` `${senderName} · ${conv.title}` ``
      - else: `` `Nuevo mensaje de ${senderName}` ``
    - `body`: longer preview — `body.length > 280 ? body.slice(0,280)+"…" : body`
    - `link`: `/app/m/atlas.chat/chat/inbox/${conversationId}`
    - `sourceType: "chat_conversation"`, `sourceId: conversationId`
    - `metadata: { kind: "chat_message", conversationId, conversationTitle: conv.title ?? null,
      conversationType: conv.type ?? null, senderName, senderId: profileId.toString(),
      snippet: <same preview> }`
    - `dedupeKey: ` `` `chat.mail:${conversationId}:${uid}` ``
    - `priority: "medium"`
  - Thread path: same, but only when we already resolved `threadRecipientIds`; reuse
    `resolveChatEmailRecipients` on that list; `metadata.kind = "chat_thread_reply"`.
  - `chat.mention.new`: unchanged channels `["in_app","email","web_push"]`, but add
    `metadata: { kind: "chat_mention", conversationId, conversationTitle: conv.title ?? null,
    senderName, snippet: preview }` and keep `title` as-is.
  - `chat.member.added` (`notifyMembersAdded`): add
    `metadata.kind = "chat_member_added"` + `metadata.conversationTitle`. Channels unchanged.
- `conv` for the non-creation send path (`sendMessage`) — fetch `type, title` once alongside
  the existing member query if not already in scope.

## A2. `chat.mail:` dedupe — `apps/api/src/services/notification-service.js`

- In `isDuplicate`, add before the generic window check:
  ```js
  if (dedupeKey.startsWith('chat.mail:')) {
    const since = new Date(Date.now() - CHAT_MAIL_THROTTLE_MS);
    const row = await tx.notification.findFirst({
      where: { userId, dedupeKey, OR: [{ readAt: null }, { createdAt: { gte: since } }] },
      select: { id: true },
    });
    return Boolean(row);
  }
  ```
- `const CHAT_MAIL_THROTTLE_MS = 24 * 60 * 60 * 1000;` near `DEDUPE_WINDOW_MS` (keep in
  sync with `CHAT_EMAIL_THROTTLE_MS` in chat-service.js).
- Net effect: one chat email per `(conversation, recipient)` until they open the conversation
  (`markReadBySource('chat_conversation', id)` from `useChatMessages.js` marks it read), and
  never more than one per 24h even if never opened.

## A3. Prune stale push subscriptions on subscribe — `notification-service.js`

- In `subscribeWebPush`, after the upsert (`row`), when `userAgent` or `parsed.deviceLabel`
  present:
  ```js
  await prisma.pushSubscription.updateMany({
    where: {
      userId: profileId,
      id: { not: row.id },
      enabled: true,
      OR: [
        ...(userAgent ? [{ userAgent }] : []),
        ...(parsed.deviceLabel ? [{ deviceLabel: parsed.deviceLabel }] : []),
      ],
    },
    data: { enabled: false },
  });
  ```
- Guard: skip the `updateMany` entirely if the `OR` array is empty (never disable by userId
  alone).

## A4. Bump `lastSeenAt` on successful push send — `notification-delivery-worker.js`

- In the `web_push` branch, when `result.ok`, also
  `await prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastSeenAt: new Date() } }).catch(() => {})`.
  Keeps the cleanup script's "stale > 60d" signal meaningful.

## A5. Atomic claim + stuck-row recovery — `notification-delivery-worker.js`

- At the top of `processPendingNotificationDeliveries`, before selecting:
  ```sql
  -- recover rows a crashed/killed pass left mid-flight
  UPDATE notification_delivery SET status = 'queued'
  WHERE channel = ${channel} AND status = 'sending'
    AND updated_at < NOW() - INTERVAL '5 minutes'
  ```
- Replace the `findMany({ where: { status: 'queued' … } })` with a race-safe claim:
  ```sql
  UPDATE notification_delivery d
  SET status = 'sending', attempts = attempts + 1, updated_at = NOW()
  FROM (
    SELECT id FROM notification_delivery
    WHERE channel = ${channel} AND status = 'queued' AND attempts < ${maxAttempts}
      ${notificationIds ? Prisma.sql`AND notification_id = ANY(${notificationIds}::uuid[])` : Prisma.empty}
    ORDER BY created_at ASC
    LIMIT ${take}
    FOR UPDATE SKIP LOCKED
  ) picked
  WHERE d.id = picked.id
  RETURNING d.id
  ```
  Then `findMany({ where: { id: { in: claimedIds } }, include: { notification: { include: { user: … } } } })`.
- `attempts` is now incremented at claim time, so downstream use `delivery.attempts` (already
  incremented) rather than `+ 1` again. Success → `status:'sent'`. Failure →
  `status: attempts >= maxAttempts ? 'failed' : 'queued'` (re-queue for another pass).
- Import `Prisma` from `@prisma/client` for `Prisma.sql` / `Prisma.empty` if not already.
- Keep `notificationIds` fast-path working (calls flow).

## A6. Worker in-flight guard — `apps/worker/src/index.js`

- Wrap `runDeliveryTick` body in a `let deliveryTickRunning = false` gate:
  `if (deliveryTickRunning) return; deliveryTickRunning = true; try { … } finally { deliveryTickRunning = false }`.
- Apply the same pattern to `runCalendarReminderTick` and `runTasksDueSoonTick` (they also
  publish notifications on bare intervals) — small, same shape.

## A7. Email content overhaul — `apps/api/src/services/notification-delivery-worker.js`

- **Label maps**: extend `EVENT_TYPE_LABELS` (`chat.message.new` → `Mensaje de chat`,
  `chat.thread.reply` → `Respuesta en un hilo`, `chat.mention.new` → `Mención en un chat`,
  `chat.member.added` → `Te agregaron a un chat`, plus `growth.lead.created/assigned`,
  `ledger.account_invite/group_invite/access_revoked`, `pfm.budget.threshold/overage`,
  `inventory.item.*`, `notes.note.shared`). Extend `SOURCE_TYPE_LABELS`
  (`chat_conversation` → `Conversación`, `chat_message` → `Mensaje`).
- **Humanizer fallback** `humanizeToken(raw)`: `chat.message.new` → `Chat message new`-style
  is wrong; instead: split on `._-`, drop a leading known namespace segment
  (`chat|projects|calendar|ledger|pfm|inventory|notes|growth|website|system`), join with
  space, capitalize first letter. Used whenever a map lookup misses — **no raw dotted/snake
  token ever reaches the body.**
- **`isChat` branch** (`notification.metadata?.kind` starts with `chat_` or
  `eventType.startsWith('chat.')`):
  - HTML: header = sender name big (`metadata.senderName` ?? title), sub-label =
    `metadata.conversationTitle` when present else "Conversación directa".
  - Body = snippet (`metadata.snippet` ?? notification.body) inside a left-border quote block.
  - **No** Tipo/Prioridad/Generado/Origen table. One muted line: `Recibido el ${createdAt}`.
  - CTA label = "Abrir conversación".
  - Plain text:
    ```
    ${senderName} te escribió${convTitle ? ` en ${convTitle}` : ''}:

    "${snippet}"

    Abrir: ${link}
    ```
- **Non-chat branch**: keep the card + table, but every `Tipo` / `Origen` value goes through
  `EVENT_TYPE_LABELS[..] ?? humanizeToken(..)` / `SOURCE_TYPE_LABELS[..] ?? humanizeToken(..)`.
  Drop the `Origen` row when the humanized value equals the raw (i.e. still meaningless).
  Trim the plain-text `details.join("\n")` dump to just `title`, `body`, `Abrir: link`.
- **Logo** — from the company's `BrandingConfig`, NOT env:
  - `createNotificationDeliveryWorker` gains a `supabaseAdmin` param (wired from
    `apps/api/src/index.js` and `apps/worker/src/index.js`).
  - `processPendingNotificationDeliveries` resolves a `Map<companyId, { logoUrl, companyName }>`
    for the batch's distinct company ids: `company.findMany({ select: { id, name,
    brandingConfig: { select: { logoFileId } } } })` → `fileAsset.findMany` →
    `supabaseAdmin.storage.from(bucket).createSignedUrl(objectKey, 7 days)`.
  - `buildNotificationEmail({ notification, appBaseUrl, brand })`; `brandHeaderHtml(brand)`
    renders `<img>` when `brand.logoUrl`, else the company name as a wordmark, else the
    `Atlas ERP` wordmark. No env, no `<img>` at `localhost`/internal ever.
  - `resolveApiBaseUrl()` is removed (was only used for the old logo path).

## A8. One-time cleanup script — `scripts/dedupe-push-subscriptions.mjs`

- Mirror `scripts/diagnose-notifications.mjs` bootstrap (PrismaPg, 20s timeout, no secrets).
- Read `push_subscription` where `enabled = true`. Group by `(userId, COALESCE(userAgent,''))`.
- For each group with > 1: keep the row with the newest `COALESCE(lastSeenAt, createdAt)`,
  mark the rest for disable.
- Also mark any `enabled` row with `COALESCE(lastSeenAt, createdAt) < now() - 60 days`.
- Default: print `{ groups, duplicatesToDisable, staleToDisable }` counts only.
  With `--apply` (`process.argv.includes('--apply')`): `updateMany({ where: { id: { in } },
  data: { enabled: false } })` and print the applied count. No endpoints, no keys, no emails
  in output.
- Add a `pnpm` script alias? No — keep it a `node --env-file` invocation like the diagnose
  script; document in the spec's rollout section (already there).

## A9. `packages/core/src/notification-preferences.js`

- No behavioural change needed (chat.message.new default email already `false`). Add a
  code comment noting chat-message email is additionally gated at publish time by
  `resolveChatEmailRecipients` (away + 24h throttle), so enabling the toggle does not mean
  "every message".

## A10. `.env.example`

- No new env vars. (An earlier draft added `ATLAS_EMAIL_LOGO_URL` /
  `ATLAS_CHAT_EMAIL_*` — dropped: the logo is the company `BrandingConfig` logo and the
  windows are fixed constants.)

## Tests (Node built-in runner)

- `apps/api/src/services/__tests__/notification-service.test.js`
  - `chat.mail:` dedupe: unread row → duplicate; read row older than throttle → not
    duplicate; read row inside throttle → duplicate.
  - `subscribeWebPush` disables same-`userAgent` siblings, leaves other devices, never
    disables when UA+label both absent.
- `apps/api/src/services/__tests__/notification-delivery-worker.test.js`
  - Two `processPendingNotificationDeliveries` calls racing the same queued row → exactly one
    `sendEmail` / `sendToSubscription`; other sees zero claimed.
  - Stuck `sending` row older than 5 min is re-queued and then processed.
  - Chat email: `buildNotificationEmail` output for a `metadata.kind:'chat_message'`
    notification contains sender name + snippet, no `Tipo:`/`Origen:`/`Prioridad:`, no
    `localhost` in `html`, `Atlas ERP` wordmark present when `brand` is null.
  - Non-chat email: unmapped `eventType`/`sourceType` never appears raw (humanized).
- `apps/api/src/routes/chat/__tests__/chat-service.test.js`
  - `resolveChatEmailRecipients`: away recipient outside throttle → included; recent reader
    → excluded; recipient with an email delivery < 24h → excluded; recipient who sent a
    message < 2h → excluded.
  - `sendMessage` non-thread: main publish channels are `["in_app","web_push"]`; an
    `["email"]` publish happens once per eligible recipient with a `chat.mail:` dedupeKey.

## Verification

- `node --test apps/api/src/services/__tests__/ apps/api/src/routes/chat/__tests__/`
- `pnpm lint`
- `pnpm build`
