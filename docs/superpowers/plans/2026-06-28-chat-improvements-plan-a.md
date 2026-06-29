# Plan A — Chat Backend Improvements
**Spec:** `docs/superpowers/specs/2026-06-28-chat-improvements-a-backend.md`
**Date:** 2026-06-28

---

## Task 1 — Migración DB

**File:** `prisma/migrations/20260629000000_chat_improvements_a/migration.sql`

```sql
-- A1: assigned_user_id en chat_conversations
ALTER TABLE chat_conversations
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID;

CREATE INDEX IF NOT EXISTS chat_conversations_assigned_user_idx
  ON chat_conversations (assigned_user_id)
  WHERE deleted_at IS NULL;

-- A4: idle + absolute expiry en chat_guest_sessions
ALTER TABLE chat_guest_sessions
  ADD COLUMN IF NOT EXISTS idle_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  ADD COLUMN IF NOT EXISTS resume_token_hash TEXT UNIQUE;

CREATE INDEX IF NOT EXISTS chat_guest_sessions_email_expiry_idx
  ON chat_guest_sessions (email, idle_expires_at, absolute_expires_at)
  WHERE email IS NOT NULL AND closed_at IS NULL;

-- A5: templates
CREATE TABLE IF NOT EXISTS chat_message_templates (
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
CREATE INDEX IF NOT EXISTS chat_message_templates_company_idx
  ON chat_message_templates (company_id) WHERE enabled = true;
```

Run: `pnpm db:migrate && pnpm db:generate`

---

## Task 2 — A1: Auto-asignación en `guest-service.js`

**File:** `apps/api/src/routes/chat/guest-service.js`

1. Change factory signature: `createGuestChatService({ prisma, supabaseAdmin, notificationService })`
2. `createGuestSession` receives `companyId` (passed from route via `x-atlas-company` → already resolved in the route)
3. After conversation insert, call new internal `autoAssign(conv.id, companyId)`:
   ```js
   async function autoAssign(conversationId, companyId) {
     const candidates = await prisma.$queryRaw`
       SELECT up.user_id, COUNT(cc.id)::int AS open_count
       FROM "UserProfile" up
       LEFT JOIN chat_conversations cc
         ON cc.assigned_user_id = up.user_id
         AND cc.status IN ('open','pending')
         AND cc.type = 'external_support'
         AND cc.deleted_at IS NULL
       WHERE up."companyId" = ${companyId}::uuid
         AND up."availableForChat" = true
       GROUP BY up.user_id
       ORDER BY open_count ASC, RANDOM()
       LIMIT 1
     `
     if (!candidates[0]) return null
     const userId = candidates[0].user_id
     await prisma.$executeRaw`
       UPDATE chat_conversations SET assigned_user_id = ${userId}::uuid WHERE id = ${conversationId}::uuid
     `
     await prisma.$executeRaw`
       INSERT INTO chat_conversation_members (conversation_id, user_id, role)
       VALUES (${conversationId}::uuid, ${userId}::uuid, 'operator')
       ON CONFLICT DO NOTHING
     `
     return userId
   }
   ```
4. Return `assignedUserId` from `createGuestSession`.

---

## Task 3 — A2: Notificaciones en `sendGuestMessage`

**File:** `apps/api/src/routes/chat/guest-service.js`

After the message insert and Supabase broadcast in `sendGuestMessage`:
```js
const conv = (await prisma.$queryRaw`
  SELECT assigned_user_id, company_id FROM chat_conversations WHERE id = ${conversationId}::uuid LIMIT 1
`)[0]

if (conv?.assigned_user_id) {
  notificationService.createNotification({
    companyId: conv.company_id,
    userId: conv.assigned_user_id,
    channels: ['in_app'],
    type: 'chat.new_guest_message',
    title: 'Nuevo mensaje de visitante',
    body: body.slice(0, 100),
    sourceType: 'ChatConversation',
    sourceId: conversationId,
    actionUrl: `/app/chat/external/${conversationId}`,
  }).catch(() => {})
}
```

Also update `apps/api/src/routes/chat/index.js` to pass `notificationService` to `createGuestChatService(...)`.

---

## Task 4 — A3: Lead Capture en `createGuestSession`

**File:** `apps/api/src/routes/chat/guest-service.js`

At end of `createGuestSession`, non-blocking try/catch:
```js
if (email && companyId) {
  setImmediate(async () => {
    try {
      const sites = await prisma.$queryRaw`
        SELECT id FROM website_site WHERE company_id = ${companyId}::uuid AND enabled = true LIMIT 1
      `
      if (!sites[0]) return
      const existing = await prisma.$queryRaw`
        SELECT id FROM growth_lead
        WHERE company_id = ${companyId}::uuid
          AND email_normalized = lower(${email})
          AND created_at > NOW() - INTERVAL '7 days'
        LIMIT 1
      `
      if (existing[0]) return
      await prisma.growthLead.create({
        data: {
          companyId,
          siteId: sites[0].id,
          status: 'new',
          source: 'chat_widget',
          email,
          emailNormalized: email.toLowerCase().trim(),
          name: name ?? null,
          message: 'Lead generado desde el chat de la web.',
          firstSubmissionAt: new Date(),
          lastSubmissionAt: new Date(),
          firstSeenAt: new Date(),
          lastSeenAt: new Date(),
        },
      })
    } catch { /* non-fatal */ }
  })
}
```

