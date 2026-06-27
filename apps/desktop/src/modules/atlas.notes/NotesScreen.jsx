import { useState, useCallback } from 'react'
import {
  Settings2, Share2, Plus, ArrowLeft, RotateCcw, Trash2, PenLine
} from 'lucide-react'
import { ConfirmDialog } from '@atlas/ui'
import { useNotes, useCreateNote } from './hooks/useNotes.js'
import { useUpdateNote, useTrashNote, useRestoreNote, usePermanentDeleteNote } from './hooks/useNote.js'
import { usePublishNote, useUnpublishNote } from './hooks/useNoteShares.js'
import { NotesSidebar } from './components/NotesSidebar.jsx'
import { NotesList } from './components/NotesList.jsx'
import { NoteEditor } from './components/NoteEditor.jsx'
import { NoteSettingsPanel } from './components/NoteSettingsPanel.jsx'
import { NoteShareModal } from './components/NoteShareModal.jsx'

// mobile: 'sidebar' | 'list' | 'editor'
export default function NotesScreen() {
  const [activeView, setActiveView]         = useState('all')
  const [selectedNote, setSelectedNote]     = useState(null)
  const [rightPanel, setRightPanel]         = useState('editor')
  const [shareOpen, setShareOpen]           = useState(false)
  const [restoreOpen, setRestoreOpen]       = useState(false)
  const [deleteOpen, setDeleteOpen]         = useState(false)
  const [noteToAction, setNoteToAction]     = useState(null)
  const [mobilePanel, setMobilePanel]       = useState('list') // mobile-only

  const queryParams   = buildQueryParams(activeView)
  const { data, isLoading } = useNotes(queryParams)
  const notes         = data?.notes ?? []
  const isTrashView   = activeView === 'trash'

  const createNote    = useCreateNote()
  const updateNote    = useUpdateNote()
  const trashNote     = useTrashNote()
  const restoreNote   = useRestoreNote()
  const permanentDelete = usePermanentDeleteNote()
  const publishNote   = usePublishNote()
  const unpublishNote = useUnpublishNote()

  function handleCreateNote() {
    createNote.mutate(
      { title: 'Nueva nota', content: '' },
      {
        onSuccess: (res) => {
          if (res?.note) {
            setSelectedNote(res.note)
            setRightPanel('editor')
            setMobilePanel('editor')
          }
        },
      },
    )
  }

  const handleUpdateNote = useCallback((patch) => {
    if (!selectedNote) return
    updateNote.mutate(
      { noteId: selectedNote.id, data: patch },
      { onSuccess: (res) => { if (res?.note) setSelectedNote(res.note) } },
    )
  }, [selectedNote, updateNote])

  function handleTrash(note) {
    const target = note ?? selectedNote
    if (!target) return
    trashNote.mutate(target.id, {
      onSuccess: () => {
        if (selectedNote?.id === target.id) {
          setSelectedNote(null)
          setMobilePanel('list')
        }
      },
    })
  }

  function selectNote(note) {
    setSelectedNote(note)
    setRightPanel('editor')
    setMobilePanel('editor')
  }

  function changeView(v) {
    setActiveView(v)
    setSelectedNote(null)
    setMobilePanel('list')
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ── Top bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-gray-100 shrink-0">
        {/* Mobile back navigation */}
        {mobilePanel === 'list' && (
          <button
            onClick={() => setMobilePanel('sidebar')}
            className="md:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        {mobilePanel === 'editor' && (
          <button
            onClick={() => setMobilePanel('list')}
            className="md:hidden flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mr-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}

        {/* Title */}
        <span className="font-semibold text-gray-900 text-sm tracking-tight">
          {selectedNote && mobilePanel === 'editor'
            ? (selectedNote.title || 'Sin titulo')
            : 'Notas'}
        </span>

        <div className="flex-1" />

        {/* Actions */}
        {selectedNote && (mobilePanel === 'editor' || window.innerWidth >= 768) && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShareOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Compartir</span>
            </button>
            <button
              onClick={() => setRightPanel(p => p === 'editor' ? 'settings' : 'editor')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                rightPanel === 'settings'
                  ? 'bg-amber-100 text-amber-700'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{rightPanel === 'settings' ? 'Editor' : 'Ajustes'}</span>
            </button>
          </div>
        )}

        {!isTrashView && (
          <button
            onClick={handleCreateNote}
            disabled={createNote.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white rounded-lg transition-colors disabled:opacity-50 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nueva nota</span>
          </button>
        )}
      </div>

      {/* ── Three-panel body ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Panel 1: Sidebar — hidden on mobile unless mobilePanel === 'sidebar' */}
        <div className={`
          shrink-0 border-r border-gray-100 overflow-y-auto
          w-full md:w-52
          ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'} md:flex flex-col
        `}>
          <NotesSidebar
            activeView={activeView}
            onViewChange={changeView}
          />
        </div>

        {/* Panel 2: Note list — hidden on mobile unless mobilePanel === 'list' */}
        <div className={`
          shrink-0 border-r border-gray-100 overflow-hidden flex flex-col
          w-full md:w-72
          ${mobilePanel === 'list' ? 'flex' : 'hidden'} md:flex
        `}>
          <NotesList
            notes={notes}
            selectedNoteId={selectedNote?.id}
            onSelect={selectNote}
            onTrash={!isTrashView ? handleTrash : undefined}
            isLoading={isLoading}
            showTrash={isTrashView}
          />

          {isTrashView && selectedNote && (
            <div className="px-3 py-2.5 border-t border-gray-100 flex gap-2 shrink-0">
              <button
                onClick={() => { setNoteToAction(selectedNote); setRestoreOpen(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restaurar
              </button>
              <button
                onClick={() => { setNoteToAction(selectedNote); setDeleteOpen(true) }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium py-2 border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Eliminar
              </button>
            </div>
          )}
        </div>

        {/* Panel 3: Editor / Settings — hidden on mobile unless mobilePanel === 'editor' */}
        <div
          className={`
            flex-1 overflow-hidden
            ${mobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-col
          `}
          style={selectedNote?.background_color ? { backgroundColor: selectedNote.background_color } : {}}
        >
          {!selectedNote ? (
            <EmptyEditor onCreateNote={handleCreateNote} isTrash={isTrashView} />
          ) : rightPanel === 'settings' ? (
            <NoteSettingsPanel
              note={selectedNote}
              onUpdate={handleUpdateNote}
              onPublish={() => publishNote.mutate(selectedNote.id, { onSuccess: r => r?.note && setSelectedNote(r.note) })}
              onUnpublish={() => unpublishNote.mutate(selectedNote.id, { onSuccess: r => r?.note && setSelectedNote(r.note) })}
              onTrash={() => handleTrash(selectedNote)}
            />
          ) : (
            <NoteEditor note={selectedNote} readOnly={isTrashView} />
          )}
        </div>
      </div>

      {selectedNote && (
        <NoteShareModal noteId={selectedNote.id} open={shareOpen} onOpenChange={setShareOpen} />
      )}

      <ConfirmDialog
        open={restoreOpen}
        onOpenChange={setRestoreOpen}
        title="Restaurar nota"
        description="La nota se movera de vuelta a tu lista de notas activas."
        confirmLabel="Restaurar"
        onConfirm={() => {
          setRestoreOpen(false)
          if (noteToAction) restoreNote.mutate(noteToAction.id, { onSuccess: () => setSelectedNote(null) })
        }}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Eliminar nota permanentemente"
        description="Esta accion no se puede deshacer. La nota se eliminara para siempre."
        confirmLabel="Eliminar permanentemente"
        onConfirm={() => {
          setDeleteOpen(false)
          if (noteToAction) permanentDelete.mutate(noteToAction.id, { onSuccess: () => setSelectedNote(null) })
        }}
      />
    </div>
  )
}

function EmptyEditor({ onCreateNote, isTrash }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-8 select-none">
      <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
        <PenLine className="w-6 h-6 text-amber-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700 mb-1">
          {isTrash ? 'Papelera' : 'Selecciona una nota'}
        </p>
        <p className="text-xs text-gray-400 leading-relaxed">
          {isTrash
            ? 'Selecciona una nota para restaurarla o eliminarla definitivamente'
            : 'Elige una nota de la lista o crea una nueva'}
        </p>
      </div>
      {!isTrash && (
        <button
          onClick={onCreateNote}
          className="mt-1 flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          Nueva nota
        </button>
      )}
    </div>
  )
}

function buildQueryParams(view) {
  if (view === 'trash')           return { is_trashed: true }
  if (view === 'recent')          return { sort: 'updated_at', limit: 20 }
  if (view === 'shared')          return { shared_with_me: true }
  if (view.startsWith('folder:')) return { folder_id: view.replace('folder:', '') }
  return {}
}
