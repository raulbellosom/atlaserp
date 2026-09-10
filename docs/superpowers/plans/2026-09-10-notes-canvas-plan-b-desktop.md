# Notes Canvas — Plan B (Desktop) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the desktop UI for the collaborative canvas note type: an Excalidraw-based editor with an Illustrator-style layers panel, real-time sync over Supabase Realtime broadcast, image upload to Supabase Storage, PNG/SVG export, grid/snap, a live read-only public view, and mobile support.

**Architecture:** A canvas note (`note.note_type === 'canvas'`) renders `<CanvasEditor>` instead of `<NoteEditor>`. `CanvasEditor` holds the full element list in a ref (source of truth), passes a *derived* scene to a lazily-loaded `<Excalidraw>` (hidden/locked/opacity applied per layer), and syncs changed elements over a `SupabaseCanvasSync` broadcast channel using Excalidraw's `reconcileElements`. Scene persists via the Plan A `PUT /notes/:id/canvas`. The public view (`PublicCanvasView`) seeds from `GET /public/notes/:slug/canvas` and subscribes to the same channel in read-only mode.

**Tech Stack:** React 18, Vite, `@excalidraw/excalidraw` (pinned, lazy), `@supabase/supabase-js` Realtime, TanStack Query, `@atlas/ui`, `node:test`.

**Depends on:** Plan A (migration, `canvas-service`, routes, SDK methods `atlas.notes.getCanvas/saveCanvas/getPublicCanvas`).

**Reference:** `docs/superpowers/specs/2026-09-10-notes-canvas-design.md` (sections 4, 5, 7-11).

---

## File Structure

- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasLayers.js` — pure layer helpers.
- Create: `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`.
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasSync.js` — pure sync helpers (`diffElements`, `mergeDelta`, `throttle`).
- Create: `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`.
- Create: `apps/desktop/src/modules/atlas.notes/lib/SupabaseCanvasSync.js` — the realtime provider class.
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasExport.js` — PNG/SVG export + download.
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasImages.js` — upload new Excalidraw files to Storage, hydrate on load.
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useCanvasScene.js` — query/mutation hooks.
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasEditor.jsx` — the editor shell.
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasStage.jsx` — the `<Excalidraw>` wrapper (lazy boundary).
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasLayersPanel.jsx` — the layers panel (rail + sheet).
- Create: `apps/desktop/src/modules/atlas.notes/PublicCanvasView.jsx` — live read-only public view.
- Create: `apps/desktop/src/modules/atlas.notes/lib/__tests__/excalidraw-imports.test.js` — smoke test for semi-internal exports.
- Modify: `apps/desktop/package.json` — add `@excalidraw/excalidraw`.
- Modify: `apps/desktop/src/modules/atlas.notes/NotesScreen.jsx` — create menu, editor branch, layers toggle.
- Modify: `apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx` — branch on `note_type`.
- Modify: `apps/desktop/src/modules/atlas.notes/hooks/useNotes.js` — `useCreateNote` passes `noteType` (already forwards `data`, so verify only).
- Modify: `apps/desktop/src/modules/atlas.notes/components/NotesList.jsx` + `components/NoteCard.jsx` + `noteIcons.jsx` — canvas icon + badge.

---

## Task 1: Add the Excalidraw dependency + import smoke test

**Files:**
- Modify: `apps/desktop/package.json`
- Create: `apps/desktop/src/modules/atlas.notes/lib/__tests__/excalidraw-imports.test.js`

- [ ] **Step 1: Find the latest stable version**

Run: `npm view @excalidraw/excalidraw version`
Record it as `<EXC_VERSION>` (e.g. `0.17.6`). Pin it EXACTLY (no `^`).

- [ ] **Step 2: Add and install**

Run: `pnpm --filter @atlas/desktop add @excalidraw/excalidraw@<EXC_VERSION>`
Expected: added to `apps/desktop/package.json` `dependencies` with the exact version, lockfile updated.

- [ ] **Step 3: Write the import smoke test**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/excalidraw-imports.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'

// These are the exports Plan B depends on. If a version bump moves or
// renames them, this fails loudly instead of at runtime in the browser.
test('@excalidraw/excalidraw exposes the exports we rely on', async () => {
  const mod = await import('@excalidraw/excalidraw')
  assert.equal(typeof mod.reconcileElements, 'function')
  assert.equal(typeof mod.exportToBlob, 'function')
  assert.equal(typeof mod.exportToSvg, 'function')
  assert.equal(typeof mod.Excalidraw, 'function')
})
```

- [ ] **Step 4: Run it**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/excalidraw-imports.test.js`
Expected: PASS. If `reconcileElements` is not a top-level export in `<EXC_VERSION>`, check `@excalidraw/excalidraw` docs for the correct path and update the spec + this test + later imports accordingly before continuing.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/package.json pnpm-lock.yaml apps/desktop/src/modules/atlas.notes/lib/__tests__/excalidraw-imports.test.js
git commit -m "chore(notes): add pinned @excalidraw/excalidraw + import smoke test"
```

---

## Task 2: `canvasLayers.js` pure helpers

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasLayers.js`
- Test: `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultLayer,
  ensureLayers,
  assignLayer,
  deriveScene,
  reorderLayer,
  mergeDown,
  duplicateLayer,
} from '../canvasLayers.js'

const L = (id, over = {}) => ({ id, name: id, visible: true, locked: false, opacity: 1, order: 0, ...over })
const E = (id, layerId, over = {}) => ({ id, type: 'rectangle', opacity: 100, isDeleted: false, customData: { layerId }, ...over })

test('defaultLayer: sensible defaults, unique id', () => {
  const a = defaultLayer()
  const b = defaultLayer()
  assert.equal(a.visible, true)
  assert.equal(a.opacity, 1)
  assert.notEqual(a.id, b.id)
})

test('ensureLayers: empty -> one default layer', () => {
  const out = ensureLayers([])
  assert.equal(out.length, 1)
  assert.equal(out[0].name, 'Capa 1')
})

test('ensureLayers: keeps existing', () => {
  const layers = [L('a', { order: 0 }), L('b', { order: 1 })]
  assert.equal(ensureLayers(layers), layers)
})

test('assignLayer: element without layerId gets the active layer', () => {
  const el = { id: 'e1', type: 'rectangle' }
  const out = assignLayer(el, 'active-1')
  assert.equal(out.customData.layerId, 'active-1')
})

test('assignLayer: element with a layerId is untouched', () => {
  const el = E('e1', 'keep-me')
  const out = assignLayer(el, 'active-1')
  assert.equal(out.customData.layerId, 'keep-me')
})

test('deriveScene: hidden layer elements are omitted', () => {
  const layers = [L('vis', { order: 0 }), L('hid', { order: 1, visible: false })]
  const els = [E('a', 'vis'), E('b', 'hid')]
  const out = deriveScene(els, layers)
  assert.deepEqual(out.map((e) => e.id), ['a'])
})

test('deriveScene: locked layer forces element.locked', () => {
  const layers = [L('x', { order: 0, locked: true })]
  const out = deriveScene([E('a', 'x', { locked: false })], layers)
  assert.equal(out[0].locked, true)
})

test('deriveScene: layer opacity multiplies element opacity (0..100 scale)', () => {
  const layers = [L('x', { order: 0, opacity: 0.5 })]
  const out = deriveScene([E('a', 'x', { opacity: 80 })], layers)
  assert.equal(out[0].opacity, 40)
})

test('deriveScene: z-order = layer order then element order within layer', () => {
  const layers = [L('back', { order: 0 }), L('front', { order: 1 })]
  const els = [E('f1', 'front'), E('b1', 'back'), E('f2', 'front'), E('b2', 'back')]
  const out = deriveScene(els, layers)
  assert.deepEqual(out.map((e) => e.id), ['b1', 'b2', 'f1', 'f2'])
})

test('deriveScene: elements whose layer no longer exists fall back to first layer', () => {
  const layers = [L('only', { order: 0 })]
  const out = deriveScene([E('a', 'ghost')], layers)
  assert.equal(out.length, 1)
  assert.equal(out[0].id, 'a')
})

test('reorderLayer: moving a layer changes derived z-order', () => {
  const layers = [L('a', { order: 0 }), L('b', { order: 1 }), L('c', { order: 2 })]
  const next = reorderLayer(layers, 'c', 0) // move c to the back
  const ordered = [...next].sort((x, y) => x.order - y.order).map((l) => l.id)
  assert.deepEqual(ordered, ['c', 'a', 'b'])
})

test('mergeDown: reassigns elements of a layer to the one below and drops the layer', () => {
  const layers = [L('low', { order: 0 }), L('high', { order: 1 })]
  const els = [E('a', 'low'), E('b', 'high')]
  const { layers: nl, elements: ne } = mergeDown(layers, els, 'high')
  assert.deepEqual(nl.map((l) => l.id), ['low'])
  assert.deepEqual(ne.map((e) => e.customData.layerId), ['low', 'low'])
})

test('mergeDown: the bottom layer cannot merge down (no-op)', () => {
  const layers = [L('low', { order: 0 }), L('high', { order: 1 })]
  const els = [E('a', 'low')]
  const out = mergeDown(layers, els, 'low')
  assert.deepEqual(out.layers.map((l) => l.id), ['low', 'high'])
})

test('duplicateLayer: clones the layer and its elements with fresh ids', () => {
  const layers = [L('src', { order: 0, name: 'Origen' })]
  const els = [E('a', 'src'), E('b', 'src')]
  const { layers: nl, elements: ne } = duplicateLayer(layers, els, 'src', () => 'NEW')
  assert.equal(nl.length, 2)
  const dup = nl.find((l) => l.id !== 'src')
  assert.equal(dup.name.includes('Origen'), true)
  const dupEls = ne.filter((e) => e.customData.layerId === dup.id)
  assert.equal(dupEls.length, 2)
  assert.equal(dupEls.every((e) => e.id !== 'a' && e.id !== 'b'), true)
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `canvasLayers.js`**

Create `apps/desktop/src/modules/atlas.notes/lib/canvasLayers.js`:

```js
// Layer model on top of Excalidraw's flat z-order.
//
// Excalidraw has no concept of layers: the paint order is the order of the
// `elements` array. We keep the FULL element list as the source of truth in
// CanvasEditor and feed <Excalidraw> a DERIVED scene: hidden layers omitted,
// locked layers force element.locked, layer opacity multiplies element
// opacity, and the array is sorted by (layer order, element order).
//
// Each element carries customData.layerId. `customData` is Excalidraw's
// official extension point and survives updateScene / export / import.

