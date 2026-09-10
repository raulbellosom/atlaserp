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
  // Layer ids are client-minted and only need to be unique within a scene
  // (not persisted entity ids — those come from the DB).
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

  withRank.sort((a, b) => a.rank - b.rank || a.elIndex - b.elIndex)

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
