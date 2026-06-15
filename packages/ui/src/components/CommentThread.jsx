import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Trash2, SmilePlus } from 'lucide-react'
import EmojiPickerLib from 'emoji-picker-react'
import { Button } from './Button.jsx'
import { Card } from './Card.jsx'
import { Avatar, AvatarImage, AvatarFallback } from './Avatar.jsx'
import { Tooltip, TooltipTrigger, TooltipContent } from './Tooltip.jsx'
import { ConfirmDialog } from './ConfirmDialog.jsx'
import MentionTextarea, { renderMentionText } from './MentionTextarea.jsx'

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
  return [person.firstName, person.lastName].filter(Boolean).join(' ') || '—'
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

// ── Emoji picker ──────────────────────────────────────────────────────────────

const PICKER_H = 420
const PICKER_W = 300

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

// ── Single comment row ────────────────────────────────────────────────────────

function CommentRow({ comment, currentUserId, members, onUpdate, onDelete, onToggleReaction, isActing }) {
  const [editing, setEditing] = useState(false)
  const [editBody, setEditBody] = useState(comment.body ?? '')
  const [deleteOpen, setDeleteOpen] = useState(false)

  const isOwn = comment.authorId === currentUserId
  const authorMember = members.find(m => m.id === comment.authorId)
  const reactions = useMemo(
    () => groupReactions(comment.reactions ?? [], currentUserId),
    [comment.reactions, currentUserId],
  )

  async function submitEdit() {
    if (!editBody.trim()) return
    await onUpdate({ commentId: comment.id, body: editBody })
    setEditing(false)
  }

  return (
    <div className={`flex gap-2.5 group transition-opacity${comment._pending ? ' opacity-60' : ''}`}>
      <Avatar className="h-7 w-7 shrink-0">
        <AvatarImage src={authorMember?.avatarUrl ?? ''} alt={displayName(comment.author)} />
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
            <MentionTextarea
              value={editBody}
              onChange={setEditBody}
              members={members}
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={submitEdit} disabled={isActing}>
                {isActing ? 'Guardando...' : 'Guardar'}
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
                  onClick={() => onToggleReaction({ commentId: comment.id, emoji: r.emoji })}
                  disabled={isActing}
                  className={[
                    'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors',
                    'disabled:cursor-not-allowed disabled:opacity-60',
                    r.isMine
                      ? 'border-indigo-500/60 bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25 active:bg-indigo-500/25'
                      : 'border-[hsl(var(--border))] bg-[hsl(var(--muted)/0.4)] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] active:bg-[hsl(var(--muted))]',
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
          <EmojiPicker onSelect={emoji => onToggleReaction({ commentId: comment.id, emoji })} />
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
        description="Esta accion no se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => onDelete(comment.id)}
      />
    </div>
  )
}

// ── Main thread ───────────────────────────────────────────────────────────────

/**
 * Generic comment thread with @mentions, emoji reactions, edit, and delete.
 *
 * Props:
 *   comments     — array of comment objects (with author, mentions, reactions populated)
 *   members      — array of { id, displayName, email?, avatarUrl? } for @mention picker
 *   currentUserId — UserProfile.id of the current user (controls own-comment actions)
 *   loading       — boolean
 *   isSubmitting  — boolean (new comment mutation pending)
 *   isActing      — boolean (update/delete/reaction mutation pending)
 *   onSubmit(body)                       — called when user posts a new comment
 *   onUpdate({ commentId, body })        — called when user edits a comment
 *   onDelete(commentId)                  — called when user deletes a comment
 *   onToggleReaction({ commentId, emoji }) — called when user adds/removes a reaction
 */
export function CommentThread({
  comments = [],
  members = [],
  currentUserId,
  loading = false,
  isSubmitting = false,
  isActing = false,
  onSubmit,
  onUpdate,
  onDelete,
  onToggleReaction,
}) {
  const [body, setBody] = useState('')

  const sorted = useMemo(
    () => [...comments].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [comments],
  )

  function handleSubmit() {
    const trimmed = body.trim()
    if (!trimmed) return
    setBody('')
    onSubmit(trimmed)
  }

  return (
    <Card className="p-4 space-y-4">
      <h3 className="text-sm font-medium">Comentarios</h3>

      {loading ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">Cargando comentarios...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Sin comentarios. Se el primero.
        </p>
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
              isActing={isActing}
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
    </Card>
  )
}
