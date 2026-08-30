# Notes Editor — Mobile-First UX Fixes

- Status: Approved (design)
- Date: 2026-08-30
- Module: `atlas.notes` (frontend only)
- Author: Raul Belloso Medina

## Problem

Field feedback on the `atlas.notes` editor, primarily on phones:

1. A blank note gives the user nowhere obvious to start writing — the first
   line is the title, and there is no muted hint for the body.
2. The image annotation toolbar is shown permanently whenever the note is
   editable, instead of only when the user chooses to edit that image.
3. The image annotation tools (arrow / box / text) do not work on touch
   devices at all, and there is no free-hand pencil.
4. The user cannot place the cursor below a trailing image to keep writing,
   and tall images look "cut off".
5. After adding a cover, scrolling hides it and it can never be seen again.

Underlying causes found in the code:

- `lib/editor-extensions.js` — `Placeholder` returns `''` for every block
  that is not the first node or a heading, so an empty body paragraph has no
  hint. There is no trailing-node guarantee, so a fresh note is a single
  paragraph (the title) with no body block at all.
- `components/NoteEditor.jsx` — `EditorProvider` is wrapped in
  `flex flex-col h-full overflow-hidden` with **no** scrollable element
  inside. Content taller than the pane (including the cover in `slotBefore`)
  is clipped, not scrollable.
- `components/ImageAnnotationOverlay.jsx` — the annotation toolbar renders
  whenever `editor.isEditable !== false`. The drawing `<svg>` binds only
  `onMouseDown/onMouseMove/onMouseUp`, which do not fire for touch, and it
  has no `touch-action: none`. There is no free-hand tool.
- `lib/extensions/AnnotatableImage.jsx` — the image node is `atom: true`
  with no trailing-node behaviour, so a trailing image leaves no cursor
  target after it.

## Goals

- A blank note shows a muted "start writing" hint in the body.
- The image annotation UI is off by default and entered explicitly per image.
- All annotation tools work with pointer / touch input, plus a free-hand
  pencil.
- The editor content area is a real scroll container; the cover scrolls with
  the content Notion-style and is reachable again by scrolling up.
- The user can always type below a trailing image.
- Non-destructive image cropping via a responsive modal.
- Cross-cutting: toolbars and drawing surfaces are usable on phones (large
  tap targets, no broken wrap, momentum horizontal scroll).

## Non-goals

- No backend, API, validator, or Prisma changes.
- No change to the Yjs collaboration model, autosave, or share/publish flow.
- No destructive crop (re-upload). Crop is stored as node attributes.
- No expanded drawing set (line / ellipse / highlighter) — deferred.
- No change to the cover upload / presign flow itself.

## Design

### Shared plumbing

#### TrailingNode extension (new) — `lib/extensions/TrailingNode.js`

A small TipTap extension that, via `appendTransaction`, ensures the document
always ends with an empty `paragraph`. Registered in `buildExtensions`
(`lib/editor-extensions.js`) for both editable and read-only builds (harmless
read-only; keeps rendered HTML consistent).

This single extension enables:

- Point 1: a fresh note now has a real empty body paragraph under the title,
  which the placeholder can target.
- Point 4: a trailing image is always followed by a paragraph, giving the
  cursor a landing spot.

Guard against infinite loops: only append when `doc.lastChild` is not an
empty paragraph, and skip when the transaction already did so.

#### Real scroll container — `components/NoteEditor.jsx`

Restructure the render:

```
<div ref={containerRef} class="flex flex-col h-full overflow-hidden">
  <div class="flex-1 min-h-0 overflow-y-auto overscroll-contain">
    <EditorProvider
      slotBefore={<> NoteCoverBanner, NoteToolbar, icon+presence row </>}
      ... unchanged ...
    />
  </div>
</div>
```

- The inner `overflow-y-auto` div is the scroll container. All
  `EditorProvider` siblings (cover, toolbar, icon row, `.tiptap`) live inside
  it, so cover + body scroll together and scrolling up reveals the cover.
