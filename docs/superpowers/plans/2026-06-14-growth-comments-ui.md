# Growth Lead Comments — Plan B: UI (Shared CommentThread)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `MentionTextarea` to `@atlas/ui`, build a generic `CommentThread` component, update inventory to use it, add `useGrowthLeadComments` hooks, and wire the `CommentThread` into the growth lead detail screen.

**Architecture:** `MentionTextarea` + `CommentThread` live in `packages/ui/src/components/`. Module-specific TanStack Query hooks (`useGrowthLeadComments.js`) live alongside the module. `InventoryCommentThread` becomes a thin adapter over the shared component. `GrowthLeadDetailScreen` gets a new "Comentarios" card.

**Tech Stack:** React, TanStack Query, `@atlas/ui`, `emoji-picker-react`

**Prerequisite:** Plan A (API) must be merged and running before Plan B can be smoke-tested end-to-end.

---

## File Map

| Action | Path |
|--------|------|
| Create | `packages/ui/src/components/MentionTextarea.jsx` — moved from atlas.projects |
| Modify | `packages/ui/src/index.js` — export MentionTextarea, renderMentionText, parseMentionIds, CommentThread |
| Modify | `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx` — re-export from @atlas/ui |
| Create | `packages/ui/src/components/CommentThread.jsx` — generic comment thread UI |
| Modify | `apps/desktop/src/modules/atlas.inventory/components/InventoryCommentThread.jsx` — use shared CommentThread |
| Create | `apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js` — TanStack Query hooks |
| Modify | `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx` — add CommentThread card |

---

## Task 1 — Move MentionTextarea to @atlas/ui

**Files:**
- Create: `packages/ui/src/components/MentionTextarea.jsx`
- Modify: `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx`

- [ ] **Step 1: Copy the full content of MentionTextarea to packages/ui**

Create `packages/ui/src/components/MentionTextarea.jsx` with the EXACT same content as the current `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx`. The component is self-contained (pure React, no module-specific imports).

The file exports:
- `default MentionTextarea` — the textarea component
- `renderMentionText(text)` — renders stored `@[uuid:Name]` tokens as React spans
- `parseMentionIds(text)` — extracts UUIDs from stored mention tokens

Verify the file is identical to the source before making changes to the original.

- [ ] **Step 2: Turn the original MentionTextarea into a re-export shim**

Replace the entire content of `apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx` with:

```javascript
// Moved to @atlas/ui — keep this shim so existing project imports don't break
export { default, renderMentionText, parseMentionIds } from '@atlas/ui'
```

- [ ] **Step 3: Export from @atlas/ui index**

In `packages/ui/src/index.js`, add these exports (find any existing export block and add near it):

```javascript
export { default as MentionTextarea, renderMentionText, parseMentionIds } from './components/MentionTextarea.jsx'
```

- [ ] **Step 4: Verify the app still compiles**

```bash
cd d:/RacoonDevs/atlaserp-v2 && node --check packages/ui/src/components/MentionTextarea.jsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/MentionTextarea.jsx packages/ui/src/index.js apps/desktop/src/modules/atlas.projects/components/MentionTextarea.jsx
git commit -m "refactor(ui): move MentionTextarea to @atlas/ui, shim original location"
```

---

## Task 2 — Create generic CommentThread component

**Files:**
- Create: `packages/ui/src/components/CommentThread.jsx`

The component receives all data and callbacks as props. It owns internal UI state only (edit draft, delete confirm, emoji picker).

- [ ] **Step 1: Create `packages/ui/src/components/CommentThread.jsx`**

