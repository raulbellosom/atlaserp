# Plan B (frontend) — Client-side push de-duplication + settings copy

Spec: `docs/superpowers/specs/2026-09-06-notification-dedup-and-chat-email-design.md`
Depends on Plan A A2/A1 for the `dedupeKey` carried on the broadcast + push payload.
Scope: `apps/api` (broadcast payload only), `apps/desktop`, `apps/desktop/public`.
Execute directly on `main`.

## B1. Carry `dedupeKey` end-to-end so the two client surfaces collapse

- `apps/api/src/services/notification-service.js` — the `broadcaster.broadcastToUsers(..., "notification.new", {...})` payload: add `dedupeKey` (the per-recipient `dedupeKey` computed in the loop is not in scope at broadcast time; instead include the notification's own `dedupeKey` — restructure so `result` also returns `firstDedupeKey` or push `{ id, dedupeKey }` per created row and broadcast per-user). Simplest: change `inAppRecipientIds` to `inAppRecipients: [{ userId, dedupeKey, notificationId }]` and broadcast per row (or include a `dedupeKeyByUser` map). Keep the existing fields.
- `apps/api/src/services/web-push-service.js` — `buildPushPayload`: add `dedupeKey: notification?.dedupeKey ?? null` inside `data`.
- `apps/desktop/public/sw-notifications.js` — include `dedupeKey: payload?.data?.dedupeKey ?? null` in the `broadcastToClients` message. Also copy `apps/desktop/dist/sw-notifications.js` is a build artifact — do not hand-edit; `pnpm build` regenerates it. Confirm the source is `public/sw-notifications.js`.
- `apps/desktop/src/lib/notificationDedup.js` — no change needed (`notificationKey` already prefers `dk:${dedupeKey}`), but broaden `claimNotification` default window to ~6000ms so the slower of the two surfaces still loses the race.
- `apps/desktop/src/app/useServiceWorkerNotifications.js` — replace the ad-hoc
  `dupKey = message.eventType === "chat.message.new" && message.callId ? ... : notificationKey(...)`
  with `notificationKey({ dedupeKey: message.dedupeKey, eventType: message.eventType, title, body })`.
- `apps/desktop/src/providers/RealtimeProvider.jsx` — `notification.new` handler: use
  `notificationKey({ dedupeKey: payload.dedupeKey, eventType: payload.eventType, title: payload.title, body: payload.body })`
  for the `claimNotification` call (payload now carries `dedupeKey`).

## B2. Stop the OS-notification double (RealtimeProvider vs service worker)

- The SW `push` handler **always** shows the OS notification. `RealtimeProvider`'s
  `showSystemNotification(...)` on `notification.new` is therefore redundant on any device
  that has an active web-push subscription, and only needed as a fallback when push is
  unavailable/unsubscribed.
- `apps/desktop/src/providers/RealtimeProvider.jsx`:
  - Import `getStoredWebPushSubscriptionId` from `../lib/webPush`.
  - Gate the `showSystemNotification` call: only call it when
    `isTauriRuntime() || !getStoredWebPushSubscriptionId()`. (Tauri has no service-worker
    push, so it still needs the direct path.) The `toast(...)` call stays unconditional
    (foreground UX).
  - When it does fire the fallback, pass `tag: notificationKey(payload) ?? payload.eventType`
    so repeated same-event alerts coalesce.

## B3. Tame iOS re-alert spam in the service worker

- `apps/desktop/public/sw-notifications.js`:
  - `renotify` currently `Boolean(payload?.tag) && /iphone|ipad|ipod/i…`. Restrict to
    incoming calls only: `renotify: isIncomingCall`.
  - Keep `tag: chat:<conversationId>` for `chat.message.new` (so multiple messages in one
    conversation replace rather than stack) — already set in `buildPushPayload`.

## B4. Settings screen copy — `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`

- For the `chat.message.new` entry, update `description` to make the new behaviour explicit,
  e.g. `"Aviso por cada mensaje. El correo solo se envía cuando llevas un rato sin leer la conversación."`.
- No functional change to the toggles; `getDefaultNotificationPreference` already returns
  `emailEnabled: false` for `chat.message.new`.

## Tests

- `apps/desktop/src/lib/__tests__/webPush.test.js` or a new
  `notificationDedup.test.js`: two payloads with the same `dedupeKey` — second
  `claimNotification` returns `false`; different `dedupeKey` — both `true`.
- If a RealtimeProvider unit test harness exists, assert `showSystemNotification` is not
  called when `getStoredWebPushSubscriptionId()` returns an id and not Tauri. Otherwise
  cover the gate logic by extracting it into a tiny pure helper
  `shouldUseDirectSystemNotification({ isTauri, hasPushSub })` and unit-test that.

## Verification

- `node --test apps/desktop/src/lib/__tests__/`
- `pnpm build` (regenerates `apps/desktop/dist/sw-notifications.js`)
- Manual (post-deploy, cannot be done here): iOS PWA — send 3 messages, expect 3 single
  notifications; desktop web with push on — expect no doubled toast/OS notification.
