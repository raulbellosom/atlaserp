// Layer model on top of Excalidraw's flat z-order.
//
// Excalidraw has no concept of layers: the paint order is the order of the
// `elements` array. CanvasEditor keeps the FULL element list as the source of
// truth and feeds <Excalidraw> a DERIVED scene: elements on hidden layers are
// omitted, and the array is sorted by (layer order, element order).
//
// deriveScene never mutates or clones elements — it only filters and reorders —
// so the objects handed to Excalidraw keep their identity and version, and a
// re-render does not look like a scene change.
//
// Layer *lock* and *opacity* are NOT applied at derive time (that would corrupt
// the source of truth when Excalidraw hands the derived scene back on change).
// They are written onto the real elements imperatively via setLayerLocked /
// setLayerOpacity, with the pre-change value remembered in customData so the
// operation is reversible.
//
// Each element carries customData.layerId. `customData` is Excalidraw's
// official extension point and survives updateScene / export / import.

let _seq = 0
function uid() {
  // Layer ids are client-minted and only need to be unique within a scene
  // (not persisted entity ids — those come from the DB).
  _seq += 1
  return `layer-${Date.now().toString(36)}-${_seq.toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// Per-layer accent colour, Illustrator-style. Cycled by layer order.
export const LAYER_PALETTE = [
  '#3b82f6', '#ec4899', '#22c55e', '#f59e0b', '#a855f7',
  '#06b6d4', '#ef4444', '#14b8a6', '#6366f1', '#eab308',
]

export function layerColorForOrder(order = 0) {
  return LAYER_PALETTE[((order % LAYER_PALETTE.length) + LAYER_PALETTE.length) % LAYER_PALETTE.length]
}

export function defaultLayer(name = 'Capa 1', order = 0) {
  return {
    id: uid(),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    order,
    color: layerColorForOrder(order),
  }
}

export function ensureLayers(layers) {
  if (!Array.isArray(layers) || layers.length === 0) return [defaultLayer()]
  // Backfill `color` for scenes saved before per-layer colours existed.
  if (layers.every((l) => l.color)) return layers
  return layers.map((l, i) => (l.color ? l : { ...l, color: layerColorForOrder(l.order ?? i) }))
}

export function assignLayer(element, activeLayerId) {
  const existing = element?.customData?.layerId
  if (existing) return element
  return {
    ...element,
    customData: { ...(element.customData ?? {}), layerId: activeLayerId },
  }
}

// Excalidraw tracks changes per element by an integer `version`. When WE mutate
// an element outside Excalidraw (layer lock / opacity / move-to-layer), we must
// bump it ourselves or the change never reconciles to other clients.
export function bumpVersion(el) {
  return {
    ...el,
    version: (el.version ?? 0) + 1,
    versionNonce: (Math.random() * 2 ** 31) | 0,
    updated: Date.now(),
  }
}

function layerIndexById(layers) {
  const map = new Map()
  const sorted = [...layers].sort((a, b) => a.order - b.order)
  sorted.forEach((l, i) => map.set(l.id, { layer: l, rank: i }))
  return { map, sorted }
}

// The scene handed to <Excalidraw>: hidden-layer elements removed, ordered by
// (layer order, element order). Returns the SAME element object references.
export function deriveScene(elements, layers) {
  const safeLayers = ensureLayers(layers)
  const { map, sorted } = layerIndexById(safeLayers)
  const fallbackId = sorted[0].id

  const withRank = elements
    .map((el, elIndex) => {
      const hit = map.get(el?.customData?.layerId) ?? map.get(fallbackId)
      return { el, elIndex, layer: hit.layer, rank: hit.rank }
    })
    .filter(({ el, layer }) => el && layer.visible !== false && !el.customData?.hidden)

  withRank.sort((a, b) => a.rank - b.rank || a.elIndex - b.elIndex)
  return withRank.map(({ el }) => el)
}

// Elements grouped by their layer id (deleted ones dropped), preserving scene
// order. Used by the layers panel to list a layer's shapes when expanded.
export function groupElementsByLayer(elements, layers) {
  const known = new Set(ensureLayers(layers).map((l) => l.id))
  const fallbackId = [...ensureLayers(layers)].sort((a, b) => a.order - b.order)[0].id
  const out = {}
  for (const el of elements) {
    if (!el || el.isDeleted) continue
    const id = known.has(el.customData?.layerId) ? el.customData.layerId : fallbackId
    ;(out[id] ??= []).push(el)
  }
  return out
}

const TYPE_LABEL = {
  rectangle: 'Rectangulo',
  ellipse: 'Elipse',
  diamond: 'Diamante',
  arrow: 'Flecha',
  line: 'Linea',
  freedraw: 'Trazo',
  image: 'Imagen',
  frame: 'Marco',
  text: 'Texto',
}

export function elementLabel(el) {
  if (!el) return 'Elemento'
  if (el.type === 'text') {
    const t = (el.text ?? '').trim().replace(/\s+/g, ' ')
    return t ? `Texto: ${t.slice(0, 24)}${t.length > 24 ? '…' : ''}` : 'Texto'
  }
  return TYPE_LABEL[el.type] ?? (el.type ? el.type[0].toUpperCase() + el.type.slice(1) : 'Elemento')
}

// ── single-element operations (from the expanded layer view) ──────────────

export function setElementHidden(elements, id, hidden) {
  return elements.map((el) =>
    el.id === id
      ? bumpVersion({ ...el, customData: { ...el.customData, hidden: hidden || undefined } })
      : el,
  )
}

export function setElementLocked(elements, id, locked) {
  return elements.map((el) => (el.id === id ? bumpVersion({ ...el, locked }) : el))
}

export function deleteElement(elements, id) {
  return elements.map((el) => (el.id === id ? bumpVersion({ ...el, isDeleted: true }) : el))
}

// Merge Excalidraw's post-change list (which only ever contains visible-layer
// elements) back into the full list by re-appending the elements that live on
// currently-hidden layers. Order does not matter — deriveScene re-sorts.
export function mergeVisibleBack(prevFull, nextVisible, layers) {
  const hiddenLayerIds = new Set(
    ensureLayers(layers)
      .filter((l) => l.visible === false)
      .map((l) => l.id),
  )
  const nextIds = new Set(nextVisible.map((el) => el.id))
  // Anything deriveScene omits (hidden layer OR individually hidden element) is
  // absent from what Excalidraw hands back — carry those forward from prevFull.
  const carried = prevFull.filter(
    (el) =>
      !nextIds.has(el.id) &&
      (hiddenLayerIds.has(el?.customData?.layerId) || el?.customData?.hidden),
  )
  return carried.length ? [...nextVisible, ...carried] : nextVisible
}

// Write a layer's opacity onto its elements. `baseOpacity` (the element's own
// opacity before any layer dimming) is stashed in customData so sliding back to
// 100% restores the per-element values exactly.
export function setLayerOpacity(elements, layerId, opacity) {
  return elements.map((el) => {
    if (el?.customData?.layerId !== layerId) return el
    const base =
      el.customData?.baseOpacity ?? (typeof el.opacity === 'number' ? el.opacity : 100)
    if (opacity >= 1) {
      const custom = { ...el.customData }
      delete custom.baseOpacity
      return bumpVersion({ ...el, opacity: base, customData: custom })
    }
    return bumpVersion({
      ...el,
      opacity: Math.round(base * opacity),
      customData: { ...el.customData, baseOpacity: base },
    })
  })
}

// Write a layer's locked state onto its elements. Unlocking only releases the
// elements this layer locked (customData.lockedByLayer), never ones the user
// locked individually.
export function setLayerLocked(elements, layerId, locked) {
  return elements.map((el) => {
    if (el?.customData?.layerId !== layerId) return el
    if (locked) {
      if (el.locked) return el // already locked (by the user) — don't claim it
      return bumpVersion({ ...el, locked: true, customData: { ...el.customData, lockedByLayer: true } })
    }
    if (el.customData?.lockedByLayer) {
      const custom = { ...el.customData }
      delete custom.lockedByLayer
      return bumpVersion({ ...el, locked: false, customData: custom })
    }
    return el
  })
}

// Reassign the given element ids to a layer (used by "move selection to layer").
export function moveElementsToLayer(elements, idSet, layerId) {
  return elements.map((el) =>
    idSet.has(el.id)
      ? bumpVersion({ ...el, customData: { ...el.customData, layerId } })
      : el,
  )
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
