import { Node, mergeAttributes } from '@tiptap/react'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageAnnotationOverlay } from '../../components/ImageAnnotationOverlay.jsx'

export const AnnotatableImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  // Reordering is handled with a custom pointer-based drag handle (see
  // ImageAnnotationOverlay) instead of native HTML5 drag, which doesn't
  // fire on touch devices.
  draggable: false,
  selectable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      annotations: { default: '[]' },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageAnnotationOverlay)
  },
})
