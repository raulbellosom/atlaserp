# Generic Comments System — Plan A (API/Backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace 9 module-specific comment tables (inv_comment, task_comment, growth_lead_comment + mentions + reactions) with 3 generic polymorphic tables (`entity_comment`, `entity_comment_mention`, `entity_comment_reaction`) and a single shared service.

**Architecture:** A generic `EntityComment` model stores `entityType` (string like `'InvItem'`, `'Task'`, `'GrowthLead'`) and `entityId` (UUID). No DB foreign key to the parent entity — validated at route level. Per-module Hono routes keep their existing URLs and permissions but delegate to one shared `createCommentsService`. Existing data is migrated via a Node script before old models are dropped.

**Tech Stack:** Prisma 7 + PostgreSQL (via `prisma db push`), Hono, Node.js built-in test runner. No migrations — project uses `db push` due to schema drift.

---

## File Map

| Action | Path |
|---|---|
| Modify | `prisma/schema.prisma` — add 3 generic models, remove 9 old models, update UserProfile back-relations |
| Create | `apps/api/src/services/comments-service.js` — generic service |
| Create | `prisma/scripts/migrate-comments.js` — one-time data migration |
| Modify | `apps/api/src/index.js` — inventory comment routes use generic service |
| Modify | `apps/api/src/routes/projects/projects-routes.js` — task comment routes use generic service |
| Modify | `apps/api/src/routes/growth/growth-comment-routes.js` — use generic service |
| Delete | `apps/api/src/routes/growth/growth-comments-service.js` — replaced by generic service |

---

### Task 1: Add generic Prisma models and update UserProfile

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the 3 generic models to schema.prisma**

Find the `GrowthLeadCommentReaction` model (currently the last comment model, around line 1130) and add the following AFTER it:

```prisma
model EntityComment {
  id         String    @id @default(uuid(7)) @db.Uuid
  companyId  String    @db.Uuid @map("company_id")
  entityType String    @db.VarChar(100) @map("entity_type")
  entityId   String    @db.Uuid @map("entity_id")
  authorId   String    @db.Uuid @map("author_id")
  body       String    @db.VarChar(5000)
  createdAt  DateTime  @default(now()) @map("created_at")
  editedAt   DateTime? @map("edited_at")

  author    UserProfile             @relation("UserEntityComments", fields: [authorId], references: [id])
  mentions  EntityCommentMention[]
  reactions EntityCommentReaction[]

  @@index([entityType, entityId])
  @@index([companyId, entityType, entityId])
  @@index([authorId])
  @@map("entity_comment")
}

model EntityCommentMention {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  createdAt DateTime @default(now()) @map("created_at")

  comment EntityComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile   @relation("UserEntityMentions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId])
  @@index([commentId])
  @@index([userId])
  @@map("entity_comment_mention")
}

model EntityCommentReaction {
  id        String   @id @default(uuid(7)) @db.Uuid
  commentId String   @db.Uuid @map("comment_id")
  userId    String   @db.Uuid @map("user_id")
  emoji     String   @db.VarChar(10)
  createdAt DateTime @default(now()) @map("created_at")

  comment EntityComment @relation(fields: [commentId], references: [id], onDelete: Cascade)
  user    UserProfile   @relation("UserEntityReactions", fields: [userId], references: [id], onDelete: Cascade)

  @@unique([commentId, userId, emoji])
  @@index([commentId])
  @@map("entity_comment_reaction")
}
```

- [ ] **Step 2: Add back-relations to UserProfile**

In `prisma/schema.prisma`, find the UserProfile model's back-relations section (look for `growthReactions` at around line 296). Add after `growthReactions`:

```prisma
  entityComments  EntityComment[]         @relation("UserEntityComments")
  entityMentions  EntityCommentMention[]  @relation("UserEntityMentions")
  entityReactions EntityCommentReaction[] @relation("UserEntityReactions")
```

- [ ] **Step 3: Validate schema**

