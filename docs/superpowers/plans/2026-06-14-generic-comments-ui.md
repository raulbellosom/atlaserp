# Generic Comments System — Plan B (Frontend/Hooks)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ~150-line per-module hook files with a `createCommentHooks` factory so any new module needs only ~25 lines of glue code to wire up comments.

**Architecture:** A factory function `createCommentHooks({ queryKey, sdk, useAuth })` lives in `apps/desktop/src/lib/createCommentHooks.js`. It accepts a `queryKey` generator function, an `sdk` object with 5 methods (list/create/update/del/toggleReaction), and the `useAuth` hook. It returns 5 ready-to-use TanStack Query hooks with optimistic updates. Existing files (`useInventoryComments.js`, `useGrowthLeadComments.js`) are rewritten to thin wrappers (~25 lines each). Projects comments are NOT migrated — they embed comments inside the task object via a different query key pattern.

**Prerequisite:** Plan A must be complete (generic DB + service in place).

**Tech Stack:** TanStack Query v5, React, sonner (toast).

---

## File Map

| Action | Path |
|---|---|
| Create | `apps/desktop/src/lib/createCommentHooks.js` — factory |
| Rewrite | `apps/desktop/src/modules/atlas.inventory/hooks/useInventoryComments.js` — thin wrapper |
| Rewrite | `apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js` — thin wrapper |

---

### Task 1: Create the hook factory

**Files:**
- Create: `apps/desktop/src/lib/createCommentHooks.js`

- [ ] **Step 1: Create the factory file**