let _seq = 0
function uid() {
  // Not for persisted entity ids (those come from the DB); layer ids are
  // client-minted and only need to be unique within a scene.
  _seq += 1
  return `layer-${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export function defaultLayer(name = 'Capa 1', order = 0) {
  return { id: uid(), name, visible: true, locked: false, opacity: 1, order }
}

export function ensureLayers(layers) {
  if (Array.isArray(layers) && layers.length > 0) return layers
  return [defaultLayer()]
}

export function assignLayer(element, activeLayerId) {
  const existing = element?.customData?.layerId
  if (existing) return element
  return {
    ...element,
    customData: { ...(element.customData ?? {}), layerId: activeLayerId },
  }
}

function layerIndexById(layers) {
  const map = new Map()
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  sorted.forEach((l, i) => map.set(l.id, { layer: l, rank: i }))
  return { map, sorted }
}

// Produces the scene handed to <Excalidraw>. Does NOT mutate inputs.
export function deriveScene(elements, layers) {
  const safeLayers = ensureLayers(layers)
  const { map, sorted } = layerIndexById(safeLayers)
  const fallbackId = sorted[0].id

  const withRank = elements
    .filter((el) => el && !el.isDeleted)
    .map((el, elIndex) => {
      const layerId = el.customData?.layerId
      const hit = map.get(layerId) ?? map.get(fallbackId)
      return { el, elIndex, layer: hit.layer, rank: hit.rank }
    })
    .filter(({ layer }) => layer.visible !== false)

  withRank.sort((a, b) => (a.rank - b.rank) || (a.elIndex - b.elIndex))

  return withRank.map(({ el, layer }) => {
    let next = el
    if (layer.locked && !el.locked) next = { ...next, locked: true }
    if (typeof layer.opacity === 'number' && layer.opacity < 1) {
      const base = typeof el.opacity === 'number' ? el.opacity : 100
      next = next === el ? { ...el } : next
      next.opacity = Math.round(base * layer.opacity)
    }
    return next
  })
}

// Move `layerId` so its order rank becomes `toIndex` (0 = back). Returns a
// new layers array with normalised integer `order`.
export function reorderLayer(layers, layerId, toIndex) {
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  const from = sorted.findIndex((l) => l.id === layerId)
  if (from === -1) return layers
  const [moved] = sorted.splice(from, 1)
  const clamped = Math.max(0, Math.min(toIndex, sorted.length))
  sorted.splice(clamped, 0, moved)
  return sorted.map((l, i) => ({ ...l, order: i }))
}

// Merge `layerId` into the layer directly below it (lower order). Reassigns
// its elements' layerId and removes the layer. No-op for the bottom layer.
export function mergeDown(layers, elements, layerId) {
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((l) => l.id === layerId)
  if (idx <= 0) return { layers, elements }
  const belowId = sorted[idx - 1].id
  const nextLayers = sorted.filter((l) => l.id !== layerId).map((l, i) => ({ ...l, order: i }))
  const nextElements = elements.map((el) =>
    el.customData?.layerId === layerId
      ? { ...el, customData: { ...el.customData, layerId: belowId } }
      : el,
  )
  return { layers: nextLayers, elements: nextElements }
}

// Duplicate a layer and its elements. `mintId` mints new element ids
// (default: a random id). Returns new { layers, elements }.
export function duplicateLayer(layers, elements, layerId, mintId) {
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  const idx = sorted.findIndex((l) => l.id === layerId)
  if (idx === -1) return { layers, elements }
  const src = sorted[idx]
  const copy = { ...src, id: uid(), name: `${src.name} copia` }
  sorted.splice(idx + 1, 0, copy)
  const nextLayers = sorted.map((l, i) => ({ ...l, order: i }))

  const mint = typeof mintId === 'function' ? mintId : () => `el-${Math.random().toString(36).slice(2)}`
  const clones = elements
    .filter((el) => el.customData?.layerId === layerId && !el.isDeleted)
    .map((el) => ({
      ...el,
      id: mint(),
      customData: { ...el.customData, layerId: copy.id },
    }))
  return { layers: nextLayers, elements: [...elements, ...clones] }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/canvasLayers.js apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-layers.test.js
git commit -m "feat(notes): canvas layer model helpers"
```

---

## Task 3: `canvasSync.js` pure helpers

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasSync.js`
- Test: `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`

- [ ] **Step 1: Write the failing tests**

Create `apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`:

```js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { diffElements, versionMap } from '../canvasSync.js'

const E = (id, version) => ({ id, version, type: 'rectangle' })

test('versionMap: id -> version', () => {
  const m = versionMap([E('a', 1), E('b', 3)])
  assert.equal(m.get('a'), 1)
  assert.equal(m.get('b'), 3)
})

test('diffElements: first pass reports everything changed', () => {
  const { changed, nextMap } = diffElements(new Map(), [E('a', 1), E('b', 1)])
  assert.deepEqual(changed.map((e) => e.id), ['a', 'b'])
  assert.equal(nextMap.get('a'), 1)
})

test('diffElements: unchanged versions -> no changes', () => {
  const prev = versionMap([E('a', 2), E('b', 2)])
  const { changed } = diffElements(prev, [E('a', 2), E('b', 2)])
  assert.deepEqual(changed, [])
})

test('diffElements: only elements whose version increased are reported', () => {
  const prev = versionMap([E('a', 2), E('b', 2)])
  const { changed, nextMap } = diffElements(prev, [E('a', 2), E('b', 5), E('c', 1)])
  assert.deepEqual(changed.map((e) => e.id).sort(), ['b', 'c'])
  assert.equal(nextMap.get('b'), 5)
})

test('diffElements: a deleted element (isDeleted, higher version) is reported', () => {
  const prev = versionMap([E('a', 2)])
  const { changed } = diffElements(prev, [{ id: 'a', version: 3, isDeleted: true, type: 'rectangle' }])
  assert.deepEqual(changed.map((e) => e.id), ['a'])
})
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `canvasSync.js`**

Create `apps/desktop/src/modules/atlas.notes/lib/canvasSync.js`:

```js
// Pure helpers for SupabaseCanvasSync. Excalidraw stamps every element with a
// monotonically increasing integer `version` on each change; we broadcast only
// the elements whose version rose since the last broadcast.

export function versionMap(elements) {
  const m = new Map()
  for (const el of elements) {
    if (el && el.id != null) m.set(el.id, el.version ?? 0)
  }
  return m
}

// prevMap: Map<id, version> from the previous broadcast (or empty on first).
// Returns { changed: Element[], nextMap: Map }.
export function diffElements(prevMap, nextElements) {
  const changed = []
  const nextMap = new Map(prevMap)
  for (const el of nextElements) {
    if (!el || el.id == null) continue
    const prevV = prevMap.get(el.id)
    const v = el.version ?? 0
    if (prevV === undefined || v > prevV) {
      changed.push(el)
      nextMap.set(el.id, v)
    }
  }
  return { changed, nextMap }
}

// Trailing throttle. Returns a function; the wrapped fn runs at most once per
// `ms`, always with the latest args, with a trailing call for the last burst.
export function throttle(fn, ms) {
  let last = 0
  let timer = null
  let lastArgs = null
  return (...args) => {
    lastArgs = args
    const now = Date.now()
    const wait = ms - (now - last)
    if (wait <= 0) {
      last = now
      fn(...lastArgs)
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now()
        timer = null
        fn(...lastArgs)
      }, wait)
    }
  }
}
```

- [ ] **Step 4: Run tests**

Run: `node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/canvasSync.js apps/desktop/src/modules/atlas.notes/lib/__tests__/canvas-sync.test.js
git commit -m "feat(notes): canvas sync diff/throttle helpers"
```

---

## Task 4: `SupabaseCanvasSync.js`

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/SupabaseCanvasSync.js`

Model the lifecycle on `apps/desktop/src/modules/atlas.notes/lib/SupabaseYjsProvider.js` (read it first): `_destroyed` guard, drop a stale channel before subscribing, don't send before `state === 'joined'`, `removeChannel` on destroy.

- [ ] **Step 1: Implement the class**

Create `apps/desktop/src/modules/atlas.notes/lib/SupabaseCanvasSync.js`:

```js
import { reconcileElements } from '@excalidraw/excalidraw'
import { diffElements, versionMap, throttle } from './canvasSync.js'

// Realtime transport for a canvas note. Excalidraw-native (no Yjs): broadcasts
// changed elements and reconciles incoming ones by version. Mirrors the
// lifecycle discipline of SupabaseYjsProvider.
export class SupabaseCanvasSync {
  constructor({
    noteId,
    supabase,
    identity,          // { id, name, color, avatarUrl } — omitted/anon for public
    readOnly = false,
    getLocalElements,  // () => Element[]  (the CanvasEditor ref contents)
    getSnapshot,       // () => ({ elements, layers, appState, files })
    onRemoteElements,  // (reconciled: Element[]) => void
    onRemoteSnapshot,  // ({ elements, layers, appState, files }) => void
    onRemotePointer,   // ({ senderId, x, y, selectedElementIds, user }) => void
    onPresence,        // (list) => void
    onStatus,          // (status) => void
  }) {
    this.noteId = noteId
    this._supabase = supabase
    this._identity = identity ?? { id: `anon-${Math.random().toString(36).slice(2)}` }
    this._readOnly = readOnly
    this._getLocalElements = getLocalElements
    this._getSnapshot = getSnapshot
    this._onRemoteElements = onRemoteElements
    this._onRemoteSnapshot = onRemoteSnapshot
    this._onRemotePointer = onRemotePointer
    this._onPresence = onPresence
    this._onStatus = onStatus

    this._channel = null
    this._destroyed = false
    this._connected = false
    this._sentVersions = new Map()

    this._sendDeltaThrottled = throttle(() => this._flushDelta(), 200)
    this._sendPointerThrottled = throttle((p) => this._rawSend('pointer', p), 50)

    this._init()
  }

  get _topic() {
    return `note:canvas:${this.noteId}`
  }

  _init() {
    const stale = this._supabase
      .getChannels()
      .find((ch) => ch.topic === `realtime:${this._topic}`)
    if (stale) {
      try { this._supabase.removeChannel(stale) } catch (_) { /* gone */ }
    }

    this._channel = this._supabase.channel(this._topic, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this._identity.id },
      },
    })

    this._channel
      .on('broadcast', { event: 'scene.delta' }, ({ payload }) => this._applyIncoming(payload?.elements))
      .on('broadcast', { event: 'scene.full' }, ({ payload }) => {
        if (!payload) return
        if (this._onRemoteSnapshot) this._onRemoteSnapshot(payload)
      })
      .on('broadcast', { event: 'scene.request' }, () => this._answerRequest())
      .on('broadcast', { event: 'pointer' }, ({ payload }) => {
        if (payload && this._onRemotePointer) this._onRemotePointer(payload)
      })
      .on('presence', { event: 'sync' }, () => {
        if (!this._onPresence) return
        const state = this._channel.presenceState()
        const list = Object.values(state).flat().map((m) => m.user).filter(Boolean)
        this._onPresence(list)
      })
      .subscribe(async (status) => {
        if (this._destroyed) return
        this._onStatus?.(status)
        if (status === 'SUBSCRIBED') {
          this._connected = true
          try {
            await this._channel.track({ user: this._pubIdentity() })
          } catch (_) { /* presence best-effort */ }
          // Pull current state from peers, and (if we're an editor holding
          // state) offer ours.
          this._rawSend('scene.request', { senderId: this._identity.id })
          if (!this._readOnly) this._broadcastFull()
        } else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) {
          this._connected = false
        }
      })
  }

  _pubIdentity() {
    const { id, name, color, avatarUrl } = this._identity
    return { id, name, color, avatarUrl }
  }

  _rawSend(event, payload) {
    if (!this._channel || this._channel.state !== 'joined') return
    this._channel.send({ type: 'broadcast', event, payload })
  }

  _applyIncoming(incoming) {
    if (!Array.isArray(incoming) || incoming.length === 0) return
    const local = this._getLocalElements?.() ?? []
    // reconcileElements(localElements, remoteElements, localAppState)
    const reconciled = reconcileElements(local, incoming, {})
    this._onRemoteElements?.(reconciled)
  }

  _answerRequest() {
    if (this._readOnly) return
    this._broadcastFull()
  }

  _broadcastFull() {
    const snap = this._getSnapshot?.()
    if (!snap) return
    this._rawSend('scene.full', { ...snap, senderId: this._identity.id })
  }

  _flushDelta() {
    if (this._readOnly) return
    const els = this._getLocalElements?.() ?? []
    const { changed, nextMap } = diffElements(this._sentVersions, els)
    this._sentVersions = nextMap
    if (changed.length === 0) return
    this._rawSend('scene.delta', { elements: changed, senderId: this._identity.id })
  }

  // Called by CanvasEditor after every local onChange.
  notifyLocalChange() {
    if (this._readOnly) return
    this._sendDeltaThrottled()
  }

  broadcastPointer(p) {
    if (this._readOnly) return
    this._sendPointerThrottled({ ...p, senderId: this._identity.id, user: this._pubIdentity() })
  }

  destroy() {
    this._destroyed = true
    this._connected = false
    if (this._channel) {
      try { this._supabase.removeChannel(this._channel) } catch (_) { /* gone */ }
      this._channel = null
    }
  }
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.notes/lib/SupabaseCanvasSync.js`
Expected: no output. (It imports `@excalidraw/excalidraw`; `node --check` only parses, does not resolve imports.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/SupabaseCanvasSync.js
git commit -m "feat(notes): SupabaseCanvasSync realtime provider"
```

