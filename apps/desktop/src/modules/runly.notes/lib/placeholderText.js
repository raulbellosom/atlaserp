/**
 * Placeholder text for a block in the notes editor.
 * @param {object} arg
 * @param {boolean} arg.isFirst        - is this the document's first child (the title line)
 * @param {string}  arg.nodeTypeName   - node.type.name
 * @param {boolean} arg.isEmpty        - node has no content
 * @param {number}  arg.docChildCount  - editor.state.doc.childCount
 * @returns {string} placeholder text ('' = no placeholder)
 */
export function bodyPlaceholderText({ isFirst, nodeTypeName, isEmpty, docChildCount }) {
  if (isFirst) return 'Sin título'
  if (nodeTypeName === 'heading') return 'Título…'
  if (nodeTypeName === 'paragraph' && isEmpty && docChildCount <= 2) {
    return 'Empieza a escribir, o pulsa «/» para comandos'
  }
  return ''
}
