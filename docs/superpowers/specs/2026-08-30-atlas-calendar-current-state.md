# atlas.calendar — Current State Spec

**Date:** 2026-08-30
**Module:** `atlas.calendar` (CORE, `core: true`, `uninstallable: false`, version `0.1.0`)
**Status:** Post-audit reference (2026-08-30 pass).

---

## 1. Layout

```
apps/api/src/routes/calendar/
  calendar-routes.js            (1010 lines — over the limit; split pending, D2-a)
  calendar-service.js           calendars + shares (owner-scoped)
  calendar-event-service.js     events, recurrence, attendees, reminders
  calendar-notification-service.js
  google/                       OAuth + two-way Google Calendar sync (9 files)
    google-token-crypto.js  google-oauth-service.js  google-config.js
    google-connection-service.js  google-source-service.js
    google-calendar-{discovery,events,event-link,initial-import}-service.js
  __tests__/                    11 files (incl. the full google/* subsystem)
apps/desktop/src/modules/atlas.calendar/  month/week/day/agenda views, Google picker
```

## 2. Data model

Prisma models: `CalendarCalendar` (ownerId), `CalendarShare` (calendarId +
userId + role VIEWER|EDITOR|MANAGER), `CalendarEvent`, `CalendarEventAttendee`,
`CalendarReminder`, `GoogleCalendarConnection`, `GoogleCalendarEventLink`, …
**User-scoped, not company-scoped.** Soft-delete via `enabled`.

## 3. Access model

- Calendars: `calendar-service` — every read/update/delete is
  `where: { ownerId: userId }`; shares only the owner can add/change/revoke.
- Events: `calendar-event-service.getAccessibleCalendarIds(userId)` = owned ∪
  shared; every list/get/create/update/delete scopes `calendarId: { in: … }`.
  Role gradient: edit ⇒ EDITOR/MANAGER/owner; delete & add-attendee ⇒
  MANAGER/owner. `updateAttendeeStatus` only touches the caller's own row.
- **Sharing is company-bounded (2026-08-30):** `calendar-service.assertShareableTarget`
  and `calendar-event-service.filterCompanyPeers` reject a target / attendee who
  shares no enabled `membership.companyId` with the acting user (403).

## 4. Recurrence (hardened 2026-08-30)

`normalizeRecurrenceRule(rule)` runs on `createEvent` + `updateEvent`: requires
`freq ∈ {DAILY,WEEKLY,MONTHLY,YEARLY}`, `interval ∈ [1,999]`, `count ∈ [1,366]`,
`until` a valid date; returns `null` for none, throws 400 on garbage.
`expandRecurrence` (run on every `listEvents`) hard-caps at 366 generated
instances and floors `interval` at 1 — regardless of what was persisted before
validation existed. Previously a client could store `count: 1e9` and DoS every
calendar fetch.

## 5. Transactions

`createEvent` writes the event row + `calendarEventAttendee` + `calendarReminder`
in one `prisma.$transaction` (2026-08-30). `updateEvent` re-arms reminders
(`sentAt = null`) when `startAt` changes and detaches a Google-imported event on
local edit.

## 6. Google Calendar integration

- Tokens: **AES-256-GCM** (random 12-byte IV + auth tag), 32-byte key from
  `GOOGLE_OAUTH_ENCRYPTION_KEY` (base64). `accessTokenEncrypted` /
  `refreshTokenEncrypted` stored, never plaintext.
- OAuth `state`: **HMAC-SHA256** signed, carries `{ userId, nonce, iat }`,
  verified with `timingSafeEqual` + expiry + `userId` binding (`google-oauth-service`).
- Env: `GOOGLE_OAUTH_CLIENT_SECRET`, `GOOGLE_OAUTH_ENCRYPTION_KEY`.
- Two-way sync with detach-on-local-edit; imported events link via
  `GoogleCalendarEventLink`.

## 7. Permissions

`atlasCalendarManifest` — 10 keys, all enforced 1:1 by the routes; `acl` block
present. Keys added to `permission-catalog.js` on 2026-08-30 (were missing →
RBAC contract). Nav: single "Calendario" item gated by `calendar.access`.

## 8. UI

Month/Week/Day/Agenda views + mini-calendar + Google connection card & picker.
Uses `@atlas/ui` (`ConfirmDialog` x3, `Dialog`, form fields). No
`window.confirm/alert/prompt`, no native `<select>/<textarea>/<table>`. Brand
violet (`bg-violet-600 text-white`) works in both themes. `CalendarScreen` is a
full workspace — no `PageHeader` by design (like chat / notes).

## 9. Tests

11 API test files. `calendar-service.test.js` 16/16, `calendar-event-service.test.js`
9/9 (5 recurrence + 3 attendee/recurrence guard + 1 detach). Full `google/*`
subsystem covered.

## 10. Known gaps / follow-ups (backlog D2-a … D2-e)

- `calendar-routes.js` 1010 lines — split into sub-routers.
- `CalendarShareModal` user picker uses the identity admin endpoint
  (`identity.users.read` coupling) — needs a lightweight member picker.
- One-time prod cleanup of any pre-existing cross-company `calendarShare` rows.
- `/calendar/internal/process-reminders` open outside production (app-wide
  pattern).
- Browser responsive QA of the calendar views (390 / 1440).

## 11. Verification (2026-08-30)

- `node --check calendar-event-service.js` — pass.
- `node --test routes/calendar/__tests__/*.test.js` — 72/72.
- `node --test` projects/rbac/notes/pwa/dist-serve/notification-publisher — green
  except the 9 pre-existing `projects/tasks-*` failures (backlog B1/B2 → D4).