- `NoteToolbar` stays in `slotBefore` (it needs `useCurrentEditor()`), and
  its container gets `sticky top-0 z-20` so it pins to the top of the scroll
  area once the cover scrolls past.
- `containerRef` stays on the outer div; the existing touch→mouse bridge for
  column-resize handles is unchanged.

### 1 — Blank note has nowhere to start

- `TrailingNode` provides the empty body paragraph.
- `Placeholder.configure` callback in `lib/editor-extensions.js`:
  - first node → `Sin título` (keeps existing title-size styling in
    `styles.css`).
  - `node.type.name === 'heading'` → `Título…` (unchanged).
  - an empty `paragraph` that is **not** the first child, when
    `editor.state.doc.childCount <= 2` → `Empieza a escribir, o pulsa «/» para comandos`.
  - otherwise → `''`.
  - `showOnlyCurrent: false` stays.
- Autosave in `NoteEditor.jsx` `handleUpdate`: when `firstLineText` is empty,
  send `patch.title = ''` (currently the key is simply omitted, leaving the
  stale `"Nueva nota"`). The list already renders `title || 'Sin titulo'`.
- `styles.css`: add the muted body-placeholder rule for
  `.tiptap p:not(:first-child).is-empty::before` (normal body size, muted
  colour) — distinct from the existing title-size first-child rule.

### 2 — Annotation bar: tap to edit

`components/ImageAnnotationOverlay.jsx` gains local state
`mode: 'view' | 'edit'` (default `'view'`).

- **View mode (default):**
  - Toolbar is not rendered.
  - The drawing `<svg>` gets `pointer-events: none` so cursor placement,
    selection, and scrolling work over the image.
  - One floating pill, bottom-right of the image, visible on hover (desktop)
    and always on touch: `Editar imagen` (pencil icon) button + the existing
    `GripVertical` drag handle. The drag-to-reorder pointer handlers are
    unchanged.
- **Edit mode:**
  - Toolbar renders: `Lápiz` / `Flecha` / `Recuadro` / `Texto`, colour
    swatches, grosor `Select`, `Recortar` (opens the crop modal), `Limpiar`
    (when annotations exist), and `Listo` (returns to view mode).
  - `<svg>` is interactive (`pointer-events: auto`).
  - Entering edit mode does not select the node in ProseMirror (avoid the
    node-selection outline fighting the overlay).
- Toolbar layout for phones: a single row, `flex-nowrap overflow-x-auto`
  with `-webkit-overflow-scrolling: touch`, buttons ≥ 40px tall, colour
  swatches 28px. No `flex-wrap`.

### 3 — Touch drawing + free-hand pencil

In `components/ImageAnnotationOverlay.jsx`:

- Replace `onMouseDown/onMouseMove/onMouseUp/onMouseLeave` on `<svg>` with
  `onPointerDown/onPointerMove/onPointerUp/onPointerCancel`, using
  `e.currentTarget.setPointerCapture(e.pointerId)` on down and matching
  `pointerId` on move/up. Add `style={{ touchAction: 'none' }}` to the svg.
- `getSvgPos` stays client-rect based (`PointerEvent` has `clientX/clientY`),
  but when a `crop` is active it maps the element-relative fraction into
  original-image normalized space: `x = cropX + frac * cropW`,
  `y = cropY + frac * cropH`. So every annotation (pen included) is always
  stored in original-image space, and the windowed `viewBox` is what makes it
  display correctly whether cropped or not.
- New tool `pen`:
  - On down: start `draft = { type: 'path', color, lineWidth, points: [pt] }`.
  - On move: append normalized points (throttle to ~1 per frame via
    `requestAnimationFrame` or a small distance threshold to bound array
    size).
  - On up: push to `annotations` with an `id`.
  - Render: `<polyline points fill="none" stroke strokeWidth
    strokeLinecap="round" strokeLinejoin="round" />` in both
    `renderAnnotation` and `renderDraft`; delete-on-click via a transparent
    wide `<polyline>` hit area, mirroring the existing arrow `<g onClick>`.
