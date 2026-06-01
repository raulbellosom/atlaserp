# Atlas Notifications - Core Module Design

Date: 2026-06-01
Status: Draft
Author: Codex (GPT-5)
Spec file: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Plan file: docs/superpowers/plans/2026-06-01-atlas-notifications-core.md (created after spec approval)

---

## 1. Feature title

Atlas Notifications - core module `atlas.notifications` for actionable in-app alerts, email, and web push.

## 2. Status

Draft

## 3. Context

Atlas ERP already has `atlas.activity` for broad operational history and also has isolated calendar reminders. The product now needs a unified notification system for high-value events (calendar reminders, website sales, system alerts, future chat) without turning every CRUD event into a notification.

## 4. Problem

There is no single core notification pipeline with:

1. Shared publish contract for core modules and custom modules.
2. User inbox (read/unread) with clear priority.
3. Delivery channels (in-app first, email and push next).
4. Notification preferences and dedupe rules.

Current behavior is fragmented (`activity` feed + calendar-only notifications), causing inconsistency and missed alerts.

## 5. Goals

1. Keep `activity` and `notifications` separated by intent: history vs actionable alerts.
2. Deliver a core module `atlas.notifications` with in-app inbox and read/unread state.
3. Allow all modules (core and custom AME3) to publish notifications through one contract.
4. Start with in-app real-time delivery in platform, then expand to email and PWA push.
5. Support event taxonomy so only selected events generate notifications.

## 6. Non-goals

1. Converting all `activity` entries into notifications.
2. Native mobile push SDK integration (Android/iOS native app) in MVP.
3. Full chat module implementation (only notification hooks for future chat).
4. Cross-company/global notification stream.

## 7. User stories

- As an operator, I want reminders about near-future calendar events so I do not miss meetings/tasks.
- As a business owner, I want sale/payment alerts from website flows so I can react quickly.
- As an admin, I want system critical alerts (sync, module errors, integration failures) so I can intervene.
- As a module developer, I want one publish API so my module can emit notifications without custom wiring.
- As a user, I want noise reduced so normal CRUD appears in `activity` but only important events appear in notifications.

## 8. UX requirements

1. Keep topbar notification bell as global entry point.
2. Bell opens a notifications panel (latest unread first) with:
   - title, body, timestamp, priority badge, deep link
   - actions: "Marcar como leida", "Marcar todo como leido"
3. Provide full screen `/app/m/atlas.notifications` for:
   - inbox filters (unread, priority, event type, date range)
   - pagination and searchable text
4. Empty state must use `EmptyState`.
5. Error state must use `ErrorState`.
6. All user-facing labels in Spanish.

## 9. Routes/screens

| Route | Screen | Module | Description |
|---|---|---|---|
| /app/m/atlas.notifications | NotificationsInboxScreen | atlas.notifications | Inbox principal con filtros |
| /app/m/atlas.notifications/settings | NotificationSettingsScreen | atlas.notifications | Preferencias y canales |

## 10. Data model

### New models

1. `NotificationDelivery`
   - Purpose: track per-channel delivery state.
   - Fields: `id`, `notificationId`, `channel` (`in_app|email|web_push`), `status` (`queued|sent|failed`), `attempts`, `lastError`, `sentAt`, `createdAt`, `updatedAt`.

2. `PushSubscription`
   - Purpose: web push subscription endpoints by user/device.
   - Fields: `id`, `userId`, `companyId`, `endpoint`, `p256dh`, `auth`, `deviceLabel`, `userAgent`, `enabled`, `lastSeenAt`, `createdAt`, `updatedAt`.

3. `NotificationPreference`
   - Purpose: user-level control by event type and channel.
   - Fields: `id`, `userId`, `eventType`, `inAppEnabled`, `emailEnabled`, `pushEnabled`, `muteUntil`, `createdAt`, `updatedAt`.

### Modified models

1. `Notification` (existing model)
   - Add: `eventType`, `sourceType`, `sourceId`, `sourceActivityId`, `priority` (`low|medium|high|critical`), `metadata` (json), `dedupeKey`, `expiresAt`.
   - Keep: `userId`, `companyId`, `kind`, `title`, `body`, `link`, `readAt`, `createdAt`.

## 11. Prisma impact

New models: `NotificationDelivery`, `PushSubscription`, `NotificationPreference`  
Modified models: `Notification`  
New migration required: Yes  
Migration safety notes: additive migration (new tables + new nullable columns). No destructive change.

## 12. API contract

### Read APIs (user-facing)

1. `GET /notifications`
   - Permission: `notifications.read`
   - Query: `unreadOnly`, `priority`, `eventType`, `cursor`, `limit`
   - Response: `{ data: Notification[], pageInfo: { nextCursor } }`

2. `PATCH /notifications/:id/read`
   - Permission: `notifications.read`
   - Response: `{ data: Notification }`

3. `PATCH /notifications/read-all`
   - Permission: `notifications.read`
   - Response: `{ data: { updated: number } }`

### Publish APIs (module/system)

4. `POST /notifications/publish`
   - Permission: `notifications.publish`
   - Body: `{ eventType, title, body?, link?, recipients, channels?, priority?, sourceType?, sourceId?, sourceActivityId?, metadata? }`
   - Response: `{ data: { created: number, deduped: number } }`

### Subscription APIs (web push)

