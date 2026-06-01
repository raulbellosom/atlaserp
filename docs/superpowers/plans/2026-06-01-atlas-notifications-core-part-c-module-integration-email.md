# Atlas Notifications - Part C Module Integration + Email Channel - Implementation Plan

Date: 2026-06-01
Spec: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Status: Draft

> **For agentic workers:** Mode: IMPLEMENTATION. Start only after Part B gate is complete.

## Goal

Enable core modules and custom modules to publish notifications through a shared helper and add asynchronous email delivery using existing SMTP configuration.

## Architecture summary

Part C introduces publisher helpers and queue-style delivery records so notification creation is synchronous but channel delivery is background/best-effort. It reuses existing SMTP settings and avoids blocking business mutations.

---

## File Structure Map

### Create

- `apps/api/src/services/notification-publisher.js`
- `apps/api/src/services/notification-delivery-worker.js`
- `apps/api/src/services/__tests__/notification-publisher.test.js`

### Modify

- `apps/api/src/services/route-loader-service.js` - inject notification publish helper into module context
- `apps/api/src/routes/calendar/calendar-routes.js` - migrate selected events to notification publish
- `modules/official/atlas.catalog/api/products-routes.js` - publish notification-eligible website/catalog events
- `modules/official/atlas.catalog/api/stock-routes.js` - publish critical stock/payment events where applicable
- `apps/api/src/index.js` - optional internal endpoint/trigger for delivery worker
- `apps/worker/src/index.js` - process queued deliveries on interval

---

## Task 1 - Shared publish helper

**Files:**
- Create: `apps/api/src/services/notification-publisher.js`

**Changes:**

- [ ] Step 1: Implement `publishNotificationFromContext(prisma, c, input)`.
- [ ] Step 2: Resolve company/user context server-side.
- [ ] Step 3: Write inbox records and channel delivery rows.
- [ ] Step 4: Never throw to caller on delivery row creation failure (best effort logging).

**Validation:**

```bash
node --check apps/api/src/services/notification-publisher.js
```

---

## Task 2 - Custom module support via moduleContext

**Files:**
- Modify: `apps/api/src/services/route-loader-service.js`

**Changes:**

- [ ] Step 1: Inject `notifications` helper object into module router factory context.
- [ ] Step 2: Provide `publishFromContext(c, payload)` API for module routes.
- [ ] Step 3: Keep backward compatibility for existing modules.

**Validation:**

```bash
node --check apps/api/src/services/route-loader-service.js
```

---

## Task 3 - Integrate selected notification-eligible events

**Files:**
- Modify: `apps/api/src/routes/calendar/calendar-routes.js`
- Modify: `modules/official/atlas.catalog/api/products-routes.js`
- Modify: `modules/official/atlas.catalog/api/stock-routes.js`

**Changes:**

- [ ] Step 1: Publish calendar reminder/invite/reschedule/cancel notifications.
- [ ] Step 2: Publish website/catalog high-value events (sale confirmed, payment fail hooks where available).
- [ ] Step 3: Keep generic CRUD events in activity only.

**Validation:**

```bash
node --check apps/api/src/routes/calendar/calendar-routes.js
node --check modules/official/atlas.catalog/api/products-routes.js
node --check modules/official/atlas.catalog/api/stock-routes.js
```

---

## Task 4 - Email delivery worker path

**Files:**
- Create: `apps/api/src/services/notification-delivery-worker.js`
- Modify: `apps/worker/src/index.js`
- Modify: `apps/api/src/index.js`

**Changes:**

- [ ] Step 1: Implement `processPendingNotificationDeliveries({ channel: "email" })`.
- [ ] Step 2: Use existing `smtp-service` for send attempts.
- [ ] Step 3: Update delivery statuses (`queued -> sent|failed`) and attempts count.
- [ ] Step 4: Add safe retry policy with cap.

**Validation:**

```bash
node --check apps/api/src/services/notification-delivery-worker.js
node --check apps/worker/src/index.js
node --check apps/api/src/index.js
```

---

## Task 5 - Tests and smoke

**Files:**
- Create: `apps/api/src/services/__tests__/notification-publisher.test.js`

**Changes:**

- [ ] Step 1: Test company/user scoping in publisher helper.
- [ ] Step 2: Test dedupe and delivery row creation.
- [ ] Step 3: Test failure isolation (business mutation should not fail when publish fails).

**Validation:**

```bash
node --test apps/api/src/services/__tests__/notification-publisher.test.js
```

Manual smoke:

```bash
curl -X POST http://localhost:4010/notifications/publish -H "Authorization: Bearer $ATLAS_TOKEN" -H "Content-Type: application/json" -d "{...channels:[\"in_app\",\"email\"]...}"
```

---

## Rollback Notes

1. Revert helper injections and module route integrations if needed.
2. Disable worker processing interval while preserving created inbox records.

---

## Part C Gate

- [ ] Core and custom routes can publish through shared helper.
- [ ] Email deliveries are queued and processed with status tracking.
- [ ] Notification spam policy respected (eligible events only).

