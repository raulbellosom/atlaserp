// Pointer-based block reordering for TipTap/ProseMirror node views.
// Native HTML5 drag-and-drop does not fire on touch devices, so block
// dragging (e.g. moving an image within a note) is implemented manually
// with pointer events instead, which work uniformly for mouse and touch.

// Finds the top-level block boundary closest to clientY and returns the
// document position to insert before. Falls back to the end of the doc.
export function findDropPosition(view, clientY) {
  const { doc } = view.state
  let pos = doc.content.size
  let found = false
  doc.forEach((node, offset) => {
    if (found) return
    const dom = view.nodeDOM(offset)
    if (!dom?.getBoundingClientRect) return
    const rect = dom.getBoundingClientRect()
    if (clientY < rect.top + rect.height / 2) {
      pos = offset
      found = true
    }
  })
  return pos
}

// Moves the node currently at fromPos to targetPos (a position computed
// against the pre-move document, e.g. from findDropPosition). No-ops if
// the target falls inside the node being moved.
export function moveNode(editor, fromPos, targetPos) {
  const { state, view } = editor
  const node = state.doc.nodeAt(fromPos)
  if (!node) return
  const nodeSize = node.nodeSize
  if (targetPos >= fromPos && targetPos <= fromPos + nodeSize) return

  const tr = state.tr
  tr.delete(fromPos, fromPos + nodeSize)
  const mappedTarget = tr.mapping.map(targetPos)
  tr.insert(mappedTarget, node.type.create(node.attrs, node.content, node.marks))
  view.dispatch(tr)
}