5. `POST /notifications/subscriptions/webpush`
   - Permission: `notifications.read`
   - Body: `{ endpoint, keys: { p256dh, auth }, deviceLabel? }`
   - Response: `{ data: PushSubscription }`

6. `DELETE /notifications/subscriptions/webpush/:id`
   - Permission: `notifications.read`
   - Response: `{ data: { deleted: true } }`

### Preferences APIs

7. `GET /notifications/preferences`
   - Permission: `notifications.read`
   - Response: `{ data: NotificationPreference[] }`

8. `PUT /notifications/preferences`
   - Permission: `notifications.read`
   - Body: `{ eventType, inAppEnabled, emailEnabled, pushEnabled, muteUntil? }`
   - Response: `{ data: NotificationPreference }`

## 13. SDK contract

Domain: `atlas.notifications`

- `list(token, query?)`
- `markRead(token, id)`
- `markAllRead(token)`
- `publish(token, payload)`
- `subscribeWebPush(token, payload)`
- `unsubscribeWebPush(token, id)`
- `listPreferences(token)`
- `upsertPreference(token, payload)`

## 14. Validator contract

- `notificationPublishSchema`
- `notificationListQuerySchema`
- `webPushSubscriptionSchema`
- `notificationPreferenceUpsertSchema`

## 15. Module manifest impact

Create a new core manifest in `apps/api/src/manifests/official/feature-modules.js`:

- key: `atlas.notifications`
- kind: `CORE`
- core: `true`
- uninstallable: `false`
- dependencies: `atlas.core`, `atlas.identity`

Permissions:

- `notifications.access`
- `notifications.read`
- `notifications.publish`
- `notifications.manage`

## 16. Navigation impact

| Label (Spanish) | Path | Icon | Layout | permissionKey |
|---|---|---|---|---|
| Notificaciones | /app/m/atlas.notifications | Bell | main | notifications.read |

## 17. Blueprint impact

N/A (core module screens, not AME3 blueprint-driven UI for MVP).

## 18. RBAC/permissions

| Permission key | Guards endpoint(s) | Gates navigation |
|---|---|---|
| notifications.access | module access | No |
| notifications.read | GET/PATCH inbox + subscriptions + preferences | Yes |
| notifications.publish | POST /notifications/publish | No |
| notifications.manage | future admin ops (retention, templates) | No |

## 19. Multi-company behavior

All notification reads and writes are scoped to the authenticated user's active company. Cross-company reads are forbidden. `companyId` is server-resolved from context, never trusted from client payload.

## 20. Files/storage impact

No file uploads required for MVP.

## 21. Export/import requirements

N/A in MVP.

## 22. Audit log requirements

Audit log entries required for:

1. notification publish (system/manual)
2. mark read / mark all read
3. preference updates
4. push subscription create/delete

## 23. Edge cases

1. Dedupe within short window using `dedupeKey`.
2. Expired notifications (`expiresAt`) are not shown in inbox.
3. User without `notifications.read` cannot consume bell/inbox.
4. Notification publish failure must not break core business mutation.
5. Web push endpoint invalidation auto-disables bad subscriptions after repeated failures.

## 24. Risks

1. Risk: notification spam. Mitigation: strict taxonomy and dedupe policy.
2. Risk: delivery backlog. Mitigation: worker queue + retry caps + dead-letter logging.
3. Risk: confusion with `activity`. Mitigation: explicit event classification contract.

## 25. Acceptance criteria

1. Given a calendar reminder event, when reminder window is reached, then user receives an unread in-app notification.
2. Given a normal CRUD update event, when published only to activity, then it does not appear in notifications inbox.
3. Given a website sale event, when publish API is called, then recipients receive notification records with priority `high`.
4. Given user marks all read, when inbox refreshes, then unread count becomes zero.
5. Given custom module publishes via core helper, when event is valid, then notifications are created without touching core routes manually.

## 26. Verification plan

1. Prisma migration and generate pass.
2. Node tests for notification service and delivery routing pass.
3. API smoke:
   - publish
   - list unread
   - mark read
   - mark all read
4. UI smoke:
   - topbar bell count updates
   - panel and full inbox render correctly
5. Permissions smoke:
   - no `notifications.read` => 403 + bell hidden

## 27. Rollback plan

1. Revert feature branch.
2. Create forward rollback migration removing new notifications tables/columns if required.
3. Disable module navigation and publish endpoint via manifest/permission controls while preserving existing data.

## 28. Future enhancements

1. Provider adapters: Firebase FCM (optional), APNs bridge (optional), additional channel providers.
2. Quiet hours and digest mode.
3. Per-role notification templates.
4. Notification actions (Approve, Open, Assign) from inbox cards.
5. Declarative rules engine mapping `activity` -> `notifications` by policy.

---

## Activity vs Notifications Classification (MVP policy)

### Always Activity-only

1. Generic create/update/delete with no urgency.
2. Catalog and profile maintenance changes.
3. Passive operational trace events.

### Always Notification-eligible

1. Calendar upcoming reminders, invite, reschedule/cancel impact.
2. Website sale confirmed, payment failed, new lead/form submission.
3. System critical failures (sync, module install error, integration down).
4. Future chat direct message/mention events.

### Both Activity + Notification

Important business milestones can be written to activity history and also delivered as notifications to target recipients.

