import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

/**
 * Pure predicate: does the document need an empty trailing node appended?
 * @param {string|null|undefined} lastNodeTypeName - doc.lastChild?.type.name
 * @param {string[]} notAfter - node type names after which NO trailing node is needed
 */
export function needsTrailingNode(lastNodeTypeName, notAfter) {
  if (!lastNodeTypeName) return true
  return !notAfter.includes(lastNodeTypeName)
}

/**
 * Ensures the document always ends with an empty paragraph, so the caret can
 * land below a trailing atom (image, drawing) and a fresh note has a body
 * block for the placeholder to target.
 */
export const TrailingNode = Extension.create({
  name: 'trailingNode',

  addOptions() {
    return { node: 'paragraph', notAfter: ['paragraph'] }
  },

  addProseMirrorPlugins() {
    const pluginKey = new PluginKey(this.name)
    const notAfter = this.options.notAfter
    const nodeName = this.options.node
    const editor = this.editor

    return [
      new Plugin({
        key: pluginKey,
        appendTransaction: (_transactions, _oldState, newState) => {
          if (editor && editor.isEditable === false) return
          const { doc, tr, schema } = newState
          if (!needsTrailingNode(doc.lastChild?.type.name, notAfter)) return
          const type = schema.nodes[nodeName]
          if (!type) return
          return tr.insert(doc.content.size, type.create())
        },
      }),
    ]
  },
})
