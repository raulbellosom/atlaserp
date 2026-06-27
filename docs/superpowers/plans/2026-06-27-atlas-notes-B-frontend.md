# atlas.notes — Plan B: Frontend (TipTap + Y.js + UI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Plan A (Backend) must be complete and `pnpm db:migrate` + `pnpm db:seed` applied.

**Goal:** Build the complete `atlas.notes` frontend — a Notion-quality notes app with TipTap rich editor, Y.js real-time collaboration, freehand drawing blocks, image annotation, folder/tag sidebar, sharing modal, cover/background picker, and public note view.

**Architecture:** Three-panel layout (sidebar → list → editor). TipTap as editor with custom Y.js Supabase provider for CRDT sync. Drawing stored as JSON stroke arrays in TipTap node attributes, rendered on canvas. Image annotations stored as JSON overlay data. Auto-saves content to Y.js state (persisted via API) every 10s and on unmount.

**Tech Stack:** TipTap (ProseMirror), Y.js, `@tiptap/extension-collaboration`, Supabase JS Realtime (broadcast transport for Y.js), TanStack Query, Tailwind, `@atlas/ui` components

---

## File Map

| File | Action |
|---|---|
| `apps/desktop/package.json` | Modify — add TipTap + Y.js deps |
| `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js` | Create — TipTap extension bundle |
| `apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js` | Create — Y.js provider over Supabase Broadcast |
| `apps/desktop/src/modules/atlas.notes/lib/extensions/DrawingBlock.jsx` | Create — TipTap custom node for freehand canvas |
| `apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx` | Create — TipTap Image + annotation overlay |
| `apps/desktop/src/modules/atlas.notes/hooks/useNotes.js` | Create |
| `apps/desktop/src/modules/atlas.notes/hooks/useNote.js` | Create |
| `apps/desktop/src/modules/atlas.notes/hooks/useNoteFolders.js` | Create |
| `apps/desktop/src/modules/atlas.notes/hooks/useNoteTags.js` | Create |
| `apps/desktop/src/modules/atlas.notes/hooks/useNoteShares.js` | Create |
| `apps/desktop/src/modules/atlas.notes/components/DrawingCanvas.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NotesList.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NotesSidebar.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx` | Create — TipTap wrapper + Y.js + auto-save |
| `apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/components/NoteShareModal.jsx` | Create |
| `apps/desktop/src/modules/atlas.notes/screens/NotesScreen.jsx` | Create — three-panel main layout |
| `apps/desktop/src/modules/atlas.notes/screens/PublicNoteScreen.jsx` | Create — public read-only view |
| `apps/desktop/src/app/ModuleOutlet.jsx` | Modify — add SCREEN_MAP entries |
| `apps/desktop/src/app/AppEntry.jsx` | Modify — add `/p/notes/:slug` route |

---

## Task 1: Install Dependencies

**Files:**
- Modify: `apps/desktop/package.json`

- [ ] **Step 1: Install TipTap + Y.js packages**

```bash
cd apps/desktop && pnpm add \
  @tiptap/react \
  @tiptap/pm \
  @tiptap/starter-kit \
  @tiptap/extension-image \
  @tiptap/extension-table \
  @tiptap/extension-table-row \
  @tiptap/extension-table-cell \
  @tiptap/extension-table-header \
  @tiptap/extension-color \
  @tiptap/extension-text-style \
  @tiptap/extension-highlight \
  @tiptap/extension-task-list \
  @tiptap/extension-task-item \
  @tiptap/extension-placeholder \
  @tiptap/extension-character-count \
  @tiptap/extension-collaboration \
  @tiptap/extension-collaboration-cursor \
  @tiptap/extension-underline \
  @tiptap/extension-link \
  yjs \
  y-protocols \
  lib0 \
  date-fns
```

- [ ] **Step 2: Return to root and verify**

```bash
cd ../..
node -e "require('./apps/desktop/node_modules/yjs')" && echo "yjs OK"
```

Expected: `yjs OK`

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml
git commit -m "feat(notes): add TipTap and Y.js dependencies"
```

---

## Task 2: TipTap Extensions Config

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js`

- [ ] **Step 1: Create the file**

```javascript
// apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import Color from '@tiptap/extension-color'
import TextStyle from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Collaboration from '@tiptap/extension-collaboration'
import CollaborationCursor from '@tiptap/extension-collaboration-cursor'
import { DrawingBlock } from './extensions/DrawingBlock.jsx'
import { AnnotatableImage } from './extensions/AnnotatableImage.jsx'

export function buildExtensions({ ydoc, provider, userColor, userName, readOnly = false }) {
  const base = [
    StarterKit.configure({ history: false }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    AnnotatableImage.configure({ inline: false, allowBase64: false }),
    DrawingBlock,
    CharacterCount,
    Placeholder.configure({
      placeholder: ({ node }) => {
        if (node.type.name === 'heading') return 'Titulo...'
        return 'Escribe algo...'
      },
    }),
  ]

  if (ydoc && provider) {
    base.push(
      Collaboration.configure({ document: ydoc }),
      CollaborationCursor.configure({
        provider,
        user: { name: userName ?? 'Anonimo', color: userColor ?? '#f59e0b' },
      }),
    )
  }

  return base
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js
git commit -m "feat(notes): add TipTap extension bundle configuration"
```

---

## Task 3: Supabase Y.js Provider

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js`

- [ ] **Step 1: Create the provider**

```javascript
// apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js
import * as Y from 'yjs'
import * as awarenessProtocol from 'y-protocols/awareness'

export class SupabaseYjsProvider {
  constructor(ydoc, { noteId, supabase, atlas, token, onSynced }) {
    this.ydoc = ydoc
    this.noteId = noteId
    this.synced = false
    this.awareness = new awarenessProtocol.Awareness(ydoc)
    this._channel = null
    this._updateHandler = null
    this._awarenessHandler = null
    this._onSynced = onSynced

    this._init(supabase, atlas, token)
  }

