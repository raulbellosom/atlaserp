import { EditorProvider } from '@tiptap/react'
import { useEffect, useRef, useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Y from 'yjs'
import { NotebookPen } from 'lucide-react'
import { Popover, PopoverTrigger, PopoverContent } from '@atlas/ui'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'
import { supabase } from '../../../lib/supabase'
import { SupabaseYjsProvider } from '../lib/SupabaseYjsProvider.js'
import { buildExtensions } from '../lib/editor-extensions.js'
import { usePresence } from '../hooks/usePresence.js'
import { NoteToolbar } from './NoteToolbar.jsx'
import { NoteCoverBanner } from './NoteCoverBanner.jsx'
import { NoteIconPickerContent } from './NoteIconPicker.jsx'
import { PresenceStack } from './PresenceStack.jsx'
import { NoteIcon } from '../noteIcons.jsx'
import { DrawingBlock } from '../lib/extensions/DrawingBlock.jsx'
import { AnnotatableImage } from '../lib/extensions/AnnotatableImage.jsx'

const AUTOSAVE_DELAY = 1500

// Fixed palette for per-collaborator cursor/avatar color — distinct from the
// amber brand accent so collaborators don't blend into UI chrome, and from
// each other (previously every user got the same hardcoded amber).
const PRESENCE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1']

function colorForUser(seed) {
  const s = String(seed ?? '')
  let hash = 0
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0
  return PRESENCE_COLORS[hash % PRESENCE_COLORS.length]
}

// scrollable=false opts out of NoteEditor's own overflow-y-auto wrapper —
// use this when an ancestor page already owns page-level scroll (e.g. the
// public share view). Nesting two independent scroll containers means the
// browser hit-tests the inner one first; here it has nothing real to
// scroll into (it's free to grow), so it just swallows the wheel/touch
// gesture instead of letting it reach the outer, actually-scrollable page.
// One page should have exactly one scroll owner.
export function NoteEditor({ note, readOnly = false, scrollable = true }) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const ydocRef = useRef(null)
  const providerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const isSavingRef = useRef(false)
  const containerRef = useRef(null)
  // providerRef is a ref (not state) so it doesn't re-render on every ydoc
  // update, but that means React never re-reads it once populated — bump
  // this after the provider is created/synced so components that need
  // providerRef.current (e.g. the presence stack) actually see it.
  const [, setProviderTick] = useState(0)

  // Create Y.js doc and provider once per noteId
  useEffect(() => {
    if (!note?.id || !token) return

    const ydoc = new Y.Doc()
    ydocRef.current = ydoc

    const provider = new SupabaseYjsProvider(ydoc, {
      noteId: note.id,
      supabase,
      atlas,
      token,
      onSynced: () => setProviderTick(t => t + 1),
    })
    providerRef.current = provider

    return () => {
      clearTimeout(saveTimerRef.current)
      provider.destroy()
      ydocRef.current = null
      providerRef.current = null
    }
  }, [note?.id, token])

  const handleUpdate = useCallback(
    ({ editor }) => {
      if (readOnly || !note?.id || !token) return
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = setTimeout(async () => {
        if (isSavingRef.current) return
        isSavingRef.current = true
        try {
          const content = editor.getHTML()
          // First paragraph text becomes the note title (Apple Notes pattern)
          const firstChild = editor.state.doc.firstChild
          const firstLineText = firstChild?.textContent?.trim() ?? ''
          // Always send title (empty string clears it -> list shows "Sin
          // titulo") instead of leaving the stale "Nueva nota".
          const patch = { content, title: firstLineText }
          await atlas.notes.update(note.id, patch, token)
          // Invalidate so NotesList and the topbar title update immediately
          queryClient.invalidateQueries({ queryKey: ['notes'] })
          queryClient.invalidateQueries({ queryKey: ['notes', note.id] })
          if (ydocRef.current) {
            const state = Y.encodeStateAsUpdate(ydocRef.current)
            const stateB64 = btoa(String.fromCharCode(...state))
            await atlas.notes.saveYDoc(note.id, stateB64, token)
          }
        } catch (err) {
          console.warn('[NoteEditor] autosave failed:', err?.message)
        } finally {
          isSavingRef.current = false
        }
      }, AUTOSAVE_DELAY)
    },
    [note?.id, token, readOnly],
  )

  // Immediate (non-debounced) update for discrete meta fields — icon and cover
  // banner are single user actions, not continuous typing, so they don't need
  // the autosave delay/queue that handleUpdate uses for content.
  const updateNoteMeta = useCallback(
    async (patch) => {
      if (readOnly || !note?.id || !token) return
      try {
        await atlas.notes.update(note.id, patch, token)
        queryClient.invalidateQueries({ queryKey: ['notes'] })
        queryClient.invalidateQueries({ queryKey: ['notes', note.id] })
      } catch (err) {
        console.warn('[NoteEditor] meta update failed:', err?.message)
      }
    },
    [note?.id, token, readOnly, queryClient],
  )

  // Touch-to-mouse bridge for TipTap column resize handles.
  // ProseMirror's columnResizing plugin only listens to mousedown/mousemove/mouseup.
  // This converts touchstart on .column-resize-handle into the equivalent mouse events.
  useEffect(() => {
    const container = containerRef.current
    if (!container || readOnly) return

    let active = false

    function makeMouseEvent(type, touch) {
      return new MouseEvent(type, {
        bubbles: true, cancelable: true, view: window,
        clientX: touch.clientX, clientY: touch.clientY,
        screenX: touch.screenX, screenY: touch.screenY,
        button: 0, buttons: type === 'mouseup' ? 0 : 1,
      })
    }

    function onTouchStart(e) {
      const handle = e.target.closest?.('.column-resize-handle') ??
        (e.target.classList?.contains('column-resize-handle') ? e.target : null)
      if (!handle) return
      e.preventDefault()
      active = true
      handle.dispatchEvent(makeMouseEvent('mousedown', e.touches[0]))
    }

    function onTouchMove(e) {
      if (!active) return
      e.preventDefault()
      document.dispatchEvent(makeMouseEvent('mousemove', e.touches[0]))
    }

    function onTouchEnd(e) {
      if (!active) return
      active = false
      document.dispatchEvent(makeMouseEvent('mouseup', e.changedTouches[0]))
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
    container.addEventListener('touchend', onTouchEnd)

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('touchmove', onTouchMove)
      container.removeEventListener('touchend', onTouchEnd)
    }
  }, [readOnly])

  const presenceUsers = usePresence(providerRef.current, session?.user?.id)

  if (!note) return null

  const extensions = [
    ...buildExtensions({
      ydoc: ydocRef.current,
      provider: providerRef.current,
      userName:
        session?.user?.user_metadata?.full_name ?? session?.user?.email ?? 'Usuario',
      userColor: colorForUser(session?.user?.id ?? session?.user?.email),
      userId: session?.user?.id ?? null,
      userAvatarUrl: session?.user?.user_metadata?.avatar_url ?? null,
      readOnly,
      noteId: note.id,
      token,
    }),
    DrawingBlock,
    AnnotatableImage,
  ]

  const editorProvider = (
    <EditorProvider
      extensions={extensions}
      content={note.content || ''}
      editable={!readOnly}
      onUpdate={handleUpdate}
      editorProps={{
        attributes: {
          class: 'focus:outline-none px-8 pt-1 pb-6 min-h-full',
        },
      }}
      slotBefore={
        <>
          <NoteCoverBanner
            coverUrl={note.cover_url}
            editable={!readOnly}
            noteId={note.id}
            token={token}
            onChange={coverUrl => updateNoteMeta({ coverUrl })}
            onRemove={() => updateNoteMeta({ coverUrl: null })}
          />
          {!readOnly && (
            // Wrapper does the pinning inside the new scroll container;
            // NoteToolbar's own `sticky top-0` had no scrolling ancestor.
            <div className="sticky top-0 z-20">
              <NoteToolbar noteId={note.id} token={token} />
            </div>
          )}
          {!readOnly && (
            // Sits directly above the title (the editor's first line — see
            // handleUpdate) so icon + title read as one unit, matching
            // Notion's page-icon convention.
            <div className="px-8 pt-4 flex items-center justify-between gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-muted transition-colors"
                    title="Seleccionar icono"
                  >
                    {note.icon
                      ? <NoteIcon name={note.icon} size={22} className="text-amber-500" />
                      : <NotebookPen className="w-5 h-5 text-muted-foreground/50" />
                    }
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-84 p-3" side="bottom" align="start">
                  <NoteIconPickerContent
                    value={note.icon}
                    onChange={icon => updateNoteMeta({ icon })}
                  />
                </PopoverContent>
              </Popover>
              <PresenceStack users={presenceUsers} />
            </div>
          )}
        </>
      }
    >
      {/* EditorProvider renders children inside editor context */}
    </EditorProvider>
  )

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      {scrollable ? (
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {editorProvider}
        </div>
      ) : (
        editorProvider
      )}
    </div>
  )
}
