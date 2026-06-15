# Growth Lead Comments — Plan A: API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a comments + reactions + mention backend for `atlas.growth` leads, following the exact same pattern as `atlas.inventory` comments.

**Architecture:** New Prisma models `GrowthLeadComment`, `GrowthLeadMention`, `GrowthLeadCommentReaction` + a dedicated service file + dedicated routes file wired into the existing growth router. No changes to `apps/api/src/index.js`.

**Tech Stack:** Prisma 7, Hono, PostgreSQL (UUID v7), `apps/api/src/lib/mention-utils.js` (shared `parseMentionIds`)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `prisma/schema.prisma` — add 3 models + back-relations |
| Create | `prisma/migrations/<timestamp>_growth_lead_comments/migration.sql` — auto-generated |
| Create | `apps/api/src/routes/growth/growth-comments-service.js` |
| Create | `apps/api/src/routes/growth/growth-comment-routes.js` |
| Modify | `apps/api/src/routes/growth/growth-router.js` — register comments routes |
| Modify | `packages/sdk/src/domains/growth.js` — 5 new SDK methods |

---

## Task 1 — Prisma schema: 3 new models + back-relations

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `GrowthLeadComment` model at the end of the growth section (after `GrowthDailyMetric`)**

Find the end of the growth section (around line 1080 in schema.prisma, after `@@map("growth_daily_metric")`). Add the three models:

```prisma
model GrowthLeadComment {
  id        String    @id @default(uuid(7)) @db.Uuid
  leadId    String    @db.Uuid @map("lead_id")
  authorId  String    @db.Uuid @map("author_id")
  body      String    @db.VarChar(5000)
  createdAt DateTime  @default(now()) @map("created_at")
  editedAt  DateTime? @map("edited_at")

  lead      GrowthLead                  @relation(fields: [leadId], references: [id], onDelete: Cascade)
  author    UserProfile                 @relation("UserGrowthComments", fields: [authorId], references: [id])
  mentions  GrowthLeadMention[]
  reactions GrowthLeadCommentReaction[]

  @@index([leadId])
  @@map("growth_lead_comment")
}

model GrowthLeadMention {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  comment GrowthLeadComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile        @relation("UserGrowthMentions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
  @@index([commentId])
  @@index([userId])
  @@map("growth_lead_mention")
}

model GrowthLeadCommentReaction {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  emoji     String   @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")

  comment GrowthLeadComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile        @relation("UserGrowthReactions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@index([commentId])
  @@map("growth_lead_comment_reaction")
}
```

- [ ] **Step 2: Add `comments` relation to `GrowthLead` model**

In the `GrowthLead` model, add a relation field before the `@@index` lines:

```prisma
  comments  GrowthLeadComment[]
```

- [ ] **Step 3: Add back-relations to `UserProfile` model**

In the `UserProfile` model, after the `invReactions` line (around line 290), add:

```prisma
  growthComments      GrowthLeadComment[]         @relation("UserGrowthComments")
  growthMentions      GrowthLeadMention[]         @relation("UserGrowthMentions")
  growthReactions     GrowthLeadCommentReaction[] @relation("UserGrowthReactions")
```

---

## Task 2 — Run migration and regenerate Prisma client

**Files:**
- Create: `prisma/migrations/<auto>/migration.sql` (auto-generated)

- [ ] **Step 1: Create and apply the migration**

```bash
cd d:/RacoonDevs/atlaserp-v2
npx prisma migrate dev --name growth_lead_comments
```

Expected output: `✔ Generated Prisma Client` and `The following migration(s) have been applied` with `growth_lead_comments`.

- [ ] **Step 2: Verify Prisma client regenerated**

```bash
node -e "const { PrismaClient } = require('./node_modules/.prisma/client'); const p = new PrismaClient(); console.log(typeof p.growthLeadComment);"
```

Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(growth): add GrowthLeadComment, GrowthLeadMention, GrowthLeadCommentReaction schema"
```

---

## Task 3 — Comments service

**Files:**
- Create: `apps/api/src/routes/growth/growth-comments-service.js`

- [ ] **Step 1: Create `growth-comments-service.js`**

```javascript
import { parseMentionIds } from '../../lib/mention-utils.js';