```js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

/**
 * Factory that returns 5 TanStack Query hooks for entity comments.
 *
 * @param {Function} queryKey    - (entityId: string) => string[] — cache key prefix
 * @param {Object}   sdk         - { list, create, update, del, toggleReaction }
 *   list(entityId, token)                        → Promise
 *   create(entityId, body, token)                → Promise
 *   update(entityId, commentId, body, token)     → Promise
 *   del(entityId, commentId, token)              → Promise
 *   toggleReaction(entityId, commentId, emoji, token) → Promise
 * @param {Function} useAuth     - the useAuth hook from AuthProvider (injected to keep factory portable)
 */
export function createCommentHooks({ queryKey, sdk, useAuth }) {
  function commentsKey(entityId) {
    return [...queryKey(entityId), 'comments']
  }

  function useComments(entityId) {
    const { session } = useAuth()
    return useQuery({
      queryKey: commentsKey(entityId),
      queryFn: () => sdk.list(entityId, session?.access_token),
      enabled: Boolean(session?.access_token) && Boolean(entityId),
      staleTime: 3 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
    })
  }

  function useCreateComment(entityId) {
    const { session, userProfile } = useAuth()
    const qc = useQueryClient()
    const key = commentsKey(entityId)
    return useMutation({
      mutationFn: ({ body }) => sdk.create(entityId, body, session?.access_token),
      onMutate: async ({ body }) => {
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData(key)
        const tempComment = {
          id: `_temp_${Date.now()}`,
          body,
          authorId: userProfile?.id,
          author: userProfile,
          createdAt: new Date().toISOString(),
          editedAt: null,
          reactions: [],
          _pending: true,
        }
        qc.setQueryData(key, (old) => {
          if (!old) return [tempComment]
          const list = old?.data ?? old
          if (!Array.isArray(list)) return old
          const updated = [...list, tempComment]
          return old?.data ? { ...old, data: updated } : updated
        })
        return { prev }
      },
      onError: (err, _, ctx) => {
        if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
        toast.error(err?.message ?? 'Error al publicar el comentario')
      },
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    })
  }

  function useUpdateComment(entityId) {
    const { session } = useAuth()
    const qc = useQueryClient()
    const key = commentsKey(entityId)
    return useMutation({
      mutationFn: ({ commentId, body }) => sdk.update(entityId, commentId, body, session?.access_token),
      onMutate: async ({ commentId, body }) => {
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData(key)
        qc.setQueryData(key, (old) => {
          if (!old) return old
          const list = old?.data ?? old
          if (!Array.isArray(list)) return old
          const updated = list.map(c =>
            c.id === commentId ? { ...c, body, editedAt: new Date().toISOString() } : c
          )
          return old?.data ? { ...old, data: updated } : updated
        })
        return { prev }
      },
      onError: (err, _, ctx) => {
        if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
        toast.error(err?.message ?? 'Error al editar el comentario')
      },
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    })
  }

  function useDeleteComment(entityId) {
    const { session } = useAuth()
    const qc = useQueryClient()
    const key = commentsKey(entityId)
    return useMutation({
      mutationFn: (commentId) => sdk.del(entityId, commentId, session?.access_token),
      onMutate: async (commentId) => {
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData(key)
        qc.setQueryData(key, (old) => {
          if (!old) return old
          const list = old?.data ?? old
          if (!Array.isArray(list)) return old
          const updated = list.filter(c => c.id !== commentId)
          return old?.data ? { ...old, data: updated } : updated
        })
        return { prev }
      },
      onError: (err, _, ctx) => {
        if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
        toast.error(err?.message ?? 'Error al eliminar el comentario')
      },
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    })
  }

  function useToggleReaction(entityId) {
    const { session, userProfile } = useAuth()
    const qc = useQueryClient()
    const key = commentsKey(entityId)
    return useMutation({
      mutationFn: ({ commentId, emoji }) => sdk.toggleReaction(entityId, commentId, emoji, session?.access_token),
      onMutate: async ({ commentId, emoji }) => {
        await qc.cancelQueries({ queryKey: key })
        const prev = qc.getQueryData(key)
        qc.setQueryData(key, old => {
          if (!old) return old
          const list = old?.data ?? old
          if (!Array.isArray(list)) return old
          const updated = list.map(c => {
            if (c.id !== commentId) return c
            const mine = c.reactions?.some(r => r.userId === userProfile?.id && r.emoji === emoji)
            const reactions = mine
              ? c.reactions.filter(r => !(r.userId === userProfile?.id && r.emoji === emoji))
              : [...(c.reactions ?? []), { id: '_opt', commentId, userId: userProfile?.id, emoji, user: userProfile ?? null }]
            return { ...c, reactions }
          })
          return old?.data ? { ...old, data: updated } : updated
        })
        return { prev }
      },
      onError: (_err, _vars, ctx) => {
        if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
        toast.error('No se pudo actualizar la reaccion')
      },
      onSettled: () => qc.invalidateQueries({ queryKey: key }),
    })
  }

  return { useComments, useCreateComment, useUpdateComment, useDeleteComment, useToggleReaction }
}
```

- [ ] **Step 2: Commit**

```
git add apps/desktop/src/lib/createCommentHooks.js
git commit -m "feat(comments): add createCommentHooks factory"
```

---

### Task 2: Rewrite useInventoryComments.js as thin wrapper

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.inventory/hooks/useInventoryComments.js`

- [ ] **Step 1: Replace the entire file**

```js
import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

const {
  useComments: useInventoryComments,
  useCreateComment: useCreateInventoryComment,
  useUpdateComment: useUpdateInventoryComment,
  useDeleteComment: useDeleteInventoryComment,
  useToggleReaction: useToggleInventoryReaction,
} = createCommentHooks({
  queryKey: (itemId) => ['inventory', 'items', itemId],
  sdk: {
    list:           (itemId, token) => atlas.inventory.listComments(itemId, token),
    create:         (itemId, body, token) => atlas.inventory.createComment(itemId, { body }, token),
    update:         (itemId, commentId, body, token) => atlas.inventory.updateComment(itemId, commentId, { body }, token),
    del:            (itemId, commentId, token) => atlas.inventory.deleteComment(itemId, commentId, token),
    toggleReaction: (itemId, commentId, emoji, token) => atlas.inventory.toggleReaction(itemId, commentId, { emoji }, token),
  },
  useAuth,
})