```jsx
import { useState, useRef, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import EmojiPickerLib from 'emoji-picker-react'
import { Pencil, Trash2, SmilePlus } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from './Avatar.jsx'
import { Button } from './Button.jsx'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip.jsx'
import MentionTextarea, { renderMentionText } from './MentionTextarea.jsx'

const PICKER_H = 420
const PICKER_W = 300

function formatTime(str) {
  if (!str) return ''
  const d = new Date(str)
  const diffMin = Math.floor((Date.now() - d) / 60000)
  if (diffMin < 1) return 'ahora'
  if (diffMin < 60) return `hace ${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `hace ${diffH}h`
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

function displayName(person) {
  if (!person) return '—'
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.displayName || '—'
}

function groupReactions(reactions = [], currentUserId = null) {
  const map = new Map()
  for (const r of reactions) {
    if (!map.has(r.emoji)) map.set(r.emoji, { emoji: r.emoji, count: 0, users: [], isMine: false })
    const entry = map.get(r.emoji)
    entry.count++
    entry.users.push(displayName(r.user) || r.userId || '?')
    if (currentUserId && r.userId === currentUserId) entry.isMine = true
  }
  return [...map.values()]
}

function EmojiPicker({ onSelect }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0, width: PICKER_W })
  const buttonRef = useRef(null)
  const pickerRef = useRef(null)

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight
      const w = Math.min(PICKER_W, vw - 16)
      const spaceAbove = rect.top - 8
      const top = spaceAbove >= PICKER_H
        ? rect.top - PICKER_H - 6
        : Math.min(rect.bottom + 6, vh - PICKER_H - 8)
      let left = rect.left
      if (left + w > vw - 8) left = vw - w - 8
      if (left < 8) left = 8
      setPos({ top, left, width: w })
    }
    setOpen(o => !o)
  }

  useEffect(() => {
    if (!open) return
    function handleOutside(e) {
      const inButton = buttonRef.current?.contains(e.target)
      const inPicker = pickerRef.current?.contains(e.target)
      if (!inButton && !inPicker) setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('touchstart', handleOutside, { passive: true })
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('touchstart', handleOutside)
    }
  }, [open])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        className="inline-flex items-center gap-1 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] px-1.5 py-0.5 text-xs text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))] transition-colors"
      >
        <SmilePlus className="h-3 w-3" />
      </button>
      {open && createPortal(
        <div
          ref={pickerRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="shadow-2xl rounded-xl overflow-hidden"
        >
          <EmojiPickerLib
            onEmojiClick={(data) => { onSelect(data.emoji); setOpen(false) }}
            theme="dark"
            height={PICKER_H}
            width={pos.width}
            searchPlaceholder="Buscar emoji..."
            lazyLoadEmojis
          />
        </div>,
        document.body
      )}
    </>
  )
}

function CommentRow({ comment, currentUserId, members, onUpdate, onDelete, onToggleReaction }) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const isOwn = comment.authorId === currentUserId
  const reactions = useMemo(
    () => groupReactions(comment.reactions ?? [], currentUserId),
    [comment.reactions, currentUserId],
  )

  async function submitEdit() {
    if (!editBody.trim() || isUpdating) return
    setIsUpdating(true)
    await onUpdate(comment.id, editBody)
    setIsUpdating(false)
    setEditing(false)
  }

  return (
    <div className={`flex gap-2.5 group transition-opacity${comment._pending ? ' opacity-60' : ''}`}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={comment.author?.avatarUrl ?? ''} alt={displayName(comment.author)} />
        <AvatarFallback className="text-xs font-medium">
          {(displayName(comment.author) || '?')[0].toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold">{displayName(comment.author)}</span>
          {comment._pending ? (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">Enviando...</span>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatTime(comment.createdAt)}</span>
          )}
          {!comment._pending && comment.editedAt && (
            <span className="text-xs text-[hsl(var(--muted-foreground))] italic">(editado)</span>
          )}
        </div>

        {editing ? (
          <div className="mt-1 space-y-2">
            <MentionTextarea value={editBody} onChange={setEditBody} members={members} rows={2} />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={submitEdit} disabled={isUpdating}>
                {isUpdating ? 'Guardando...' : 'Guardar'}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 text-sm leading-relaxed">{renderMentionText(comment.body)}</p>
        )}

        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {reactions.map(r => (
            <Tooltip key={r.emoji}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onToggleReaction(comment.id, r.emoji)}
                  className={[
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                    r.isMine
                      ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]',
                  ].join(' ')}
                >
                  <span>{r.emoji}</span>
                  <span>{r.count}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">{r.users.join(', ')}</p>
              </TooltipContent>
            </Tooltip>
          ))}
          <EmojiPicker onSelect={emoji => onToggleReaction(comment.id, emoji)} />
        </div>
      </div>

      {isOwn && !editing && (
        <div className="flex items-start gap-1 shrink-0 opacity-30 md:opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => { setEditBody(comment.body ?? ''); setEditing(true) }}
            className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteOpen(true)}
            className="flex h-6 w-6 items-center justify-center rounded text-[hsl(var(--muted-foreground))] hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar comentario"
        description="Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => onDelete(comment.id)}
      />
    </div>
  )
}