---

## Task 5: `canvasImages.js` + `canvasExport.js`

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasImages.js`
- Create: `apps/desktop/src/modules/atlas.notes/lib/canvasExport.js`

Read `apps/desktop/src/modules/atlas.notes/lib/noteImageUpload.js` first to reuse the `presign-image` flow verbatim.

- [ ] **Step 1: Implement `canvasImages.js`**

```js
import { atlas } from '../../../lib/atlas'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024

// Given Excalidraw's files map after an onChange, upload any entry that still
// has only a dataURL (freshly pasted/dropped) to the atlas-notes bucket and
// return a persistable manifest: { [fileId]: { mimeType, storageKey, url, created } }.
export async function syncNewImages({ files, manifest, noteId, token }) {
  const next = { ...manifest }
  for (const [fileId, file] of Object.entries(files ?? {})) {
    if (next[fileId]?.url) continue // already uploaded
    const dataURL = file?.dataURL
    if (!dataURL || !dataURL.startsWith('data:')) continue
    const blob = dataURLtoBlob(dataURL)
    if (blob.size > MAX_IMAGE_BYTES) {
      throw new Error('La imagen supera el limite de 10 MB')
    }
    const ext = (file.mimeType?.split('/')[1] ?? 'png').replace('+xml', '')
    const presign = await atlas.notes.presignImage(
      { fileName: `canvas-${fileId}.${ext}`, mimeType: file.mimeType, noteId },
      token,
    )
    await fetch(presign.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': file.mimeType ?? 'image/png' },
      body: blob,
    })
    next[fileId] = {
      mimeType: file.mimeType ?? 'image/png',
      storageKey: presign.objectKey,
      url: presign.publicUrl,
      created: Date.now(),
    }
  }
  return next
}