Run:
```
pnpm prisma validate
```

Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 4: Push new tables to DB**

Run:
```
pnpm prisma db push --accept-data-loss
```

Expected output ends with: `Your database is now in sync with your Prisma schema.`

The new tables `entity_comment`, `entity_comment_mention`, `entity_comment_reaction` are now created alongside the old tables (old tables still exist for migration).

- [ ] **Step 5: Regenerate Prisma client**

Run:
```
pnpm db:generate
```

Expected: `Generated Prisma Client (v7.8.0)`

- [ ] **Step 6: Commit**

```
git add prisma/schema.prisma
git commit -m "feat(schema): add generic EntityComment/Mention/Reaction models"
```

---

### Task 2: Create generic comments service

**Files:**
- Create: `apps/api/src/services/comments-service.js`

- [ ] **Step 1: Create the file**

```js
import { parseMentionIds } from '../lib/mention-utils.js';

export class CommentsServiceError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.name = 'CommentsServiceError';
    this.status = status;
  }
}

export function createCommentsService({ prisma }) {
  async function resolveProfileId(authUserId) {
    if (!authUserId) return null;
    const profile = await prisma.userProfile.findFirst({
      where: { authUserId },
      select: { id: true },
    });
    return profile?.id ?? null;
  }

  async function listComments(entityType, entityId) {
    return prisma.entityComment.findMany({
      where: { entityType, entityId },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        mentions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
        reactions: { include: { user: { select: { id: true, firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async function createComment(entityType, entityId, authorAuthId, body, companyId) {
    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new CommentsServiceError('Usuario no encontrado.', 400);
    if (!body?.trim()) throw new CommentsServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new CommentsServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const trimmedBody = body.trim();
    const mentionIds = parseMentionIds(trimmedBody);

    return prisma.$transaction(async (tx) => {
      const comment = await tx.entityComment.create({
        data: { entityType, entityId, authorId: authorProfileId, body: trimmedBody, companyId },
        include: {
          author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
        },
      });

      for (const userId of mentionIds) {
        try {
          await tx.entityCommentMention.create({ data: { commentId: comment.id, userId } });
        } catch (err) {
          if (err.code !== 'P2003' && err.code !== 'P2002') throw err;
        }
      }

      return { comment, mentionIds };
    });
  }

  async function updateComment(commentId, authorAuthId, body) {
    if (!body?.trim()) throw new CommentsServiceError('El comentario no puede estar vacio.', 400);
    if (body.trim().length > 5000) throw new CommentsServiceError('El comentario no puede tener mas de 5000 caracteres.', 400);

    const authorProfileId = await resolveProfileId(authorAuthId);
    if (!authorProfileId) throw new CommentsServiceError('Usuario no encontrado.', 400);

    const comment = await prisma.entityComment.findFirst({ where: { id: commentId } });
    if (!comment) throw new CommentsServiceError('Comentario no encontrado.', 404);
    if (comment.authorId !== authorProfileId) throw new CommentsServiceError('Solo el autor puede editar este comentario.', 403);

    return prisma.entityComment.update({
      where: { id: commentId },
      data: { body: body.trim(), editedAt: new Date() },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, avatarFileId: true } },
      },
    });
  }

  async function deleteComment(commentId, requesterAuthId, companyId) {
    const requesterProfileId = await resolveProfileId(requesterAuthId);
    if (!requesterProfileId) throw new CommentsServiceError('Usuario no encontrado.', 400);

    const comment = await prisma.entityComment.findFirst({ where: { id: commentId } });
    if (!comment) throw new CommentsServiceError('Comentario no encontrado.', 404);
    if (comment.companyId !== companyId) throw new CommentsServiceError('Comentario no encontrado.', 404);
    if (comment.authorId !== requesterProfileId) throw new CommentsServiceError('No tienes permiso para eliminar este comentario.', 403);

    await prisma.entityComment.delete({ where: { id: commentId } });
  }

  async function toggleReaction(commentId, userAuthId, emoji) {
    const userProfileId = await resolveProfileId(userAuthId);
    if (!userProfileId) throw new CommentsServiceError('Usuario no encontrado.', 400);

    const existing = await prisma.entityCommentReaction.findUnique({
      where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
    });

    if (existing) {
      await prisma.entityCommentReaction.delete({
        where: { commentId_userId_emoji: { commentId, userId: userProfileId, emoji } },
      });
      return { action: 'removed' };
    }

    await prisma.entityCommentReaction.create({ data: { commentId, userId: userProfileId, emoji } });
    return { action: 'added' };
  }

  return { listComments, createComment, updateComment, deleteComment, toggleReaction };
}
```