export {
  useInventoryComments,
  useCreateInventoryComment,
  useUpdateInventoryComment,
  useDeleteInventoryComment,
  useToggleInventoryReaction,
}
```

The exports are identical to the old file, so `InventoryCommentThread.jsx` needs no changes.

- [ ] **Step 2: Commit**

```
git add apps/desktop/src/modules/atlas.inventory/hooks/useInventoryComments.js
git commit -m "refactor(inventory): useInventoryComments now uses createCommentHooks factory"
```

---

### Task 3: Rewrite useGrowthLeadComments.js as thin wrapper

**Files:**
- Rewrite: `apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js`

- [ ] **Step 1: Replace the entire file**

```js
import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

const {
  useComments: useGrowthLeadComments,
  useCreateComment: useCreateGrowthLeadComment,
  useUpdateComment: useUpdateGrowthLeadComment,
  useDeleteComment: useDeleteGrowthLeadComment,
  useToggleReaction: useToggleGrowthLeadCommentReaction,
} = createCommentHooks({
  queryKey: (leadId) => ['growth', 'leads', leadId],
  sdk: {
    list:           (leadId, token) => atlas.growth.listLeadComments(leadId, token),
    create:         (leadId, body, token) => atlas.growth.createLeadComment(leadId, body, token),
    update:         (leadId, commentId, body, token) => atlas.growth.updateLeadComment(leadId, commentId, body, token),
    del:            (leadId, commentId, token) => atlas.growth.deleteLeadComment(leadId, commentId, token),
    toggleReaction: (leadId, commentId, emoji, token) => atlas.growth.toggleLeadCommentReaction(leadId, commentId, emoji, token),
  },
  useAuth,
})

export {
  useGrowthLeadComments,
  useCreateGrowthLeadComment,
  useUpdateGrowthLeadComment,
  useDeleteGrowthLeadComment,
  useToggleGrowthLeadCommentReaction,
}
```

The exports match what `GrowthLeadDetailScreen.jsx` and `InventoryCommentThread.jsx` already import — no changes needed in those screens.

- [ ] **Step 2: Commit**

```
git add apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js
git commit -m "refactor(growth): useGrowthLeadComments now uses createCommentHooks factory"
```

---

## Adding comments to a new module (template)

Once Plan A + B are complete, wiring up comments for any new module takes 4 files and ~30 lines of glue:

**1. API service** — already handled by generic `commentsService` (no new file needed)

**2. API route** — add 5 routes to the module router (copy the growth-comment-routes.js pattern, change entityType string and permission keys):
```js
// modules/custom/my.module/api/index.js (or dedicated routes file)
app.get('/my-entities/:id/comments', requirePermission('my.entity.read'), async (c) => {
  const comments = await commentsService.listComments('MyEntity', c.req.param('id'))
  return c.json({ data: comments })
})
// ... 4 more routes
```

**3. SDK methods** — add 5 methods to the module's SDK domain (copy the growth.js pattern)

**4. Hooks** — create `useMyEntityComments.js` (25 lines using `createCommentHooks` factory):
```js
import { createCommentHooks } from '../../../lib/createCommentHooks'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

const { useComments, useCreateComment, useUpdateComment, useDeleteComment, useToggleReaction } =
  createCommentHooks({
    queryKey: (entityId) => ['my-module', 'entities', entityId],
    sdk: {
      list:           (id, token) => atlas.myModule.listEntityComments(id, token),
      create:         (id, body, token) => atlas.myModule.createEntityComment(id, body, token),
      update:         (id, cid, body, token) => atlas.myModule.updateEntityComment(id, cid, body, token),
      del:            (id, cid, token) => atlas.myModule.deleteEntityComment(id, cid, token),
      toggleReaction: (id, cid, emoji, token) => atlas.myModule.toggleEntityCommentReaction(id, cid, emoji, token),
    },
    useAuth,
  })

export { useComments as useMyEntityComments, ... }
```

**5. UI** — render `<CommentThread />` from `@atlas/ui` with callbacks bound to the 5 hooks.