// On load: fetch each manifest url and return an Excalidraw files map
// { [id]: { id, mimeType, dataURL, created } } for excalidrawAPI.addFiles().
export async function hydrateImages(manifest) {
  const entries = await Promise.all(
    Object.entries(manifest ?? {}).map(async ([fileId, meta]) => {
      if (!meta?.url) return null
      const res = await fetch(meta.url)
      const blob = await res.blob()
      const dataURL = await blobToDataURL(blob)
      return { id: fileId, mimeType: meta.mimeType ?? blob.type, dataURL, created: meta.created ?? Date.now() }
    }),
  )
  return entries.filter(Boolean)
}

function dataURLtoBlob(dataURL) {
  const [head, b64] = dataURL.split(',')
  const mime = head.match(/data:(.*?);base64/)?.[1] ?? 'image/png'
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onload = () => resolve(fr.result)
    fr.onerror = reject
    fr.readAsDataURL(blob)
  })
}
```

**Note:** if the frontend SDK does not already expose `atlas.notes.presignImage`, add it in Plan A Task 7 style (POST `/notes/presign-image`). Check `grep -rn "presign" packages/sdk/src` — if missing, add:
```js
    presignImage: (body, token) => request('/notes/presign-image', { method: 'POST', token, body }),
```

- [ ] **Step 2: Implement `canvasExport.js`**

```js
import { exportToBlob, exportToSvg } from '@excalidraw/excalidraw'

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const safeName = (title) => (title?.trim() || 'lienzo').replace(/[^\w\-. ]+/g, '_')

export async function exportCanvasPng({ elements, appState, files, title }) {
  const blob = await exportToBlob({
    elements,
    appState: { ...appState, exportBackground: true },
    files: files ?? {},
    mimeType: 'image/png',
  })
  triggerDownload(blob, `${safeName(title)}.png`)
}

export async function exportCanvasSvg({ elements, appState, files, title }) {
  const svg = await exportToSvg({ elements, appState, files: files ?? {} })
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' })
  triggerDownload(blob, `${safeName(title)}.svg`)
}
```

- [ ] **Step 3: Syntax-check**

Run:
```bash
node --check apps/desktop/src/modules/atlas.notes/lib/canvasImages.js && node --check apps/desktop/src/modules/atlas.notes/lib/canvasExport.js
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/lib/canvasImages.js apps/desktop/src/modules/atlas.notes/lib/canvasExport.js
git commit -m "feat(notes): canvas image upload + PNG/SVG export helpers"
```

---

## Task 6: `useCanvasScene.js` hooks

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/hooks/useCanvasScene.js`

- [ ] **Step 1: Implement**

```js
import { useQuery, useMutation } from '@tanstack/react-query'
import { useAuth } from '../../../auth/AuthProvider'
import { atlas } from '../../../lib/atlas'

export function useCanvasScene(noteId) {
  const { session } = useAuth()
  const token = session?.access_token
  return useQuery({
    queryKey: ['canvas-scene', noteId],
    queryFn: () => atlas.notes.getCanvas(noteId, token),
    enabled: Boolean(token && noteId),
    staleTime: Infinity, // the realtime channel keeps it fresh; refetch only on remount
  })
}

export function useSaveCanvasScene(noteId) {
  const { session } = useAuth()
  const token = session?.access_token
  return useMutation({
    mutationFn: (scene) => atlas.notes.saveCanvas(noteId, scene, token),
  })
}

export function usePublicCanvasScene(slug) {
  return useQuery({
    queryKey: ['public-canvas', slug],
    queryFn: () => atlas.notes.getPublicCanvas(slug),
    enabled: Boolean(slug),
    retry: false,
    staleTime: 0,
  })
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.notes/hooks/useCanvasScene.js`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/hooks/useCanvasScene.js
git commit -m "feat(notes): useCanvasScene hooks"
```

---

## Task 7: `CanvasStage.jsx` — the lazy Excalidraw wrapper

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasStage.jsx`

This is the only module that statically imports the heavy package, so it is the lazy boundary.

- [ ] **Step 1: Implement**