- [ ] **Step 2: Syntax check**

Run:
```
node --check apps/api/src/services/comments-service.js
```

Expected: no output (clean).

- [ ] **Step 3: Commit**

```
git add apps/api/src/services/comments-service.js
git commit -m "feat(comments): add generic createCommentsService"
```

---

### Task 3: Migrate existing comment data to generic tables

**Files:**
- Create: `prisma/scripts/migrate-comments.js` (deleted after use)

- [ ] **Step 1: Create migration script**

```js
// prisma/scripts/migrate-comments.js
// One-time data migration: copies inv_comment, task_comment, growth_lead_comment
// (and their mentions/reactions) into entity_comment, entity_comment_mention, entity_comment_reaction.
// Safe to re-run: skips rows already migrated (checks id existence).

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  console.log('Starting comment migration...');

  // ── Inventory comments → EntityComment with entityType = 'InvItem' ────────
  const invComments = await prisma.invComment.findMany({
    include: {
      item: { select: { companyId: true } },
      mentions: true,
      reactions: true,
    },
  });
  console.log(`Found ${invComments.length} inv_comment rows`);

  for (const c of invComments) {
    const existing = await prisma.entityComment.findFirst({ where: { id: c.id } });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      await tx.entityComment.create({
        data: {
          id: c.id,
          companyId: c.item.companyId,
          entityType: 'InvItem',
          entityId: c.itemId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt,
          editedAt: c.editedAt,
        },
      });
      for (const m of c.mentions) {
        await tx.entityCommentMention.upsert({
          where: { commentId_userId: { commentId: c.id, userId: m.userId } },
          create: { id: m.id, commentId: c.id, userId: m.userId, createdAt: m.createdAt },
          update: {},
        });
      }
      for (const r of c.reactions) {
        await tx.entityCommentReaction.upsert({
          where: { commentId_userId_emoji: { commentId: c.id, userId: r.userId, emoji: r.emoji } },
          create: { id: r.id, commentId: c.id, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt },
          update: {},
        });
      }
    });
  }
  console.log('Inventory comments migrated.');

  // ── Task comments → EntityComment with entityType = 'Task' ───────────────
  const taskComments = await prisma.taskComment.findMany({
    include: {
      task: { include: { project: { select: { companyId: true } } } },
      mentions: true,
      reactions: true,
    },
  });
  console.log(`Found ${taskComments.length} task_comment rows`);

  for (const c of taskComments) {
    const existing = await prisma.entityComment.findFirst({ where: { id: c.id } });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      await tx.entityComment.create({
        data: {
          id: c.id,
          companyId: c.task.project.companyId,
          entityType: 'Task',
          entityId: c.taskId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt,
          editedAt: c.editedAt,
        },
      });
      for (const m of c.mentions) {
        await tx.entityCommentMention.upsert({
          where: { commentId_userId: { commentId: c.id, userId: m.userId } },
          create: { id: m.id, commentId: c.id, userId: m.userId, createdAt: m.createdAt },
          update: {},
        });
      }
      for (const r of c.reactions) {
        await tx.entityCommentReaction.upsert({
          where: { commentId_userId_emoji: { commentId: c.id, userId: r.userId, emoji: r.emoji } },
          create: { id: r.id, commentId: c.id, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt },
          update: {},
        });
      }
    });
  }
  console.log('Task comments migrated.');

  // ── Growth lead comments → EntityComment with entityType = 'GrowthLead' ──
  const growthComments = await prisma.growthLeadComment.findMany({
    include: {
      lead: { select: { companyId: true } },
      mentions: true,
      reactions: true,
    },
  });
  console.log(`Found ${growthComments.length} growth_lead_comment rows`);

  for (const c of growthComments) {
    const existing = await prisma.entityComment.findFirst({ where: { id: c.id } });
    if (existing) continue;
    await prisma.$transaction(async (tx) => {
      await tx.entityComment.create({
        data: {
          id: c.id,
          companyId: c.lead.companyId,
          entityType: 'GrowthLead',
          entityId: c.leadId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt,
          editedAt: c.editedAt,
        },
      });
      for (const m of c.mentions) {
        await tx.entityCommentMention.upsert({
          where: { commentId_userId: { commentId: c.id, userId: m.userId } },
          create: { id: m.id, commentId: c.id, userId: m.userId, createdAt: m.createdAt },
          update: {},
        });
      }
      for (const r of c.reactions) {
        await tx.entityCommentReaction.upsert({
          where: { commentId_userId_emoji: { commentId: c.id, userId: r.userId, emoji: r.emoji } },
          create: { id: r.id, commentId: c.id, userId: r.userId, emoji: r.emoji, createdAt: r.createdAt },
          update: {},
        });
      }
    });
  }
  console.log('Growth lead comments migrated.');

  const total = await prisma.entityComment.count();
  console.log(`Migration complete. Total entity_comment rows: ${total}`);
  await prisma.$disconnect();
}

migrate().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
```

