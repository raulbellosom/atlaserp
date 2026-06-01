# Atlas Notifications - Part A Foundation - Implementation Plan

Date: 2026-06-01
Spec: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Status: Draft

> **For agentic workers:** Mode: IMPLEMENTATION. This part is backend-only foundation. Do not start Part B until Part A gate passes.

## Goal

Create the backend and contract foundation of `atlas.notifications`: data model, validators, service, routes, permissions, manifest, and SDK methods for in-app inbox.

## Architecture summary

Part A introduces additive schema changes and a notification service that is independent from `activity`. It provides a publish API and inbox read APIs with dedupe and company scoping, without UI changes yet.

---

## File Structure Map

### Create

- `apps/api/src/services/notification-service.js`
- `apps/api/src/routes/notifications.js`
- `apps/api/src/services/__tests__/notification-service.test.js`

### Modify

- `prisma/schema.prisma` - extend `Notification`, add `NotificationDelivery`, `PushSubscription`, `NotificationPreference`
- `prisma/migrations/YYYYMMDDHHMMSS_atlas_notifications_foundation/migration.sql` - forward migration
- `packages/validators/src/index.js` - notification schemas
- `apps/api/src/manifests/official/feature-modules.js` - add `atlas.notifications` core manifest
- `apps/api/src/permission-catalog.js` - add notification permission labels
- `apps/api/src/index.js` - mount notifications router
- `packages/sdk/src/index.js` - add `atlas.notifications` domain methods

---

## Task 1 - Prisma foundation

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/YYYYMMDDHHMMSS_atlas_notifications_foundation/migration.sql`

**Changes:**

- [ ] Step 1: Extend `Notification` with classification and source fields (`eventType`, `sourceType`, `sourceId`, `sourceActivityId`, `priority`, `metadata`, `dedupeKey`, `expiresAt`).
- [ ] Step 2: Add `NotificationDelivery`, `PushSubscription`, and `NotificationPreference` models with indexes.
- [ ] Step 3: Generate and review migration SQL for additive-only safety.

**Validation:**

```bash
pnpm db:generate
pnpm db:migrate
```

---

## Task 2 - Validators

**Files:**
- Modify: `packages/validators/src/index.js`

**Changes:**

- [ ] Step 1: Add `notificationPublishSchema`.
- [ ] Step 2: Add `notificationListQuerySchema`.
- [ ] Step 3: Add `webPushSubscriptionSchema`.
- [ ] Step 4: Add `notificationPreferenceUpsertSchema`.

**Validation:**

```bash
node --check packages/validators/src/index.js
```

---

## Task 3 - Service and API routes

**Files:**
- Create: `apps/api/src/services/notification-service.js`
- Create: `apps/api/src/routes/notifications.js`
- Modify: `apps/api/src/index.js`

**Changes:**

- [ ] Step 1: Implement `createNotificationService({ prisma })` with `list`, `markRead`, `markAllRead`, `publish`, `upsertPreference`, `listPreferences`.
- [ ] Step 2: Enforce company scoping from authenticated context in every query/mutation.
- [ ] Step 3: Add dedupe behavior using `dedupeKey` + short time window.
- [ ] Step 4: Mount routes in API bootstrap.

**Validation:**

```bash
node --check apps/api/src/services/notification-service.js
node --check apps/api/src/routes/notifications.js
node --check apps/api/src/index.js
```

---

## Task 4 - Core module registration and RBAC

**Files:**
- Modify: `apps/api/src/manifests/official/feature-modules.js`
- Modify: `apps/api/src/permission-catalog.js`

**Changes:**

- [ ] Step 1: Add core module manifest `atlas.notifications`.
- [ ] Step 2: Declare permissions: `notifications.access`, `notifications.read`, `notifications.publish`, `notifications.manage`.
- [ ] Step 3: Add navigation entry and ACL mapping.

**Validation:**

```bash
node --check apps/api/src/manifests/official/feature-modules.js
node --check apps/api/src/permission-catalog.js
pnpm db:seed
```

---

## Task 5 - SDK methods

**Files:**
- Modify: `packages/sdk/src/index.js`

**Changes:**

- [ ] Step 1: Add `atlas.notifications.list`.
- [ ] Step 2: Add `atlas.notifications.markRead` and `markAllRead`.
- [ ] Step 3: Add `atlas.notifications.publish`.
- [ ] Step 4: Add `atlas.notifications.listPreferences` and `upsertPreference`.

**Validation:**

```bash
node --check packages/sdk/src/index.js
```

---

## Task 6 - Tests and smoke

**Files:**
- Create: `apps/api/src/services/__tests__/notification-service.test.js`

**Changes:**

- [ ] Step 1: Add tests for publish, dedupe, list unread, mark read, mark all read.
- [ ] Step 2: Add permission/API smoke commands.

**Validation:**

```bash
node --test apps/api/src/services/__tests__/notification-service.test.js
```

Manual smoke:

```bash
curl -X POST http://localhost:4010/notifications/publish -H "Authorization: Bearer $ATLAS_TOKEN" -H "Content-Type: application/json" -d "{...}"
curl "http://localhost:4010/notifications?unreadOnly=true" -H "Authorization: Bearer $ATLAS_TOKEN"
curl -X PATCH "http://localhost:4010/notifications/read-all" -H "Authorization: Bearer $ATLAS_TOKEN"
```

---

## Rollback Notes

1. Revert service/route/SDK/manifest files if not migrated.
2. If migrated, add forward rollback migration to drop newly added notification artifacts.

---

## Part A Gate

- [ ] Migration applied and client generated.
- [ ] Notification endpoints return expected responses.
- [ ] Permissions seeded and enforced.
- [ ] Tests pass.