```jsx
import { forwardRef } from 'react'
import { Excalidraw } from '@excalidraw/excalidraw'
import '@excalidraw/excalidraw/index.css'

// Thin wrapper so CanvasEditor never imports the heavy bundle directly.
// CanvasEditor lazy-loads THIS module.
const CanvasStage = forwardRef(function CanvasStage(props, _ref) {
  const {
    initialElements,
    initialAppState,
    initialFiles,
    viewModeEnabled = false,
    onExcalidrawAPI,
    onChange,
    onPointerUpdate,
    langCode = 'es-ES',
  } = props

  return (
    <div className="h-full w-full">
      <Excalidraw
        excalidrawAPI={onExcalidrawAPI}
        initialData={{
          elements: initialElements ?? [],
          appState: { ...(initialAppState ?? {}), collaborators: new Map() },
          files: initialFiles ?? {},
          scrollToContent: true,
        }}
        viewModeEnabled={viewModeEnabled}
        onChange={onChange}
        onPointerUpdate={onPointerUpdate}
        langCode={langCode}
        UIOptions={{ canvasActions: { loadScene: false, saveToActiveFile: false } }}
      />
    </div>
  )
})

export default CanvasStage
```

If `@excalidraw/excalidraw/index.css` is not the correct CSS path for `<EXC_VERSION>`, run `ls node_modules/@excalidraw/excalidraw/dist` (or check the package `exports`) and use the right one. Update the spec if it differs.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/CanvasStage.jsx
git commit -m "feat(notes): CanvasStage lazy Excalidraw wrapper"
```

---

## Task 8: `CanvasLayersPanel.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasLayersPanel.jsx`

Check `@atlas/ui` exports first: `grep -n "Sheet\|DropdownMenu\|TextField\|ConfirmDialog\|Slider" packages/ui/src/index.js`. Use whatever the real names are; the code below assumes `Sheet`, `SheetContent`, `DropdownMenu*`, `TextField`, `ConfirmDialog`. If there is no `Slider`, use `<input type="range">` styled with Tailwind (allowed here — no `@atlas/ui` equivalent) or add a `Slider` to `@atlas/ui` per CLAUDE.md rules (preferred if time allows).

- [ ] **Step 1: Implement the panel body (shared by rail + sheet)**

```jsx
import { useState } from 'react'
import { Eye, EyeOff, Lock, LockOpen, GripVertical, Plus, MoreVertical } from 'lucide-react'
import {
  Sheet, SheetContent, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, TextField, ConfirmDialog,
} from '@atlas/ui'

// Presentational: receives layers + callbacks, renders the Illustrator-style
// list. Used docked (desktop rail) and inside a bottom Sheet (mobile).
function LayerRows({ layers, activeLayerId, elementCounts, onSelect, onRename, onToggleVisible, onToggleLocked, onOpacity, onReorder, onDuplicate, onMergeDown, onDelete }) {
  const [dragId, setDragId] = useState(null)
  const [confirmDel, setConfirmDel] = useState(null)
  const sorted = [...layers].sort((a, b) => b.order - a.order) // top layer first in the panel

  return (
    <div className="flex flex-col">
      {sorted.map((layer, i) => {
        const count = elementCounts?.[layer.id] ?? 0
        return (
          <div
            key={layer.id}
            className={[
              'flex items-center gap-2 px-2 py-2 border-b border-border min-h-[44px] cursor-pointer',
              layer.id === activeLayerId ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted',
            ].join(' ')}
            onClick={() => onSelect(layer.id)}
            draggable
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId && dragId !== layer.id) onReorder(dragId, layer.order); setDragId(null) }}
          >
            <GripVertical size={14} className="text-muted-foreground shrink-0" />
            <button onClick={(e) => { e.stopPropagation(); onToggleVisible(layer.id) }} className="shrink-0 p-1" aria-label={layer.visible ? 'Ocultar capa' : 'Mostrar capa'}>
              {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-muted-foreground" />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); onToggleLocked(layer.id) }} className="shrink-0 p-1" aria-label={layer.locked ? 'Desbloquear capa' : 'Bloquear capa'}>
              {layer.locked ? <Lock size={15} /> : <LockOpen size={15} className="text-muted-foreground" />}
            </button>
            <div className="flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
              <TextField
                value={layer.name}
                onChange={(e) => onRename(layer.id, e.target.value)}
                className="text-xs"
              />
              <div className="text-[10px] text-muted-foreground mt-0.5">{count} elemento{count === 1 ? '' : 's'}</div>
            </div>
            <input
              type="range" min="0" max="100" value={Math.round((layer.opacity ?? 1) * 100)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onOpacity(layer.id, Number(e.target.value) / 100)}
              className="w-16 shrink-0 accent-amber-500"
              aria-label="Opacidad de la capa"
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="shrink-0 p-1" onClick={(e) => e.stopPropagation()} aria-label="Acciones de capa"><MoreVertical size={15} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onDuplicate(layer.id)}>Duplicar</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => onMergeDown(layer.id)} disabled={i === sorted.length - 1}>Combinar hacia abajo</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => (count > 0 ? setConfirmDel(layer) : onDelete(layer.id))} disabled={layers.length === 1}>Eliminar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )
      })}
      <ConfirmDialog
        open={Boolean(confirmDel)}
        onOpenChange={(o) => !o && setConfirmDel(null)}
        title="Eliminar capa"
        description={`La capa "${confirmDel?.name}" y sus elementos se eliminaran del lienzo.`}
        confirmLabel="Eliminar"
        onConfirm={() => { onDelete(confirmDel.id); setConfirmDel(null) }}
      />
    </div>
  )
}

export function CanvasLayersPanel(props) {
  const { open, onOpenChange, isMobile, onAddLayer, ...rows } = props

  const header = (
    <div className="flex items-center justify-between px-3 h-11 border-b border-border">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Capas</span>
      <button onClick={onAddLayer} className="flex items-center gap-1 text-xs font-medium text-amber-600 hover:text-amber-700" >
        <Plus size={13} /> Nueva capa
      </button>
    </div>
  )

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto p-0">
          {header}
          <LayerRows {...rows} />
        </SheetContent>
      </Sheet>
    )
  }

  if (!open) return null
  return (
    <div className="w-72 shrink-0 border-l border-border flex flex-col bg-background overflow-y-auto">
      {header}
      <LayerRows {...rows} />
    </div>
  )
}
```

- [ ] **Step 2: Syntax-check**

Run: `node --check apps/desktop/src/modules/atlas.notes/components/CanvasLayersPanel.jsx`
Expected: no output. (JSX passes `node --check`? No — `node --check` fails on JSX. Instead run `pnpm --filter @atlas/desktop exec eslint src/modules/atlas.notes/components/CanvasLayersPanel.jsx` or rely on the Vite build in Task 12.)

- [ ] **Step 3: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/CanvasLayersPanel.jsx
git commit -m "feat(notes): CanvasLayersPanel (rail + mobile sheet)"
```

---

## Task 9: `CanvasEditor.jsx`

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/components/CanvasEditor.jsx`

Read `apps/desktop/src/modules/atlas.notes/components/NoteEditor.jsx` for the engine-lifecycle pattern (effect keyed by `note.id` + `token`, teardown on unmount, `key={note.id}` on the surface).

- [ ] **Step 1: Implement**

```jsx
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Layers, Image as ImageIcon, FileDown, Grid3x3 } from 'lucide-react'
import { useAuth } from '../../../auth/AuthProvider'
import { supabase } from '../../../lib/supabase'
import { atlas } from '../../../lib/atlas'
import { useCanvasScene, useSaveCanvasScene } from '../hooks/useCanvasScene.js'
import {
  ensureLayers, defaultLayer, assignLayer, deriveScene,
  reorderLayer, mergeDown, duplicateLayer,
} from '../lib/canvasLayers.js'
import { SupabaseCanvasSync } from '../lib/SupabaseCanvasSync.js'
import { syncNewImages, hydrateImages } from '../lib/canvasImages.js'
import { exportCanvasPng, exportCanvasSvg } from '../lib/canvasExport.js'
import { CanvasLayersPanel } from './CanvasLayersPanel.jsx'