- [ ] **Step 2: Run migration**

```
node prisma/scripts/migrate-comments.js
```

Expected output:
```
Starting comment migration...
Found N inv_comment rows
Inventory comments migrated.
Found N task_comment rows
Task comments migrated.
Found N growth_lead_comment rows
Growth lead comments migrated.
Migration complete. Total entity_comment rows: N
```

- [ ] **Step 3: Delete migration script**

```
del prisma\scripts\migrate-comments.js
```

(Or `rm prisma/scripts/migrate-comments.js` in bash)

- [ ] **Step 4: Commit**

```
git commit -m "feat(comments): migrate existing comment data to generic entity_comment tables"
```

---

### Task 4: Update inventory comment routes to use generic service

**Files:**
- Modify: `apps/api/src/index.js` (lines ~4681–4755, the 5 inventory comment routes)

The inventory comment routes currently call `inventoryService.listComments`, `inventoryService.createComment`, etc. Replace them to call the generic `commentsService` instead.

- [ ] **Step 1: Import CommentsService at the top of index.js**

Find the import block where services are imported (near the top of `apps/api/src/index.js`). Add:

```js
import { createCommentsService, CommentsServiceError } from './services/comments-service.js';
```

- [ ] **Step 2: Instantiate the service**

Find where `inventoryService` is instantiated (search for `createInventoryService`). After it, add:

```js
const commentsService = createCommentsService({ prisma });
```

- [ ] **Step 3: Replace the 5 inventory comment route handlers**

Find the block starting with `// Comments` around line 4680. Replace the entire block (5 routes) with:

