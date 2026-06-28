import { EditorProvider } from '@tiptap/react'
import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import * as Y from 'yjs'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'
import { supabase } from '../../../lib/supabase'
import { SupabaseYjsProvider } from '../lib/SupabaseYjsProvider.js'
import { buildExtensions } from '../lib/editor-extensions.js'
import { NoteToolbar } from './NoteToolbar.jsx'
import { DrawingBlock } from '../lib/extensions/DrawingBlock.jsx'
import { AnnotatableImage } from '../lib/extensions/AnnotatableImage.jsx'

const AUTOSAVE_DELAY = 1500

export function NoteEditor({ note, readOnly = false }) {
  const { session } = useAuth()
  const token = session?.access_token
  const queryClient = useQueryClient()
  const ydocRef = useRef(null)
  const providerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const isSavingRef = useRef(false)
  const containerRef = useRef(null)

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
      onSynced: () => {},
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
          const patch = { content }
          if (firstLineText) patch.title = firstLineText
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

  if (!note) return null

  const extensions = [
    ...buildExtensions({
      ydoc: ydocRef.current,
      provider: providerRef.current,
      userName:
        session?.user?.user_metadata?.full_name ?? session?.user?.email ?? 'Usuario',
      userColor: '#f59e0b',
      readOnly,
    }),
    DrawingBlock,
    AnnotatableImage,
  ]

  return (
    <div ref={containerRef} className="flex flex-col h-full overflow-hidden">
      <EditorProvider
        extensions={extensions}
        content={note.content || ''}
        editable={!readOnly}
        onUpdate={handleUpdate}
        editorProps={{
          attributes: {
            class: 'focus:outline-none px-8 py-6 min-h-full',
          },
        }}
        slotBefore={!readOnly ? <NoteToolbar /> : null}
      >
        {/* EditorProvider renders children inside editor context */}
      </EditorProvider>
    </div>
  )
}