- Tool order in the toolbar: `Lápiz`, `Flecha`, `Recuadro`, `Texto`.
- The text tool's inline `<input>` (already replacing `window.prompt`) is
  kept; its position math already uses `clientX/clientY` and is
  pointer-compatible.

### 4 — Type below image / not "cut off"

- Scroll container (shared plumbing) lets tall images be scrolled past — the
  "cut" appearance was the pane clipping with no scroll.
- `TrailingNode` gives the cursor a target after a trailing image.
- `components/ImageAnnotationOverlay.jsx` `NodeViewWrapper`: `block w-full`
  (was `inline-block`), remove any height constraint.
- `styles.css`: `.tiptap img { max-width: 100%; height: auto; display: block; }`
  (scoped so it does not fight the crop wrapper — see below).
- `content` image variant is already width-only (no crop); no change.

### 5 — Cover reachable after scroll

- `NoteCoverBanner` stays in `slotBefore`, first in DOM order, and scrolls
  with the content (user's choice).
- With the scroll container fixed, scrolling up brings it back.
- `NoteToolbar` `sticky top-0` keeps it usable after the cover scrolls off.
- No change to `NoteCoverBanner.jsx` itself beyond confirming it needs none.

### Crop — non-destructive

#### Node attribute — `lib/extensions/AnnotatableImage.jsx`

Add attribute `crop` with `default: null`. Shape when set:
`{ x, y, w, h }`, each a number in `0..1` relative to the original image
(`x,y` = top-left of the visible window, `w,h` = its size). Parsed/rendered
via `data-crop` JSON on the `img` (or a wrapping element) in `parseHTML` /
`renderHTML` so it round-trips through stored note HTML and
`PublicNoteScreen`.

#### Rendering — `components/ImageAnnotationOverlay.jsx`

When `crop` is set:

- Wrapper element: `overflow: hidden`, `aspect-ratio: (w*naturalW)/(h*naturalH)`
  — computed from the loaded image's `naturalWidth/naturalHeight` (fallback
  to `w/h` ratio before load).
- `img`: `position: absolute; width: (100/w)%; left: -(x/w)*100%;
  top: -(y/h)*100%; height: auto; max-width: none;` (the `max-width:none`
  override is why the `.tiptap img` rule above must not use `!important`).
- Annotation `<svg>` overlays the wrapper with
  `viewBox="{x*1000} {y*1000} {w*1000} {h*1000}"` and
  `preserveAspectRatio="none"`, so stored annotation coordinates (authored in
  original-image normalized space, ×1000) need no transformation.

When `crop` is `null`: current full-image rendering, `viewBox="0 0 1000 1000"`.

#### Crop modal (new) — `components/ImageCropModal.jsx`

- Built on `Dialog` from `@atlas/ui`. Full-screen on mobile
  (`max-w-none h-[100dvh]`), centered on desktop.
- Shows the original (uncropped) image with a draggable + resizable crop
  rectangle overlay. Handles are 44px pointer targets (corners + edges),
  Pointer Events, `touch-action: none`, `setPointerCapture`.
- Aspect presets: `Libre`, `1:1`, `4:3`, `16:9` (segmented control). When a
  ratio is locked, resizing constrains to it.
- Footer: `Restablecer` (clears crop), `Cancelar`, `Aplicar`.
- On `Aplicar`: `updateAttributes({ crop: { x, y, w, h } })`. On
  `Restablecer` + `Aplicar` (or a dedicated action):
  `updateAttributes({ crop: null })`.
- The original image and all annotations are preserved regardless.

#### Public render — `PublicNoteScreen.jsx`

