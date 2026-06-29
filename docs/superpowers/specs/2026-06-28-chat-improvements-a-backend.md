# Chat Improvements — Plan A: Backend
**Date:** 2026-06-28
**Status:** Approved — ready for implementation

---

## Context

The `atlas.chat` guest widget is live in production. This spec covers backend improvements to make it operationally solid: agent assignment, notifications, lead capture, session lifecycle, and message templates.

---

## A1 — Agent Auto-Assignment

**Goal:** When a guest session is created, automatically assign it to the least-loaded available operator.

**Migration:** Add `assigned_user_id UUID` to `chat_conversations`.

```sql
ALTER TABLE chat_conversations
  ADD COLUMN assigned_user_id UUID REFERENCES "UserProfile"(user_id) ON DELETE SET NULL;
CREATE INDEX chat_conversations_assigned_user_idx
  ON chat_conversations (assigned_user_id)
  WHERE deleted_at IS NULL;
```

**Assignment logic** (in `guest-service.js`, called after conversation insert):
```sql
SELECT up.user_id, COUNT(cc.id) AS open_count
FROM "UserProfile" up
LEFT JOIN chat_conversations cc
  ON cc.assigned_user_id = up.user_id
  AND cc.status IN ('open', 'pending')
  AND cc.type = 'external_support'
WHERE up.company_id = $companyId
  AND up.available_for_chat = true
GROUP BY up.user_id
ORDER BY open_count ASC, RANDOM()
LIMIT 1
```

If a candidate is found:
- `UPDATE chat_conversations SET assigned_user_id = $userId WHERE id = $convId`
- Add operator as member: `INSERT INTO chat_conversation_members (conversation_id, user_id, role) VALUES ($convId, $userId, 'operator') ON CONFLICT DO NOTHING`

**New API endpoints:**
- `POST /chat/external/:conversationId/assign` — manually reassign to another operator (body: `{ userId }`)
- The existing `GET /chat/external` list must include `assigned_user_id` in the response

**`createGuestSession` signature change:** Needs `companyId`. Resolve via `website_id → website_site → company_id` or pass directly from the route (the route already resolves company from `x-atlas-company` header).

---

## A2 — In-App Notification on New Guest Message

**Goal:** When a guest sends a message and the conversation has an assigned operator, fire an in-app notification to that operator.

**Where:** In `guest-service.js` → `sendGuestMessage`, after the message insert and broadcast, if `assigned_user_id` is set on the conversation:

```js
notificationService.createNotification({
  companyId,
  userId: conversation.assigned_user_id,
  channels: ['in_app', 'email'],  // respects user preferences via existing notificationService
  type: 'chat.new_guest_message',
  title: 'Nuevo mensaje de visitante',
  body: body.slice(0, 100),
  sourceType: 'ChatConversation',
  sourceId: conversationId,
  actionUrl: `/app/chat/external/${conversationId}`,
})
```

**When no assigned user:** fire notification to ALL available operators (broadcast to online operators). Use the same query from A1 but without LIMIT.

**`sendGuestMessage` signature change:** Needs `notificationService` injected into `createGuestChatService`. Update factory signature.

---

## A3 — Lead Capture on Session Creation

**Goal:** When `createGuestSession` is called with an `email`, create a `GrowthLead` with `source: 'chat_widget'` if one doesn't already exist for this email + company in the last 7 days.

**Logic** (at the end of `createGuestSession`, non-fatal — wrapped in try/catch):
1. If no `email` → skip
2. Resolve `companyId` from `websiteId` (already needed for A1)
3. Look up default site for the company (`SELECT id FROM website_site WHERE company_id = $1 AND enabled = true LIMIT 1`)
4. Check for recent lead: `SELECT id FROM growth_lead WHERE company_id = $1 AND email_normalized = lower($2) AND created_at > NOW() - INTERVAL '7 days' LIMIT 1`
5. If none found: `prisma.growthLead.create({ data: { companyId, siteId, status: 'new', source: 'chat_widget', email, name, message: 'Lead generado desde el chat de la web', firstSubmissionAt: now(), ... } })`
6. Store `leadId` in `chat_guest_sessions.metadata.leadId` for traceability

**No migration needed** — `GrowthLead.source` is already a `String?` field.

---

## A4 — Session Expiration: Idle 30 min OR Absolute 24h

**Goal:** Guest sessions expire after 30 min of inactivity OR 24h from creation, whichever comes first. Sessions with the same email can be resumed if still valid.

**Migration:**
```sql
ALTER TABLE chat_guest_sessions
  ADD COLUMN idle_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  ADD COLUMN absolute_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours');
```