export class GrowthCommentServiceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'GrowthCommentServiceError';
    this.status = status;
  }
}

export function createGrowthCommentsService({ prisma }) {
  async function resolveProfileId(authUserId) {
    if (!authUserId) return null;
    const profile = await prisma.userProfile.findFirst({
      where: { authUserId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  const authorSelect = {
    select: { id: true, firstName: true, lastName: true, avatarFileId: true },
  };

  async function listComments(leadId, companyId) {
    const lead = await prisma.growthLead.findFirst({ where: { id: leadId, companyId } });
    if (!lead) throw new GrowthCommentServiceError('Lead no encontrado.', 404);

    return prisma.growthLeadComment.findMany({
      where: { leadId },
      include: {
        author: authorSelect,
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createComment(leadId, authorAuthId, body, companyId) {
    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new GrowthCommentServiceError('Usuario no encontrado.', 400);

    const lead = await prisma.growthLead.findFirst({ where: { id: leadId, companyId } });
    if (!lead) throw new GrowthCommentServiceError('Lead no encontrado.', 404);

    if (!body?.trim()) throw new GrowthCommentServiceError('El comentario no puede estar vacío.', 400);
    if (body.trim().length > 5000) throw new GrowthCommentServiceError('El comentario no puede tener más de 5000 caracteres.', 400);

    const trimmedBody = body.trim();
    const mentionIds = parseMentionIds(trimmedBody);

    return prisma.$transaction(async (tx) => {
      const comment = await tx.growthLeadComment.create({
        data: { leadId, authorId: authorProfileId, body: trimmedBody },
        include: { author: authorSelect },
      });

      for (const userId of mentionIds) {
        try {
          await tx.growthLeadMention.create({ data: { commentId: comment.id, userId } });
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err;
        }
      }

      return { comment, mentionIds };
    });
  }

  async function updateComment(commentId, authorAuthId, body) {
    if (!body?.trim()) throw new GrowthCommentServiceError('El comentario no puede estar vacío.', 400);
    if (body.trim().length > 5000) throw new GrowthCommentServiceError('El comentario no puede tener más de 5000 caracteres.', 400);

    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new GrowthCommentServiceError('Usuario no encontrado.', 400);

    const comment = await prisma.growthLeadComment.findFirst({ where: { id: commentId } });
    if (!comment) throw new GrowthCommentServiceError('Comentario no encontrado.', 404);
    if (comment.authorId !== authorProfileId) throw new GrowthCommentServiceError('Solo el autor puede editar este comentario.', 403);

    return prisma.growthLeadComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: { author: authorSelect },
    });
  }

  async function deleteComment(commentId, requesterAuthId, companyId) {
    const requesterProfileId = await resolveProfileId(requesterAuthId);
    if (!requesterProfileId) throw new GrowthCommentServiceError('Usuario no encontrado.', 400);

    const comment = await prisma.growthLeadComment.findFirst({
      where: { id: commentId },
      include: { lead: { select: { companyId: true } } },
    });
    if (!comment) throw new GrowthCommentServiceError('Comentario no encontrado.', 404);
    if (comment.lead?.companyId !== companyId) throw new GrowthCommentServiceError('Comentario no encontrado.', 404);
    if (comment.authorId !== requesterProfileId) throw new GrowthCommentServiceError('No tienes permiso para eliminar este comentario.', 403);

    await prisma.growthLeadComment.delete({ where: { id: commentId } });
  }

  async function toggleReaction(commentId, userAuthId, emoji) {
    const userProfileId = await resolveProfileId(userAuthId);
    if (!userProfileId) throw new GrowthCommentServiceError('Usuario no encontrado.', 400);

    const existing = await prisma.growthLeadCommentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
    });

    if (existing) {
      await prisma.growthLeadCommentReaction.delete({
        where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
      });
      return { action: 'removed' };
    }

    await prisma.growthLeadCommentReaction.create({ data: { commentId, userId: userProfileId, emoji } });
    return { action: 'added' };
  }

  return { listComments, createComment, updateComment, deleteComment, toggleReaction };
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/growth/growth-comments-service.js
```

Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/growth/growth-comments-service.js
git commit -m "feat(growth): add growth-comments-service with CRUD + reactions"
```

---

## Task 4 — Comment routes

**Files:**
- Create: `apps/api/src/routes/growth/growth-comment-routes.js`

- [ ] **Step 1: Create `growth-comment-routes.js`**

```javascript
import { Hono } from 'hono';
import { GrowthCommentServiceError } from './growth-comments-service.js';

function companyId(c) {
  return (
    c.get('companyId') ??
    c.get('userContext')?.memberships?.[0]?.companyId ??
    null
  );
}

function authUserId(c) {
  return c.get('authUserId') ?? null;
}

function hasPermission(c, key) {
  const ctx = c.get('userContext');
  return Boolean(
    ctx?.isAdmin ||
    ctx?.permissionSet?.has?.(key) ||
    ctx?.permissions?.includes?.(key),
  );
}

function handleError(c, err) {
  if (err instanceof GrowthCommentServiceError) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[growth.comments]', err);
  return c.json({ error: 'Error interno.' }, 500);
}

export function createGrowthCommentRoutes({ commentsService, requirePermission }) {
  const app = new Hono();

  // GET /growth/leads/:id/comments
  app.get('/leads/:id/comments', requirePermission('growth.leads.read'), async (c) => {
    try {
      const { id } = c.req.param();
      const comments = await commentsService.listComments(id, companyId(c));
      return c.json({ data: comments });
    } catch (err) {
      return handleError(c, err);
    }
  });

  // POST /growth/leads/:id/comments
  app.post('/leads/:id/comments', requirePermission('growth.leads.update'), async (c) => {
    try {
      const { id } = c.req.param();
      const { body } = await c.req.json();
      const { comment } = await commentsService.createComment(id, authUserId(c), body, companyId(c));
      return c.json({ data: comment }, 201);
    } catch (err) {
      return handleError(c, err);
    }
  });

  // PATCH /growth/leads/:id/comments/:cid
  app.patch('/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const { cid } = c.req.param();
      const { body } = await c.req.json();
      const comment = await commentsService.updateComment(cid, authUserId(c), body);
      return c.json({ data: comment });
    } catch (err) {
      return handleError(c, err);
    }
  });

  // DELETE /growth/leads/:id/comments/:cid
  app.delete('/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const { cid } = c.req.param();
      await commentsService.deleteComment(cid, authUserId(c), companyId(c));
      return c.json({ success: true });
    } catch (err) {
      return handleError(c, err);
    }
  });

  // POST /growth/leads/:id/comments/:cid/reactions
  app.post('/leads/:id/comments/:cid/reactions', requirePermission('growth.leads.update'), async (c) => {
    try {
      const { cid } = c.req.param();
      const { emoji } = await c.req.json();
      const result = await commentsService.toggleReaction(cid, authUserId(c), emoji);
      return c.json({ data: result });
    } catch (err) {
      return handleError(c, err);
    }
  });

  return app;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/growth/growth-comment-routes.js
```

Expected: no output.

---

## Task 5 — Wire comments routes into growth router

**Files:**
- Modify: `apps/api/src/routes/growth/growth-router.js`

- [ ] **Step 1: Update `growth-router.js`**

Replace the entire file content with:

```javascript
import { Hono } from "hono";

import { createNotificationService } from "../../services/notification-service.js";
import { createGrowthAnalyticsRoutes } from "./growth-analytics-routes.js";
import { createGrowthAnalyticsService } from "./growth-analytics-service.js";
import { createGrowthCommentRoutes } from "./growth-comment-routes.js";
import { createGrowthCommentsService } from "./growth-comments-service.js";
import { createGrowthLeadRoutes } from "./growth-lead-routes.js";
import { createGrowthLeadService } from "./growth-lead-service.js";

export function createGrowthRouter({
  prisma,
  requirePermission,
  notificationService = createNotificationService({ prisma }),
}) {
  const app = new Hono();
  const service = createGrowthLeadService({ prisma, notificationService });
  const analyticsService = createGrowthAnalyticsService({ prisma });
  const commentsService = createGrowthCommentsService({ prisma });

  app.route("", createGrowthLeadRoutes({ service, requirePermission }));
  app.route("", createGrowthAnalyticsRoutes({ service: analyticsService, prisma, requirePermission }));
  app.route("", createGrowthCommentRoutes({ commentsService, requirePermission }));
  return app;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/api/src/routes/growth/growth-router.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/growth/growth-comment-routes.js apps/api/src/routes/growth/growth-router.js
git commit -m "feat(growth): add comment routes wired into growth router"
```

---

## Task 6 — SDK methods

**Files:**
- Modify: `packages/sdk/src/domains/growth.js`

- [ ] **Step 1: Add 5 comment methods to the returned object in `growth.js`**

At the end of the `return { ... }` block (before the closing `};`), add:

```javascript
    // Comments
    listLeadComments: (leadId, token) =>
      request(`${leadPath(leadId)}/comments`, {
        headers: withAuthHeaders(token),
      }),

    createLeadComment: (leadId, payload, token) =>
      request(`${leadPath(leadId)}/comments`, {
        method: 'POST',
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    updateLeadComment: (leadId, commentId, payload, token) =>
      request(`${leadPath(leadId)}/comments/${encodeURIComponent(commentId)}`, {
        method: 'PATCH',
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),

    deleteLeadComment: (leadId, commentId, token) =>
      request(`${leadPath(leadId)}/comments/${encodeURIComponent(commentId)}`, {
        method: 'DELETE',
        headers: withAuthHeaders(token),
      }),

    toggleLeadCommentReaction: (leadId, commentId, payload, token) =>
      request(`${leadPath(leadId)}/comments/${encodeURIComponent(commentId)}/reactions`, {
        method: 'POST',
        headers: withAuthHeaders(token),
        body: JSON.stringify(payload),
      }),
```

- [ ] **Step 2: Syntax check**

```bash
node --check packages/sdk/src/domains/growth.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add packages/sdk/src/domains/growth.js
git commit -m "feat(sdk): add growth lead comment methods"
```

---

## Task 7 — Manual smoke test

- [ ] **Step 1: Start the API**

```bash
pnpm dev:api
```

Wait for `Hono running on port 4010`.

- [ ] **Step 2: Hit the list endpoint (expect 200, empty array)**

Use the app's auth token (from browser devtools → Application → Local Storage → `access_token`).

```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" \
  http://localhost:4010/growth/leads/<REAL_LEAD_ID>/comments | python -m json.tool
```

Expected: `{"data": []}`

- [ ] **Step 3: Create a comment**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"body":"Primer comentario de prueba"}' \
  http://localhost:4010/growth/leads/<REAL_LEAD_ID>/comments | python -m json.tool
```

Expected: `{"data": {"id": "...", "body": "Primer comentario de prueba", ...}}`

- [ ] **Step 4: List again — verify comment appears**

```bash
curl -s -H "Authorization: Bearer $ATLAS_TOKEN" \
  http://localhost:4010/growth/leads/<REAL_LEAD_ID>/comments | python -m json.tool
```

Expected: array with 1 comment.

- [ ] **Step 5: React to the comment**

```bash
curl -s -X POST \
  -H "Authorization: Bearer $ATLAS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"emoji":"👍"}' \
  http://localhost:4010/growth/leads/<REAL_LEAD_ID>/comments/<COMMENT_ID>/reactions | python -m json.tool
```

Expected: `{"data": {"action": "added"}}`
