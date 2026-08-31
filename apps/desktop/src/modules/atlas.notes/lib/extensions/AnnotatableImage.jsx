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
      // Percentage (0..100) of the content column. null = full width, for
      // backward compatibility with images inserted before this attribute
      // existed — new inserts get an explicit default (see noteImageUpload.js).
      width: {
        default: null,
        parseHTML: (el) => {
          const raw = el.getAttribute('data-width')
          if (!raw) return null
          const n = Number(raw)
          return Number.isFinite(n) ? n : null
        },
        renderHTML: (attrs) =>
          attrs.width != null ? { 'data-width': String(attrs.width) } : {},
      },
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