**Keep existing `expires_at`** as a fallback / legacy field. New logic uses `idle_expires_at` and `absolute_expires_at`.

**Session validity check** (update `resolveGuestSession`):
```sql
WHERE session_token_hash = $hash
  AND closed_at IS NULL
  AND idle_expires_at > NOW()
  AND absolute_expires_at > NOW()
```

**Bump idle expiry on activity** (`sendGuestMessage`):
```sql
UPDATE chat_guest_sessions
SET idle_expires_at = NOW() + INTERVAL '30 minutes',
    last_seen_at = NOW()
WHERE id = $sessionId
```

**Session continuation on `createSession` with email:**
Before creating a new session, check:
```sql
SELECT cgs.*, cc.id as conversation_id
FROM chat_guest_sessions cgs
JOIN chat_conversations cc ON cc.created_by_guest_id = cgs.id
WHERE cgs.email = lower($email)
  AND cgs.closed_at IS NULL
  AND cgs.idle_expires_at > NOW()
  AND cgs.absolute_expires_at > NOW()
  AND cc.status != 'closed'
ORDER BY cgs.created_at DESC
LIMIT 1
```
If found → return existing `{ token: CANNOT_RETURN_ORIGINAL_TOKEN }` — issue: the original raw token is never stored. Solution: generate a new continuation token, store its hash in the session (add column `continuation_token_hash TEXT`), and return it. The continuation token is single-use: after first use it's cleared.

Actually simpler: add `resume_token_hash TEXT` column. When an email match is found, generate a new random token, store its hash, and return it. The widget uses it normally. On resolution, check BOTH `session_token_hash` AND `resume_token_hash`.

**Migration addition:**
```sql
ALTER TABLE chat_guest_sessions ADD COLUMN resume_token_hash TEXT UNIQUE;
```

**Auto-close expired sessions** (cron job / worker task, run every 15 min):
```sql
UPDATE chat_conversations
SET status = 'closed', updated_at = NOW()
WHERE type = 'external_support'
  AND status IN ('open', 'pending')
  AND created_by_guest_id IN (
    SELECT id FROM chat_guest_sessions
    WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
      AND closed_at IS NULL
  );

UPDATE chat_guest_sessions
SET closed_at = NOW()
WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
  AND closed_at IS NULL;
```

This can run in `apps/worker/` or as a scheduled endpoint `POST /chat/internal/expire-sessions` called by the worker.

---

## A5 — Message Templates

**Goal:** Operators can save and reuse canned reply templates per company.

**Migration:**
```sql
CREATE TABLE chat_message_templates (
  id           UUID        NOT NULL DEFAULT uuidv7() PRIMARY KEY,
  company_id   UUID        NOT NULL,
  created_by   UUID,
  title        TEXT        NOT NULL,
  body         TEXT        NOT NULL,
  tags         TEXT[]      NOT NULL DEFAULT '{}',
  usage_count  INT         NOT NULL DEFAULT 0,
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX chat_message_templates_company_idx ON chat_message_templates (company_id) WHERE enabled = true;
```

**Endpoints** (add to `internal` router in `apps/api/src/routes/chat/index.js`):
- `GET /chat/templates` — list for company (auth required, permission: `chat.conversations.create`)
- `POST /chat/templates` — create (body: `{ title, body, tags? }`)
- `PATCH /chat/templates/:id` — update
- `DELETE /chat/templates/:id` — soft-delete (`enabled = false`)
- `POST /chat/templates/:id/use` — increment `usage_count` (called when operator sends a template)

---

## Files to Create/Modify

| Action | Path |
|---|---|
| New migration | `prisma/migrations/20260629000000_chat_improvements_a/migration.sql` |
| Modify | `apps/api/src/routes/chat/guest-service.js` |
| Modify | `apps/api/src/routes/chat/index.js` |
| Modify | `apps/api/src/routes/chat/chat-service.js` (add notificationService param) |
| New | `apps/api/src/routes/chat/template-service.js` |
| Modify | `apps/worker/src/index.js` (add session expiry job) |
| Modify | `packages/sdk/src/domains/chat.js` (add assignment endpoint) |

---

## Verification

- `POST /public/chat/session` with email → conversation created with `assigned_user_id` set
- `GET /chat/external` → shows `assignedUserId` per conversation
- `POST /public/chat/session/:token/messages` → operator receives in-app notification
- `GrowthLead` row created with `source = 'chat_widget'` after session with email
- Session idle expiry: if no message for 30 min → `POST /chat/internal/expire-sessions` closes conversation
- Same email within 30 min idle window → `createSession` returns continuation token
- `GET /chat/templates` → returns company templates