```js
// Comments (generic)
app.get('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.read'), async (c) => {
  try {
    const comments = await commentsService.listComments('InvItem', c.req.param('id'));
    return c.json({ data: comments });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudieron cargar los comentarios.' }, 500);
  }
});

app.post('/inventory/items/:id/comments', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    const { body }   = await c.req.json();
    const result     = await commentsService.createComment('InvItem', c.req.param('id'), authUserId, body, companyId);
    return c.json({ data: result }, 201);
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo crear el comentario.' }, 500);
  }
});

app.patch('/inventory/items/:id/comments/:cid', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const authUserId = c.get('authUserId');
    const { body }   = await c.req.json();
    const comment    = await commentsService.updateComment(c.req.param('cid'), authUserId, body);
    return c.json({ data: comment });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar el comentario.' }, 500);
  }
});

app.delete('/inventory/items/:id/comments/:cid', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const companyId  = c.get('companyId');
    const authUserId = c.get('authUserId');
    await commentsService.deleteComment(c.req.param('cid'), authUserId, companyId);
    return c.json({ success: true });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo eliminar el comentario.' }, 500);
  }
});

app.post('/inventory/items/:id/comments/:cid/reactions', authMiddleware, requirePermission('inventory.item.update'), async (c) => {
  try {
    const authUserId = c.get('authUserId');
    const { emoji }  = await c.req.json();
    const result     = await commentsService.toggleReaction(c.req.param('cid'), authUserId, emoji);
    return c.json({ data: result });
  } catch (err) {
    if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
    return c.json({ error: 'No se pudo actualizar la reaccion.' }, 500);
  }
});
```

- [ ] **Step 4: Verify syntax**

```
node --check apps/api/src/index.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```
git add apps/api/src/index.js
git commit -m "feat(comments): inventory comment routes now use generic commentsService"
```

---

### Task 5: Update projects task comment routes to use generic service

**Files:**
- Modify: `apps/api/src/routes/projects/projects-routes.js` (lines 326–400, the 5 task comment routes)

The projects routes use `getUserId(c)` (returns UserProfile ID). The generic service expects `authUserId`. We'll use `c.get('authUserId')` instead.

- [ ] **Step 1: Import CommentsService in projects-routes.js**

Find the import block at the top of `apps/api/src/routes/projects/projects-routes.js`. Add:

```js
import { createCommentsService, CommentsServiceError } from '../../services/comments-service.js';
```

- [ ] **Step 2: Instantiate commentsService inside createProjectsRouter**

Find `export function createProjectsRouter({ prisma, requirePermission, notificationService })`. Inside this function, after the existing service instantiations, add:

```js
const commentsSvc = createCommentsService({ prisma });
```

- [ ] **Step 3: Replace the 5 task comment route handlers**

Find `// --- Task Comments ---` (around line 326). Replace the entire block:

```js
// --- Task Comments ---
app.get('/projects/:id/tasks/:tid/comments', requirePermission('projects.task.read'), async (c) => {
  try {
    const comments = await commentsSvc.listComments('Task', c.req.param('tid'));
    return c.json(comments);
  } catch (err) { return handleError(c, err, 'Error al listar comentarios.') }
});

app.post('/projects/:id/tasks/:tid/comments', requirePermission('projects.task.update'), async (c) => {
  try {
    const companyId  = getCompanyId(c);
    const authUserId = c.get('authUserId');
    const { body }   = await c.req.json();
    const { comment, mentionIds } = await commentsSvc.createComment('Task', c.req.param('tid'), authUserId, body, companyId);

    // Validate mentions are project members before notifying
    if (mentionIds.length > 0) {
      const members = await prisma.projectMember.findMany({
        where: { projectId: c.req.param('id'), userId: { in: mentionIds } },
        select: { userId: true },
      });
      const validatedMentionIds = members.map((m) => m.userId);
      if (validatedMentionIds.length > 0) {
        notifSvc.notifyTaskComment({
          companyId,
          actorId: getUserId(c),
          taskId: c.req.param('tid'),
          mentionedUserIds: validatedMentionIds,
        });
      }
    }
    return c.json(comment, 201);
  } catch (err) { return handleError(c, err, 'Error al crear comentario.') }
});

app.patch('/projects/:id/tasks/:tid/comments/:cid', requirePermission('projects.task.update'), async (c) => {
  try {
    const { body } = await c.req.json();
    const comment  = await commentsSvc.updateComment(c.req.param('cid'), c.get('authUserId'), body);
    return c.json(comment);
  } catch (err) { return handleError(c, err, 'Error al editar comentario.') }
});

app.delete('/projects/:id/tasks/:tid/comments/:cid', requirePermission('projects.task.update'), async (c) => {
  try {
    await commentsSvc.deleteComment(c.req.param('cid'), c.get('authUserId'), getCompanyId(c));
    return c.json({ ok: true });
  } catch (err) { return handleError(c, err, 'Error al eliminar comentario.') }
});

app.post('/projects/:id/tasks/:tid/comments/:cid/reactions', requirePermission('projects.task.update'), async (c) => {
  try {
    const { emoji } = await c.req.json();
    const commentId = c.req.param('cid');
    const result    = await commentsSvc.toggleReaction(commentId, c.get('authUserId'), emoji);
    if (result.action === 'added') {
      notifSvc.notifyTaskReaction({ companyId: getCompanyId(c), actorId: getUserId(c), commentId });
    }
    return c.json(result);
  } catch (err) { return handleError(c, err, 'Error al actualizar reaccion.') }
});
```