Verify the read-only render path uses the same `AnnotatableImage` /
`ImageAnnotationOverlay` (or shares the crop CSS). If it renders raw HTML
instead, add the crop wrapper CSS so `data-crop` images display cropped in
the public view. Confirmed during implementation.

### Cross-cutting mobile polish

- Every pointer-driven surface (annotation `<svg>`, crop handles): Pointer
  Events + `touch-action: none` + `setPointerCapture`.
- `NoteToolbar.jsx`: on small screens use `flex-nowrap overflow-x-auto` with
  momentum scroll instead of `flex-wrap`; keep `sticky top-0`. Tap targets
  stay ≥ 32px (they are `h-7` = 28px today — bump to `h-8`/`min-w-8` on
  `max-sm`).
- Annotation toolbar + crop modal controls: ≥ 40px tap targets, 28px colour
  swatches.
- Use `100dvh` (not `100vh`) for the full-screen crop modal to avoid the
  mobile browser chrome gap.

## Components / files

New:

- `apps/desktop/src/modules/atlas.notes/lib/extensions/TrailingNode.js`
- `apps/desktop/src/modules/atlas.notes/components/ImageCropModal.jsx`

Changed:

- `apps/desktop/src/modules/atlas.notes/lib/editor-extensions.js`
- `apps/desktop/src/modules/atlas.notes/lib/extensions/AnnotatableImage.jsx`
- `apps/desktop/src/modules/atlas.notes/components/ImageAnnotationOverlay.jsx`
- `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx`
- `apps/desktop/src/modules/atlas.notes/components/NoteToolbar.jsx`
- `apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx` (verify / crop CSS)
- `apps/desktop/src/styles.css`

## Data / compatibility

- `crop` defaults to `null`; existing notes are unaffected.
- `type: 'path'` annotations are additive to the existing `annotations` JSON
  array; older renderers ignore unknown types (they already `return null`).
- `TrailingNode` may append one empty paragraph to existing notes on first
  open; this is saved on the next autosave and is visually inert.
- No migration.

## Testing

Node's built-in runner (`node --test`), matching repo convention. Pure-logic
units only; DOM/TipTap interaction is verified manually.

- `TrailingNode`: given a doc whose last node is an image / heading / empty
  paragraph, `appendTransaction` yields a doc ending in exactly one empty
  paragraph; idempotent on re-run.
- Crop geometry helper (extracted from `ImageCropModal`): rect ↔
  `{x,y,w,h}` normalization, aspect-ratio constraint, clamp to `[0,1]`.
- `viewBox` string builder: `crop` → `"x y w h"` (×1000), `null` →
  `"0 0 1000 1000"`.
- Placeholder callback: returns the body hint only for a non-first empty
  paragraph when `childCount <= 2`.

Manual QA (per `docs/ai-context/ui-screen-audit-checklist.md`), screenshots
at 390px and 1440px (both themes):

- New note: body placeholder visible; can type body without touching title.
- Insert image mid-note and as the last block; type below it; scroll past a
  tall image.
- Image view mode: no toolbar; tap `Editar imagen`; draw with pen / arrow /
  box / text using touch; `Listo` restores the clean view.
- Crop: open modal, drag/resize with touch, presets, `Aplicar`; annotations
  still aligned; `Restablecer` returns to full image.
- Add cover, scroll down (toolbar pins), scroll up (cover returns).
- Public share view renders a cropped image correctly.

## Implementation plan split

- **Plan A — editor core:** `TrailingNode`, scroll-container restructure,
  placeholder + empty-title autosave, image sizing CSS. Covers points 1, 4,
  5.
- **Plan B — image editing:** annotation view/edit mode + floating control,
  Pointer Events + free-hand pen, `crop` attr + CSS rendering +
  `ImageCropModal`, public-render check, mobile toolbar polish. Covers points
  2, 3, and crop.

Plan B depends on Plan A (shared scroll container and image-wrapper class
changes).
