import StarterKit from '@tiptap/starter-kit'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import Color from '@tiptap/extension-color'
import { TextStyle } from '@tiptap/extension-text-style'
import Highlight from '@tiptap/extension-highlight'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Collaboration from '@tiptap/extension-collaboration'
// TipTap v3 renamed CollaborationCursor -> CollaborationCaret (the -cursor
// package stopped at v2 and does not work against v3 core).
import CollaborationCaret from '@tiptap/extension-collaboration-caret'
import { SlashCommand } from './extensions/SlashCommand.jsx'
import { TrailingNode } from './extensions/TrailingNode.js'
import { bodyPlaceholderText } from './placeholderText.js'

export function buildExtensions({
  ydoc, provider, userColor, userName, userId, userAvatarUrl,
  readOnly = false, noteId, token,
}) {
  const base = [
    // Exclude link/underline/image/trailingNode from StarterKit — we register
    // them explicitly below (StarterKit v3 bundles them; adding duplicates
    // triggers a TipTap "Duplicate extension names" warning). history is off
    // because Collaboration provides its own Y.js-backed undo/redo.
    StarterKit.configure({ history: false, link: false, underline: false, trailingNode: false }),
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Link.configure({ openOnClick: false }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Table.configure({ resizable: true }),
    TableRow,
    TableCell,
    TableHeader,
    // Image is intentionally omitted here: AnnotatableImage (added in NoteEditor) overrides
    // the 'image' node. Including both would produce a duplicate-extension warning.
    CharacterCount,
    Placeholder.configure({
      showOnlyCurrent: false,
      placeholder: ({ editor, node }) =>
        bodyPlaceholderText({
          isFirst: editor.state.doc.firstChild === node,
          nodeTypeName: node.type.name,
          isEmpty: node.content.size === 0,
          docChildCount: editor.state.doc.childCount,
        }),
    }),
    TrailingNode,
  ]

  if (!readOnly) {
    base.push(SlashCommand.configure({ noteId, token }))
  }

  if (ydoc && provider) {
    base.push(
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({
        provider,
        user: {
          id: userId ?? null,
          name: userName ?? 'Anonimo',
          color: userColor ?? '#f59e0b',
          avatarUrl: userAvatarUrl ?? null,
        },
      }),
    )
  }

  return base
}
