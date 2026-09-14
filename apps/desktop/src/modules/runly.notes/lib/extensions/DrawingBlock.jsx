import { Node, mergeAttributes } from '@tiptap/react'
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