/**
 * Generic comment thread with mention support and emoji reactions.
 *
 * Props:
 *   comments      — Comment[] from the server (optimistic ok if _pending flag is set)
 *   members       — { id, displayName, email?, firstName?, lastName?, avatarUrl? }[]
 *   currentUserId — string (profile id of the current user)
 *   loading       — boolean
 *   isSubmitting  — boolean (disables the composer submit button)
 *   onSubmit      — (body: string) => void
 *   onUpdate      — (commentId: string, body: string) => Promise<void>
 *   onDelete      — (commentId: string) => void
 *   onToggleReaction — (commentId: string, emoji: string) => void
 */
export function CommentThread({
  comments = [],
  members = [],
  currentUserId,
  loading = false,
  isSubmitting = false,
  onSubmit,
  onUpdate,
  onDelete,
  onToggleReaction,
}) {
  const [body, setBody] = useState('')

  function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed || isSubmitting) return
    setBody('')
    onSubmit(trimmed)
  }

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [comments],
  )

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Comentarios</h3>

      {loading && sorted.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando comentarios...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Sin comentarios. Sé el primero.</p>
      ) : (
        <div className="space-y-4">
          {sorted.map(c => (
            <CommentRow
              key={c.id}
              comment={c}
              currentUserId={currentUserId}
              members={members}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onToggleReaction={onToggleReaction}
            />
          ))}
        </div>
      )}

      <div className="space-y-2 pt-2 border-t border-[hsl(var(--border))]">
        <MentionTextarea
          value={body}
          onChange={setBody}
          members={members}
          placeholder="Escribe un comentario... usa @ para mencionar"
          rows={2}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={!body.trim() || isSubmitting}
          >
            {isSubmitting ? 'Publicando...' : 'Publicar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Export from @atlas/ui index**

In `packages/ui/src/index.js`, add:

```javascript
export { CommentThread } from './components/CommentThread.jsx'
```

- [ ] **Step 3: Syntax check**

```bash
node --check packages/ui/src/components/CommentThread.jsx
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/CommentThread.jsx packages/ui/src/index.js
git commit -m "feat(ui): add generic CommentThread component with MentionTextarea + emoji reactions"
```

---

## Task 3 — Update InventoryCommentThread to use shared CommentThread

**Files:**
- Modify: `apps/desktop/src/modules/atlas.inventory/components/InventoryCommentThread.jsx`

The existing `InventoryCommentThread` reimplements the full UI. Replace it with a thin adapter that uses the shared `CommentThread` from `@atlas/ui` and keeps the inventory-specific query hooks.

- [ ] **Step 1: Replace `InventoryCommentThread.jsx` with a thin adapter**

Read the existing file first, then replace its entire content with:

```jsx
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CommentThread } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'
import {
  useInventoryComments,
  useCreateInventoryComment,
  useUpdateInventoryComment,
  useDeleteInventoryComment,
  useToggleInventoryReaction,
} from '../hooks/useInventoryComments.js'

export function InventoryCommentThread({ itemId }) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const currentUserId = userProfile?.id

  const commentsQuery = useInventoryComments(itemId)
  const createComment = useCreateInventoryComment(itemId)
  const updateComment = useUpdateInventoryComment(itemId)
  const deleteComment = useDeleteInventoryComment(itemId)
  const toggleReaction = useToggleInventoryReaction(itemId)

  const membersQuery = useQuery({
    queryKey: ['identity', 'users'],
    queryFn: () => atlas.identity.listUsers(token),
    enabled: Boolean(token),
    staleTime: 10 * 60 * 1000,
  })

  const members = useMemo(() => {
    const raw = membersQuery.data?.data ?? membersQuery.data ?? []
    return raw.map(u => ({
      id: u.id,
      displayName: u.displayName || u.email || u.id,
      email: u.email || '',
      avatarUrl: u.avatarUrl || null,
    }))
  }, [membersQuery.data])

  const comments = useMemo(() => {
    const raw = commentsQuery.data?.data ?? commentsQuery.data ?? []
    return raw
  }, [commentsQuery.data])

  return (
    <Card className="p-4">
      <CommentThread
        comments={comments}
        members={members}
        currentUserId={currentUserId}
        loading={commentsQuery.isLoading}
        isSubmitting={createComment.isPending}
        onSubmit={(body) => createComment.mutate({ body })}
        onUpdate={(commentId, body) => updateComment.mutateAsync({ commentId, body })}
        onDelete={(commentId) => deleteComment.mutate(commentId)}
        onToggleReaction={(commentId, emoji) => toggleReaction.mutate({ commentId, emoji })}
      />
    </Card>
  )
}
```

- [ ] **Step 2: Verify no broken imports remain in the file**

```bash
node --check apps/desktop/src/modules/atlas.inventory/components/InventoryCommentThread.jsx
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.inventory/components/InventoryCommentThread.jsx
git commit -m "refactor(inventory): slim InventoryCommentThread to use shared CommentThread from @atlas/ui"
```

---

## Task 4 — Growth comment hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js`

- [ ] **Step 1: Create `useGrowthLeadComments.js`**

```javascript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

function useToken() {
  const { session } = useAuth()
  return session?.access_token
}

export function useGrowthLeadComments(leadId) {
  const token = useToken()
  return useQuery({
    queryKey: ['growth', 'leads', leadId, 'comments'],
    queryFn: () => atlas.growth.listLeadComments(leadId, token),
    enabled: Boolean(token) && Boolean(leadId),
    staleTime: 3 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}

export function useCreateGrowthLeadComment(leadId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const key = ['growth', 'leads', leadId, 'comments']

  return useMutation({
    mutationFn: (data) => atlas.growth.createLeadComment(leadId, data, token),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      const tempComment = {
        id: `_temp_${Date.now()}`,
        body: data.body,
        authorId: userProfile?.id,
        author: userProfile,
        createdAt: new Date().toISOString(),
        editedAt: null,
        reactions: [],
        _pending: true,
      }
      qc.setQueryData(key, (old) => {
        const list = old?.data ?? old ?? []
        const updated = [...(Array.isArray(list) ? list : []), tempComment]
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (err, _, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error(err?.message ?? 'Error al publicar el comentario')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useUpdateGrowthLeadComment(leadId) {
  const token = useToken()
  const qc = useQueryClient()
  const key = ['growth', 'leads', leadId, 'comments']

  return useMutation({
    mutationFn: ({ commentId, body }) =>
      atlas.growth.updateLeadComment(leadId, commentId, { body }, token),
    onMutate: async ({ commentId, body }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => {
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useDeleteGrowthLeadComment(leadId) {
  const token = useToken()
  const qc = useQueryClient()
  const key = ['growth', 'leads', leadId, 'comments']

  return useMutation({
    mutationFn: (commentId) =>
      atlas.growth.deleteLeadComment(leadId, commentId, token),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => {
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
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}

export function useToggleGrowthLeadCommentReaction(leadId) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const qc = useQueryClient()
  const key = ['growth', 'leads', leadId, 'comments']

  return useMutation({
    mutationFn: ({ commentId, emoji }) =>
      atlas.growth.toggleLeadCommentReaction(leadId, commentId, { emoji }, token),
    onMutate: async ({ commentId, emoji }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData(key)
      qc.setQueryData(key, (old) => {
        const list = old?.data ?? old
        if (!Array.isArray(list)) return old
        const updated = list.map(c => {
          if (c.id !== commentId) return c
          const mine = c.reactions?.some(r => r.userId === userProfile?.id && r.emoji === emoji)
          const reactions = mine
            ? c.reactions.filter(r => !(r.userId === userProfile?.id && r.emoji === emoji))
            : [...(c.reactions ?? []), {
                id: '_opt',
                commentId,
                userId: userProfile?.id,
                emoji,
                user: userProfile ?? null,
              }]
          return { ...c, reactions }
        })
        return old?.data ? { ...old, data: updated } : updated
      })
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) qc.setQueryData(key, ctx.prev)
      toast.error('No se pudo actualizar la reacción')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key })
    },
  })
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.growth/hooks/useGrowthLeadComments.js
git commit -m "feat(growth): add useGrowthLeadComments TanStack Query hooks"
```

---

## Task 5 — Wire CommentThread into GrowthLeadDetailScreen

**Files:**
- Modify: `apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx`

The `CommentThread` card goes in the left column, below the activity card and above the files card. The existing "Agregar nota" card stays in the right column (notes go to the activity feed; comments are for team discussion).

- [ ] **Step 1: Add imports at the top of GrowthLeadDetailScreen.jsx**

In the existing `@atlas/ui` import block, add `Card` (already imported) and `CommentThread`:

```javascript
import { CommentThread } from '@atlas/ui'
```

Add the growth comment hooks imports after the existing module imports:

```javascript
import {
  useGrowthLeadComments,
  useCreateGrowthLeadComment,
  useUpdateGrowthLeadComment,
  useDeleteGrowthLeadComment,
  useToggleGrowthLeadCommentReaction,
} from '../hooks/useGrowthLeadComments.js'
```

- [ ] **Step 2: Add hooks calls inside the component body**

After the existing `assigneesResponse` query (around line 116), add:

```javascript
  const commentsQuery = useGrowthLeadComments(leadId);
  const createComment = useCreateGrowthLeadComment(leadId);
  const updateComment = useUpdateGrowthLeadComment(leadId);
  const deleteComment = useDeleteGrowthLeadComment(leadId);
  const toggleReaction = useToggleGrowthLeadCommentReaction(leadId);
```

Also add a memoized `members` array for the mention picker (after the `assigneeOptions` computation in the render section):

```javascript
  const members = useMemo(
    () =>
      assignees.map((u) => ({
        id: u.id,
        displayName: u.displayName || u.email || u.id,
        email: u.email || '',
        avatarUrl: u.avatarUrl || null,
        firstName: u.firstName || null,
        lastName: u.lastName || null,
      })),
    [assignees],
  );
```

Note: `assignees` already contains team members. Using assignees as the mention source avoids a separate API call and keeps mentions scoped to team members who can be assigned to leads.

- [ ] **Step 3: Add the CommentThread card in the JSX**

In the left column (`<div className="space-y-6">`), after the closing `</Card>` of the Activity section and before the AttachmentsPanel Card, add:

```jsx
          {canRead ? (
            <Card className="space-y-4 p-5">
              <CommentThread
                comments={commentsQuery.data?.data ?? commentsQuery.data ?? []}
                members={members}
                currentUserId={userProfile?.id}
                loading={commentsQuery.isLoading}
                isSubmitting={createComment.isPending}
                onSubmit={(body) => createComment.mutate({ body })}
                onUpdate={(commentId, body) => updateComment.mutateAsync({ commentId, body })}
                onDelete={(commentId) => deleteComment.mutate(commentId)}
                onToggleReaction={(commentId, emoji) => toggleReaction.mutate({ commentId, emoji })}
              />
            </Card>
          ) : null}
```

- [ ] **Step 4: Syntax check**

```bash
node --check apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.growth/screens/GrowthLeadDetailScreen.jsx
git commit -m "feat(growth): add CommentThread with mentions and reactions to lead detail screen"
```

---

## Task 6 — End-to-end verification

**Prerequisite:** Both Plan A (API) and Plan B (UI) must be fully applied and the dev server running (`pnpm dev`).

- [ ] **Step 1: Open a lead detail screen in the browser**

Navigate to `http://localhost:5173/app/m/atlas.growth/leads` → click any lead.

Verify:
- A "Comentarios" card appears below the "Actividad" card in the left column
- The composer textarea shows "Escribe un comentario... usa @ para mencionar"
- The "Agregar nota" card in the right column still works

- [ ] **Step 2: Post a comment**

Type any text in the composer, click "Publicar". Verify:
- The comment appears immediately (optimistic update)
- Author name, timestamp, and no reactions shown

- [ ] **Step 3: Test @mentions**

Type `@` in the composer. Verify a dropdown appears with team members. Click one. Verify the mention token is inserted as `@[DisplayName]`. Post the comment. Verify the mention renders as a highlighted chip.

- [ ] **Step 4: Test emoji reaction**

Hover over the comment to reveal the `😊+` picker button. Click it, select an emoji. Verify it appears as a reaction chip.

- [ ] **Step 5: Test edit**

Hover to reveal Pencil icon. Click it. Edit the text. Click "Guardar". Verify the comment updates and shows "(editado)".

- [ ] **Step 6: Test delete**

Click the Trash icon. Confirm in the dialog. Verify the comment disappears.

- [ ] **Step 7: Verify inventory comments still work**

Navigate to an inventory item. Verify the comment thread still displays and functions identically to before.
