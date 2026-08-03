import { Extension } from '@tiptap/core'
import Suggestion from '@tiptap/suggestion'
import { ReactRenderer } from '@tiptap/react'
import {
  Heading1, Heading2, Heading3, List, ListOrdered, ListChecks,
  Quote, Code2, Table2, ImagePlus, PenLine,
} from 'lucide-react'
import { SlashCommandMenu } from '../../components/SlashCommandMenu.jsx'
import { pickAndUploadNoteImage } from '../noteImageUpload.js'

// Notion-style "/" command list. Each `run` reuses the exact same editor
// command the equivalent NoteToolbar.jsx button already calls — no
// duplicated block-insertion logic.
function buildItems({ noteId, token }) {
  return [
    { title: 'Titulo 1', icon: Heading1, keywords: ['heading', 'h1', 'titulo'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
    { title: 'Titulo 2', icon: Heading2, keywords: ['heading', 'h2', 'titulo'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
    { title: 'Titulo 3', icon: Heading3, keywords: ['heading', 'h3', 'titulo'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
    { title: 'Lista con vinetas', icon: List, keywords: ['bullet', 'lista'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
    { title: 'Lista numerada', icon: ListOrdered, keywords: ['ordered', 'numerada', 'lista'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
    { title: 'Lista de tareas', icon: ListChecks, keywords: ['task', 'checklist', 'pendientes'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
    { title: 'Cita', icon: Quote, keywords: ['quote', 'blockquote'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
    { title: 'Bloque de codigo', icon: Code2, keywords: ['code', 'codigo'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
    { title: 'Tabla', icon: Table2, keywords: ['table', 'tabla'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { title: 'Imagen', icon: ImagePlus, keywords: ['image', 'imagen', 'foto'],
      run: (editor, range) => { editor.chain().focus().deleteRange(range).run(); pickAndUploadNoteImage({ editor, noteId, token }) } },
    { title: 'Canvas de dibujo', icon: PenLine, keywords: ['drawing', 'dibujo', 'canvas'],
      run: (editor, range) => editor.chain().focus().deleteRange(range).insertDrawingBlock().run() },
  ]
}

export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return { noteId: null, token: null }
  },

  addProseMirrorPlugins() {
    const { noteId, token } = this.options
    const items = buildItems({ noteId, token })

    return [
      Suggestion({
        editor: this.editor,
        char: '/',
        startOfLine: true,
        allow: ({ editor }) => !editor.isActive('codeBlock') && !editor.isActive('table'),
        items: ({ query }) => {
          const q = query.toLowerCase()
          if (!q) return items
          return items.filter(item =>
            item.title.toLowerCase().includes(q) || item.keywords.some(k => k.includes(q)),
          )
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => {
          let component
          let unmount

          return {
            onStart: (props) => {
              component = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor })
              unmount = props.mount(component.element)
            },
            onUpdate(props) {
              component.updateProps(props)
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                unmount?.()
                return true
              }
              return component.ref?.onKeyDown(props) ?? false
            },
            onExit() {
              unmount?.()
              component.destroy()
            },
          }
        },
      }),
    ]
  },
})
