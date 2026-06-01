# Atlas Notifications - Part D Web Push (PWA) - Implementation Plan

Date: 2026-06-01
Spec: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Status: Draft

> **For agentic workers:** Mode: IMPLEMENTATION. Start only after Part C gate is complete.

## Goal

Add standards-based web push delivery for installed PWA users, including subscription management, secure key storage, and background notification handling.

## Architecture summary

Part D extends channel delivery with `web_push` using browser Push API + service worker. Subscription capture happens in frontend; delivery attempts are processed in backend/worker through queued `NotificationDelivery` rows.

---

## File Structure Map

### Create

- `apps/desktop/public/sw-notifications.js`
- `apps/api/src/services/web-push-service.js`
- `apps/api/src/services/__tests__/web-push-service.test.js`
- `apps/desktop/src/lib/webPush.js`

### Modify

- `apps/desktop/src/main.jsx` - register service worker
- `apps/desktop/public/site.webmanifest` - ensure install/push-friendly metadata
- `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx` - add subscribe/unsubscribe controls
- `apps/api/src/routes/notifications.js` - web push subscribe/unsubscribe endpoints
- `apps/api/src/services/notification-delivery-worker.js` - process `web_push` channel
- `apps/api/src/routes/settings-routes.js` - add VAPID settings endpoints (or create dedicated notifications settings route)

---

## Task 1 - Push key and settings backend

**Files:**
- Modify: `apps/api/src/routes/settings-routes.js` (or dedicated route file)
- Create: `apps/api/src/services/web-push-service.js`

**Changes:**

- [ ] Step 1: Add secure storage/retrieval for VAPID keys in instance config.
- [ ] Step 2: Add validation and permissions for managing keys.
- [ ] Step 3: Add sender service to dispatch push payloads.

**Validation:**

```bash
node --check apps/api/src/services/web-push-service.js
node --check apps/api/src/routes/settings-routes.js
```

---

## Task 2 - Subscription lifecycle APIs

**Files:**
- Modify: `apps/api/src/routes/notifications.js`

**Changes:**

- [ ] Step 1: Implement `POST /notifications/subscriptions/webpush`.
- [ ] Step 2: Implement `DELETE /notifications/subscriptions/webpush/:id`.
- [ ] Step 3: Enforce ownership and company scoping.

**Validation:**

```bash
node --check apps/api/src/routes/notifications.js
```

---

## Task 3 - Frontend PWA subscription UX

**Files:**
- Create: `apps/desktop/src/lib/webPush.js`
- Modify: `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`
- Modify: `apps/desktop/src/main.jsx`
- Create: `apps/desktop/public/sw-notifications.js`

**Changes:**

- [ ] Step 1: Register dedicated notification service worker.
- [ ] Step 2: Add `Suscribirme a notificaciones push` action in settings screen.
- [ ] Step 3: Request permission on explicit user action only.
- [ ] Step 4: Send subscription object to backend API.
- [ ] Step 5: Handle `push` and `notificationclick` events in service worker.

**Validation:**

```bash
node --check apps/desktop/src/lib/webPush.js
node --check apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx
pnpm --filter @atlas/desktop build:web
```

---

## Task 4 - Worker channel delivery

**Files:**
- Modify: `apps/api/src/services/notification-delivery-worker.js`
- Create: `apps/api/src/services/__tests__/web-push-service.test.js`

**Changes:**

- [ ] Step 1: Process pending `web_push` deliveries with retry caps.
- [ ] Step 2: Disable stale subscriptions after repeated permanent failures.
- [ ] Step 3: Add tests for success/failure lifecycle.

**Validation:**

```bash
node --test apps/api/src/services/__tests__/web-push-service.test.js
```

---

## Task 5 - Platform compatibility and smoke

**Files:**
- No new files

**Changes:**

- [ ] Step 1: Verify subscribe/unsubscribe flow in Chromium-based browser.
- [ ] Step 2: Verify notification click deep-link navigation.
- [ ] Step 3: Verify fallback behavior when push unsupported (keep in-app only).

**Validation:**

Manual checks only.

---

## Rollback Notes

1. Disable `web_push` channel processing in worker and keep in-app/email active.
2. Keep subscription rows for later re-enable or purge them with migration if required.

---

## Part D Gate

- [ ] Push subscription lifecycle works end-to-end.
- [ ] Push delivery rows processed successfully.
- [ ] Unsupported environments degrade gracefully to in-app notifications.