  async _init(supabase, atlas, token) {
    // 1. Load persisted server state
    try {
      const res = await atlas.notes.getYDoc(this.noteId, token)
      if (res?.state) {
        const buf = Uint8Array.from(atob(res.state), c => c.charCodeAt(0))
        Y.applyUpdate(this.ydoc, buf, 'server-load')
      }
    } catch (_) {
      // New note — no state yet
    }

    this.synced = true
    this._onSynced?.()

    // 2. Subscribe to broadcast channel
    this._channel = supabase.channel(`note:ydoc:${this.noteId}`, {
      config: { broadcast: { self: false, ack: false } },
    })

    this._channel
      .on('broadcast', { event: 'ydoc.update' }, ({ payload }) => {
        const update = Uint8Array.from(atob(payload.update), c => c.charCodeAt(0))
        Y.applyUpdate(this.ydoc, update, 'broadcast')
      })
      .on('broadcast', { event: 'awareness.update' }, ({ payload }) => {
        const update = Uint8Array.from(atob(payload.update), c => c.charCodeAt(0))
        awarenessProtocol.applyAwarenessUpdate(this.awareness, update, 'broadcast')
      })
      .subscribe()

    // 3. Broadcast local doc updates
    this._updateHandler = (update, origin) => {
      if (origin === 'server-load' || origin === 'broadcast') return
      const encoded = btoa(String.fromCharCode(...update))
      this._channel.send({ type: 'broadcast', event: 'ydoc.update', payload: { update: encoded } })
    }
    this.ydoc.on('update', this._updateHandler)

    // 4. Broadcast awareness (cursor) changes
    this._awarenessHandler = ({ updated }) => {
      const update = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [...updated])
      const encoded = btoa(String.fromCharCode(...update))
      this._channel.send({ type: 'broadcast', event: 'awareness.update', payload: { update: encoded } })
    }
    this.awareness.on('update', this._awarenessHandler)
  }

  setAwarenessField(field, value) {
    this.awareness.setLocalStateField(field, value)
  }

  destroy() {
    if (this._updateHandler) this.ydoc.off('update', this._updateHandler)
    if (this._awarenessHandler) this.awareness.off('update', this._awarenessHandler)
    this.awareness.destroy()
    if (this._channel) this._channel.unsubscribe()
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js
git commit -m "feat(notes): add Y.js Supabase Broadcast provider for real-time collab"
```

---

## Task 4: DrawingBlock TipTap Extension + Canvas Component

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/extensions/DrawingBlock.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/DrawingCanvas.jsx`

- [ ] **Step 1: Create the TipTap node extension**

```javascript
// apps/desktop/src/modules/atlas.notes/lib/extensions/DrawingBlock.jsx
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { DrawingCanvas } from '../../components/DrawingCanvas.jsx'

export const DrawingBlock = Node.create({
  name: 'drawingBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      strokes: { default: '[]' },
      canvasWidth: { default: 700 },
      canvasHeight: { default: 300 },
      backgroundColor: { default: '#ffffff' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="drawing-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'drawing-block' })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(DrawingCanvas)
  },

  addCommands() {
    return {
      insertDrawingBlock: () => ({ commands }) =>
        commands.insertContent({ type: 'drawingBlock', attrs: {} }),
    }
  },
})
```

- [ ] **Step 2: Create DrawingCanvas.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/DrawingCanvas.jsx
import { NodeViewWrapper } from '@tiptap/react'
import { useRef, useState, useEffect } from 'react'

const COLORS = ['#1a1a1a', '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ffffff']
const SIZES = [2, 4, 8, 14, 20]

export function DrawingCanvas({ node, updateAttributes, editor }) {
  const canvasRef = useRef(null)
  const isDrawing = useRef(false)
  const currentStroke = useRef([])
  const strokesRef = useRef(JSON.parse(node.attrs.strokes || '[]'))
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#1a1a1a')
  const [size, setSize] = useState(4)
  const [strokeCount, setStrokeCount] = useState(strokesRef.current.length)

  useEffect(() => {
    strokesRef.current = JSON.parse(node.attrs.strokes || '[]')
    redraw()
    setStrokeCount(strokesRef.current.length)
  }, [node.attrs.strokes])

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    strokesRef.current.forEach(s => paintStroke(ctx, s))
  }

  function paintStroke(ctx, stroke) {
    if (!stroke.points || stroke.points.length < 2) return
    ctx.save()
    ctx.beginPath()
    ctx.globalCompositeOperation = stroke.tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = stroke.tool === 'eraser' ? 'rgba(0,0,0,1)' : stroke.color
    ctx.lineWidth = stroke.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    stroke.points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.stroke()
    ctx.restore()
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  function onPointerDown(e) {
    e.preventDefault()
    isDrawing.current = true
    currentStroke.current = [getPos(e)]
  }

  function onPointerMove(e) {
    e.preventDefault()
    if (!isDrawing.current) return
    const pos = getPos(e)
    currentStroke.current.push(pos)
    const ctx = canvasRef.current.getContext('2d')
    const pts = currentStroke.current
    if (pts.length < 2) return
    paintStroke(ctx, { tool, color, size, points: [pts[pts.length - 2], pts[pts.length - 1]] })
  }

  function onPointerUp(e) {
    e.preventDefault()
    if (!isDrawing.current || !currentStroke.current.length) return
    isDrawing.current = false
    const newStroke = { tool, color, size, points: currentStroke.current }
    currentStroke.current = []
    const updated = [...strokesRef.current, newStroke]
    strokesRef.current = updated
    setStrokeCount(updated.length)
    updateAttributes({ strokes: JSON.stringify(updated) })
  }

  function undoLast() {
    const updated = strokesRef.current.slice(0, -1)
    strokesRef.current = updated
    setStrokeCount(updated.length)
    updateAttributes({ strokes: JSON.stringify(updated) })
  }

  function clearAll() {
    strokesRef.current = []
    setStrokeCount(0)
    updateAttributes({ strokes: '[]' })
    const ctx = canvasRef.current?.getContext('2d')
    ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)
  }

  const editable = editor?.isEditable !== false

  return (
    <NodeViewWrapper className="my-4 select-none">
      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        {editable && (
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 flex-wrap">
            <button onClick={() => setTool('pen')} className={`px-2 py-1 text-xs rounded font-medium ${tool === 'pen' ? 'bg-amber-100 text-amber-700' : 'text-gray-600 hover:bg-gray-100'}`}>Lapiz</button>
            <button onClick={() => setTool('eraser')} className={`px-2 py-1 text-xs rounded font-medium ${tool === 'eraser' ? 'bg-gray-200' : 'text-gray-600 hover:bg-gray-100'}`}>Borrador</button>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex gap-1">
              {COLORS.map(c => (
                <button key={c} onClick={() => { setTool('pen'); setColor(c) }}
                  className={`w-5 h-5 rounded-full border-2 ${color === c && tool === 'pen' ? 'border-amber-500 scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c === '#ffffff' ? '#f3f4f6' : c }} />
              ))}
            </div>
            <div className="h-4 w-px bg-gray-200" />
            <div className="flex gap-1 items-center">
              {SIZES.map(s => (
                <button key={s} onClick={() => setSize(s)} className={`flex items-center justify-center w-6 h-6 rounded ${size === s ? 'bg-amber-100' : 'hover:bg-gray-100'}`}>
                  <div className="rounded-full bg-gray-700" style={{ width: Math.min(s, 14), height: Math.min(s, 14) }} />
                </button>
              ))}
            </div>
            <div className="ml-auto flex gap-1">
              <button onClick={undoLast} disabled={strokeCount === 0} className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30">Deshacer</button>
              <button onClick={clearAll} disabled={strokeCount === 0} className="px-2 py-1 text-xs text-red-500 hover:bg-red-50 rounded disabled:opacity-30">Limpiar</button>
            </div>
          </div>
        )}
        <canvas
          ref={canvasRef}
          width={node.attrs.canvasWidth}
          height={node.attrs.canvasHeight}
          onPointerDown={editable ? onPointerDown : undefined}
          onPointerMove={editable ? onPointerMove : undefined}
          onPointerUp={editable ? onPointerUp : undefined}
          onPointerLeave={editable ? onPointerUp : undefined}
          style={{
            touchAction: 'none',
            display: 'block',
            width: '100%',
            cursor: editable ? (tool === 'eraser' ? 'cell' : 'crosshair') : 'default',
            backgroundColor: node.attrs.backgroundColor,
          }}
        />
      </div>
    </NodeViewWrapper>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/extensions/DrawingBlock.jsx \
        apps/desktop/src/modules/atlas.notes/components/DrawingCanvas.jsx
git commit -m "feat(notes): add DrawingBlock TipTap extension and freehand canvas component"
```

---

## Task 5: AnnotatableImage Extension + Overlay Component

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx`

- [ ] **Step 1: Create the TipTap extension**

```javascript
// apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageAnnotationOverlay } from '../../components/ImageAnnotationOverlay.jsx'

export const AnnotatableImage = Image.extend({
  name: 'annotatableImage',

  addAttributes() {
    return {
      ...this.parent?.(),
      annotations: { default: '[]' },
      caption: { default: '' },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageAnnotationOverlay)
  },
})
```

- [ ] **Step 2: Create ImageAnnotationOverlay.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx
import { NodeViewWrapper } from '@tiptap/react'
import { useState, useRef } from 'react'

const ANN_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6']

export function ImageAnnotationOverlay({ node, updateAttributes, editor }) {
  const [annotating, setAnnotating] = useState(false)
  const [anns, setAnns] = useState(() => JSON.parse(node.attrs.annotations || '[]'))
  const [activeTool, setActiveTool] = useState('arrow')
  const [activeColor, setActiveColor] = useState('#ef4444')
  const [draft, setDraft] = useState(null)
  const containerRef = useRef(null)
  const editable = editor?.isEditable !== false

  function rel(e) {
    const rect = containerRef.current.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    }
  }

  function onDown(e) { if (!annotating) return; setDraft({ type: activeTool, color: activeColor, start: rel(e), end: rel(e) }) }
  function onMove(e) { if (!draft) return; setDraft(d => ({ ...d, end: rel(e) })) }

  function onUp(e) {
    if (!draft) return
    let ann = { ...draft, id: Date.now() }
    if (ann.type === 'text') {
      const text = window.prompt('Texto de anotacion:')
      if (!text) { setDraft(null); return }
      ann = { ...ann, text }
    }
    const updated = [...anns, ann]
    setAnns(updated)
    updateAttributes({ annotations: JSON.stringify(updated) })
    setDraft(null)
  }

  function remove(id) {
    const updated = anns.filter(a => a.id !== id)
    setAnns(updated)
    updateAttributes({ annotations: JSON.stringify(updated) })
  }

  function renderAnn(ann) {
    const x1 = Math.min(ann.start.x, ann.end.x), y1 = Math.min(ann.start.y, ann.end.y)
    const w = Math.abs(ann.end.x - ann.start.x), h = Math.abs(ann.end.y - ann.start.y)

    if (ann.type === 'rect') return (
      <div key={ann.id} onClick={() => annotating && remove(ann.id)}
        style={{ position: 'absolute', left: `${x1}%`, top: `${y1}%`, width: `${w}%`, height: `${h}%`,
          border: `2.5px solid ${ann.color}`, cursor: annotating ? 'pointer' : 'default', boxSizing: 'border-box' }} />
    )
    if (ann.type === 'text') return (
      <div key={ann.id} onClick={() => annotating && remove(ann.id)}
        style={{ position: 'absolute', left: `${ann.start.x}%`, top: `${ann.start.y}%`, color: ann.color,
          background: 'rgba(255,255,255,0.9)', padding: '2px 6px', borderRadius: 4, fontSize: 13, fontWeight: 600,
          cursor: annotating ? 'pointer' : 'default', whiteSpace: 'nowrap', transform: 'translate(-50%,-50%)' }}>
        {ann.text}
      </div>
    )
    return (
      <svg key={ann.id} onClick={() => annotating && remove(ann.id)}
        style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', overflow: 'visible',
          pointerEvents: annotating ? 'all' : 'none' }}>
        <defs>
          <marker id={`arr-${ann.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill={ann.color} />
          </marker>
        </defs>
        <line x1={`${ann.start.x}%`} y1={`${ann.start.y}%`} x2={`${ann.end.x}%`} y2={`${ann.end.y}%`}
          stroke={ann.color} strokeWidth="2.5" markerEnd={`url(#arr-${ann.id})`}
          style={{ cursor: annotating ? 'pointer' : 'default' }} />
      </svg>
    )
  }

  return (
    <NodeViewWrapper className="my-3 group">
      <div className="relative inline-block w-full">
        <div ref={containerRef} className="relative" style={{ cursor: annotating ? 'crosshair' : 'default' }}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp}>
          <img src={node.attrs.src} alt={node.attrs.alt || ''} style={{ width: '100%', display: 'block', borderRadius: 8 }} draggable={false} />
          {anns.map(a => renderAnn(a))}
          {draft && renderAnn({ ...draft, id: 'draft' })}
        </div>
        {node.attrs.caption && <p className="text-center text-sm text-gray-500 mt-1">{node.attrs.caption}</p>}
        {editable && (
          <div className={`absolute top-2 right-2 flex gap-1 bg-white/90 backdrop-blur rounded-lg shadow p-1 ${annotating ? 'flex' : 'hidden group-hover:flex'}`}>
            {!annotating ? (
              <button onClick={() => setAnnotating(true)} className="px-2 py-1 text-xs rounded hover:bg-gray-100">Anotar</button>
            ) : (
              <>
                {['arrow','rect','text'].map(t => (
                  <button key={t} onClick={() => setActiveTool(t)}
                    className={`px-2 py-1 text-xs rounded ${activeTool === t ? 'bg-amber-100 text-amber-700' : 'hover:bg-gray-100'}`}>
                    {t === 'arrow' ? 'Flecha' : t === 'rect' ? 'Cuadro' : 'Texto'}
                  </button>
                ))}
                <div className="flex gap-1">
                  {ANN_COLORS.map(c => (
                    <button key={c} onClick={() => setActiveColor(c)}
                      className={`w-4 h-4 rounded-full border-2 ${activeColor === c ? 'border-gray-600' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} />
                  ))}
                </div>
                <button onClick={() => setAnnotating(false)} className="ml-1 px-2 py-1 text-xs rounded hover:bg-gray-100 text-gray-500">Listo</button>
              </>
            )}
          </div>
        )}
      </div>
    </NodeViewWrapper>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx \
        apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx
git commit -m "feat(notes): add AnnotatableImage extension with arrow/rect/text annotation overlay"
```

---

## Task 6: API Hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useNotes.js`
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useNote.js`
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useNoteFolders.js`
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useNoteTags.js`
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useNoteShares.js`

- [ ] **Step 1: Create useNotes.js**

```javascript
// apps/desktop/src/modules/atlas.notes/hooks/useNotes.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'
import { toast } from 'sonner'

export function useNotes(params = {}) {
  const { atlas, token } = useAtlas()
  return useQuery({
    queryKey: ['notes', params],
    queryFn: () => atlas.notes.list(params, token),
    enabled: Boolean(token),
    select: res => res.notes ?? [],
    staleTime: 30_000,
  })
}

export function useCreateNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: data => atlas.notes.create(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
    onError: () => toast.error('No se pudo crear la nota'),
  })
}

export function useUpdateNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.notes.update(id, data, token),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['note', id] })
    },
  })
}

export function useTrashNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: id => atlas.notes.trash(id, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Nota movida a papelera') },
    onError: () => toast.error('No se pudo eliminar la nota'),
  })
}

export function useRestoreNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: id => atlas.notes.restore(id, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Nota restaurada') },
  })
}

export function usePermanentDeleteNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: id => atlas.notes.permanentDelete(id, token),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['notes'] }); toast.success('Nota eliminada definitivamente') },
    onError: () => toast.error('No se pudo eliminar'),
  })
}
```

- [ ] **Step 2: Create useNote.js**

```javascript
// apps/desktop/src/modules/atlas.notes/hooks/useNote.js
import { useQuery } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'

export function useNote(noteId) {
  const { atlas, token } = useAtlas()
  return useQuery({
    queryKey: ['note', noteId],
    queryFn: () => atlas.notes.get(noteId, token),
    enabled: Boolean(token && noteId),
    select: res => res.note,
    staleTime: 0,
  })
}
```

- [ ] **Step 3: Create useNoteFolders.js**

```javascript
// apps/desktop/src/modules/atlas.notes/hooks/useNoteFolders.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'
import { toast } from 'sonner'

export function useNoteFolders() {
  const { atlas, token } = useAtlas()
  return useQuery({
    queryKey: ['note-folders'],
    queryFn: () => atlas.notes.listFolders(token),
    enabled: Boolean(token),
    select: res => res.folders ?? [],
    staleTime: 60_000,
  })
}

export function useCreateFolder() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: data => atlas.notes.createFolder(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-folders'] }),
    onError: () => toast.error('No se pudo crear la carpeta'),
  })
}

export function useUpdateFolder() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }) => atlas.notes.updateFolder(id, data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-folders'] }),
  })
}

export function useDeleteFolder() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: id => atlas.notes.deleteFolder(id, token),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['note-folders'] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
```

- [ ] **Step 4: Create useNoteTags.js**

```javascript
// apps/desktop/src/modules/atlas.notes/hooks/useNoteTags.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'

export function useNoteTags() {
  const { atlas, token } = useAtlas()
  return useQuery({
    queryKey: ['note-tags'],
    queryFn: () => atlas.notes.listTags(token),
    enabled: Boolean(token),
    select: res => res.tags ?? [],
    staleTime: 60_000,
  })
}

export function useCreateTag() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: data => atlas.notes.createTag(data, token),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['note-tags'] }),
  })
}

export function useSetNoteTags() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, tagIds }) => atlas.notes.setNoteTags(noteId, tagIds, token),
    onSuccess: (_, { noteId }) => {
      qc.invalidateQueries({ queryKey: ['note', noteId] })
      qc.invalidateQueries({ queryKey: ['notes'] })
    },
  })
}
```

- [ ] **Step 5: Create useNoteShares.js**

```javascript
// apps/desktop/src/modules/atlas.notes/hooks/useNoteShares.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'
import { toast } from 'sonner'

export function useNoteShares(noteId) {
  const { atlas, token } = useAtlas()
  return useQuery({
    queryKey: ['note-shares', noteId],
    queryFn: () => atlas.notes.listShares(noteId, token),
    enabled: Boolean(token && noteId),
    select: res => res.shares ?? [],
  })
}

export function useShareNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, targetUserId, permission }) =>
      atlas.notes.shareNote(noteId, { targetUserId, permission }, token),
    onSuccess: (_, { noteId }) => { qc.invalidateQueries({ queryKey: ['note-shares', noteId] }); toast.success('Nota compartida') },
    onError: () => toast.error('No se pudo compartir la nota'),
  })
}

export function useRevokeShare() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ noteId, shareId }) => atlas.notes.revokeShare(noteId, shareId, token),
    onSuccess: (_, { noteId }) => qc.invalidateQueries({ queryKey: ['note-shares', noteId] }),
  })
}

export function usePublishNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: noteId => atlas.notes.publish(noteId, token),
    onSuccess: (_, noteId) => qc.invalidateQueries({ queryKey: ['note', noteId] }),
  })
}

export function useUnpublishNote() {
  const { atlas, token } = useAtlas()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: noteId => atlas.notes.unpublish(noteId, token),
    onSuccess: (_, noteId) => qc.invalidateQueries({ queryKey: ['note', noteId] }),
  })
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/hooks/
git commit -m "feat(notes): add TanStack Query hooks for notes, folders, tags and shares"
```

---

## Task 7: NoteEditor + NoteToolbar

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx`

- [ ] **Step 1: Create NoteToolbar.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx
import { useAtlas } from '../../../lib/atlas.js'

const COLORS = [
  { v: '#1a1a1a', l: 'Negro' }, { v: '#ef4444', l: 'Rojo' }, { v: '#3b82f6', l: 'Azul' },
  { v: '#22c55e', l: 'Verde' }, { v: '#f59e0b', l: 'Amarillo' }, { v: '#8b5cf6', l: 'Morado' },
]
const HIGHLIGHTS = [
  { v: '#fef08a', l: 'Amarillo' }, { v: '#bbf7d0', l: 'Verde' }, { v: '#bfdbfe', l: 'Azul' },
  { v: '#fbcfe8', l: 'Rosa' }, { v: '#fed7aa', l: 'Naranja' },
]

export function NoteToolbar({ editor, noteId }) {
  const { atlas, token, supabase } = useAtlas()
  if (!editor) return null

  async function uploadAndInsertImage(file) {
    const res = await atlas.notes.presignImage({ fileName: file.name, mimeType: file.type, noteId }, token)
    await fetch(res.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    const { data } = await supabase.storage.from('atlas-notes').createSignedUrl(res.objectKey, 3600 * 8760)
    if (data?.signedUrl) {
      editor.chain().focus().insertContent({ type: 'annotatableImage', attrs: { src: data.signedUrl, alt: file.name } }).run()
    }
  }

  const btn = (active, onClick, label, title) => (
    <button key={label} onClick={onClick} title={title ?? label}
      className={`px-2 py-1 text-sm rounded ${active ? 'bg-gray-200 font-semibold' : 'hover:bg-gray-100'}`}>
      {label}
    </button>
  )

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-gray-100 bg-white/80 backdrop-blur sticky top-0 z-10 flex-wrap">
      {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'N', 'Negrita')}
      {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'I', 'Cursiva')}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'S', 'Subrayado')}
      {btn(editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'T', 'Tachado')}
      <div className="h-4 w-px bg-gray-200 mx-1" />
      {[1,2,3].map(l => btn(editor.isActive('heading',{level:l}), () => editor.chain().focus().toggleHeading({level:l}).run(), `H${l}`))}
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), '•')}
      {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), '1.')}
      {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), '☑')}
      {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), '"')}
      {btn(editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), '</>')}
      <div className="h-4 w-px bg-gray-200 mx-1" />
      {/* Color picker */}
      <div className="relative group">
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" title="Color de texto">A</button>
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 hidden group-hover:flex gap-1 z-20">
          {COLORS.map(c => <button key={c.v} onClick={() => editor.chain().focus().setColor(c.v).run()} className="w-5 h-5 rounded-full border border-gray-200" style={{ backgroundColor: c.v }} title={c.l} />)}
          <button onClick={() => editor.chain().focus().unsetColor().run()} className="w-5 h-5 rounded text-xs border text-gray-400">X</button>
        </div>
      </div>
      {/* Highlight picker */}
      <div className="relative group">
        <button className="px-2 py-1 text-sm rounded hover:bg-gray-100" title="Resaltar">M</button>
        <div className="absolute left-0 top-full mt-1 bg-white border rounded-lg shadow-lg p-2 hidden group-hover:flex gap-1 z-20">
          {HIGHLIGHTS.map(c => <button key={c.v} onClick={() => editor.chain().focus().toggleHighlight({color:c.v}).run()} className="w-5 h-5 rounded border border-gray-200" style={{ backgroundColor: c.v }} title={c.l} />)}
          <button onClick={() => editor.chain().focus().unsetHighlight().run()} className="w-5 h-5 rounded text-xs border text-gray-400">X</button>
        </div>
      </div>
      <div className="h-4 w-px bg-gray-200 mx-1" />
      {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), 'Tabla')}
      {btn(false, () => editor.chain().focus().insertDrawingBlock().run(), 'Dibujo')}
      <label className="px-2 py-1 text-sm rounded hover:bg-gray-100 cursor-pointer" title="Insertar imagen">
        Imagen
        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadAndInsertImage(f).catch(()=>{}); e.target.value='' }} />
      </label>
      <div className="ml-auto flex gap-1">
        {btn(false, () => editor.chain().focus().undo().run(), '↩', 'Deshacer')}
        {btn(false, () => editor.chain().focus().redo().run(), '↪', 'Rehacer')}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create NoteEditor.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx
import { useEditor, EditorContent } from '@tiptap/react'
import { useEffect, useRef, useCallback } from 'react'
import * as Y from 'yjs'
import { SupabaseYjsProvider } from '../lib/SupabaseYjsProvider.js'
import { buildExtensions } from '../lib/editor-extensions.js'
import { NoteToolbar } from './NoteToolbar.jsx'
import { useAtlas } from '../../../lib/atlas.js'

// Verify import paths match your project's hooks. Common patterns:
// import { useProfile } from '../../../hooks/useProfile.js'
// import { useAuth } from '../../../providers/AuthProvider.jsx'

export function NoteEditor({ noteId, note, onTitleChange, readOnly = false }) {
  const { atlas, token, supabase } = useAtlas()
  const ydocRef = useRef(new Y.Doc())
  const providerRef = useRef(null)
  const saveTimerRef = useRef(null)
  const persistTimerRef = useRef(null)

  const editor = useEditor({
    extensions: buildExtensions({ readOnly }),
    editable: !readOnly,
    editorProps: {
      attributes: { class: 'prose prose-slate max-w-none focus:outline-none min-h-[60vh] px-8 py-4' },
    },
  }, [readOnly])

  // Initialize Y.js provider when noteId changes (or when non-readonly)
  useEffect(() => {
    if (!noteId || readOnly || !editor) return

    const doc = new Y.Doc()
    ydocRef.current = doc
    providerRef.current?.destroy()

    const provider = new SupabaseYjsProvider(doc, {
      noteId,
      supabase,
      atlas,
      token,
      onSynced: () => {
        // Re-init editor extensions with the loaded ydoc
        editor.extensionManager.extensions
          .find(e => e.name === 'collaboration')
          ?.options
        // Set initial content only if doc is empty (new note)
        if (!doc.getXmlFragment('default').length && note?.content) {
          editor.commands.setContent(note.content)
        }
      },
    })
    providerRef.current = provider

    // Persist Y.js state to DB every 10s
    persistTimerRef.current = setInterval(() => {
      const state = Y.encodeStateAsUpdate(doc)
      const base64 = btoa(String.fromCharCode(...state))
      atlas.notes.saveYDoc(noteId, base64, token).catch(() => {})
    }, 10_000)

    return () => {
      clearInterval(persistTimerRef.current)
      const state = Y.encodeStateAsUpdate(doc)
      const base64 = btoa(String.fromCharCode(...state))
      atlas.notes.saveYDoc(noteId, base64, token).catch(() => {})
      provider.destroy()
      providerRef.current = null
    }
  }, [noteId, editor, readOnly])

  // Load non-collab content for read-only mode
  useEffect(() => {
    if (readOnly && editor && note?.content) {
      editor.commands.setContent(note.content)
    }
  }, [readOnly, editor, note?.content])

  // Debounced save of JSON content + word count
  const debouncedSave = useCallback(() => {
    if (!editor || !noteId || readOnly) return
    clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      const content = editor.getJSON()
      const contentText = editor.getText()
      const wordCount = contentText.trim().split(/\s+/).filter(Boolean).length
      atlas.notes.update(noteId, { content, contentText, wordCount }, token).catch(() => {})
    }, 1500)
  }, [editor, noteId, readOnly, atlas, token])

  useEffect(() => {
    if (!editor) return
    editor.on('update', debouncedSave)
    return () => { editor.off('update', debouncedSave); clearTimeout(saveTimerRef.current) }
  }, [editor, debouncedSave])

  const containerStyle = {}
  if (note?.background_color) containerStyle.backgroundColor = note.background_color
  else if (note?.background_image_url) {
    containerStyle.backgroundImage = `url(${note.background_image_url})`
    containerStyle.backgroundSize = 'cover'
    containerStyle.backgroundPosition = 'center'
  }

  return (
    <div className="flex flex-col h-full" style={containerStyle}>
      {!readOnly && editor && <NoteToolbar editor={editor} noteId={noteId} />}
      <div className="flex-1 overflow-auto">
        <div className="px-8 pt-8 pb-2">
          {note?.icon && <span className="text-4xl block mb-2">{note.icon}</span>}
          <input
            type="text"
            defaultValue={note?.title ?? ''}
            placeholder="Sin titulo"
            onChange={e => onTitleChange?.(e.target.value)}
            onBlur={e => noteId && atlas.notes.update(noteId, { title: e.target.value }, token).catch(() => {})}
            disabled={readOnly}
            className="w-full text-4xl font-bold text-gray-900 bg-transparent border-none outline-none placeholder:text-gray-300 disabled:cursor-default"
          />
        </div>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx \
        apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx
git commit -m "feat(notes): add NoteEditor with Y.js + auto-save and NoteToolbar"
```

---

## Task 8: NoteCard, NotesList, NotesSidebar

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/NotesList.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/NotesSidebar.jsx`

- [ ] **Step 1: Create NoteCard.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

export function NoteCard({ note, selected, onClick }) {
  const preview = note.content_text?.slice(0, 120) || ''
  return (
    <button onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-sm ${selected ? 'ring-2 ring-amber-400 border-amber-200' : 'border-gray-100 hover:border-gray-200'}`}
      style={note.background_color ? { backgroundColor: note.background_color } : {}}>
      {note.cover_url && <img src={note.cover_url} alt="" className="w-full h-24 object-cover rounded-lg mb-2" />}
      <div className="flex items-start gap-2">
        {note.icon && <span className="text-lg shrink-0">{note.icon}</span>}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${note.title ? 'text-gray-900' : 'text-gray-400'}`}>
            {note.title || 'Sin titulo'}
          </p>
          {preview && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{preview}</p>}
        </div>
        {note.is_pinned && <span className="text-gray-400 shrink-0 text-xs">📌</span>}
      </div>
      <div className="flex items-center gap-1 mt-2 flex-wrap">
        {(note.tags ?? []).slice(0, 3).map(t => (
          <span key={t.id} className="text-xs px-1.5 py-0.5 rounded-full text-white" style={{ backgroundColor: t.color }}>{t.name}</span>
        ))}
        <span className="ml-auto text-xs text-gray-400 shrink-0">
          {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: es })}
        </span>
      </div>
    </button>
  )
}
```

- [ ] **Step 2: Create NotesList.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NotesList.jsx
import { NoteCard } from './NoteCard.jsx'
import { EmptyState } from '@atlas/ui'

export function NotesList({ notes = [], selectedId, onSelect, loading }) {
  if (loading) return (
    <div className="flex flex-col gap-2 p-3">
      {[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-gray-100 animate-pulse" />)}
    </div>
  )
  if (!notes.length) return <EmptyState title="Sin notas" description="Crea tu primera nota con el boton +" className="py-16" />
  return (
    <div className="flex flex-col gap-2 p-3">
      {notes.map(n => <NoteCard key={n.id} note={n} selected={n.id === selectedId} onClick={() => onSelect(n.id)} />)}
    </div>
  )
}
```

- [ ] **Step 3: Create NotesSidebar.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NotesSidebar.jsx
import { useState } from 'react'
import { useNoteFolders, useCreateFolder, useDeleteFolder } from '../hooks/useNoteFolders.js'
import { useNoteTags } from '../hooks/useNoteTags.js'
import { ConfirmDialog } from '@atlas/ui'

export function NotesSidebar({ activeFilter, onFilterChange }) {
  const { data: folders = [] } = useNoteFolders()
  const { data: tags = [] } = useNoteTags()
  const createFolder = useCreateFolder()
  const deleteFolder = useDeleteFolder()
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(null)

  const item = (label, value, icon) => (
    <button key={value} onClick={() => onFilterChange(value)}
      className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${activeFilter === value ? 'bg-amber-50 text-amber-700 font-medium' : 'text-gray-600 hover:bg-gray-50'}`}>
      <span>{icon}</span><span className="flex-1 text-left">{label}</span>
    </button>
  )

  async function submit() {
    if (!newName.trim()) return
    await createFolder.mutateAsync({ name: newName.trim() })
    setNewName(''); setCreating(false)
  }

  return (
    <div className="flex flex-col gap-1 p-3 h-full overflow-y-auto">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3 mb-1">Notas</p>
      {item('Todas las notas', 'all', '📋')}
      {item('Compartidas', 'shared', '👥')}
      {item('Destacadas', 'pinned', '📌')}
      {item('Archivadas', 'archived', '📦')}
      {item('Papelera', 'trash', '🗑️')}
      <div className="h-px bg-gray-100 my-2" />
      <div className="flex items-center justify-between px-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Carpetas</p>
        <button onClick={() => setCreating(true)} className="text-gray-400 hover:text-gray-600 text-lg leading-none">+</button>
      </div>
      {folders.map(f => (
        <div key={f.id} className="group flex items-center">
          {item(f.name, `folder:${f.id}`, '📁')}
          <button onClick={() => setDeleting(f)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 text-xs shrink-0">✕</button>
        </div>
      ))}
      {creating && (
        <div className="flex gap-1 px-3">
          <input autoFocus type="text" value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key==='Enter') submit(); if (e.key==='Escape') setCreating(false) }}
            placeholder="Nombre de carpeta" className="flex-1 text-sm border border-gray-200 rounded px-2 py-1" />
          <button onClick={submit} className="text-xs px-2 bg-amber-100 text-amber-700 rounded hover:bg-amber-200">OK</button>
        </div>
      )}
      {tags.length > 0 && (
        <>
          <div className="h-px bg-gray-100 my-2" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-3">Etiquetas</p>
          {tags.map(t => (
            <button key={t.id} onClick={() => onFilterChange(`tag:${t.id}`)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm ${activeFilter===`tag:${t.id}` ? 'bg-amber-50 text-amber-700' : 'text-gray-600 hover:bg-gray-50'}`}>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <span className="flex-1 text-left">{t.name}</span>
              <span className="text-xs text-gray-400">{t.note_count}</span>
            </button>
          ))}
        </>
      )}
      <ConfirmDialog open={Boolean(deleting)} onOpenChange={() => setDeleting(null)}
        title="Eliminar carpeta"
        description={`Las notas de "${deleting?.name}" quedaran sin carpeta.`}
        onConfirm={() => { deleteFolder.mutate(deleting.id); setDeleting(null) }}
        confirmLabel="Eliminar" />
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx \
        apps/desktop/src/modules/atlas.notes/components/NotesList.jsx \
        apps/desktop/src/modules/atlas.notes/components/NotesSidebar.jsx
git commit -m "feat(notes): add NoteCard, NotesList and NotesSidebar components"
```

---

## Task 9: NoteSettingsPanel + NoteShareModal

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx`
- Create: `apps/desktop/src/modules/atlas.notes/components/NoteShareModal.jsx`

- [ ] **Step 1: Create NoteSettingsPanel.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx
import { useState } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@atlas/ui'
import { useNoteFolders } from '../hooks/useNoteFolders.js'
import { useNoteTags, useCreateTag, useSetNoteTags } from '../hooks/useNoteTags.js'
import { useUpdateNote } from '../hooks/useNotes.js'
import { usePublishNote, useUnpublishNote } from '../hooks/useNoteShares.js'
import { toast } from 'sonner'

const BG_COLORS = [
  { l: 'Blanco', v: null }, { l: 'Crema', v: '#fef3c7' }, { l: 'Rosa', v: '#fce7f3' },
  { l: 'Azul', v: '#dbeafe' }, { l: 'Verde', v: '#dcfce7' }, { l: 'Lila', v: '#ede9fe' },
  { l: 'Gris', v: '#f3f4f6' }, { l: 'Noche', v: '#1e1e2e' },
]
const ICONS = ['📝','⭐','💡','🔥','📌','✅','🎯','🚀','💼','🔐','🎨','📊','📖','🧠','💬','🌿','🏆','⚡','🎵','🌍']

export function NoteSettingsPanel({ open, onOpenChange, note }) {
  const { data: folders = [] } = useNoteFolders()
  const { data: tags = [] } = useNoteTags()
  const updateNote = useUpdateNote()
  const setNoteTags = useSetNoteTags()
  const createTag = useCreateTag()
  const publishNote = usePublishNote()
  const unpublishNote = useUnpublishNote()
  const [newTagName, setNewTagName] = useState('')

  if (!note) return null
  const selectedTagIds = (note.tags ?? []).map(t => t.id)
  const publicUrl = note.is_public && note.public_slug ? `${window.location.origin}/p/notes/${note.public_slug}` : null

  function toggleTag(tagId) {
    const next = selectedTagIds.includes(tagId) ? selectedTagIds.filter(id => id !== tagId) : [...selectedTagIds, tagId]
    setNoteTags.mutate({ noteId: note.id, tagIds: next })
  }

  async function addTag() {
    if (!newTagName.trim()) return
    const res = await createTag.mutateAsync({ name: newTagName.trim() })
    setNoteTags.mutate({ noteId: note.id, tagIds: [...selectedTagIds, res.tag.id] })
    setNewTagName('')
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 overflow-y-auto">
        <SheetHeader><SheetTitle>Configuracion de nota</SheetTitle></SheetHeader>
        <div className="space-y-6 mt-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Icono</p>
            <div className="grid grid-cols-8 gap-1">
              {ICONS.map(icon => (
                <button key={icon} onClick={() => updateNote.mutate({ id: note.id, icon })}
                  className={`text-lg p-1 rounded ${note.icon === icon ? 'bg-amber-100 ring-1 ring-amber-400' : 'hover:bg-gray-100'}`}>{icon}</button>
              ))}
              <button onClick={() => updateNote.mutate({ id: note.id, icon: '' })} className="text-xs p-1 rounded hover:bg-gray-100 text-gray-400">X</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Color de fondo</p>
            <div className="flex flex-wrap gap-2">
              {BG_COLORS.map(c => (
                <button key={c.v ?? 'none'} onClick={() => updateNote.mutate({ id: note.id, backgroundColor: c.v })}
                  title={c.l}
                  className={`w-7 h-7 rounded-full border-2 ${note.background_color === c.v ? 'border-amber-500 scale-110' : 'border-gray-200'}`}
                  style={{ backgroundColor: c.v ?? '#ffffff' }} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Carpeta</p>
            <select value={note.folder_id ?? ''} onChange={e => updateNote.mutate({ id: note.id, folderId: e.target.value || null })}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
              <option value="">Sin carpeta</option>
              {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Etiquetas</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {tags.map(t => (
                <button key={t.id} onClick={() => toggleTag(t.id)}
                  className={`px-2 py-0.5 rounded-full text-xs font-medium border ${selectedTagIds.includes(t.id) ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'}`}
                  style={selectedTagIds.includes(t.id) ? { backgroundColor: t.color } : {}}>{t.name}</button>
              ))}
            </div>
            <div className="flex gap-1">
              <input type="text" value={newTagName} onChange={e => setNewTagName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addTag()}
                placeholder="Nueva etiqueta..." className="flex-1 text-sm border border-gray-200 rounded px-2 py-1" />
              <button onClick={addTag} className="px-2 py-1 text-sm bg-gray-100 rounded hover:bg-gray-200">+</button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Enlace publico</p>
            {note.is_public ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-xs text-green-700 flex-1 break-all">{publicUrl}</span>
                  <button onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success('Enlace copiado') }} className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded hover:bg-green-200">Copiar</button>
                </div>
                <button onClick={() => unpublishNote.mutate(note.id)} className="w-full text-sm text-red-500 hover:bg-red-50 p-1 rounded">Desactivar enlace</button>
              </div>
            ) : (
              <button onClick={() => publishNote.mutate(note.id)} className="w-full text-sm border border-dashed border-gray-300 rounded-lg p-2 hover:bg-gray-50 text-gray-600">
                Generar enlace publico
              </button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Create NoteShareModal.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/components/NoteShareModal.jsx
import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@atlas/ui'
import { useNoteShares, useShareNote, useRevokeShare } from '../hooks/useNoteShares.js'
import { useAtlas } from '../../../lib/atlas.js'

export function NoteShareModal({ open, onOpenChange, noteId }) {
  const { data: shares = [] } = useNoteShares(noteId)
  const shareNote = useShareNote()
  const revokeShare = useRevokeShare()
  const { atlas, token } = useAtlas()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  async function search(q) {
    setQuery(q)
    if (q.length < 2) { setResults([]); return }
    const res = await atlas.identity.listUsers(token, { q, pageSize: 8 })
    setResults(res.users ?? [])
  }

  function add(user, permission) {
    shareNote.mutate({ noteId, targetUserId: user.id, permission })
    setQuery(''); setResults([])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Compartir nota</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <input type="text" value={query} onChange={e => search(e.target.value)}
              placeholder="Buscar usuario por nombre o email..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            {results.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
                {results.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50">
                    <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-sm font-medium text-amber-700 shrink-0">
                      {u.displayName?.[0] ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.displayName}</p>
                      <p className="text-xs text-gray-500 truncate">{u.email}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => add(u, 'read')} className="text-xs px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200">Leer</button>
                      <button onClick={() => add(u, 'edit')} className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 hover:bg-amber-200">Editar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          {shares.length > 0 ? (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Con acceso</p>
              <div className="space-y-2">
                {shares.map(s => (
                  <div key={s.id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-sm font-medium text-gray-600 shrink-0">{s.display_name?.[0] ?? '?'}</div>
                    <p className="flex-1 text-sm font-medium truncate">{s.display_name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.permission === 'edit' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                      {s.permission === 'edit' ? 'Editor' : 'Lector'}
                    </span>
                    <button onClick={() => revokeShare.mutate({ noteId, shareId: s.id })} className="text-xs text-red-500 hover:text-red-700">Quitar</button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            !query && <p className="text-sm text-gray-500 text-center py-4">Esta nota no esta compartida con nadie</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteSettingsPanel.jsx \
        apps/desktop/src/modules/atlas.notes/components/NoteShareModal.jsx
git commit -m "feat(notes): add NoteSettingsPanel and NoteShareModal"
```

---

## Task 10: NotesScreen (Main Three-Panel Layout)

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/screens/NotesScreen.jsx`

- [ ] **Step 1: Create the screen**

```jsx
// apps/desktop/src/modules/atlas.notes/screens/NotesScreen.jsx
import { useState } from 'react'
import { NotesSidebar } from '../components/NotesSidebar.jsx'
import { NotesList } from '../components/NotesList.jsx'
import { NoteEditor } from '../components/NoteEditor.jsx'
import { NoteSettingsPanel } from '../components/NoteSettingsPanel.jsx'
import { NoteShareModal } from '../components/NoteShareModal.jsx'
import { useNotes, useCreateNote, useTrashNote, useUpdateNote } from '../hooks/useNotes.js'
import { useNote } from '../hooks/useNote.js'
import { ConfirmDialog } from '@atlas/ui'

function filterToParams(filter) {
  if (filter === 'shared') return { shared: true }
  if (filter === 'archived') return { archived: true }
  if (filter === 'trash') return { trashed: true }
  if (filter?.startsWith('folder:')) return { folderId: filter.slice(7) }
  if (filter?.startsWith('tag:')) return { tagId: filter.slice(4) }
  return {}
}

export default function NotesScreen() {
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)
  const [query, setQuery] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [trashConfirm, setTrashConfirm] = useState(null)

  const params = { ...filterToParams(filter), ...(query ? { q: query } : {}) }
  const { data: notes = [], isLoading } = useNotes(params)
  const { data: note } = useNote(selectedId)
  const createNote = useCreateNote()
  const trashNote = useTrashNote()
  const updateNote = useUpdateNote()

  async function handleCreate() {
    const res = await createNote.mutateAsync({ title: '', content: { type: 'doc', content: [] } })
    setSelectedId(res.note.id)
  }

  const isTrash = filter === 'trash'
  const readOnly = note && !note.is_owner && note.my_share_permission !== 'edit'

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 shrink-0 border-r border-gray-100 bg-white">
        <NotesSidebar activeFilter={filter} onFilterChange={f => { setFilter(f); setSelectedId(null) }} />
      </div>

      {/* Notes list */}
      <div className="w-68 shrink-0 border-r border-gray-100 bg-gray-50 flex flex-col" style={{ width: 272 }}>
        <div className="p-3 border-b border-gray-100 flex items-center gap-2">
          <input type="text" value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Buscar..." className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white" />
          {!isTrash && (
            <button onClick={handleCreate} disabled={createNote.isPending}
              className="shrink-0 w-8 h-8 bg-amber-400 hover:bg-amber-500 text-white rounded-lg font-bold text-xl leading-none flex items-center justify-center">
              +
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto">
          <NotesList notes={notes} selectedId={selectedId} onSelect={setSelectedId} loading={isLoading} />
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 flex flex-col bg-white">
        {note ? (
          <>
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 min-h-[40px]">
              <span className="text-xs text-gray-400">{note.word_count ?? 0} palabras</span>
              {!note.is_owner && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
                  Compartida — {note.my_share_permission === 'edit' ? 'editor' : 'lector'}
                </span>
              )}
              <div className="ml-auto flex gap-1">
                {!readOnly && <button onClick={() => setShareOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Compartir</button>}
                <button onClick={() => setSettingsOpen(true)} className="text-xs px-2 py-1 rounded hover:bg-gray-100">Ajustes</button>
                {note.is_owner && !isTrash && (
                  <button onClick={() => setTrashConfirm(note.id)} className="text-xs px-2 py-1 rounded hover:bg-red-50 text-red-500">Eliminar</button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              <NoteEditor noteId={selectedId} note={note} onTitleChange={title => updateNote.mutate({ id: selectedId, title })} readOnly={readOnly} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center"><p className="text-5xl mb-3">📝</p><p className="text-sm">Selecciona o crea una nota</p></div>
          </div>
        )}
      </div>

      <NoteSettingsPanel open={settingsOpen} onOpenChange={setSettingsOpen} note={note} />
      <NoteShareModal open={shareOpen} onOpenChange={setShareOpen} noteId={selectedId} />
      <ConfirmDialog open={Boolean(trashConfirm)} onOpenChange={() => setTrashConfirm(null)}
        title="Mover a papelera"
        description="La nota se movera a la papelera. Puedes restaurarla desde la seccion Papelera."
        onConfirm={() => { trashNote.mutate(trashConfirm); setSelectedId(null); setTrashConfirm(null) }}
        confirmLabel="Mover a papelera" />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/screens/NotesScreen.jsx
git commit -m "feat(notes): add three-panel NotesScreen"
```

---

## Task 11: PublicNoteScreen + Register All Routes

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/screens/PublicNoteScreen.jsx`
- Modify: `apps/desktop/src/app/ModuleOutlet.jsx`
- Modify: `apps/desktop/src/app/AppEntry.jsx`

- [ ] **Step 1: Create PublicNoteScreen.jsx**

```jsx
// apps/desktop/src/modules/atlas.notes/screens/PublicNoteScreen.jsx
import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAtlas } from '../../../lib/atlas.js'
import { NoteEditor } from '../components/NoteEditor.jsx'
import { ErrorState } from '@atlas/ui'

export default function PublicNoteScreen() {
  const { slug } = useParams()
  const { atlas } = useAtlas()

  const { data: note, isLoading, isError } = useQuery({
    queryKey: ['public-note', slug],
    queryFn: () => atlas.notes.getPublic(slug).then(r => r.note),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (isError || !note) return (
    <div className="flex items-center justify-center min-h-screen">
      <ErrorState title="Nota no disponible" description="Este enlace no existe o la nota ya no es publica." />
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto">
        {note.cover_url && <img src={note.cover_url} alt="" className="w-full h-56 object-cover" />}
        <NoteEditor noteId={null} note={note} readOnly />
        <div className="px-8 py-4 border-t border-gray-100 flex items-center gap-3 text-xs text-gray-400">
          <span>Escrita por {note.author_name}</span>
          <span>·</span>
          <span>{note.word_count} palabras</span>
          <span className="ml-auto">Publicada con Atlas ERP</span>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add entries to SCREEN_MAP in ModuleOutlet.jsx**

Open `apps/desktop/src/app/ModuleOutlet.jsx`. Find `const SCREEN_MAP = {` and add inside:

```javascript
"atlas.notes:/": lazy(() => import("../modules/atlas.notes/screens/NotesScreen.jsx")),
"atlas.notes:/notes": lazy(() => import("../modules/atlas.notes/screens/NotesScreen.jsx")),
```

- [ ] **Step 3: Add public route in AppEntry.jsx**

Open `apps/desktop/src/app/AppEntry.jsx`. Find the `/p` routes block. Check if there is a `PublicModuleOutlet` with a SCREEN_MAP or inline Route declarations.

**If PublicModuleOutlet has a static map**, open it and add:
```javascript
"notes/:slug": lazy(() => import("../modules/atlas.notes/screens/PublicNoteScreen.jsx")),
```

**If /p routes are inline Route elements** in AppEntry.jsx, add inside the `/p` block:
```jsx
// Add import at top of AppEntry.jsx:
const PublicNoteScreen = lazy(() => import('../modules/atlas.notes/screens/PublicNoteScreen.jsx'))

// Add inside <Route path="/p" ...>:
<Route path="notes/:slug" element={<PublicNoteScreen />} />
```

- [ ] **Step 4: Start dev server and verify**

```bash
pnpm dev:frontend
```

- Navigate to `http://localhost:5173/app/m/atlas.notes/notes` — three-panel layout should render
- "Notas" should appear in the main sidebar nav (requires `pnpm db:seed` to have run)
- Create a note, publish it, open `/p/notes/<slug>` in a new incognito tab — should render read-only

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/screens/PublicNoteScreen.jsx \
        apps/desktop/src/app/ModuleOutlet.jsx \
        apps/desktop/src/app/AppEntry.jsx
git commit -m "feat(notes): register notes routes and add public note screen at /p/notes/:slug"
```

---

## Verification Checklist

Run these manually in the browser after both Plan A and Plan B are complete:

- [ ] Create note → title saves on blur, content auto-saves after 1.5s
- [ ] Open same note in two browser tabs → type in one → appears in other within 2s (Y.js collab working)
- [ ] Insert drawing block → draw → strokes persist on page reload
- [ ] Insert image → hover "Anotar" → add arrow, rect, text annotations → reload → annotations persist
- [ ] Create folder "Trabajo" → move note → note lists under folder filter
- [ ] Create tag "importante" → assign → tag badge appears on NoteCard
- [ ] Set background color → NoteCard and editor reflect color
- [ ] Share note with another user (edit permission) → log in as that user → note visible under "Compartidas"
- [ ] Publish note → copy link → open in incognito → renders read-only at `/p/notes/<slug>`
- [ ] Trash note → open Papelera filter → note visible → restore works
- [ ] Check `apps/api/src/routes/notes/` files are under 1000 lines each (CLAUDE.md limit)
