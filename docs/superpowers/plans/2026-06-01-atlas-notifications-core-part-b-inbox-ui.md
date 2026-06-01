# Atlas Notifications - Part B Inbox UI - Implementation Plan

Date: 2026-06-01
Spec: docs/superpowers/specs/2026-06-01-atlas-notifications-core-design.md
Status: Draft

> **For agentic workers:** Mode: IMPLEMENTATION. Start only after Part A gate is complete.

## Goal

Ship the end-user UX for notifications: topbar bell, unread badge, inbox panel, and full screen module routes.

## Architecture summary

Part B consumes Part A APIs to build consistent in-app UX. It adds a new core screen in ModuleOutlet mapping and replaces legacy bell behavior with the unified notifications domain.

---

## File Structure Map

### Create

- `apps/desktop/src/modules/atlas.notifications/NotificationsInboxScreen.jsx`
- `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`
- `apps/desktop/src/modules/atlas.notifications/index.js`

### Modify

- `apps/desktop/src/components/NotificationBell.jsx` - repoint to `atlas.notifications` API
- `apps/desktop/src/components/Topbar.jsx` - ensure unified bell placement and navigation
- `apps/desktop/src/app/ModuleOutlet.jsx` - add `atlas.notifications` route mappings

---

## Task 1 - Notification bell unification

**Files:**
- Modify: `apps/desktop/src/components/NotificationBell.jsx`
- Modify: `apps/desktop/src/components/Topbar.jsx`

**Changes:**

- [ ] Step 1: Replace legacy calendar-specific assumptions with generic notification fields.
- [ ] Step 2: Keep unread badge and mark-read actions.
- [ ] Step 3: Add navigation behavior for notification links.

**Validation:**

```bash
node --check apps/desktop/src/components/NotificationBell.jsx
node --check apps/desktop/src/components/Topbar.jsx
```

---

## Task 2 - Core notifications screens

**Files:**
- Create: `apps/desktop/src/modules/atlas.notifications/NotificationsInboxScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx`
- Create: `apps/desktop/src/modules/atlas.notifications/index.js`

**Changes:**

- [ ] Step 1: Build inbox table/list view with `PageHeader`, filters, empty/error/loading states.
- [ ] Step 2: Add actions: mark one read, mark all read.
- [ ] Step 3: Build settings screen for event/channel preferences.

**Validation:**

```bash
node --check apps/desktop/src/modules/atlas.notifications/NotificationsInboxScreen.jsx
node --check apps/desktop/src/modules/atlas.notifications/NotificationSettingsScreen.jsx
node --check apps/desktop/src/modules/atlas.notifications/index.js
```

---

## Task 3 - Route mapping integration

**Files:**
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`

**Changes:**

- [ ] Step 1: Add `SCREEN_MAP` entries for:
  - `atlas.notifications:/`
  - `atlas.notifications:/settings`
- [ ] Step 2: Ensure fallback and navigation access checks behave like other core modules.

**Validation:**

```bash
node --check apps/desktop/src/app/ModuleOutlet.jsx
pnpm --filter @atlas/desktop build:web
```

---

## Task 4 - UX smoke tests

**Files:**
- No new files

**Changes:**

- [ ] Step 1: Verify bell unread count updates after publish.
- [ ] Step 2: Verify `/app/m/atlas.notifications` list renders and filters.
- [ ] Step 3: Verify mark-read actions update UI state.
- [ ] Step 4: Verify user without `notifications.read` cannot access route.

**Validation:**

Manual checks only.

---

## Rollback Notes

1. Revert bell + topbar + module route map + new screens.
2. Keep backend intact from Part A.

---

## Part B Gate

- [ ] Desktop build passes.
- [ ] Bell works end-to-end with unread and mark-read behavior.
- [ ] Inbox route gated by permissions.