- [ ] **Step 4: Verify syntax**

```
node --check apps/api/src/routes/projects/projects-routes.js
```

Expected: no output.

- [ ] **Step 5: Commit**

```
git add apps/api/src/routes/projects/projects-routes.js
git commit -m "feat(comments): projects task comment routes now use generic commentsService"
```

---

### Task 6: Update growth comment routes, remove old models and tables

**Files:**
- Modify: `apps/api/src/routes/growth/growth-comment-routes.js`
- Modify: `apps/api/src/routes/growth/growth-router.js`
- Delete: `apps/api/src/routes/growth/growth-comments-service.js`
- Modify: `prisma/schema.prisma` — remove 9 old models + 9 old UserProfile back-relations

- [ ] **Step 1: Rewrite growth-comment-routes.js to use generic service**

Replace the entire content of `apps/api/src/routes/growth/growth-comment-routes.js`:

```js
import { Hono } from 'hono';
import { CommentsServiceError } from '../../services/comments-service.js';

function handleError(c, err) {
  if (err instanceof CommentsServiceError) return c.json({ error: err.message }, err.status);
  console.error('[atlas.growth] comments error', err);
  return c.json({ error: 'Error interno al procesar el comentario.' }, 500);
}

export function createGrowthCommentRoutes({ service, requirePermission }) {
  const app = new Hono();

  app.get('/growth/leads/:id/comments', requirePermission('growth.leads.read'), async (c) => {
    try {
      const comments = await service.listComments('GrowthLead', c.req.param('id'));
      return c.json({ data: comments });
    } catch (err) { return handleError(c, err); }
  });

  app.post('/growth/leads/:id/comments', requirePermission('growth.leads.update'), async (c) => {
    try {
      const companyId  = c.get('companyId');
      const authUserId = c.get('authUserId');
      const { body }   = await c.req.json();
      const result     = await service.createComment('GrowthLead', c.req.param('id'), authUserId, body, companyId);
      return c.json({ data: result }, 201);
    } catch (err) { return handleError(c, err); }
  });

  app.patch('/growth/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const authUserId = c.get('authUserId');
      const { body }   = await c.req.json();
      const comment    = await service.updateComment(c.req.param('cid'), authUserId, body);
      return c.json({ data: comment });
    } catch (err) { return handleError(c, err); }
  });

  app.delete('/growth/leads/:id/comments/:cid', requirePermission('growth.leads.update'), async (c) => {
    try {
      const companyId  = c.get('companyId');
      const authUserId = c.get('authUserId');
      await service.deleteComment(c.req.param('cid'), authUserId, companyId);
      return c.json({ success: true });
    } catch (err) { return handleError(c, err); }
  });

  app.post('/growth/leads/:id/comments/:cid/reactions', requirePermission('growth.leads.update'), async (c) => {
    try {
      const authUserId = c.get('authUserId');
      const { emoji }  = await c.req.json();
      const result     = await service.toggleReaction(c.req.param('cid'), authUserId, emoji);
      return c.json({ data: result });
    } catch (err) { return handleError(c, err); }
  });

  return app;
}
```

