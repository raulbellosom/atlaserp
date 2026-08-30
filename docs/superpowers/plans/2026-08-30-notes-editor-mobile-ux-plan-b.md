# Notes Editor Mobile UX — Plan B (Image Editing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make in-note image editing mobile-first: the annotation UI is off until the user taps "Editar imagen", all drawing tools work with touch, a free-hand pencil is added, and images can be cropped non-destructively through a responsive modal.

**Architecture:** Frontend-only. Pure geometry helpers go in a new `lib/imageCrop.js` (unit-tested). `AnnotatableImage` gains a `crop` node attribute (JSON in `data-crop`). `ImageAnnotationOverlay.jsx` is rewritten: `mode` state (`view` | `edit`), a floating "Editar imagen" control in view mode, Pointer Events for all drawing, a `pen` tool, and crop-aware rendering (an `overflow-hidden` wrapper + a windowed SVG `viewBox`). A new `ImageCropModal.jsx` built on `@atlas/ui` `Dialog` provides the cropper. `NoteToolbar.jsx` gets a mobile-friendly no-wrap layout.

**Tech Stack:** React 18, `@tiptap/react` v3, `@tiptap/core`, `@atlas/ui` (`Dialog`), Tailwind, Node built-in test runner.

**Spec:** `docs/superpowers/specs/2026-08-30-notes-editor-mobile-ux-design.md`

**Depends on:** Plan A (shared scroll container; `.tiptap img` rule is intentionally not `!important` so the crop wrapper can override `max-width`).

---

## File Structure

Create:
- `apps/desktop/src/modules/atlas.notes/lib/imageCrop.js` — pure helpers: `cropToViewBox`, `clampCropRect`, `applyAspectRatio`, `elementFracToImageSpace`.
- `apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js`
- `apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx` — the responsive cropper dialog.

Modify:
- `apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx` — add the `crop` attribute.
- `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx` — full rewrite (view/edit mode, Pointer Events, pen, crop rendering, modal wiring).
- `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx` — mobile no-wrap layout + larger tap targets.

---

## Task 1: Geometry helpers `lib/imageCrop.js` + tests

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/imageCrop.js`
- Test: `apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js`

All rectangles are `{ x, y, w, h }` with each value a fraction `0..1` of the
**original image** (`x,y` = top-left of the visible window).

- [ ] **Step 1: Write the failing test**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cropToViewBox,
  clampCropRect,
  applyAspectRatio,
  elementFracToImageSpace,
} from '../imageCrop.js'

test('cropToViewBox: null → full viewBox', () => {
  assert.equal(cropToViewBox(null), '0 0 1000 1000')
})

test('cropToViewBox: windows into the crop rect (×1000)', () => {
  assert.equal(cropToViewBox({ x: 0.1, y: 0.2, w: 0.5, h: 0.4 }), '100 200 500 400')
})

test('clampCropRect: clamps size and keeps the window inside the image', () => {
  assert.deepEqual(
    clampCropRect({ x: -0.2, y: 0.5, w: 1.5, h: 0.3 }),
    { x: 0, y: 0.5, w: 1, h: 0.3 },
  )
  assert.deepEqual(
    clampCropRect({ x: 0.9, y: 0.9, w: 0.3, h: 0.3 }),
    { x: 0.7, y: 0.7, w: 0.3, h: 0.3 },
  )
})

test('clampCropRect: enforces a minimum window size', () => {
  const r = clampCropRect({ x: 0.5, y: 0.5, w: 0.001, h: 0.001 })
  assert.ok(r.w >= 0.05 && r.h >= 0.05)
})

test('applyAspectRatio: null ratio just clamps', () => {
  assert.deepEqual(
    applyAspectRatio({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, null),
    { x: 0.1, y: 0.1, w: 0.6, h: 0.6 },
  )
})

test('applyAspectRatio: derives height from width for a fraction-space ratio', () => {
  assert.deepEqual(
    applyAspectRatio({ x: 0.1, y: 0.1, w: 0.6, h: 0.6 }, 2),
    { x: 0.1, y: 0.1, w: 0.6, h: 0.3 },
  )
})

test('elementFracToImageSpace: identity when there is no crop', () => {
  assert.deepEqual(
    elementFracToImageSpace({ x: 0.5, y: 0.5 }, null),
    { x: 0.5, y: 0.5 },
  )
})

test('elementFracToImageSpace: maps a fraction of the window into image space', () => {
  assert.deepEqual(
    elementFracToImageSpace({ x: 0.5, y: 0.5 }, { x: 0.2, y: 0.2, w: 0.4, h: 0.4 }),
    { x: 0.4, y: 0.4 },
  )
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js`
Expected: FAIL — `Cannot find module '../imageCrop.js'`.

