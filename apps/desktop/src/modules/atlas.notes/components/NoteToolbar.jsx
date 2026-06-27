import { useCurrentEditor } from '@tiptap/react'
import { Undo2, Redo2, Link2, PenLine, Table2 } from 'lucide-react'

const ToolbarButton = ({ onClick, active, disabled, title, children }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`px-2 py-1 rounded text-sm transition-colors ${
      active
        ? 'bg-amber-100 text-amber-700 font-semibold'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    } disabled:opacity-30 disabled:cursor-not-allowed`}
  >
    {children}
  </button>
)

const Divider = () => <div className="h-5 w-px bg-gray-200 mx-1" />

export function NoteToolbar() {
  const { editor } = useCurrentEditor()
  if (!editor) return null

  return (
    <div className="flex items-center gap-0.5 px-3 py-1.5 border-b border-gray-200 bg-white flex-wrap sticky top-0 z-10">
      {/* History */}
      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Deshacer">
        <Undo2 className="w-3.5 h-3.5" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Rehacer">
        <Redo2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Headings */}
      {[1, 2, 3].map(l => (
        <ToolbarButton
          key={l}
          onClick={() => editor.chain().focus().toggleHeading({ level: l }).run()}
          active={editor.isActive('heading', { level: l })}
          title={`Titulo ${l}`}
        >
          H{l}
        </ToolbarButton>
      ))}

      <Divider />

      {/* Marks */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBold().run()}
        active={editor.isActive('bold')}
        title="Negrita"
      >
        <strong>N</strong>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleItalic().run()}
        active={editor.isActive('italic')}
        title="Cursiva"
      >
        <em>C</em>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        active={editor.isActive('underline')}
        title="Subrayado"
      >
        <u>S</u>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleStrike().run()}
        active={editor.isActive('strike')}
        title="Tachado"
      >
        <s>T</s>
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleCode().run()}
        active={editor.isActive('code')}
        title="Codigo"
      >
        {'<>'}
      </ToolbarButton>

      <Divider />

      {/* Text colors */}
      <div className="relative flex items-center gap-1" title="Color de texto">
        <span className="text-xs text-gray-500">A</span>
        {['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#1a1a1a'].map(c => (
          <button
            key={c}
            onClick={() => editor.chain().focus().setColor(c).run()}
            className={`w-4 h-4 rounded-full border-2 ${
              editor.isActive('textStyle', { color: c }) ? 'border-amber-500' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <button
          onClick={() => editor.chain().focus().unsetColor().run()}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
          title="Sin color de texto"
        >
          &#x2715;
        </button>
      </div>

      <Divider />

      {/* Highlights */}
      <div className="relative flex items-center gap-1" title="Resaltado">
        <span className="text-xs text-gray-500">&#x25AE;</span>
        {['#fef08a', '#bbf7d0', '#bfdbfe', '#f5d0fe', '#fed7aa'].map(c => (
          <button
            key={c}
            onClick={() => editor.chain().focus().toggleHighlight({ color: c }).run()}
            className={`w-4 h-4 rounded border-2 ${
              editor.isActive('highlight', { color: c }) ? 'border-amber-500' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
            title={c}
          />
        ))}
        <button
          onClick={() => editor.chain().focus().unsetHighlight().run()}
          className="text-xs text-gray-400 hover:text-gray-600 px-1"
          title="Sin resaltado"
        >
          &#x2715;
        </button>
      </div>

      <Divider />

      {/* Lists */}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        active={editor.isActive('bulletList')}
        title="Lista de viñetas"
      >
        &bull; Lista
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        active={editor.isActive('orderedList')}
        title="Lista numerada"
      >
        1. Lista
      </ToolbarButton>
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        active={editor.isActive('taskList')}
        title="Lista de tareas"
      >
        &#x2611; Tareas
      </ToolbarButton>

      <Divider />

      {/* Blocks */}
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Cita">
        Cita
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Bloque de codigo">
        {'{ }'}
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="Insertar tabla">
        <Table2 className="w-3.5 h-3.5" />
      </ToolbarButton>

      <Divider />

      {/* Custom blocks */}
      <ToolbarButton onClick={() => editor.chain().focus().insertDrawingBlock().run()} title="Insertar dibujo">
        <PenLine className="w-3.5 h-3.5" />
      </ToolbarButton>

      {/* Link */}
      <ToolbarButton
        onClick={() => {
          const currentHref = editor.getAttributes('link').href ?? ''
          editor.chain().focus().setLink({ href: currentHref }).run()
        }}
        active={editor.isActive('link')}
        title="Enlace"
      >
        <Link2 className="w-3.5 h-3.5" />
      </ToolbarButton>
    </div>
  )
}