- [ ] **Step 2: Update growth-router.js to import generic service**

Replace the current import of `createGrowthCommentsService` with the generic service:

```js
import { Hono } from "hono";

import { createNotificationService } from "../../services/notification-service.js";
import { createCommentsService } from "../../services/comments-service.js";
import { createGrowthAnalyticsRoutes } from "./growth-analytics-routes.js";
import { createGrowthAnalyticsService } from "./growth-analytics-service.js";
import { createGrowthCommentRoutes } from "./growth-comment-routes.js";
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
  const commentsService = createCommentsService({ prisma });
  app.route("", createGrowthLeadRoutes({ service, requirePermission }));
  app.route("", createGrowthCommentRoutes({ service: commentsService, requirePermission }));
  app.route("", createGrowthAnalyticsRoutes({ service: analyticsService, prisma, requirePermission }));
  return app;
}
```

- [ ] **Step 3: Delete the old growth-specific comments service**

```
del apps\api\src\routes\growth\growth-comments-service.js
```

- [ ] **Step 4: Remove old Prisma models**

In `prisma/schema.prisma`, delete the following 9 model blocks entirely:
- `model GrowthLeadComment { ... }` (the full block including @@map)
- `model GrowthLeadMention { ... }`
- `model GrowthLeadCommentReaction { ... }`
- `model InvComment { ... }`
- `model InvMention { ... }`
- `model InvCommentReaction { ... }`
- `model TaskComment { ... }`
- `model TaskMention { ... }`
- `model TaskCommentReaction { ... }`

Also remove the back-relation fields from `UserProfile`:
- Remove: `invComments     InvComment[]         @relation("UserInvComments")`
- Remove: `invMentions     InvMention[]         @relation("UserInvMentions")`
- Remove: `invReactions    InvCommentReaction[] @relation("UserInvReactions")`
- Remove: `growthComments  GrowthLeadComment[]         @relation("UserGrowthComments")`
- Remove: `growthMentions  GrowthLeadMention[]         @relation("UserGrowthMentions")`
- Remove: `growthReactions GrowthLeadCommentReaction[] @relation("UserGrowthReactions")`
- Remove: `taskComments         TaskComment[]         @relation("TaskCommentAuthor")`
- Remove: `taskMentions         TaskMention[]         @relation("TaskMentionUser")`
- Remove: `taskCommentReactions TaskCommentReaction[] @relation("UserTaskReactions")`

Also remove the back-relation fields from the `Task` model (look for `comments TaskComment[]`):
- Remove: `comments TaskComment[] @relation("TaskComments")`

And from `InvItem` model (look for `comments InvComment[]`):
- Remove: `comments InvComment[]`

And from `GrowthLead` model:
- Remove: `comments GrowthLeadComment[]`

- [ ] **Step 5: Validate schema**

```
pnpm prisma validate
```

Expected: `The schema at prisma\schema.prisma is valid 🚀`

- [ ] **Step 6: Push schema to drop old tables**

```
pnpm prisma db push --accept-data-loss
```

Expected output includes dropping the 9 old tables. Ends with: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 7: Regenerate Prisma client**

```
pnpm db:generate
```

- [ ] **Step 8: Syntax check all modified files**

```
node --check apps/api/src/routes/growth/growth-comment-routes.js && node --check apps/api/src/routes/growth/growth-router.js && echo OK
```

- [ ] **Step 9: Commit everything**

```
git add prisma/schema.prisma apps/api/src/routes/growth/growth-comment-routes.js apps/api/src/routes/growth/growth-router.js apps/api/src/routes/projects/projects-routes.js
git commit -m "refactor(comments): consolidate to 3 generic tables, remove 9 module-specific comment tables"
```