- [ ] **Step 3: Write the helpers**

Create `apps/desktop/src/modules/atlas.notes/lib/imageCrop.js`:

```js
// Crop geometry helpers for note body images. All rects are
// { x, y, w, h } as fractions 0..1 of the ORIGINAL image.

const MIN_SIZE = 0.05

/** SVG viewBox string that windows annotation space into the crop rect. */
export function cropToViewBox(crop) {
  if (!crop) return '0 0 1000 1000'
  const { x, y, w, h } = crop
  return `${x * 1000} ${y * 1000} ${w * 1000} ${h * 1000}`
}

/** Clamp a rect to a valid window: min size, fully inside [0,1]×[0,1]. */
export function clampCropRect(rect) {
  const w = Math.min(1, Math.max(MIN_SIZE, rect.w))
  const h = Math.min(1, Math.max(MIN_SIZE, rect.h))
  const x = Math.min(1 - w, Math.max(0, rect.x))
  const y = Math.min(1 - h, Math.max(0, rect.y))
  return { x, y, w, h }
}

/**
 * Constrain a rect to an aspect ratio expressed in FRACTION space
 * (w_frac / h_frac). Keeps width, derives height. `ratio` null → just clamp.
 * The caller converts a pixel ratio to fraction space via natural dimensions.
 */
export function applyAspectRatio(rect, ratio) {
  if (!ratio) return clampCropRect(rect)
  let w = rect.w
  let h = w / ratio
  if (h > 1) {
    h = 1
    w = h * ratio
  }
  return clampCropRect({ x: rect.x, y: rect.y, w, h })
}

/**
 * Map a fraction of the displayed (possibly cropped) image element into
 * original-image space, so every stored annotation coordinate is
 * crop-independent.
 */
export function elementFracToImageSpace(frac, crop) {
  if (!crop) return { x: frac.x, y: frac.y }
  return {
    x: crop.x + frac.x * crop.w,
    y: crop.y + frac.y * crop.h,
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/imageCrop.js apps/desktop/src/modules/atlas.notes/lib/__tests__/image-crop.test.js
git commit -m "feat(notes): add image crop geometry helpers"
```

---

## Task 2: Add the `crop` attribute to `AnnotatableImage`

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx`

- [ ] **Step 1: Add the attribute**

In `addAttributes()`, add a `crop` entry after `annotations`:

```js
  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      annotations: { default: '[]' },
      crop: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-crop')
          if (!raw) return null
          try {
            return JSON.parse(raw)
          } catch {
            return null
          }
        },
        renderHTML: (attrs) =>
          attrs.crop ? { 'data-crop': JSON.stringify(attrs.crop) } : {},
      },
    }
  },
```

- [ ] **Step 2: Syntax-check**

Run: `npx --yes esbuild apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx --loader=jsx --bundle=false > /dev/null`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx
git commit -m "feat(notes): add crop attribute to the AnnotatableImage node"
```

---