const CanvasStage = lazy(() => import('./CanvasStage.jsx'))
const AUTOSAVE_DELAY = 1500
const PRESENCE_COLORS = ['#3b82f6', '#22c55e', '#a855f7', '#ec4899', '#06b6d4', '#f97316']
const colorForUser = (seed) => {
  const s = String(seed ?? '')
  let h = 0
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return PRESENCE_COLORS[h % PRESENCE_COLORS.length]
}

export function CanvasEditor({ note }) {
  const { session, userProfile } = useAuth()
  const token = session?.access_token
  const noteId = note?.id

  const { data, isLoading, error } = useCanvasScene(noteId)
  const saveScene = useSaveCanvasScene(noteId)

  const elementsRef = useRef([])          // full element list = source of truth
  const [layers, setLayers] = useState([defaultLayer()])
  const [activeLayerId, setActiveLayerId] = useState(null)
  const filesManifestRef = useRef({})
  const appStateRef = useRef({})
  const [ready, setReady] = useState(false)
  const [showLayers, setShowLayers] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  const apiRef = useRef(null)
  const syncRef = useRef(null)
  const saveTimer = useRef(null)

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const on = () => setIsMobile(mq.matches)
    on(); mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  // Seed from the server scene once loaded.
  useEffect(() => {
    if (!data?.scene) return
    let cancelled = false
    ;(async () => {
      const s = data.scene
      elementsRef.current = Array.isArray(s.elements) ? s.elements : []
      const ls = ensureLayers(s.layers)
      setLayers(ls)
      const topLayer = [...ls].sort((a, b) => b.order - a.order)[0]
      setActiveLayerId(topLayer.id) // topmost layer active by default
      filesManifestRef.current = s.files ?? {}
      appStateRef.current = s.appState ?? {}
      const files = await hydrateImages(s.files)
      if (cancelled) return
      if (apiRef.current && files.length) apiRef.current.addFiles(files)
      setReady(true)
    })()
    return () => { cancelled = true }
  }, [data?.scene])

  // Realtime provider — lifecycle keyed by note + token (see NoteEditor).
  useEffect(() => {
    if (!noteId || !token) return
    const sync = new SupabaseCanvasSync({
      noteId,
      supabase,
      identity: {
        id: session?.user?.id,
        name: userProfile?.displayName ?? session?.user?.email ?? 'Usuario',
        color: colorForUser(session?.user?.id ?? session?.user?.email),
        avatarUrl: userProfile?.avatarUrl ?? null,
      },
      getLocalElements: () => elementsRef.current,
      getSnapshot: () => ({
        elements: elementsRef.current,
        layers,
        appState: appStateRef.current,
        files: filesManifestRef.current,
      }),
      onRemoteElements: (reconciled) => {
        elementsRef.current = reconciled
        apiRef.current?.updateScene({ elements: deriveScene(reconciled, layers) })
      },
      onRemoteSnapshot: (snap) => {
        elementsRef.current = Array.isArray(snap.elements) ? snap.elements : elementsRef.current
        if (Array.isArray(snap.layers) && snap.layers.length) setLayers(ensureLayers(snap.layers))
        if (snap.appState) appStateRef.current = snap.appState
        apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, snap.layers ?? layers) })
      },
      onRemotePointer: (p) => {
        const map = new Map()
        map.set(p.senderId, { pointer: { x: p.x, y: p.y }, username: p.user?.name, ...p.user })
        apiRef.current?.updateScene({ collaborators: map })
      },
    })
    syncRef.current = sync
    return () => { sync.destroy(); syncRef.current = null }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId, token])

  const persist = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveScene.mutate({
        elements: elementsRef.current,
        appState: appStateRef.current,
        layers,
        files: filesManifestRef.current,
      })
    }, AUTOSAVE_DELAY)
  }, [layers, saveScene])

  useEffect(() => () => {
    clearTimeout(saveTimer.current)
    // final flush
    if (elementsRef.current.length || Object.keys(filesManifestRef.current).length) {
      saveScene.mutate({
        elements: elementsRef.current, appState: appStateRef.current,
        layers, files: filesManifestRef.current,
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleChange = useCallback(async (elements, appState) => {
    // Assign new elements to the active layer.
    const withLayers = elements.map((el) => assignLayer(el, activeLayerId ?? layers[0]?.id))
    elementsRef.current = withLayers
    appStateRef.current = {
      gridModeEnabled: appState.gridModeEnabled,
      gridSize: appState.gridSize,
      snapToGrid: appState.snapToGrid,
      viewBackgroundColor: appState.viewBackgroundColor,
    }
    syncRef.current?.notifyLocalChange()
    persist()

    // Upload any freshly added images.
    const files = apiRef.current?.getFiles?.() ?? {}
    const hasNew = Object.keys(files).some((id) => !filesManifestRef.current[id]?.url)
    if (hasNew) {
      try {
        filesManifestRef.current = await syncNewImages({
          files, manifest: filesManifestRef.current, noteId, token,
        })
        persist()
      } catch (e) {
        console.warn('[canvas] image upload failed:', e?.message)
      }
    }
  }, [activeLayerId, layers, noteId, token, persist])

  const handlePointer = useCallback((payload) => {
    const p = payload?.pointer
    if (!p) return
    syncRef.current?.broadcastPointer({ x: p.x, y: p.y, selectedElementIds: payload.button })
  }, [])

  // Apply a derived scene whenever layers change (visibility/lock/opacity/order).
  useEffect(() => {
    if (ready) apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layers) })
  }, [layers, ready])

  const elementCounts = useMemo(() => {
    const c = {}
    for (const el of elementsRef.current) {
      if (el.isDeleted) continue
      const id = el.customData?.layerId
      if (id) c[id] = (c[id] ?? 0) + 1
    }
    return c
  // recompute on every layers change (cheap, and layers change is the trigger UI cares about)
  }, [layers, ready])

  const mutateLayers = (next) => { setLayers(next); persist() }

  const layerCbs = {
    activeLayerId,
    elementCounts,
    onSelect: setActiveLayerId,
    onRename: (id, name) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, name } : l))),
    onToggleVisible: (id) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l))),
    onToggleLocked: (id) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l))),
    onOpacity: (id, opacity) => mutateLayers(layers.map((l) => (l.id === id ? { ...l, opacity } : l))),
    onReorder: (id, toOrder) => mutateLayers(reorderLayer(layers, id, toOrder)),
    onDuplicate: (id) => {
      const { layers: nl, elements: ne } = duplicateLayer(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
    },
    onMergeDown: (id) => {
      const { layers: nl, elements: ne } = mergeDown(layers, elementsRef.current, id)
      elementsRef.current = ne
      mutateLayers(nl)
    },
    onDelete: (id) => {
      if (layers.length === 1) return
      elementsRef.current = elementsRef.current.filter((el) => el.customData?.layerId !== id)
      const nl = layers.filter((l) => l.id !== id).map((l, i) => ({ ...l, order: i }))
      if (activeLayerId === id) setActiveLayerId(nl[nl.length - 1].id)
      mutateLayers(nl)
    },
  }

  const addLayer = () => {
    const order = layers.length
    const nl = [...layers, defaultLayer(`Capa ${order + 1}`, order)]
    setActiveLayerId(nl[nl.length - 1].id)
    mutateLayers(nl)
  }

  const doExport = (fn) => fn({
    elements: deriveScene(elementsRef.current, layers),
    appState: appStateRef.current,
    files: apiRef.current?.getFiles?.() ?? {},
    title: note?.title,
  })

  if (error) return <div className="p-8 text-sm text-muted-foreground">No se pudo cargar el lienzo.</div>

  return (
    <div className="flex h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-1 px-3 h-11 border-b border-border shrink-0">
          <button onClick={() => doExport(exportCanvasPng)} className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg" title="Exportar PNG">
            <FileDown size={13} /> PNG
          </button>
          <button onClick={() => doExport(exportCanvasSvg)} className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted rounded-lg" title="Exportar SVG">
            <FileDown size={13} /> SVG
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setShowLayers((v) => !v)}
            className={['flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium rounded-lg', showLayers ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' : 'text-muted-foreground hover:bg-muted'].join(' ')}
          >
            <Layers size={13} /> <span className="hidden sm:inline">Capas</span>
          </button>
        </div>
        <div className="flex-1 min-h-0">
          {(isLoading || !ready) ? (
            <div className="h-full grid place-items-center text-sm text-muted-foreground">Cargando lienzo...</div>
          ) : (
            <Suspense fallback={<div className="h-full grid place-items-center text-sm text-muted-foreground">Cargando editor...</div>}>
              <CanvasStage
                initialElements={deriveScene(elementsRef.current, layers)}
                initialAppState={appStateRef.current}
                initialFiles={{}}
                onExcalidrawAPI={(api) => { apiRef.current = api }}
                onChange={handleChange}
                onPointerUpdate={handlePointer}
              />
            </Suspense>
          )}
        </div>
      </div>

      <CanvasLayersPanel
        open={showLayers}
        onOpenChange={setShowLayers}
        isMobile={isMobile}
        onAddLayer={addLayer}
        layers={layers}
        {...layerCbs}
      />
    </div>
  )
}
```

**Known simplifications (acceptable for v1, note in the spec if not already):**
- `deriveScene` runs on every change; fine for typical canvas sizes.
- Deletions from a hidden layer via the layers panel hard-remove from the ref (no tombstone) — acceptable, they were the user's explicit action.
- `onChange` re-derives via `assignLayer` only for elements missing a `layerId`.

- [ ] **Step 2: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/components/CanvasEditor.jsx
git commit -m "feat(notes): CanvasEditor shell with realtime + layers + images + export"
```