---

## Task 5 — A4: Expiración de Sesiones

**File:** `apps/api/src/routes/chat/guest-service.js`

1. Update `resolveGuestSession` query to check `idle_expires_at` and `absolute_expires_at` instead of (or in addition to) `expires_at`.
2. Update `sendGuestMessage` to bump `idle_expires_at`:
   ```js
   await prisma.$executeRaw`
     UPDATE chat_guest_sessions
     SET idle_expires_at = NOW() + INTERVAL '30 minutes', last_seen_at = NOW()
     WHERE id = ${session.id}::uuid
   `
   ```
3. Session continuation in `createGuestSession` (when `email` is provided):
   ```js
   if (email) {
     const existing = await prisma.$queryRaw`
       SELECT cgs.id, cc.id as conversation_id
       FROM chat_guest_sessions cgs
       JOIN chat_conversations cc ON cc.created_by_guest_id = cgs.id
       WHERE lower(cgs.email) = lower(${email})
         AND cgs.closed_at IS NULL
         AND cgs.idle_expires_at > NOW()
         AND cgs.absolute_expires_at > NOW()
         AND cc.status != 'closed'
       ORDER BY cgs.created_at DESC LIMIT 1
     `
     if (existing[0]) {
       const resumeToken = crypto.randomBytes(32).toString('hex')
       const resumeHash = hashToken(resumeToken)
       await prisma.$executeRaw`
         UPDATE chat_guest_sessions
         SET resume_token_hash = ${resumeHash}, idle_expires_at = NOW() + INTERVAL '30 minutes'
         WHERE id = ${existing[0].id}::uuid
       `
       return { token: resumeToken, sessionId: existing[0].id, conversationId: existing[0].conversation_id, resumed: true }
     }
   }
   ```
4. Update `resolveGuestSession` to also match `resume_token_hash`, then clear it after use (single-use).

**Worker expiry job:**

**File:** `apps/api/src/routes/chat/index.js` — add internal endpoint:
```js
internal.post('/chat/internal/expire-sessions', requirePermission('chat.conversations.create'), async (c) => {
  const expired = await expireStaleGuestSessions(prisma)
  return c.json({ data: expired })
})
```

**File:** New `apps/api/src/routes/chat/session-expiry-job.js`:
```js
export async function expireStaleGuestSessions(prisma) {
  // Close conversations whose guest session has expired
  const closed = await prisma.$executeRaw`
    UPDATE chat_conversations
    SET status = 'closed', updated_at = NOW()
    WHERE type = 'external_support'
      AND status IN ('open', 'pending')
      AND created_by_guest_id IN (
        SELECT id FROM chat_guest_sessions
        WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
          AND closed_at IS NULL
      )
  `
  await prisma.$executeRaw`
    UPDATE chat_guest_sessions
    SET closed_at = NOW()
    WHERE (idle_expires_at < NOW() OR absolute_expires_at < NOW())
      AND closed_at IS NULL
  `
  return { closedConversations: closed }
}
```

Add to worker: call `expireStaleGuestSessions` every 15 min via `setInterval`.

---

## Task 6 — A5: Templates CRUD

**New file:** `apps/api/src/routes/chat/template-service.js`
- `createTemplateService({ prisma })` with: `listTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`, `recordUsage`
- All scoped by `companyId`

**Modify:** `apps/api/src/routes/chat/index.js` — add to `internal` router:
```
GET    /chat/templates
POST   /chat/templates
PATCH  /chat/templates/:id
DELETE /chat/templates/:id
POST   /chat/templates/:id/use
```

Permission: `chat.conversations.create` for all (same as other internal chat endpoints).

---

## Task 7 — A1b: Manual Assignment Endpoint + Response Update

**File:** `apps/api/src/routes/chat/index.js`

Add to `internal`:
```js
internal.post('/chat/external/:conversationId/assign', requirePermission('chat.conversations.create'), async (c) => {
  const { conversationId } = c.req.param()
  const { userId } = await c.req.json()
  const companyId = c.get('companyId')
  // validate userId belongs to company, update assigned_user_id, add as member
  ...
})
```

Update `GET /chat/external` and `GET /chat/external/:id` responses to include `assignedUserId`.

---

## Task 8 — Deploy & Verify

1. `pnpm db:migrate` locally
2. `pnpm db:generate`
3. Test: `POST /public/chat/session` with email → check lead created, assignment set
4. Test: `POST /public/chat/session/:token/messages` → check notification fires
5. Test: `GET /chat/templates` → empty list → `POST /chat/templates` → list returns template
6. `pnpm docker:release:api` → `./setup-external.sh` on VPS

---

## Order

Tasks 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8
Tasks 2–7 can be done in a single editing session after migration is in place.