## Task 3: `ImageCropModal.jsx` (new)

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx`

Context: `@atlas/ui` `Dialog` / `DialogContent` (from
`packages/ui/src/components/Dialog.jsx`) accept `size` (`"sm"|"md"|"lg"|"xl"|"2xl"`)
and `mobileVariant` (`"sheet"` default, or `"center"` for a centered box on
mobile too). The cropper uses `size="2xl" mobileVariant="center"`.

- [ ] **Step 1: Create the file**

Create `apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx`:

```jsx
import { useEffect, useRef, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@atlas/ui'
import { clampCropRect, applyAspectRatio } from '../lib/imageCrop.js'

const PRESETS = [
  { id: 'free', label: 'Libre', ratio: null },
  { id: '1', label: '1:1', ratio: 1 },
  { id: '43', label: '4:3', ratio: 4 / 3 },
  { id: '169', label: '16:9', ratio: 16 / 9 },
]

const DEFAULT_RECT = { x: 0.05, y: 0.05, w: 0.9, h: 0.9 }
const HANDLES = ['nw', 'ne', 'sw', 'se']

// Non-destructive image cropper. `crop` (nullable) is a rect in fractions of
// the original image; `onApply(rect|null)` receives the new crop (null clears).
export function ImageCropModal({ open, onOpenChange, src, crop, onApply }) {
  const areaRef = useRef(null)
  const gestureRef = useRef(null) // { mode, pointerId, start:{x,y}, startRect }
  const [rect, setRect] = useState(crop ?? DEFAULT_RECT)
  const [preset, setPreset] = useState('free')
  const [nat, setNat] = useState(null) // { w, h }

  useEffect(() => {
    if (open) {
      setRect(crop ?? DEFAULT_RECT)
      setPreset('free')
    }
    // Only reset on open/close transitions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Convert a pixel aspect ratio to fraction space using natural dimensions.
  function ratioFrac(pixelRatio) {
    if (!pixelRatio) return null
    if (!nat) return pixelRatio
    return pixelRatio * (nat.h / nat.w)
  }

  function selectPreset(p) {
    setPreset(p.id)
    setRect((r) => applyAspectRatio(r, ratioFrac(p.ratio)))
  }

  function pointerFrac(e) {
    const b = areaRef.current.getBoundingClientRect()
    return { x: (e.clientX - b.left) / b.width, y: (e.clientY - b.top) / b.height }
  }

  const startGesture = (mode) => (e) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    gestureRef.current = { mode, pointerId: e.pointerId, start: pointerFrac(e), startRect: rect }
  }

  function onAreaPointerMove(e) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    const now = pointerFrac(e)
    const dx = now.x - g.start.x
    const dy = now.y - g.start.y
    let next = { ...g.startRect }
    if (g.mode === 'move') {
      next.x = g.startRect.x + dx
      next.y = g.startRect.y + dy
      setRect(clampCropRect(next))
      return
    }
    if (g.mode.includes('e')) next.w = g.startRect.w + dx
    if (g.mode.includes('s')) next.h = g.startRect.h + dy
    if (g.mode.includes('w')) {
      next.x = g.startRect.x + dx
      next.w = g.startRect.w - dx
    }
    if (g.mode.includes('n')) {
      next.y = g.startRect.y + dy
      next.h = g.startRect.h - dy
    }
    const r = ratioFrac(PRESETS.find((p) => p.id === preset)?.ratio)
    setRect(r ? applyAspectRatio(next, r) : clampCropRect(next))
  }

  function endGesture(e) {
    const g = gestureRef.current
    if (!g || g.pointerId !== e.pointerId) return
    gestureRef.current = null
  }

  const pct = (v) => `${v * 100}%`

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="2xl" mobileVariant="center">
        <DialogHeader>
          <DialogTitle>Recortar imagen</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 mb-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPreset(p)}
              className={`px-3 h-9 rounded-lg text-xs font-medium border transition-colors ${
                preset === p.id
                  ? 'bg-amber-500 text-white border-amber-500'
                  : 'border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div
          ref={areaRef}
          className="relative w-full max-h-[60dvh] select-none overflow-hidden rounded-lg bg-[hsl(var(--muted))]"
          style={{ touchAction: 'none', aspectRatio: nat ? String(nat.w / nat.h) : '3 / 2' }}
          onPointerMove={onAreaPointerMove}
          onPointerUp={endGesture}
          onPointerCancel={endGesture}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 w-full h-full object-contain pointer-events-none"
            onLoad={(e) => setNat({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
          />

          <div className="absolute left-0 right-0 top-0 bg-black/50 pointer-events-none" style={{ height: pct(rect.y) }} />
          <div className="absolute left-0 right-0 bottom-0 bg-black/50 pointer-events-none" style={{ height: pct(1 - rect.y - rect.h) }} />
          <div className="absolute left-0 bg-black/50 pointer-events-none" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(rect.x) }} />
          <div className="absolute right-0 bg-black/50 pointer-events-none" style={{ top: pct(rect.y), height: pct(rect.h), width: pct(1 - rect.x - rect.w) }} />

          <div
            className="absolute border-2 border-white cursor-move"
            style={{ left: pct(rect.x), top: pct(rect.y), width: pct(rect.w), height: pct(rect.h), touchAction: 'none' }}
            onPointerDown={startGesture('move')}
          >
            {HANDLES.map((h) => (
              <button
                key={h}
                aria-label={`Ajustar esquina ${h}`}
                onPointerDown={startGesture(h)}
                className="absolute w-11 h-11 -m-5"
                style={{
                  left: h.includes('w') ? 0 : undefined,
                  right: h.includes('e') ? 0 : undefined,
                  top: h.includes('n') ? 0 : undefined,
                  bottom: h.includes('s') ? 0 : undefined,
                  touchAction: 'none',
                }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border border-black/20 shadow" />
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <button
            onClick={() => onApply(null)}
            className="px-3 h-9 rounded-lg text-xs font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] sm:mr-auto"
          >
            Restablecer
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-3 h-9 rounded-lg text-xs font-medium border border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
          >
            Cancelar
          </button>
          <button
            onClick={() => onApply(clampCropRect(rect))}
            className="px-4 h-9 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white"
          >
            Aplicar
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 2: Syntax-check**

Run: `npx --yes esbuild apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx --loader=jsx --bundle=false > /dev/null`
Expected: no error.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx
git commit -m "feat(notes): add responsive ImageCropModal"
```

---

## Task 4: Rewrite `ImageAnnotationOverlay.jsx`

**Files:**
- Modify (full rewrite): `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx`

- [ ] **Step 1: Replace the entire file**

Overwrite `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx` with:

```jsx
import { NodeViewWrapper } from '@tiptap/react'
import { useRef, useState } from 'react'
import { GripVertical, Pencil, Crop as CropIcon, Check } from 'lucide-react'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@atlas/ui'
import { findDropPosition, moveNode } from '../lib/dragReorder.js'
import { withImageVariant } from '../../../lib/imageVariants.js'
import { cropToViewBox, elementFracToImageSpace } from '../lib/imageCrop.js'
import { ImageCropModal } from './ImageCropModal.jsx'

const COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#1a1a1a', '#ffffff']
const TOOLS = [
  { id: 'pen', label: 'Lapiz' },
  { id: 'arrow', label: 'Flecha' },
  { id: 'rect', label: 'Recuadro' },
  { id: 'text', label: 'Texto' },
]
const W = 1000
const H = 1000

function parseCrop(raw) {
  if (!raw) return null
  if (typeof raw === 'object') return raw
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function ImageAnnotationOverlay({ node, updateAttributes, editor, getPos }) {
  const svgRef = useRef(null)
  const dragRef = useRef(null) // { pointerId, dropPos } — image reorder
  const drawRef = useRef(null) // { pointerId } — annotation drawing

  const [mode, setMode] = useState('view') // 'view' | 'edit'
  const [tool, setTool] = useState('pen')
  const [color, setColor] = useState('#ef4444')
  const [lineWidth, setLineWidth] = useState(3)
  const [draft, setDraft] = useState(null)
  const [textInput, setTextInput] = useState(null) // { screenX, screenY, svgX, svgY }
  const [dropIndicator, setDropIndicator] = useState(null) // { top, left, width }
  const [cropOpen, setCropOpen] = useState(false)
  const [natural, setNatural] = useState(null) // { w, h }

  const annotations = JSON.parse(node.attrs.annotations || '[]')
  const crop = parseCrop(node.attrs.crop)
  const editable = editor?.isEditable !== false
  const isEditing = editable && mode === 'edit'

  // ── image reorder drag handle (mouse + touch via Pointer Events) ─────────
  function getIndicatorRect(view, pos) {
    const { doc } = view.state
    const dom = pos < doc.content.size ? view.nodeDOM(pos) : null
    if (dom?.getBoundingClientRect) {
      const rect = dom.getBoundingClientRect()
      return { top: rect.top, left: rect.left, width: rect.width }
    }
    let lastDom = null
    doc.forEach((_n, offset) => {
      lastDom = view.nodeDOM(offset) ?? lastDom
    })
    if (lastDom?.getBoundingClientRect) {
      const rect = lastDom.getBoundingClientRect()
      return { top: rect.bottom, left: rect.left, width: rect.width }
    }
    const containerRect = view.dom.getBoundingClientRect()
    return { top: containerRect.top, left: containerRect.left, width: containerRect.width }
  }

  function onHandlePointerDown(e) {
    if (!editable || typeof getPos !== 'function') return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { pointerId: e.pointerId, dropPos: null }
  }
  function onHandlePointerMove(e) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const view = editor.view
    const dropPos = findDropPosition(view, e.clientY)
    dragRef.current.dropPos = dropPos
    setDropIndicator(getIndicatorRect(view, dropPos))
  }
  function onHandlePointerUp(e) {
    if (!dragRef.current || dragRef.current.pointerId !== e.pointerId) return
    const { dropPos } = dragRef.current
    dragRef.current = null
    setDropIndicator(null)
    if (dropPos !== null) moveNode(editor, getPos(), dropPos)
  }

  // ── annotation drawing (Pointer Events) ─────────────────────────────────
  function getPoint(e) {
    const rect = svgRef.current.getBoundingClientRect()
    const frac = {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
    return elementFracToImageSpace(frac, crop)
  }

  function onDrawPointerDown(e) {
    if (!isEditing || textInput) return
    e.preventDefault()
    const p = getPoint(e)
    if (tool === 'text') {
      const rect = svgRef.current.getBoundingClientRect()
      setTextInput({
        svgX: p.x,
        svgY: p.y,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      })
      return
    }
    svgRef.current.setPointerCapture(e.pointerId)
    drawRef.current = { pointerId: e.pointerId }
    if (tool === 'pen') setDraft({ type: 'path', color, lineWidth, points: [p] })
    else setDraft({ type: tool, color, lineWidth, start: p, end: p })
  }

  function onDrawPointerMove(e) {
    if (!drawRef.current || drawRef.current.pointerId !== e.pointerId) return
    const p = getPoint(e)
    setDraft((d) => {
      if (!d) return d
      if (d.type === 'path') {
        const last = d.points[d.points.length - 1]
        if (last && Math.hypot(p.x - last.x, p.y - last.y) < 0.004) return d
        return { ...d, points: [...d.points, p] }
      }
      return { ...d, end: p }
    })
  }

  function onDrawPointerUp(e) {
    if (!drawRef.current || drawRef.current.pointerId !== e.pointerId) return
    drawRef.current = null
    const d = draft
    setDraft(null)
    if (!d) return
    if (d.type === 'path' && d.points.length < 2) return
    updateAttributes({
      annotations: JSON.stringify([...annotations, { ...d, id: Date.now() }]),
    })
  }

  function commitTextInput(text) {
    if (text?.trim()) {
      const ann = {
        type: 'text',
        id: Date.now(),
        color,
        lineWidth,
        text: text.trim(),
        svgX: textInput.svgX,
        svgY: textInput.svgY,
      }
      updateAttributes({ annotations: JSON.stringify([...annotations, ann]) })
    }
    setTextInput(null)
  }

  function removeAnnotation(id) {
    updateAttributes({
      annotations: JSON.stringify(annotations.filter((a) => a.id !== id)),
    })
  }

  function exitEditMode() {
    setDraft(null)
    setTextInput(null)
    setMode('view')
  }

  // ── rendering ──────────────────────────────────────────────────────────
  function renderAnnotation(ann) {
    const clickable = isEditing ? 'cursor-pointer' : ''
    if (ann.type === 'path') {
      const pts = (ann.points || []).map((p) => `${p.x * W},${p.y * H}`).join(' ')
      return (
        <g key={ann.id} onClick={() => isEditing && removeAnnotation(ann.id)} className={clickable}>
          <polyline
            points={pts}
            fill="none"
            stroke={ann.color}
            strokeWidth={ann.lineWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {isEditing && (
            <polyline points={pts} fill="none" stroke="transparent" strokeWidth={Math.max(ann.lineWidth + 12, 16)} />
          )}
        </g>
      )
    }
    if (ann.type === 'arrow') {
      const x1 = ann.start.x * W
      const y1 = ann.start.y * H
      const x2 = ann.end.x * W
      const y2 = ann.end.y * H
      return (
        <g key={ann.id} onClick={() => isEditing && removeAnnotation(ann.id)} className={clickable}>
          <defs>
            <marker id={`ah-${ann.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill={ann.color} />
            </marker>
          </defs>
          <line
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={ann.color}
            strokeWidth={ann.lineWidth}
            markerEnd={`url(#ah-${ann.id})`}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )
    }
    if (ann.type === 'rect') {
      const x = Math.min(ann.start.x, ann.end.x) * W
      const y = Math.min(ann.start.y, ann.end.y) * H
      const w = Math.abs(ann.end.x - ann.start.x) * W
      const h = Math.abs(ann.end.y - ann.start.y) * H
      return (
        <rect
          key={ann.id}
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={ann.color}
          strokeWidth={ann.lineWidth}
          fill="none"
          vectorEffect="non-scaling-stroke"
          onClick={() => isEditing && removeAnnotation(ann.id)}
          className={clickable}
        />
      )
    }
    if (ann.type === 'text') {
      return (
        <text
          key={ann.id}
          x={ann.svgX * W}
          y={ann.svgY * H}
          fill={ann.color}
          fontSize={ann.lineWidth * 8 + 12}
          fontWeight="bold"
          fontFamily="sans-serif"
          onClick={() => isEditing && removeAnnotation(ann.id)}
          className={`select-none ${clickable}`}
        >
          {ann.text}
        </text>
      )
    }
    return null
  }

  function renderDraft() {
    if (!draft) return null
    if (draft.type === 'path') {
      const pts = draft.points.map((p) => `${p.x * W},${p.y * H}`).join(' ')
      return (
        <polyline
          points={pts}
          fill="none"
          stroke={draft.color}
          strokeWidth={draft.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    if (draft.type === 'arrow') {
      return (
        <line
          x1={draft.start.x * W}
          y1={draft.start.y * H}
          x2={draft.end.x * W}
          y2={draft.end.y * H}
          stroke={draft.color}
          strokeWidth={draft.lineWidth}
          strokeDasharray="6 3"
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    if (draft.type === 'rect') {
      const x = Math.min(draft.start.x, draft.end.x) * W
      const y = Math.min(draft.start.y, draft.end.y) * H
      const w = Math.abs(draft.end.x - draft.start.x) * W
      const h = Math.abs(draft.end.y - draft.start.y) * H
      return (
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          stroke={draft.color}
          strokeWidth={draft.lineWidth}
          fill="none"
          strokeDasharray="6 3"
          vectorEffect="non-scaling-stroke"
        />
      )
    }
    return null
  }

  const src = withImageVariant(node.attrs.src, 'content')
  const wrapperStyle = { userSelect: 'none' }
  const imgStyle = { display: 'block' }
  if (crop) {
    const ar = natural ? (crop.w * natural.w) / (crop.h * natural.h) : crop.w / crop.h
    wrapperStyle.aspectRatio = String(ar)
    Object.assign(imgStyle, {
      position: 'absolute',
      width: `${100 / crop.w}%`,
      left: `${(-crop.x / crop.w) * 100}%`,
      top: `${(-crop.y / crop.h) * 100}%`,
      maxWidth: 'none',
      height: 'auto',
    })
  } else {
    imgStyle.width = '100%'
    imgStyle.height = 'auto'
  }

  return (
    <NodeViewWrapper className="group/img relative my-2 block w-full">
      {isEditing && (
        <div className="flex items-center gap-1.5 py-1.5 px-2 bg-[hsl(var(--muted))] border border-[hsl(var(--border))] rounded-t text-xs flex-nowrap overflow-x-auto [-webkit-overflow-scrolling:touch]">
          <button
            title="Arrastrar para mover la imagen"
            className="flex items-center justify-center w-9 h-9 rounded text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground)/0.1)] hover:text-[hsl(var(--foreground))] cursor-grab active:cursor-grabbing shrink-0"
            style={{ touchAction: 'none' }}
            onPointerDown={onHandlePointerDown}
            onPointerMove={onHandlePointerMove}
            onPointerUp={onHandlePointerUp}
            onPointerCancel={onHandlePointerUp}
          >
            <GripVertical className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-[hsl(var(--border))] shrink-0" />
          {TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTool(t.id)}
              className={`px-2.5 h-9 rounded font-medium shrink-0 ${
                tool === t.id
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground)/0.1)]'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="h-5 w-px bg-[hsl(var(--border))] shrink-0" />
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 shrink-0 ${color === c ? 'border-amber-500 scale-110' : 'border-transparent'}`}
              style={{ backgroundColor: c === '#ffffff' ? '#f3f4f6' : c }}
            />
          ))}
          <div className="h-5 w-px bg-[hsl(var(--border))] shrink-0" />
          <Select value={String(lineWidth)} onValueChange={(v) => setLineWidth(Number(v))}>
            <SelectTrigger className="h-9 w-auto min-w-16 px-2 py-0 text-xs shrink-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 6, 8].map((w) => (
                <SelectItem key={w} value={String(w)}>
                  {w}px
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="h-5 w-px bg-[hsl(var(--border))] shrink-0" />
          <button
            onClick={() => setCropOpen(true)}
            className="flex items-center gap-1 px-2.5 h-9 rounded font-medium text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted-foreground)/0.1)] shrink-0"
          >
            <CropIcon className="w-3.5 h-3.5" /> Recortar
          </button>
          {annotations.length > 0 && (
            <button
              onClick={() => updateAttributes({ annotations: '[]' })}
              className="text-xs text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 px-2.5 h-9 rounded shrink-0"
            >
              Limpiar
            </button>
          )}
          <button
            onClick={exitEditMode}
            className="ml-auto flex items-center gap-1 px-3 h-9 rounded font-semibold bg-amber-500 hover:bg-amber-600 text-white shrink-0"
          >
            <Check className="w-3.5 h-3.5" /> Listo
          </button>
        </div>
      )}

      <div
        className={`relative rounded-b ${crop ? 'overflow-hidden' : ''}`}
        style={wrapperStyle}
      >
        <img
          src={src}
          alt={node.attrs.alt ?? ''}
          style={imgStyle}
          draggable={false}
          onLoad={(e) => setNatural({ w: e.target.naturalWidth, h: e.target.naturalHeight })}
        />
        <svg
          ref={svgRef}
          viewBox={cropToViewBox(crop)}
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full"
          style={{
            touchAction: 'none',
            pointerEvents: isEditing ? 'auto' : 'none',
            cursor: isEditing ? (tool === 'text' ? 'text' : 'crosshair') : 'default',
          }}
          onPointerDown={isEditing ? onDrawPointerDown : undefined}
          onPointerMove={isEditing ? onDrawPointerMove : undefined}
          onPointerUp={isEditing ? onDrawPointerUp : undefined}
          onPointerCancel={isEditing ? onDrawPointerUp : undefined}
        >
          {annotations.map(renderAnnotation)}
          {renderDraft()}
        </svg>

        {textInput && (
          <input
            autoFocus
            type="text"
            placeholder="Escribe una anotacion..."
            className="absolute bg-[hsl(var(--background))] text-[hsl(var(--foreground))] border border-amber-400 dark:border-amber-600 rounded px-2 py-1 text-sm shadow-lg outline-none z-10"
            style={{ left: textInput.screenX, top: textInput.screenY, minWidth: 180 }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitTextInput(e.target.value)
              if (e.key === 'Escape') setTextInput(null)
            }}
            onBlur={(e) => commitTextInput(e.target.value)}
          />
        )}

        {editable && mode === 'view' && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover/img:opacity-100 transition-opacity">
            <button
              onClick={() => setMode('edit')}
              className="flex items-center gap-1.5 text-xs font-medium bg-[hsl(var(--background)/0.9)] backdrop-blur-sm border border-[hsl(var(--border))] rounded-lg px-2.5 py-1.5 shadow-sm hover:bg-[hsl(var(--muted))] transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" /> Editar imagen
            </button>
            <button
              title="Arrastrar para mover la imagen"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-[hsl(var(--background)/0.9)] backdrop-blur-sm border border-[hsl(var(--border))] shadow-sm text-[hsl(var(--muted-foreground))] cursor-grab active:cursor-grabbing"
              style={{ touchAction: 'none' }}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
            >
              <GripVertical className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {dropIndicator && (
        <div
          className="fixed h-0.5 bg-amber-500 rounded-full z-50 pointer-events-none"
          style={{ top: dropIndicator.top, left: dropIndicator.left, width: dropIndicator.width }}
        />
      )}

      {cropOpen && (
        <ImageCropModal
          open={cropOpen}
          onOpenChange={setCropOpen}
          src={src}
          crop={crop}
          onApply={(next) => {
            updateAttributes({ crop: next })
            setCropOpen(false)
          }}
        />
      )}
    </NodeViewWrapper>
  )
}
```

- [ ] **Step 2: Syntax-check**

Run: `npx --yes esbuild apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx --loader=jsx --bundle=false > /dev/null`
Expected: no error.

- [ ] **Step 3: Run the notes lib tests (imports resolve)**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/`
Expected: PASS — Plan A + Task 1 tests.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx
git commit -m "feat(notes): tap-to-edit image annotations, pointer/touch drawing, free-hand pen, crop rendering"
```

---

## Task 5: `NoteToolbar.jsx` mobile no-wrap layout

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx:142-143` (the root `<div>` of the returned toolbar)

Context: today the toolbar root is
`className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-background/90 backdrop-blur-sm flex-wrap sticky top-0 z-10 shadow-sm"`.
On a phone `flex-wrap` stacks the buttons into 3–4 cramped rows. Switch to a
single horizontally-scrollable row.

- [ ] **Step 1: Change the root className**

Replace that `className` string with:

```jsx
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-border bg-background/90 backdrop-blur-sm flex-nowrap overflow-x-auto [-webkit-overflow-scrolling:touch] sm:flex-wrap sm:overflow-visible sticky top-0 z-10 shadow-sm">
```

- [ ] **Step 2: Keep dividers from collapsing**

In the `Divider` component (lines 53-55), add `shrink-0` so dividers keep
width inside the scroll row:

```jsx
function Divider() {
  return <div className="h-5 w-px bg-border mx-0.5 shrink-0" />
}
```

- [ ] **Step 3: Keep buttons from shrinking + bump the phone tap target**

In `ToolbarButton` (lines 34-51), replace the first string entry of the
className array so buttons never shrink and are 32px tall on phones, 28px on
`sm+` (unchanged desktop):

```jsx
      className={[
        'h-8 min-w-8 sm:h-7 sm:min-w-7 px-1.5 rounded flex items-center justify-center gap-1 text-sm transition-colors select-none shrink-0',
```

- [ ] **Step 4: Syntax-check**

Run: `npx --yes esbuild apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx --loader=jsx --bundle=false > /dev/null`
Expected: no error.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx
git commit -m "fix(notes): single scrollable toolbar row on phones instead of cramped wrap"
```

---

## Task 6: Build, lint, and manual QA

**Files:** none (verification only)

- [ ] **Step 1: Run every notes unit test**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/`
Expected: PASS — `trailing-node`, `placeholder-text` (Plan A), `image-crop`.

- [ ] **Step 2: Lint**

Run: `pnpm lint 2>&1 | tail -40`
Expected: no new errors under `apps/desktop/src/modules/atlas.notes/**`.

- [ ] **Step 3: Production build of the frontend**

Run: `pnpm --filter @atlas/desktop build 2>&1 | tail -40` (or `pnpm build` from
root). Expected: build succeeds; no unresolved-import or JSX errors from the
notes module.

- [ ] **Step 4: Manual QA — `pnpm dev:frontend`, record pass/fail**

At 390px and 1440px width, light and dark:

1. **View mode default:** open a note with an image. No annotation toolbar is
   shown. Hover (desktop) / look (mobile): the `Editar imagen` pill +
   drag-handle appear bottom-right. Clicking on the image places the text
   caret / lets the page scroll — it does not start a drawing.
2. **Enter edit mode:** tap `Editar imagen`. The toolbar appears as one
   horizontally-scrollable row. Tap `Listo` — toolbar disappears, back to a
   clean image.
3. **Touch drawing:** in edit mode, with a finger / trackpad drag: `Lapiz`
   draws a free-hand line; `Flecha` draws an arrow; `Recuadro` draws a
   rectangle; `Texto` opens the inline input at the tap point and Enter
   commits it. Tapping an existing annotation deletes it. `Limpiar` removes
   all.
4. **Crop:** in edit mode tap `Recortar`. The modal opens (near-full-screen
   on mobile, centered on desktop). Drag the crop rectangle and its corner
   handles with touch; try the `1:1` / `4:3` / `16:9` presets. `Aplicar` —
   the image in the note now shows only the cropped window and existing
   annotations stay aligned to their image features. Re-open `Recortar` →
   `Restablecer` → the full image is back.
5. **Reorder still works:** drag the grip handle (view mode pill or edit
   toolbar) up/down — the amber drop indicator shows and the image moves.
6. **Public view:** open the note's public share link. A cropped image
   renders cropped; annotations render; no console errors. (`PublicNoteScreen`
   reuses `NoteEditor` → same node view, so no separate change is needed —
   just confirm.)
7. **Collab:** open the same note in two tabs; enter edit mode in one, draw
   and crop — the other tab reflects the new `annotations` / `crop` within a
   second (same Yjs attribute sync as before).

- [ ] **Step 5: Commit any QA fixes**

```bash
git add -A
git commit -m "test(notes): Plan B manual QA pass for image-editing mobile fixes" --allow-empty
```

---

## Self-Review (author checklist — completed)

- **Spec coverage:** point 2 (tap-to-edit) → Task 4 (`mode` state, floating
  control, `pointerEvents` gate); point 3 (touch tools + pen) → Task 1
  (`elementFracToImageSpace`) + Task 4 (Pointer Events, `pen` tool); crop
  (non-destructive) → Task 1 (`cropToViewBox`, `clampCropRect`,
  `applyAspectRatio`) + Task 2 (`crop` attr) + Task 3 (`ImageCropModal`) +
  Task 4 (crop-aware wrapper + windowed `viewBox`); cross-cutting mobile
  polish → Task 4 (annotation toolbar `flex-nowrap`, 36px targets) + Task 5
  (`NoteToolbar`). Public render → Task 6 Step 4.6 (verify only).
- **Placeholder scan:** none — both new components and the rewrite are given
  in full; every command has expected output.
- **Type consistency:** helper signatures `cropToViewBox(crop)`,
  `clampCropRect(rect)`, `applyAspectRatio(rect, ratio)`,
  `elementFracToImageSpace(frac, crop)` are used identically in
  `ImageCropModal.jsx` (Task 3) and `ImageAnnotationOverlay.jsx` (Task 4).
  Annotation object shapes: `{ type:'path', color, lineWidth, points:[{x,y}], id }`,
  `{ type:'arrow'|'rect', color, lineWidth, start:{x,y}, end:{x,y}, id }`,
  `{ type:'text', color, lineWidth, text, svgX, svgY, id }` — consistent
  between `onDraw*`, `commitTextInput`, `renderAnnotation`, `renderDraft`.
  `crop` object shape `{ x, y, w, h }` consistent between the node attr,
  modal, and overlay.
- **Known minor visual change:** annotation strokes now use
  `vectorEffect="non-scaling-stroke"`, so `lineWidth` is screen pixels rather
  than stretched viewBox units — pre-existing annotations render with
  slightly crisper/thinner strokes. Acceptable (more predictable); noted for
  the reviewer.