---

## Task 10: `PublicCanvasView.jsx` + wire `PublicNoteScreen`

**Files:**
- Create: `apps/desktop/src/modules/atlas.notes/PublicCanvasView.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx`

- [ ] **Step 1: Implement `PublicCanvasView.jsx`**

```jsx
import { lazy, Suspense, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { ErrorState } from '@atlas/ui'
import { usePublicCanvasScene } from './hooks/useCanvasScene.js'
import { SupabaseCanvasSync } from './lib/SupabaseCanvasSync.js'
import { hydrateImages } from './lib/canvasImages.js'
import { deriveScene, ensureLayers } from './lib/canvasLayers.js'

const CanvasStage = lazy(() => import('./components/CanvasStage.jsx'))

export default function PublicCanvasView({ slug }) {
  const { data, isLoading, error } = usePublicCanvasScene(slug)
  const apiRef = useRef(null)
  const syncRef = useRef(null)
  const elementsRef = useRef([])
  const layersRef = useRef([])

  const scene = data?.scene

  useEffect(() => {
    if (!scene) return
    let cancelled = false
    elementsRef.current = Array.isArray(scene.elements) ? scene.elements : []
    layersRef.current = ensureLayers(scene.layers)
    ;(async () => {
      const files = await hydrateImages(scene.files)
      if (cancelled) return
      if (apiRef.current && files.length) apiRef.current.addFiles(files)
      apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layersRef.current) })
    })()

    const sync = new SupabaseCanvasSync({
      noteId: scene.noteId,
      supabase,
      readOnly: true,
      getLocalElements: () => elementsRef.current,
      onRemoteElements: (reconciled) => {
        elementsRef.current = reconciled
        apiRef.current?.updateScene({ elements: deriveScene(reconciled, layersRef.current) })
      },
      onRemoteSnapshot: (snap) => {
        elementsRef.current = Array.isArray(snap.elements) ? snap.elements : elementsRef.current
        if (Array.isArray(snap.layers) && snap.layers.length) layersRef.current = ensureLayers(snap.layers)
        apiRef.current?.updateScene({ elements: deriveScene(elementsRef.current, layersRef.current) })
      },
    })
    syncRef.current = sync
    return () => { cancelled = true; sync.destroy() }
  }, [scene])

  if (isLoading) return <div className="min-h-screen grid place-items-center bg-gray-50 text-sm text-gray-400">Cargando lienzo...</div>
  if (error || !scene) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50">
        <div className="max-w-md w-full p-8">
          <ErrorState title="Lienzo no encontrado" description="Este lienzo no existe o el enlace publico fue desactivado." />
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-white">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-gray-200 shrink-0">
        <h1 className="text-sm font-semibold text-gray-900 truncate">{scene.title || 'Lienzo'}</h1>
        <span className="text-[11px] text-gray-400">Solo lectura</span>
      </div>
      <div className="flex-1 min-h-0">
        <Suspense fallback={<div className="h-full grid place-items-center text-sm text-gray-400">Cargando editor...</div>}>
          <CanvasStage
            initialElements={[]}
            initialAppState={scene.appState}
            initialFiles={{}}
            viewModeEnabled
            onExcalidrawAPI={(api) => { apiRef.current = api }}
          />
        </Suspense>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Branch in `PublicNoteScreen.jsx`**

At the top of the component, after `const note = data?.note`, add:

```jsx
  if (note?.note_type === 'canvas') {
    return (
      <Suspense fallback={<div className="min-h-screen grid place-items-center text-sm text-gray-400">Cargando...</div>}>
        <PublicCanvasView slug={slug} />
      </Suspense>
    )
  }
```

Add the imports at the top:

```jsx
import { lazy, Suspense } from 'react'
const PublicCanvasView = lazy(() => import('./PublicCanvasView.jsx'))
```

(Merge the `lazy, Suspense` import with the existing `react` import line.)

**Also:** `GET /public/notes/:slug` must return `note_type`. Verify `shares-service.getPublicNote` selects it — Plan A did not add it. Add `notes.note_type,` to the SELECT column list in `apps/api/src/routes/notes/shares-service.js` `getPublicNote` and commit it with this task (small API touch, belongs with the consumer).

- [ ] **Step 3: Build check**

Run: `pnpm --filter @atlas/desktop build`
Expected: build succeeds (this is the first real compile of all the JSX).

- [ ] **Step 4: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/PublicCanvasView.jsx apps/desktop/src/modules/atlas.notes/PublicNoteScreen.jsx apps/api/src/routes/notes/shares-service.js
git commit -m "feat(notes): live read-only public canvas view"
```

---

## Task 11: Wire `NotesScreen` — create menu + editor branch

**Files:**
- Modify: `apps/desktop/src/modules/atlas.notes/NotesScreen.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NotesList.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx`
- Modify: `apps/desktop/src/modules/atlas.notes/noteIcons.jsx`

- [ ] **Step 1: Create menu (Documento / Lienzo)**

In `NotesScreen.jsx`, import `DropdownMenu*` from `@atlas/ui` and `Shapes` + `FileText` from `lucide-react`. Replace the single "Nueva" `<button>` (lines ~155-163) with a `DropdownMenu`:

```jsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <button
      disabled={createNote.isPending}
      className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
    >
      <Plus size={13} />
      <span>Nueva</span>
    </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent align="start">
    <DropdownMenuItem onSelect={() => handleCreateNote('document')}>
      <FileText size={13} className="mr-2" /> Documento
    </DropdownMenuItem>
    <DropdownMenuItem onSelect={() => handleCreateNote('canvas')}>
      <Shapes size={13} className="mr-2" /> Lienzo
    </DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Change `handleCreateNote` (line ~84) to accept a type:

```jsx
  function handleCreateNote(noteType = 'document') {
    createNote.mutate(
      { title: noteType === 'canvas' ? 'Nuevo lienzo' : 'Nueva nota', content: '', noteType },
      {
        onSuccess: (res) => {
          if (res?.note) {
            setSelectedNote(res.note)
            setNoteParam(res.note.id)
            setRightPanel('editor')
            setMobileView('editor')
          }
        },
      },
    )
  }
```

Update the `EmptyEditor` `onCreateNote` call sites to pass `'document'` (or leave — the default covers it).

- [ ] **Step 2: Editor branch**

Import `CanvasEditor`:

```jsx
import { CanvasEditor } from './components/CanvasEditor.jsx'
```

In Panel 2's render (the `rightPanel === 'settings' ? ... : <NoteEditor ... />` ternary, lines ~249-259), change the final branch to:

```jsx
        ) : selectedNote.note_type === 'canvas' ? (
          <CanvasEditor note={selectedNote} />
        ) : (
          <NoteEditor note={selectedNote} readOnly={isTrashView} />
        )}
```

(`CanvasEditor` has no trash/read-only mode in v1; the trash view still lists canvas notes but opening one shows the editor. Acceptable — the spec lists "convert / trash-view canvas" as out of scope. If `isTrashView`, keep showing `NoteEditor` read-only path instead: guard with `!isTrashView && selectedNote.note_type === 'canvas'`.)

Use this guarded form:

```jsx
        ) : (!isTrashView && selectedNote.note_type === 'canvas') ? (
          <CanvasEditor note={selectedNote} />
        ) : (
          <NoteEditor note={selectedNote} readOnly={isTrashView} />
        )}
```

- [ ] **Step 3: Canvas icon + badge in the list**

In `noteIcons.jsx`, ensure `Shapes` (lucide) is resolvable by `NoteIcon` (add it to whatever icon map exists, keyed `'shapes'`).

In `NotesList.jsx` / `NoteCard.jsx`, where each row/card renders, if `note.note_type === 'canvas'` show a `<Shapes size={13} />` glyph and a small `Lienzo` badge (`<span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Lienzo</span>`). Match the file's existing markup.

- [ ] **Step 4: Build**

Run: `pnpm --filter @atlas/desktop build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add apps/desktop/src/modules/atlas.notes/NotesScreen.jsx apps/desktop/src/modules/atlas.notes/components/NotesList.jsx apps/desktop/src/modules/atlas.notes/components/NoteCard.jsx apps/desktop/src/modules/atlas.notes/noteIcons.jsx
git commit -m "feat(notes): create-canvas menu + canvas editor branch + list badge"
```

---

## Task 12: Full-app build, lint, tests

- [ ] **Step 1: All new unit tests**

Run:
```bash
node --test apps/desktop/src/modules/atlas.notes/lib/__tests__/
```
Expected: PASS (`canvas-layers`, `canvas-sync`, `excalidraw-imports`).

- [ ] **Step 2: Lint**

Run: `pnpm lint`
Expected: no new errors. Fix any `no-restricted-syntax` (local-date) or unused-import hits in the new files.

- [ ] **Step 3: Build all**

Run: `pnpm build`
Expected: success. Confirm the Excalidraw chunk is split (Vite prints a separate chunk for `CanvasStage`).

- [ ] **Step 4: Commit any fixes**

```bash
git add -A
git commit -m "chore(notes): lint/build fixes for canvas note type"
```

---

## Task 13: Manual QA (desktop + mobile + public)

- [ ] **Step 1: Two-client editing**

`pnpm dev`. Open the same new canvas note in two browser profiles (both logged in, same company). Verify:
- draw a freehand stroke, a rectangle, a text, paste an image — all appear in the other client within ~1s.
- move/resize/rotate an element — syncs.
- reload one client — scene persists (elements, images, grid).

- [ ] **Step 2: Layers**

- add 3 layers, rename, drag to reorder — z-order changes on canvas.
- hide a layer — its elements vanish locally and on the other client.
- lock a layer — its elements can't be selected/moved.
- set a layer opacity to 40% — elements dim.
- duplicate a layer, merge down, delete a layer with content (confirm dialog).

- [ ] **Step 3: Grid + export**

- toggle grid (Excalidraw toolbar) — persists across reload.
- click PNG and SVG — files download and open correctly.

- [ ] **Step 4: Public live view**

- in the note settings panel, Publish. Open the public URL (`/app/p/notes/:slug`) in a logged-out browser.
- verify the canvas renders, pan/zoom works, editing is impossible (view mode).
- edit in the authed client — the change appears live in the public tab.
- Unpublish — public tab shows "no encontrado" on reload.

- [ ] **Step 5: Mobile (390px) and desktop (1440px)**

- 390px: create a canvas, draw with touch, open the layers bottom sheet, reorder a layer by drag, close the sheet. Toolbar reachable with a thumb.
- 1440px: layers rail docks on the right without covering the canvas toolbar.
- Run the 14-aspect checklist in `docs/ai-context/ui-screen-audit-checklist.md`.

- [ ] **Step 6: Tauri build smoke**

Run: `cd apps/desktop && pnpm tauri build` (or `pnpm tauri dev` if a full build is too slow).
Expected: compiles and the app opens; a canvas note works offline-agnostic (online only, per spec).

- [ ] **Step 7: Mark the spec verified**

In `docs/superpowers/specs/2026-09-10-notes-canvas-design.md` section 14, add `Verified: 2026-09-10 (two-client + public live + mobile + Tauri smoke)` to the Plan B bullet.

```bash
git add docs/superpowers/specs/2026-09-10-notes-canvas-design.md
git commit -m "docs(notes): mark canvas Plan B verified"
```

---

## Self-Review notes (addressed)

- **Spec section 4 (layers):** Tasks 2, 8, 9 — `canvasLayers.js` + panel + editor wiring. Covered.
- **Spec section 5 (realtime):** Tasks 3, 4, 9, 10 — `canvasSync.js`, `SupabaseCanvasSync`, editor + public wiring. `scene.request`/`scene.full`/`scene.delta`/`pointer` all in Task 4.
- **Spec section 7 (frontend files):** every file in the File Structure has a task.
- **Spec section 8 (images):** Task 5 `canvasImages.js`, used in Task 9 `handleChange`.
- **Spec section 9 (export/grid):** Task 5 `canvasExport.js` + Task 9 header buttons; grid via Excalidraw toolbar, persisted through `appStateRef` whitelist.
- **Spec section 10 (mobile):** Task 8 sheet branch + Task 13 step 5.
- **Type consistency:** `deriveScene(elements, layers)`, `assignLayer(el, activeLayerId)`, `reorderLayer(layers, id, toOrder)`, `mergeDown(layers, elements, id) -> {layers, elements}`, `duplicateLayer(layers, elements, id, mintId) -> {layers, elements}`, `SupabaseCanvasSync` methods `notifyLocalChange()` / `broadcastPointer()` / `destroy()` — used consistently across Tasks 2, 4, 9, 10.
- **Gap fixed:** `getPublicNote` must return `note_type` — folded into Task 10 step 2.
- **Gap fixed:** frontend SDK may lack `presignImage` — noted in Task 5 step 1.
